use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const PROFILES_FILE: &str = "speaker_profiles.json";
const SIMILARITY_THRESHOLD: f32 = 0.85;
const MAX_EMBEDDINGS_PER_PROFILE: usize = 5;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeakerProfile {
    pub id: String,
    /// User-assigned name. Empty string means unnamed — display `auto_name` instead.
    pub name: String,
    /// Auto-generated label, e.g. "说话人 1".
    pub auto_name: String,
    /// Up to MAX_EMBEDDINGS_PER_PROFILE representative d-vectors (rolling window).
    #[serde(default)]
    pub embeddings: Vec<Vec<f32>>,
    pub created_at: u64,
    pub last_seen_at: u64,
    pub recording_count: u64,
}

impl SpeakerProfile {
    /// The display name: user name if set, otherwise auto_name.
    pub fn display_name(&self) -> &str {
        if self.name.is_empty() {
            &self.auto_name
        } else {
            &self.name
        }
    }
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn profiles_path(app: &AppHandle) -> std::path::PathBuf {
    app.path()
        .app_data_dir()
        .expect("app_data_dir unavailable")
        .join(PROFILES_FILE)
}

pub fn load_profiles(app: &AppHandle) -> Vec<SpeakerProfile> {
    let path = profiles_path(app);
    match std::fs::read_to_string(&path) {
        Ok(json) => serde_json::from_str(&json).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

fn save_profiles(app: &AppHandle, profiles: &[SpeakerProfile]) {
    let path = profiles_path(app);
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(profiles) {
        let _ = std::fs::write(path, json);
    }
}

/// Cosine similarity between two vectors. Returns 0.0 if either vector has zero norm.
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }
    (dot / (norm_a * norm_b)).clamp(-1.0, 1.0)
}

/// Maximum similarity between a query embedding and all stored embeddings in a profile.
fn max_similarity(query: &[f32], profile: &SpeakerProfile) -> f32 {
    profile
        .embeddings
        .iter()
        .map(|e| cosine_similarity(query, e))
        .fold(0.0f32, f32::max)
}

/// Given a list of embeddings (one per SPEAKER_XX key) from a single recording,
/// match each against existing profiles or register new ones.
///
/// Returns a mapping: SPEAKER_XX label → display name (for use in transcript).
pub fn identify_or_register_all(
    app: &AppHandle,
    speaker_embeddings: &HashMap<String, Vec<f32>>,
) -> HashMap<String, String> {
    if speaker_embeddings.is_empty() {
        return HashMap::new();
    }

    let mut profiles = load_profiles(app);
    let now = now_secs();
    let mut mapping: HashMap<String, String> = HashMap::new();

    // Sort speaker labels for deterministic ordering (SPEAKER_00 before SPEAKER_01, etc.)
    let mut labels: Vec<&String> = speaker_embeddings.keys().collect();
    labels.sort();

    for label in labels {
        let embedding = &speaker_embeddings[label];

        // Find best matching profile
        let best = profiles
            .iter_mut()
            .enumerate()
            .filter(|(_, p)| !p.embeddings.is_empty())
            .map(|(i, p)| (i, max_similarity(embedding, p)))
            .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));

        if let Some((idx, sim)) = best {
            if sim >= SIMILARITY_THRESHOLD {
                // Matched — update profile stats and store new embedding sample
                let profile = &mut profiles[idx];
                profile.last_seen_at = now;
                profile.recording_count += 1;
                if profile.embeddings.len() >= MAX_EMBEDDINGS_PER_PROFILE {
                    profile.embeddings.remove(0);
                }
                profile.embeddings.push(embedding.clone());
                mapping.insert(label.clone(), profile.display_name().to_string());
                continue;
            }
        }

        // No match — register new profile
        let auto_number = profiles.len() + 1;
        let new_profile = SpeakerProfile {
            id: Uuid::new_v4().to_string(),
            name: String::new(),
            auto_name: format!("说话人 {}", auto_number),
            embeddings: vec![embedding.clone()],
            created_at: now,
            last_seen_at: now,
            recording_count: 1,
        };
        mapping.insert(label.clone(), new_profile.auto_name.clone());
        profiles.push(new_profile);
    }

    save_profiles(app, &profiles);
    mapping
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_speaker_profiles(app: AppHandle) -> Vec<SpeakerProfile> {
    load_profiles(&app)
}

#[tauri::command]
pub fn update_speaker_name(app: AppHandle, id: String, name: String) -> Result<(), String> {
    let mut profiles = load_profiles(&app);
    let profile = profiles
        .iter_mut()
        .find(|p| p.id == id)
        .ok_or_else(|| format!("Speaker profile not found: {}", id))?;
    profile.name = name.trim().to_string();
    save_profiles(&app, &profiles);
    Ok(())
}

#[tauri::command]
pub fn delete_speaker_profile(app: AppHandle, id: String) -> Result<(), String> {
    let mut profiles = load_profiles(&app);
    let before = profiles.len();
    profiles.retain(|p| p.id != id);
    if profiles.len() == before {
        return Err(format!("Speaker profile not found: {}", id));
    }
    save_profiles(&app, &profiles);
    Ok(())
}

/// Merge `source_id` into `target_id`: move embeddings (up to cap), accumulate
/// recording_count, then delete the source profile.
#[tauri::command]
pub fn merge_speaker_profiles(
    app: AppHandle,
    source_id: String,
    target_id: String,
) -> Result<(), String> {
    if source_id == target_id {
        return Err("Cannot merge a profile into itself".to_string());
    }

    let mut profiles = load_profiles(&app);

    let source_idx = profiles
        .iter()
        .position(|p| p.id == source_id)
        .ok_or_else(|| format!("Source profile not found: {}", source_id))?;
    let target_idx = profiles
        .iter()
        .position(|p| p.id == target_id)
        .ok_or_else(|| format!("Target profile not found: {}", target_id))?;

    // Extract data from source before mutating
    let source_embeddings = profiles[source_idx].embeddings.clone();
    let source_count = profiles[source_idx].recording_count;
    let source_last_seen = profiles[source_idx].last_seen_at;

    {
        let target = &mut profiles[target_idx];
        for emb in source_embeddings {
            if target.embeddings.len() >= MAX_EMBEDDINGS_PER_PROFILE {
                target.embeddings.remove(0);
            }
            target.embeddings.push(emb);
        }
        target.recording_count += source_count;
        target.last_seen_at = target.last_seen_at.max(source_last_seen);
    }

    profiles.remove(source_idx);
    save_profiles(&app, &profiles);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cosine_identical() {
        let v = vec![1.0f32, 0.0, 0.0];
        assert!((cosine_similarity(&v, &v) - 1.0).abs() < 1e-6);
    }

    #[test]
    fn cosine_orthogonal() {
        let a = vec![1.0f32, 0.0];
        let b = vec![0.0f32, 1.0];
        assert!(cosine_similarity(&a, &b).abs() < 1e-6);
    }

    #[test]
    fn cosine_opposite() {
        let a = vec![1.0f32, 0.0];
        let b = vec![-1.0f32, 0.0];
        assert!((cosine_similarity(&a, &b) + 1.0).abs() < 1e-6);
    }

    #[test]
    fn cosine_zero_vector() {
        let a = vec![0.0f32, 0.0];
        let b = vec![1.0f32, 0.0];
        assert_eq!(cosine_similarity(&a, &b), 0.0);
    }

    #[test]
    fn cosine_length_mismatch() {
        let a = vec![1.0f32];
        let b = vec![1.0f32, 0.0];
        assert_eq!(cosine_similarity(&a, &b), 0.0);
    }
}
