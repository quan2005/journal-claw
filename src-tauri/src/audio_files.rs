use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Returns the legacy audio cache directory (App data dir), creating it if needed.
pub fn audio_cache_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Read audio duration in seconds from file header.
/// Returns 0.0 on any failure (incomplete/corrupt file).
pub(crate) fn read_duration(path: &PathBuf) -> f64 {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    if ext == "wav" {
        return hound::WavReader::open(path)
            .ok()
            .map(|reader| {
                let spec = reader.spec();
                if spec.sample_rate == 0 || spec.channels == 0 {
                    return 0.0;
                }
                reader.duration() as f64 / spec.sample_rate as f64
            })
            .unwrap_or(0.0);
    }

    if matches!(ext.as_str(), "m4a" | "mp4" | "aac") {
        return mp4ameta::Tag::read_from_path(path)
            .ok()
            .map(|tag| tag.duration().as_secs_f64())
            .unwrap_or(0.0);
    }

    0.0
}

/// Check if the audio file uses an unsupported codec (e.g. Opus in m4a).
/// The local Apple/SpeakerKit path cannot decode Opus in MP4 containers, so
/// macOS local transcription rejects these files before invoking native tools.
///
/// Detection: searches for the "Opus" fourcc in the stsd atom's codec entry.
/// This is reliable because "Opus" (capital-O) is an uncommon byte sequence
/// outside of the codec declaration.
pub(crate) fn is_unsupported_codec(path: &PathBuf) -> bool {
    // Only check m4a/mp4 files
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    if !matches!(ext.as_str(), "m4a" | "mp4") {
        return false;
    }

    // Read up to 1MB — the stsd atom is always near the beginning
    let Ok(data) = std::fs::read(path) else {
        return false;
    };
    let search_region = &data[..data.len().min(1_048_576)];

    // Opus codec fourcc in stsd atom
    search_region.windows(4).any(|w| w == b"Opus")
}

#[tauri::command]
pub fn reveal_in_file_manager(path: String) -> Result<(), String> {
    crate::platform::reveal_in_file_manager(&path)
}
