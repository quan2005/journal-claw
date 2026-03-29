use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct Config {
    #[serde(default)]
    pub dashscope_api_key: String,
    #[serde(default)]
    pub workspace_path: String,
    #[serde(default = "default_claude_cli")]
    pub claude_cli_path: String,
}

fn default_claude_cli() -> String {
    let home = std::env::var("HOME").unwrap_or_default();
    let local_bin = format!("{}/.local/bin/claude", home);
    for candidate in &[local_bin.as_str(), "/usr/local/bin/claude", "/opt/homebrew/bin/claude"] {
        if std::path::Path::new(candidate).exists() {
            return candidate.to_string();
        }
    }
    "claude".to_string()
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join("config.json"))
}

fn default_workspace_path() -> Result<String, String> {
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    let path = PathBuf::from(home).join("Documents").join("journal");
    Ok(path.to_string_lossy().to_string())
}

pub fn load_config(app: &AppHandle) -> Result<Config, String> {
    let path = config_path(app)?;
    let mut config = if !path.exists() {
        Config::default()
    } else {
        let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).map_err(|e| e.to_string())?
    };
    if config.workspace_path.is_empty() {
        config.workspace_path = default_workspace_path()?;
    }
    Ok(config)
}

pub fn save_config(app: &AppHandle, config: &Config) -> Result<(), String> {
    let path = config_path(app)?;
    let data = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_api_key(app: AppHandle) -> Result<Option<String>, String> {
    let config = load_config(&app)?;
    if config.dashscope_api_key.is_empty() {
        Ok(None)
    } else {
        Ok(Some(config.dashscope_api_key))
    }
}

#[tauri::command]
pub fn set_api_key(app: AppHandle, key: String) -> Result<(), String> {
    let mut config = load_config(&app)?;
    config.dashscope_api_key = key;
    save_config(&app, &config)
}

#[tauri::command]
pub fn open_settings(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("settings") {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(&app, "settings", WebviewUrl::App("settings.html".into()))
        .title("设置 - Journal")
        .inner_size(400.0, 250.0)
        .resizable(true)
        .center()
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_workspace_path(app: AppHandle) -> Result<String, String> {
    let config = load_config(&app)?;
    Ok(config.workspace_path)
}

#[tauri::command]
pub fn set_workspace_path(app: AppHandle, path: String) -> Result<(), String> {
    fs::create_dir_all(&path)
        .map_err(|e| format!("无法创建 workspace 目录: {}", e))?;
    let mut config = load_config(&app)?;
    config.workspace_path = path;
    save_config(&app, &config)
}

#[tauri::command]
pub fn get_claude_cli_path(app: AppHandle) -> Result<String, String> {
    let config = load_config(&app)?;
    Ok(config.claude_cli_path)
}

#[tauri::command]
pub fn set_claude_cli_path(app: AppHandle, path: String) -> Result<(), String> {
    let mut config = load_config(&app)?;
    config.claude_cli_path = path;
    save_config(&app, &config)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn config_defaults() {
        let c: Config = serde_json::from_str("{}").unwrap();
        assert_eq!(c.workspace_path, "");
        assert_eq!(c.claude_cli_path, "claude");
        assert_eq!(c.dashscope_api_key, "");
    }

    #[test]
    fn config_roundtrip() {
        let c = Config {
            dashscope_api_key: "key".into(),
            workspace_path: "/Users/test/notebook".into(),
            claude_cli_path: "claude".into(),
        };
        let json = serde_json::to_string(&c).unwrap();
        let c2: Config = serde_json::from_str(&json).unwrap();
        assert_eq!(c2.workspace_path, "/Users/test/notebook");
        assert_eq!(c2.claude_cli_path, "claude");
    }
}
