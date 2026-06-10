// src-tauri/src/ai_plan.rs
//
// Pure planning layer for AI processing.
// Computes what will happen without side-effects (except reading the material file).
// Enables zero-mock unit testing of classification, prompt building, and dedup logic.

use crate::digest::compute_source_digest;
use crate::frontmatter::entry_has_digest;
use std::path::Path;

// ── Types ───────────────────────────────────────

#[derive(Debug, Clone, PartialEq)]
pub enum MaterialType {
    Audio,
    Text,
    Image,
    Other,
}

/// Describes what the AI processor will do — produced by pure planning logic.
#[derive(Debug, Clone)]
pub struct ProcessingPlan {
    pub material_path: String,
    pub year_month: String,
    pub material_type: MaterialType,
    pub source_digest: String,
    pub is_duplicate: bool,
    pub user_prompt: String,
    pub model: String,
}

// ── Pure functions ──────────────────────────────

pub fn classify_material(path: &str) -> MaterialType {
    let ext = Path::new(path)
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_ascii_lowercase();
    match ext.as_str() {
        "m4a" | "wav" | "mp3" | "aac" | "ogg" | "flac" | "webm" => MaterialType::Audio,
        "txt" | "md" | "pdf" | "docx" | "doc" => MaterialType::Text,
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp" => MaterialType::Image,
        _ => MaterialType::Other,
    }
}

/// Build the default user prompt from a material path.
pub fn build_default_user_prompt(
    material_path: &str,
    year_month: &str,
    note: Option<&str>,
) -> String {
    let filename = Path::new(material_path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let relative_ref = format!("{}/raw/{}", year_month, filename);
    let note_suffix = note
        .filter(|n| !n.trim().is_empty())
        .map(|n| format!(" {}", n.trim()))
        .unwrap_or_default();
    format!("分析和处理 @{}{}", relative_ref, note_suffix)
}

/// Plan processing for a material file. Reads the material and scans existing entries.
/// Returns a plan describing what would happen, or None if the material cannot be read.
pub fn plan_processing(
    material_path: &str,
    year_month: &str,
    note: Option<&str>,
    prompt_text: Option<&str>,
    model: &str,
    existing_entry_contents: &[(&str, &str)], // (filename, content) pairs
) -> Option<ProcessingPlan> {
    let material_bytes = std::fs::read(material_path).ok()?;
    let material_type = classify_material(material_path);
    let source_digest = compute_source_digest(&material_bytes, "v1", model);

    let is_duplicate = existing_entry_contents
        .iter()
        .any(|(_, content)| entry_has_digest(content, &source_digest));

    let user_prompt = if let Some(pt) = prompt_text.filter(|s| !s.trim().is_empty()) {
        pt.to_string()
    } else {
        build_default_user_prompt(material_path, year_month, note)
    };

    Some(ProcessingPlan {
        material_path: material_path.to_string(),
        year_month: year_month.to_string(),
        material_type,
        source_digest,
        is_duplicate,
        user_prompt,
        model: model.to_string(),
    })
}

// ── Tests ───────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classify_audio_formats() {
        assert_eq!(classify_material("recording.m4a"), MaterialType::Audio);
        assert_eq!(classify_material("meeting.wav"), MaterialType::Audio);
        assert_eq!(classify_material("voice.mp3"), MaterialType::Audio);
        assert_eq!(classify_material("stream.webm"), MaterialType::Audio);
    }

    #[test]
    fn classify_text_formats() {
        assert_eq!(classify_material("notes.txt"), MaterialType::Text);
        assert_eq!(classify_material("report.pdf"), MaterialType::Text);
        assert_eq!(classify_material("doc.docx"), MaterialType::Text);
        assert_eq!(classify_material("readme.md"), MaterialType::Text);
    }

    #[test]
    fn classify_image_formats() {
        assert_eq!(classify_material("photo.png"), MaterialType::Image);
        assert_eq!(classify_material("scan.jpg"), MaterialType::Image);
        assert_eq!(classify_material("banner.webp"), MaterialType::Image);
    }

    #[test]
    fn classify_unknown() {
        assert_eq!(classify_material("data.csv"), MaterialType::Other);
        assert_eq!(classify_material("no-extension"), MaterialType::Other);
    }

    #[test]
    fn default_prompt_includes_path() {
        let prompt = build_default_user_prompt("/path/to/file.txt", "2603", None);
        assert!(prompt.contains("2603/raw/file.txt"));
        assert!(prompt.starts_with("分析和处理"));
    }

    #[test]
    fn default_prompt_appends_note() {
        let prompt = build_default_user_prompt("/path/file.m4a", "2603", Some("会议录音"));
        assert!(prompt.contains("会议录音"));
    }

    #[test]
    fn custom_prompt_overrides_default() {
        let plan = plan_processing_with_mock_data(Some("请总结这段文本"), "test-model", &[]);
        assert_eq!(plan.user_prompt, "请总结这段文本");
    }

    #[test]
    fn duplicate_detected_by_digest() {
        let content = b"test content for dedup";
        let digest = crate::digest::compute_source_digest(content, "v1", "model-x");
        let entry_content = format!("---\nsource_digest: {}\n---\n\n# Test\n", digest);
        assert!(crate::frontmatter::entry_has_digest(
            &entry_content,
            &digest
        ));
    }

    #[test]
    fn no_duplicate_when_digest_differs() {
        let entry_content = "---\nsource_digest: abc123\n---\n\n# Test\n";
        assert!(!crate::frontmatter::entry_has_digest(
            entry_content,
            "different_digest"
        ));
    }

    #[test]
    fn plan_processing_with_real_file() {
        use std::io::Write;
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("test.txt");
        let mut f = std::fs::File::create(&file_path).unwrap();
        f.write_all(b"hello world").unwrap();

        let path_str = file_path.to_str().unwrap();
        let plan = plan_processing(path_str, "2603", None, None, "model-a", &[]).unwrap();

        assert_eq!(plan.material_type, MaterialType::Text);
        assert_eq!(plan.year_month, "2603");
        assert!(!plan.is_duplicate);
        assert!(plan.user_prompt.contains("test.txt"));
    }

    #[test]
    fn plan_processing_detects_duplicate() {
        use std::io::Write;
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("dup.txt");
        let mut f = std::fs::File::create(&file_path).unwrap();
        let content = b"duplicate content";
        f.write_all(content).unwrap();

        let digest = crate::digest::compute_source_digest(content, "v1", "model-b");
        let entry = format!("---\nsource_digest: {}\n---\n\n# Existing\n", digest);
        let entries = vec![("01-existing.md", entry.as_str())];

        let path_str = file_path.to_str().unwrap();
        let plan = plan_processing(path_str, "2603", None, None, "model-b", &entries).unwrap();
        assert!(plan.is_duplicate);
    }

    // Helper for tests that need a plan without real file I/O
    fn plan_processing_with_mock_data(
        prompt_text: Option<&str>,
        model: &str,
        _existing_entries: &[(&str, &str)],
    ) -> ProcessingPlan {
        let user_prompt = if let Some(pt) = prompt_text.filter(|s| !s.trim().is_empty()) {
            pt.to_string()
        } else {
            build_default_user_prompt("/tmp/test.txt", "2603", None)
        };
        ProcessingPlan {
            material_path: "/tmp/test.txt".to_string(),
            year_month: "2603".to_string(),
            material_type: MaterialType::Text,
            source_digest: "fake-digest".to_string(),
            is_duplicate: false,
            user_prompt,
            model: model.to_string(),
        }
    }
}
