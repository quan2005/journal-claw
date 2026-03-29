use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

use crate::config::load_config;

#[derive(Debug, Serialize, Deserialize)]
struct WorkspaceSettings {
    #[serde(default = "default_theme")]
    theme: String,
}

impl Default for WorkspaceSettings {
    fn default() -> Self {
        WorkspaceSettings {
            theme: default_theme(),
        }
    }
}

fn default_theme() -> String {
    "system".to_string()
}

fn valid_theme(s: &str) -> bool {
    matches!(s, "light" | "dark" | "system")
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let config = load_config(app)?;
    if config.workspace_path.is_empty() {
        return Err("workspace_path not set".to_string());
    }
    Ok(PathBuf::from(&config.workspace_path).join(".setting.json"))
}

fn load_settings(app: &AppHandle) -> Result<WorkspaceSettings, String> {
    let path = settings_path(app)?;
    if !path.exists() {
        return Ok(WorkspaceSettings::default());
    }
    let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut s: WorkspaceSettings = serde_json::from_str(&data).unwrap_or_default();
    if !valid_theme(&s.theme) {
        s.theme = "system".to_string();
    }
    Ok(s)
}

fn save_settings(app: &AppHandle, settings: &WorkspaceSettings) -> Result<(), String> {
    let path = settings_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let data = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_workspace_theme(app: AppHandle) -> Result<String, String> {
    Ok(load_settings(&app)?.theme)
}

#[tauri::command]
pub fn set_workspace_theme(app: AppHandle, theme: String) -> Result<(), String> {
    if !valid_theme(&theme) {
        return Err(format!("invalid theme: {}", theme));
    }
    let mut settings = load_settings(&app)?;
    settings.theme = theme;
    save_settings(&app, &settings)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_theme_is_system() {
        let s = WorkspaceSettings::default();
        assert_eq!(s.theme, "system");
    }

    #[test]
    fn valid_theme_accepts_known_values() {
        assert!(valid_theme("light"));
        assert!(valid_theme("dark"));
        assert!(valid_theme("system"));
        assert!(!valid_theme("auto"));
        assert!(!valid_theme(""));
    }

    #[test]
    fn deserialize_missing_theme_defaults_to_system() {
        let s: WorkspaceSettings = serde_json::from_str("{}").unwrap();
        assert_eq!(s.theme, "system");
    }

    #[test]
    fn deserialize_valid_theme() {
        let s: WorkspaceSettings = serde_json::from_str(r#"{"theme":"dark"}"#).unwrap();
        assert_eq!(s.theme, "dark");
    }
}
