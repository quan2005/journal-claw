use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

use crate::config::load_config;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoLintConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_frequency")]
    pub frequency: String,
    #[serde(default = "default_time")]
    pub time: String,
    #[serde(default = "default_min_entries")]
    pub min_entries: u32,
}

impl Default for AutoLintConfig {
    fn default() -> Self {
        AutoLintConfig {
            enabled: false,
            frequency: default_frequency(),
            time: default_time(),
            min_entries: default_min_entries(),
        }
    }
}

fn default_frequency() -> String { "daily".to_string() }
fn default_time() -> String { "03:00".to_string() }
fn default_min_entries() -> u32 { 10 }

fn valid_frequency(s: &str) -> bool {
    matches!(s, "daily" | "weekly" | "monthly")
}

fn valid_time(s: &str) -> bool {
    matches!(s, "03:00" | "12:00" | "22:00")
}

fn valid_min_entries(n: u32) -> bool {
    matches!(n, 10 | 20 | 30)
}

#[derive(Debug, Serialize, Deserialize)]
struct WorkspaceSettings {
    #[serde(default = "default_theme")]
    theme: String,
    #[serde(default)]
    disabled_skills: Vec<String>,
    #[serde(default, alias = "auto_dream")]
    auto_lint: AutoLintConfig,
}

impl Default for WorkspaceSettings {
    fn default() -> Self {
        WorkspaceSettings {
            theme: default_theme(),
            disabled_skills: Vec::new(),
            auto_lint: AutoLintConfig::default(),
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

#[tauri::command]
pub fn get_auto_lint_config(app: AppHandle) -> Result<AutoLintConfig, String> {
    Ok(load_settings(&app)?.auto_lint)
}

#[tauri::command]
pub fn set_auto_lint_config(app: AppHandle, config: AutoLintConfig) -> Result<(), String> {
    if !valid_frequency(&config.frequency) {
        return Err(format!("invalid frequency: {}", config.frequency));
    }
    if !valid_time(&config.time) {
        return Err(format!("invalid time: {}", config.time));
    }
    if !valid_min_entries(config.min_entries) {
        return Err(format!("invalid min_entries: {}", config.min_entries));
    }
    let mut settings = load_settings(&app)?;
    settings.auto_lint = config;
    save_settings(&app, &settings)
}

/// Returns the workspace path for use by auto_lint scheduler.
pub fn get_workspace_path_for_auto_lint(app: &AppHandle) -> Result<String, String> {
    let config = load_config(app)?;
    if config.workspace_path.is_empty() {
        return Err("workspace_path not set".to_string());
    }
    Ok(config.workspace_path)
}

/// Load auto_lint config without going through Tauri command interface.
pub fn load_auto_lint_config(app: &AppHandle) -> Result<AutoLintConfig, String> {
    Ok(load_settings(app)?.auto_lint)
}

#[tauri::command]
pub fn get_disabled_skills(app: AppHandle) -> Result<Vec<String>, String> {
    Ok(load_settings(&app)?.disabled_skills)
}

#[tauri::command]
pub fn set_disabled_skills(app: AppHandle, skills: Vec<String>) -> Result<(), String> {
    let mut settings = load_settings(&app)?;
    settings.disabled_skills = skills;
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

    #[test]
    fn load_settings_sanitizes_invalid_theme() {
        let mut s: WorkspaceSettings = serde_json::from_str(r#"{"theme":"bogus"}"#).unwrap();
        if !valid_theme(&s.theme) {
            s.theme = "system".to_string();
        }
        assert_eq!(s.theme, "system");
    }
}
