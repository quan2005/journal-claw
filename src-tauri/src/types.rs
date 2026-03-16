use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingItem {
    pub filename: String,      // "录音 2026-03-12 22:41.m4a"
    pub path: String,          // absolute path
    pub display_name: String,  // "录音 2026-03-12 22:41"
    pub duration_secs: f64,    // 0.0 if unreadable
    pub year_month: String,    // "202603"
    #[serde(default)]
    pub transcript_status: Option<String>,  // "completed" | "failed" | null
}
