use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct WindowState {
    pub width: f64,
    pub height: f64,
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AsrConfig {
    pub asr_engine: String,
    pub dashscope_api_key: String,
    pub whisperkit_model: String,
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
    // ASR 引擎配置
    #[serde(default = "default_asr_engine")]
    pub asr_engine: String, // "dashscope" | "whisperkit"
    #[serde(default = "default_whisperkit_model")]
    pub whisperkit_model: String, // "base" | "small" | "large-v3-turbo"
}

fn augmented_path() -> String {
    let path_env = std::env::var("PATH").unwrap_or_default();
    format!(
        "{}:/usr/local/bin:/opt/homebrew/bin:{}/.local/bin",
        path_env,
        std::env::var("HOME").unwrap_or_default()
    )
}

fn default_claude_cli() -> String {
    if cfg!(test) {
        return "claude".to_string();
    }
    if let Ok(output) = std::process::Command::new("which")
        .arg("claude")
        .env("PATH", augmented_path())
        .output()
    {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return path;
            }
        }
    }
    "claude".to_string()
}

fn default_active_engine() -> String {
    "claude".to_string()
}

fn default_asr_engine() -> String {
    "whisperkit".to_string()
}

fn default_whisperkit_model() -> String {
    "base".to_string()
}

pub fn normalize_whisperkit_model(model: &str) -> Option<&'static str> {
    match model {
        "base" => Some("base"),
        "small" => Some("small"),
        "large-v3-turbo" | "large-v3_turbo" => Some("large-v3-turbo"),
        _ => None,
    }
}

pub fn whisperkit_cli_model_name(model: &str) -> String {
    match normalize_whisperkit_model(model) {
        Some("large-v3-turbo") => "large-v3_turbo".to_string(),
        Some(normalized) => normalized.to_string(),
        None => model.to_string(),
    }
}

fn sanitize_engine_config(config: &mut Config) {
    let valid_engines = ["claude", "qwen"];
    if !valid_engines.contains(&config.active_ai_engine.as_str()) {
        config.active_ai_engine = default_active_engine();
    }

    let valid_asr_engines = ["dashscope", "whisperkit"];
    if !valid_asr_engines.contains(&config.asr_engine.as_str()) {
        config.asr_engine = default_asr_engine();
    }

    config.whisperkit_model = normalize_whisperkit_model(&config.whisperkit_model)
        .unwrap_or("base")
        .to_string();
}

pub fn whisperkit_models_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| e.to_string())
        .map(|dir| dir.join("whisperkit-models"))
}

pub fn find_whisperkit_model_dir(app: &AppHandle, model: &str) -> Option<PathBuf> {
    let model_key = whisperkit_cli_model_name(model);
    let relative = PathBuf::from("models")
        .join("argmaxinc")
        .join("whisperkit-coreml")
        .join(format!("openai_whisper-{}", model_key));

    let bundled = app
        .path()
        .resource_dir()
        .ok()
        .map(|dir| dir.join("whisperkit-models").join(&relative))
        .filter(|path| path.exists());
    if bundled.is_some() {
        return bundled;
    }

    let source_resource = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("whisperkit-models")
        .join(&relative);
    if source_resource.exists() {
        return Some(source_resource);
    }

    whisperkit_models_dir(app)
        .ok()
        .map(|dir| dir.join(relative))
        .filter(|path| path.exists())
}

/// 在 PATH（含 /usr/local/bin, /opt/homebrew/bin）中查找 whisperkit-cli。
/// 返回绝对路径，若未找到返回 None。
pub fn find_whisperkit_cli_path() -> Option<String> {
    let output = std::process::Command::new("which")
        .arg("whisperkit-cli")
        .env("PATH", augmented_path())
        .output()
        .ok()?;
    if output.status.success() {
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path.is_empty() {
            return Some(path);
        }
    }
    None
}

#[tauri::command]
pub fn check_whisperkit_cli_installed() -> bool {
    find_whisperkit_cli_path().is_some()
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
    sanitize_engine_config(&mut config);
    Ok(config)
}

fn write_config_file(path: &Path, config: &Config) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let data = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(path, data).map_err(|e| e.to_string())
}

pub fn save_config(app: &AppHandle, config: &Config) -> Result<(), String> {
    let path = config_path(app)?;
    write_config_file(&path, config)
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
        .inner_size(600.0, 500.0)
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
    fs::create_dir_all(&path).map_err(|e| format!("无法创建 workspace 目录: {}", e))?;
    let mut config = load_config(&app)?;
    config.workspace_path = path.clone();
    save_config(&app, &config)?;
    crate::ai_processor::ensure_workspace_dot_claude(&path);
    Ok(())
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
    let mut c = load_config(&app)?;

    // Auto-select: if the saved engine is not installed, pick the first available one.
    // Priority: claude > qwen. If neither is installed, keep the saved value.
    let engine_available = |name: &str| -> bool {
        std::process::Command::new("which")
            .arg(name)
            .env("PATH", augmented_path())
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    };

    let claude_ok = engine_available("claude");
    let qwen_ok = engine_available("qwen");

    let resolved = match c.active_ai_engine.as_str() {
        "claude" if claude_ok => "claude",
        "qwen" if qwen_ok => "qwen",
        // saved engine not available — pick best available
        _ if claude_ok => "claude",
        _ if qwen_ok => "qwen",
        _ => c.active_ai_engine.as_str(),
    };

    if resolved != c.active_ai_engine.as_str() {
        c.active_ai_engine = resolved.to_string();
        // Persist the auto-selected engine so it stays consistent
        let _ = save_config(&app, &c);
    }

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
pub fn set_engine_config(app: AppHandle, config: EngineConfig) -> Result<(), String> {
    let valid_engines = ["claude", "qwen"];
    if !valid_engines.contains(&config.active_ai_engine.as_str()) {
        return Err(format!("invalid engine: {}", config.active_ai_engine));
    }
    let mut c = load_config(&app)?;
    c.active_ai_engine = config.active_ai_engine;
    c.claude_code_api_key = config.claude_code_api_key;
    c.claude_code_base_url = config.claude_code_base_url;
    c.claude_code_model = config.claude_code_model;
    c.qwen_code_api_key = config.qwen_code_api_key;
    c.qwen_code_base_url = config.qwen_code_base_url;
    c.qwen_code_model = config.qwen_code_model;
    save_config(&app, &c)
}

#[tauri::command]
pub fn get_app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
pub fn get_asr_config(app: AppHandle) -> Result<AsrConfig, String> {
    let c = load_config(&app)?;
    Ok(AsrConfig {
        asr_engine: c.asr_engine,
        dashscope_api_key: c.dashscope_api_key,
        whisperkit_model: c.whisperkit_model,
    })
}

#[tauri::command]
pub fn set_asr_config(
    app: AppHandle,
    asr_engine: String,
    dashscope_api_key: String,
    whisperkit_model: String,
) -> Result<(), String> {
    let valid_engines = ["dashscope", "whisperkit"];
    if !valid_engines.contains(&asr_engine.as_str()) {
        return Err(format!("invalid asr_engine: {}", asr_engine));
    }
    let Some(normalized_model) = normalize_whisperkit_model(&whisperkit_model) else {
        return Err(format!("invalid whisperkit_model: {}", whisperkit_model));
    };
    let mut c = load_config(&app)?;
    c.asr_engine = asr_engine;
    c.dashscope_api_key = dashscope_api_key;
    c.whisperkit_model = normalized_model.to_string();
    save_config(&app, &c)
}

#[tauri::command]
pub fn get_whisperkit_models_dir(app: AppHandle) -> Result<String, String> {
    let dir = whisperkit_models_dir(&app)?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn check_whisperkit_model_downloaded(app: AppHandle, model: String) -> bool {
    find_whisperkit_model_dir(&app, &model).is_some()
}

/// 下载指定的 WhisperKit 模型（通过触发一次空白音频转录，whisperkit-cli 会先下载模型）。
/// 通过 `whisperkit-download-progress` 事件推送状态：
///   { model, status: "downloading" | "done" | "error", message? }
#[tauri::command]
pub async fn download_whisperkit_model(app: AppHandle, model: String) -> Result<(), String> {
    if find_whisperkit_model_dir(&app, &model).is_some() {
        let _ = app.emit(
            "whisperkit-download-progress",
            serde_json::json!({
                "model": model, "status": "done"
            }),
        );
        return Ok(());
    }

    let model_cache_dir = whisperkit_models_dir(&app)?;
    let _ = std::fs::create_dir_all(&model_cache_dir);

    // 找到 sidecar 二进制路径（bundle 模式用 Tauri resource 路径，dev 模式用 target/debug/）
    let cli_path = app
        .path()
        .resource_dir()
        .ok()
        .map(|d| {
            d.join("binaries")
                .join("whisperkit-cli-aarch64-apple-darwin")
        })
        .filter(|p| p.exists())
        .or_else(|| {
            let p = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("target/debug/whisperkit-cli");
            if p.exists() { Some(p) } else { None }
        })
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "whisperkit-cli".to_string());

    // 生成一个最小合法 WAV 文件（静音，16 采样，16kHz mono 16-bit）供触发下载
    let tmp_wav = std::env::temp_dir().join("whisperkit_download_trigger.wav");
    {
        let num_samples: u32 = 16;
        let sample_rate: u32 = 16000;
        let num_channels: u16 = 1;
        let bits_per_sample: u16 = 16;
        let byte_rate = sample_rate * num_channels as u32 * bits_per_sample as u32 / 8;
        let block_align = num_channels * bits_per_sample / 8;
        let data_size = num_samples * num_channels as u32 * bits_per_sample as u32 / 8;
        let file_size = 36 + data_size;
        let mut wav: Vec<u8> = Vec::new();
        wav.extend_from_slice(b"RIFF");
        wav.extend_from_slice(&file_size.to_le_bytes());
        wav.extend_from_slice(b"WAVE");
        wav.extend_from_slice(b"fmt ");
        wav.extend_from_slice(&16u32.to_le_bytes()); // chunk size
        wav.extend_from_slice(&1u16.to_le_bytes()); // PCM
        wav.extend_from_slice(&num_channels.to_le_bytes());
        wav.extend_from_slice(&sample_rate.to_le_bytes());
        wav.extend_from_slice(&byte_rate.to_le_bytes());
        wav.extend_from_slice(&block_align.to_le_bytes());
        wav.extend_from_slice(&bits_per_sample.to_le_bytes());
        wav.extend_from_slice(b"data");
        wav.extend_from_slice(&data_size.to_le_bytes());
        wav.extend(vec![0u8; data_size as usize]);
        std::fs::write(&tmp_wav, wav).map_err(|e| e.to_string())?;
    }

    let _ = app.emit(
        "whisperkit-download-progress",
        serde_json::json!({
            "model": model, "status": "downloading", "message": "正在启动下载…"
        }),
    );
    let cli_model = whisperkit_cli_model_name(&model);

    use std::process::Stdio;
    use tokio::io::{AsyncBufReadExt, BufReader};

    let mut cmd = tokio::process::Command::new(&cli_path);
    cmd.args([
        "transcribe",
        "--audio-path",
        tmp_wav.to_str().unwrap_or(""),
        "--verbose",
        "--language",
        "zh",
        "--download-model-path",
        model_cache_dir.to_str().unwrap_or(""),
        "--download-tokenizer-path",
        model_cache_dir.to_str().unwrap_or(""),
        "--model",
        &cli_model,
    ]);
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

    let app_for_spawn_error = app.clone();
    let model_for_spawn_error = model.clone();
    let mut child = cmd.spawn().map_err(|e| {
        let _ = std::fs::remove_file(&tmp_wav);
        let msg = format!("启动 whisperkit-cli 失败: {}", e);
        let _ = app_for_spawn_error.emit(
            "whisperkit-download-progress",
            serde_json::json!({
                "model": model_for_spawn_error,
                "status": "error",
                "message": msg,
            }),
        );
        msg
    })?;

    // 流式读取 stderr，逐行 emit 进度
    if let Some(stderr) = child.stderr.take() {
        let app_clone = app.clone();
        let model_clone = model.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                if line.trim().is_empty() {
                    continue;
                }
                let _ = app_clone.emit(
                    "whisperkit-download-progress",
                    serde_json::json!({
                        "model": model_clone,
                        "status": "downloading",
                        "message": line.trim(),
                    }),
                );
            }
        });
    }

    let status = child.wait().await;
    let _ = std::fs::remove_file(&tmp_wav);

    // 判断模型是否已落盘（即使转录失败，只要模型下载了就算成功）
    let downloaded = check_whisperkit_model_downloaded(app.clone(), model.clone());
    let finished_successfully = status.as_ref().map(|s| s.success()).unwrap_or(false);
    if downloaded || finished_successfully {
        let _ = app.emit(
            "whisperkit-download-progress",
            serde_json::json!({
                "model": model, "status": "done"
            }),
        );
        Ok(())
    } else {
        let detail = match status {
            Ok(exit_status) => format!("whisperkit-cli 退出状态: {}", exit_status),
            Err(error) => format!("等待 whisperkit-cli 结束失败: {}", error),
        };
        let msg = format!("下载失败，请检查网络连接后重试。{}", detail);
        let _ = app.emit(
            "whisperkit-download-progress",
            serde_json::json!({
                "model": model, "status": "error", "message": msg
            }),
        );
        Err(msg)
    }
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
    fn write_config_file_creates_missing_parent_dirs() {
        let temp_root = std::env::temp_dir().join(format!(
            "journal-config-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let path = temp_root.join("nested").join("config.json");

        let result = write_config_file(&path, &Config::default());

        assert!(result.is_ok(), "write_config_file failed: {:?}", result);
        assert!(path.exists(), "config file should exist after save");

        let _ = fs::remove_dir_all(temp_root);
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

    #[test]
    fn config_asr_fields_default() {
        let c: Config = serde_json::from_str("{}").unwrap();
        assert_eq!(c.asr_engine, "whisperkit");
        assert_eq!(c.whisperkit_model, "base");
    }

    #[test]
    fn config_asr_fields_roundtrip() {
        let c = Config {
            asr_engine: "whisperkit".into(),
            whisperkit_model: "small".into(),
            ..Config::default()
        };
        let json = serde_json::to_string(&c).unwrap();
        let c2: Config = serde_json::from_str(&json).unwrap();
        assert_eq!(c2.asr_engine, "whisperkit");
        assert_eq!(c2.whisperkit_model, "small");
    }

    #[test]
    fn whisperkit_model_normalization_supports_turbo_aliases() {
        assert_eq!(
            normalize_whisperkit_model("large-v3_turbo"),
            Some("large-v3-turbo")
        );
        assert_eq!(
            normalize_whisperkit_model("large-v3-turbo"),
            Some("large-v3-turbo")
        );
        assert_eq!(
            whisperkit_cli_model_name("large-v3-turbo"),
            "large-v3_turbo"
        );
        assert_eq!(whisperkit_cli_model_name("small"), "small");
    }

    #[test]
    fn sanitize_engine_config_recovers_empty_strings() {
        let mut c = Config {
            active_ai_engine: "".into(),
            asr_engine: "".into(),
            whisperkit_model: "".into(),
            ..Config::default()
        };
        sanitize_engine_config(&mut c);
        assert_eq!(c.active_ai_engine, "claude");
        assert_eq!(c.asr_engine, "whisperkit");
        assert_eq!(c.whisperkit_model, "base");
    }

    #[test]
    fn sanitize_engine_config_normalizes_legacy_turbo_name() {
        let mut c = Config {
            whisperkit_model: "large-v3_turbo".into(),
            ..Config::default()
        };
        sanitize_engine_config(&mut c);
        assert_eq!(c.whisperkit_model, "large-v3-turbo");
    }
}
