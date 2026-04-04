use crate::types::RecordingItem;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Returns the recordings storage directory (App data dir), creating it if needed.
/// On macOS: ~/Library/Application Support/journal/
pub fn recordings_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Read M4A duration in seconds from file header.
/// Returns 0.0 on any failure (incomplete/corrupt file).
pub(crate) fn read_duration_pub(path: &PathBuf) -> f64 {
    mp4ameta::Tag::read_from_path(path)
        .ok()
        .map(|tag| tag.duration().as_secs_f64())
        .unwrap_or(0.0)
}

/// Check if the audio file uses an unsupported codec (e.g. Opus in m4a).
/// macOS native APIs (SFSpeechRecognizer, AVAudioPlayer) cannot decode Opus,
/// so we must reject these files before attempting transcription.
///
/// Detection: searches for the "Opus" fourcc in the stsd atom's codec entry.
/// This is reliable because "Opus" (capital-O) is an uncommon byte sequence
/// outside of the codec declaration.
pub(crate) fn is_unsupported_codec(path: &PathBuf) -> bool {
    // Only check m4a/mp4 files
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    if !matches!(ext.as_str(), "m4a" | "mp4") {
        return false;
    }

    // Read up to 1MB — the stsd atom is always near the beginning
    let Ok(data) = std::fs::read(path) else { return false };
    let search_region = &data[..data.len().min(1_048_576)];

    // Opus codec fourcc in stsd atom
    search_region.windows(4).any(|w| w == b"Opus")
}

/// Parse display_name and year_month from a filename like "录音 2026-03-12 22:41.m4a".
pub(crate) fn parse_filename_pub(filename: &str) -> (String, String) {
    let display_name = filename.trim_end_matches(".m4a").to_string();
    // Extract yyyyMM: look for pattern YYYY-MM in the display name
    let year_month = display_name
        .split_whitespace()
        .find_map(|part| {
            let mut it = part.splitn(3, '-');
            let y = it.next()?;
            let m = it.next()?;
            if y.len() == 4
                && m.len() == 2
                && y.chars().all(|c| c.is_ascii_digit())
                && m.chars().all(|c| c.is_ascii_digit())
            {
                Some(format!("{}{}", y, m))
            } else {
                None
            }
        })
        .unwrap_or_else(|| "000000".to_string());
    (display_name, year_month)
}

#[tauri::command]
pub async fn list_recordings(app: AppHandle) -> Result<Vec<RecordingItem>, String> {
    let dir = recordings_dir(&app)?;

    tauri::async_runtime::spawn_blocking(move || {
        let mut items: Vec<RecordingItem> = std::fs::read_dir(&dir)
            .map_err(|e| e.to_string())?
            .filter_map(|entry| {
                let entry = entry.ok()?;
                let filename = entry.file_name().to_string_lossy().into_owned();
                if !filename.ends_with(".m4a") {
                    return None;
                }
                let path = entry.path();
                let (display_name, year_month) = parse_filename_pub(&filename);
                let duration_secs = read_duration_pub(&path);

                // Check transcript status
                let transcript_file =
                    crate::transcription::transcript_json_path_for_audio(path.as_path());
                let transcript_status = if transcript_file.exists() {
                    std::fs::read_to_string(&transcript_file)
                        .ok()
                        .and_then(|data| {
                            serde_json::from_str::<serde_json::Value>(&data)
                                .ok()
                                .and_then(|v| v.get("status")?.as_str().map(String::from))
                        })
                } else {
                    None
                };

                Some(RecordingItem {
                    filename,
                    path: path.to_string_lossy().into_owned(),
                    display_name,
                    duration_secs,
                    year_month,
                    transcript_status,
                })
            })
            .collect();
        items.sort_by(|a, b| b.filename.cmp(&a.filename));
        Ok(items)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn delete_recording(path: String) -> Result<(), String> {
    std::fs::remove_file(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reveal_in_finder(path: String) -> Result<(), String> {
    // open -R highlights the file in Finder (equivalent to NSWorkspace.activateFileViewerSelectingURLs)
    std::process::Command::new("open")
        .args(["-R", &path])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn play_recording(path: String) -> Result<(), String> {
    std::process::Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_filename_standard() {
        let (display, ym) = parse_filename_pub("录音 2026-03-12 22:41.m4a");
        assert_eq!(display, "录音 2026-03-12 22:41");
        assert_eq!(ym, "202603");
    }

    #[test]
    fn parse_filename_with_seconds() {
        let (display, ym) = parse_filename_pub("录音 2026-03-12 22:41:05.m4a");
        assert_eq!(display, "录音 2026-03-12 22:41:05");
        assert_eq!(ym, "202603");
    }

    #[test]
    fn parse_filename_unknown() {
        let (display, ym) = parse_filename_pub("unknown.m4a");
        assert_eq!(display, "unknown");
        assert_eq!(ym, "000000");
    }
}
