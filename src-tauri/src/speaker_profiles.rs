use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const PROFILES_FILE: &str = "speaker_profiles.json";
const SIMILARITY_THRESHOLD: f32 = 0.85;
const MAX_EMBEDDINGS_PER_PROFILE: usize = 5;

/// File-level lock to serialize load-modify-save cycles.
/// Prevents concurrent recordings from corrupting the profiles file.
static PROFILES_LOCK: Mutex<()> = Mutex::new(());

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeakerProfile {
    pub id: String,
    /// User-assigned name. Empty string means unnamed — display `auto_name` instead.
    pub name: String,
    /// Auto-generated label, e.g. "说话人 1".
    pub auto_name: String,
    /// Up to MAX_EMBEDDINGS_PER_PROFILE representative d-vectors (rolling window).
    /// Persisted to disk for matching; stripped before sending to the frontend.
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

    /// Add an embedding, enforcing the rolling window cap.
    fn add_embedding(&mut self, embedding: Vec<f32>) {
        if self.embeddings.len() >= MAX_EMBEDDINGS_PER_PROFILE {
            self.embeddings.remove(0);
        }
        self.embeddings.push(embedding);
    }
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn profiles_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    if let Ok(cfg) = crate::config::load_config(app) {
        if !cfg.workspace_path.is_empty() {
            let dir = crate::identity::identity_dir(&cfg.workspace_path).join("raw");
            std::fs::create_dir_all(&dir)
                .map_err(|e| format!("创建 identity/raw 目录失败: {}", e))?;
            return Ok(dir.join(PROFILES_FILE));
        }
    }
    // Fallback: app_data_dir (workspace not configured yet)
    app.path()
        .app_data_dir()
        .map(|p| p.join(PROFILES_FILE))
        .map_err(|e| format!("app_data_dir unavailable: {}", e))
}

pub fn load_profiles(app: &AppHandle) -> Vec<SpeakerProfile> {
    let path = match profiles_path(app) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[speaker_profiles] {}", e);
            return Vec::new();
        }
    };
    // Migration: if new workspace path doesn't have the file yet, copy from old app_data_dir
    if !path.exists() {
        if let Ok(old_path) = app.path().app_data_dir().map(|p| p.join(PROFILES_FILE)) {
            if old_path.exists() && old_path != path {
                let _ = std::fs::copy(&old_path, &path);
            }
        }
    }
    match std::fs::read_to_string(&path) {
        Ok(json) => {
            let result: Result<Vec<SpeakerProfile>, _> = serde_json::from_str(&json);
            match result {
                Ok(profiles) => profiles,
                Err(e) => {
                    eprintln!("[speaker_profiles] Failed to parse {}: {}", PROFILES_FILE, e);
                    Vec::new()
                }
            }
        }
        Err(_) => Vec::new(),
    }
}

fn save_profiles(app: &AppHandle, profiles: &[SpeakerProfile]) -> Result<(), String> {
    let path = profiles_path(app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create profiles dir: {}", e))?;
    }
    let json = serde_json::to_string_pretty(profiles)
        .map_err(|e| format!("Failed to serialize profiles: {}", e))?;
    std::fs::write(&path, json)
        .map_err(|e| format!("Failed to write {}: {}", PROFILES_FILE, e))
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

/// Find the next available auto-number by scanning existing auto_names.
/// This avoids duplicates after deletions (e.g., deleting "说话人 2" then adding a new speaker).
fn next_auto_number(profiles: &[SpeakerProfile]) -> usize {
    let max_num = profiles
        .iter()
        .filter_map(|p| {
            p.auto_name
                .strip_prefix("说话人 ")
                .and_then(|s| s.parse::<usize>().ok())
        })
        .max()
        .unwrap_or(0);
    max_num + 1
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

    // Acquire lock for the entire load-modify-save cycle
    let _guard = PROFILES_LOCK.lock().unwrap_or_else(|e| {
        eprintln!("[speaker_profiles] Lock poisoned: {}", e);
        e.into_inner()
    });

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
                profile.add_embedding(embedding.clone());
                mapping.insert(label.clone(), profile.display_name().to_string());
                continue;
            }
        }

        // No match — register new profile
        let auto_number = next_auto_number(&profiles);
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

    if let Err(e) = save_profiles(app, &profiles) {
        eprintln!("[speaker_profiles] {}", e);
    }
    mapping
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_speaker_profiles(app: AppHandle) -> Vec<SpeakerProfile> {
    let _guard = PROFILES_LOCK.lock().unwrap_or_else(|e| {
        eprintln!("[speaker_profiles] Lock poisoned: {}", e);
        e.into_inner()
    });
    load_profiles(&app)
        .into_iter()
        .map(|mut p| {
            p.embeddings = Vec::new();
            p
        })
        .collect()
}

#[tauri::command]
pub fn update_speaker_name(app: AppHandle, id: String, name: String) -> Result<(), String> {
    let _guard = PROFILES_LOCK.lock().unwrap_or_else(|e| {
        eprintln!("[speaker_profiles] Lock poisoned: {}", e);
        e.into_inner()
    });

    let mut profiles = load_profiles(&app);
    let profile = profiles
        .iter_mut()
        .find(|p| p.id == id)
        .ok_or_else(|| format!("Speaker profile not found: {}", id))?;
    profile.name = name.trim().to_string();
    save_profiles(&app, &profiles)
}

#[tauri::command]
pub fn delete_speaker_profile(app: AppHandle, id: String) -> Result<(), String> {
    let _guard = PROFILES_LOCK.lock().unwrap_or_else(|e| {
        eprintln!("[speaker_profiles] Lock poisoned: {}", e);
        e.into_inner()
    });

    let mut profiles = load_profiles(&app);
    let before = profiles.len();
    profiles.retain(|p| p.id != id);
    if profiles.len() == before {
        return Err(format!("Speaker profile not found: {}", id));
    }
    save_profiles(&app, &profiles)
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

    let _guard = PROFILES_LOCK.lock().unwrap_or_else(|e| {
        eprintln!("[speaker_profiles] Lock poisoned: {}", e);
        e.into_inner()
    });

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
            target.add_embedding(emb);
        }
        target.recording_count += source_count;
        target.last_seen_at = target.last_seen_at.max(source_last_seen);
    }

    profiles.remove(source_idx);
    save_profiles(&app, &profiles)
}

/// Update all profiles whose id matches `old_id` to use `new_id`.
/// Used when merging identity files to keep speaker_id references consistent.
pub fn reassign_speaker_id(app: &AppHandle, old_id: &str, new_id: &str) -> Result<(), String> {
    let _guard = PROFILES_LOCK.lock().unwrap_or_else(|e| {
        eprintln!("[speaker_profiles] Lock poisoned: {}", e);
        e.into_inner()
    });
    let mut profiles = load_profiles(app);
    let mut changed = false;
    for p in &mut profiles {
        if p.id == old_id {
            p.id = new_id.to_string();
            changed = true;
        }
    }
    if changed {
        save_profiles(app, &profiles)?;
    }
    Ok(())
}
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

    #[test]
    fn next_auto_number_skips_gaps() {
        let profiles = vec![
            SpeakerProfile {
                id: "1".into(), name: String::new(), auto_name: "说话人 1".into(),
                embeddings: vec![], created_at: 0, last_seen_at: 0, recording_count: 1,
            },
            SpeakerProfile {
                id: "3".into(), name: String::new(), auto_name: "说话人 5".into(),
                embeddings: vec![], created_at: 0, last_seen_at: 0, recording_count: 1,
            },
        ];
        // Max existing is 5, so next should be 6 (not profiles.len()+1=3)
        assert_eq!(next_auto_number(&profiles), 6);
    }

    #[test]
    fn next_auto_number_empty() {
        assert_eq!(next_auto_number(&[]), 1);
    }

    #[test]
    fn add_embedding_rolling_window() {
        let mut profile = SpeakerProfile {
            id: "1".into(), name: String::new(), auto_name: "说话人 1".into(),
            embeddings: vec![], created_at: 0, last_seen_at: 0, recording_count: 0,
        };
        for i in 0..7 {
            profile.add_embedding(vec![i as f32]);
        }
        assert_eq!(profile.embeddings.len(), MAX_EMBEDDINGS_PER_PROFILE);
        // Should contain the last 5: [2, 3, 4, 5, 6]
        assert_eq!(profile.embeddings[0], vec![2.0f32]);
        assert_eq!(profile.embeddings[4], vec![6.0f32]);
    }
}
