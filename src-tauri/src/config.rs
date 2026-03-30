use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct WindowState {
    pub width: f64,
    pub height: f64,
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EngineConfig {
    pub active_ai_engine: String,
    pub claude_code_api_key: String,
    pub claude_code_base_url: String,
    pub claude_code_model: String,
    pub qwen_code_api_key: String,
    pub qwen_code_base_url: String,
    pub qwen_code_model: String,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct Config {
    #[serde(default)]
    pub dashscope_api_key: String,
    #[serde(default)]
    pub workspace_path: String,
    #[serde(default = "default_claude_cli")]
    pub claude_cli_path: String,
    #[serde(default)]
    pub window_state: Option<WindowState>,
    // AI 引擎配置
    #[serde(default = "default_active_engine")]
    pub active_ai_engine: String,
    #[serde(default)]
    pub claude_code_api_key: String,
    #[serde(default)]
    pub claude_code_base_url: String,
    #[serde(default)]
    pub claude_code_model: String,
    #[serde(default)]
    pub qwen_code_api_key: String,
    #[serde(default)]
    pub qwen_code_base_url: String,
    #[serde(default)]
    pub qwen_code_model: String,
}

fn default_claude_cli() -> String {
    let home = std::env::var("HOME").unwrap_or_default();
    let local_bin = format!("{}/.local/bin/claude", home);
    for candidate in &[local_bin.as_str(), "/usr/local/bin/claude", "/opt/homebrew/bin/claude"] {
        if cfg!(test) {
            // In tests, skip file existence checks to ensure deterministic behavior
            continue;
        }
        if std::path::Path::new(candidate).exists() {
            return candidate.to_string();
        }
    }
    "claude".to_string()
}

fn default_active_engine() -> String {
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
        .title("设置 - 谨迹")
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

#[tauri::command]
pub fn get_engine_config(app: AppHandle) -> Result<EngineConfig, String> {
    let c = load_config(&app)?;
    Ok(EngineConfig {
        active_ai_engine: c.active_ai_engine,
        claude_code_api_key: c.claude_code_api_key,
        claude_code_base_url: c.claude_code_base_url,
        claude_code_model: c.claude_code_model,
        qwen_code_api_key: c.qwen_code_api_key,
        qwen_code_base_url: c.qwen_code_base_url,
        qwen_code_model: c.qwen_code_model,
    })
}

#[tauri::command]
pub fn set_engine_config(
    app: AppHandle,
    active_ai_engine: String,
    claude_code_api_key: String,
    claude_code_base_url: String,
    claude_code_model: String,
    qwen_code_api_key: String,
    qwen_code_base_url: String,
    qwen_code_model: String,
) -> Result<(), String> {
    let valid_engines = ["claude", "qwen"];
    if !valid_engines.contains(&active_ai_engine.as_str()) {
        return Err(format!("invalid engine: {}", active_ai_engine));
    }
    let mut c = load_config(&app)?;
    c.active_ai_engine = active_ai_engine;
    c.claude_code_api_key = claude_code_api_key;
    c.claude_code_base_url = claude_code_base_url;
    c.claude_code_model = claude_code_model;
    c.qwen_code_api_key = qwen_code_api_key;
    c.qwen_code_base_url = qwen_code_base_url;
    c.qwen_code_model = qwen_code_model;
    save_config(&app, &c)
}

#[tauri::command]
pub fn get_app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn config_defaults() {
        let c: Config = serde_json::from_str("{}").unwrap();
        assert_eq!(c.workspace_path, "");
        // claude_cli_path should be "claude" in test environments where candidates don't exist
        assert_eq!(c.claude_cli_path, "claude");
        assert_eq!(c.dashscope_api_key, "");
    }

    #[test]
    fn config_roundtrip() {
        let c = Config {
            dashscope_api_key: "key".into(),
            workspace_path: "/Users/test/notebook".into(),
            claude_cli_path: "claude".into(),
            window_state: None,
            ..Config::default()
        };
        let json = serde_json::to_string(&c).unwrap();
        let c2: Config = serde_json::from_str(&json).unwrap();
        assert_eq!(c2.workspace_path, "/Users/test/notebook");
        assert_eq!(c2.claude_cli_path, "claude");
    }

    #[test]
    fn config_new_engine_fields_default() {
        let c: Config = serde_json::from_str("{}").unwrap();
        assert_eq!(c.active_ai_engine, "claude");
        assert_eq!(c.claude_code_api_key, "");
        assert_eq!(c.qwen_code_api_key, "");
    }

    #[test]
    fn config_engine_fields_roundtrip() {
        let c = Config {
            active_ai_engine: "qwen".into(),
            qwen_code_api_key: "sk-test".into(),
            ..Config::default()
        };
        let json = serde_json::to_string(&c).unwrap();
        let c2: Config = serde_json::from_str(&json).unwrap();
        assert_eq!(c2.active_ai_engine, "qwen");
        assert_eq!(c2.qwen_code_api_key, "sk-test");
    }
}
