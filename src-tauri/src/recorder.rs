use crate::types::RecordingItem;
use std::sync::Mutex;
use tauri::{AppHandle, State};

pub struct RecorderState(pub Mutex<Option<()>>);

#[tauri::command]
pub fn start_recording(_app: AppHandle, _state: State<'_, RecorderState>) -> Result<String, String> {
    Err("not_implemented".to_string())
}

#[tauri::command]
pub fn stop_recording(_app: AppHandle, _state: State<'_, RecorderState>) -> Result<RecordingItem, String> {
    Err("not_implemented".to_string())
}
