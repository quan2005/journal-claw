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
    pub dashscope_asr_model: String,
    pub volcengine_asr_api_key: String,
    pub volcengine_asr_resource_id: String,
    #[serde(default)]
    pub siliconflow_asr_api_key: String,
    #[serde(default)]
    pub siliconflow_asr_model: String,
    pub zhipu_asr_api_key: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct VendorConfig {
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub model: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProviderEntry {
    pub id: String,
    pub label: String,
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub model: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EngineConfig {
    pub active_provider: String,
    pub providers: Vec<ProviderEntry>,
}

pub struct BuiltinPreset {
    pub id: &'static str,
    pub label: &'static str,
    pub default_base_url: &'static str,
    pub default_model: &'static str,
}

pub const BUILTIN_PRESETS: &[BuiltinPreset] = &[
    BuiltinPreset {
        id: "deepseek",
        label: "DeepSeek",
        default_base_url: "https://api.deepseek.com/anthropic",
        default_model: "deepseek-chat",
    },
    BuiltinPreset {
        id: "volcengine",
        label: "火山方舟",
        default_base_url: "https://ark.cn-beijing.volces.com/api/coding",
        default_model: "doubao-1.5-pro-256k",
    },
    BuiltinPreset {
        id: "zhipu",
        label: "智谱 AI",
        default_base_url: "https://open.bigmodel.cn/api/anthropic",
        default_model: "glm-4-plus",
    },
    BuiltinPreset {
        id: "dashscope",
        label: "阿里云百炼",
        default_base_url: "https://coding.dashscope.aliyuncs.com/apps/anthropic",
        default_model: "qwen-max",
    },
    BuiltinPreset {
        id: "anthropic",
        label: "Anthropic",
        default_base_url: "https://api.anthropic.com",
        default_model: "claude-sonnet-4-20250514",
    },
];

impl Config {
    pub fn active_provider_entry(&self) -> Option<&ProviderEntry> {
        self.providers.iter().find(|p| p.id == self.active_provider)
    }

    pub fn active_vendor_config(&self) -> (&str, &str, &str) {
        match self.active_provider_entry() {
            Some(p) => (p.api_key.as_str(), p.base_url.as_str(), p.model.as_str()),
            None => ("", "", ""),
        }
    }
}

pub fn preset_for_id(id: &str) -> Option<&'static BuiltinPreset> {
    BUILTIN_PRESETS.iter().find(|p| p.id == id)
}

pub fn default_base_url_for_vendor(vendor: &str) -> String {
    preset_for_id(vendor)
        .map(|p| p.default_base_url.to_string())
        .unwrap_or_else(|| "https://api.anthropic.com".to_string())
}

pub fn default_model_for_vendor(vendor: &str) -> String {
    preset_for_id(vendor)
        .map(|p| p.default_model.to_string())
        .unwrap_or_else(|| "claude-sonnet-4-20250514".to_string())
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct Config {
    #[serde(default)]
    pub dashscope_api_key: String,
    #[serde(default)]
    pub workspace_path: String,
    #[serde(default)]
    pub window_state: Option<WindowState>,
    // AI 引擎配置 (provider list, v3)
    #[serde(default = "default_active_vendor")]
    pub active_provider: String,
    #[serde(default)]
    pub providers: Vec<ProviderEntry>,
    // v2 fields — kept for migration
    #[serde(default)]
    pub active_vendor: String,
    #[serde(default)]
    pub vendor_configs: std::collections::HashMap<String, VendorConfig>,
    // Legacy single-vendor fields — kept for migration
    #[serde(default)]
    pub vendor_api_key: String,
    #[serde(default)]
    pub vendor_base_url: String,
    #[serde(default)]
    pub vendor_model: String,
    // Legacy fields — kept for migration from old config.json
    #[serde(default)]
    pub active_ai_engine: String,
    #[serde(default)]
    pub claude_code_api_key: String,
    #[serde(default)]
    pub claude_code_base_url: String,
    #[serde(default)]
    pub claude_code_model: String,
    #[serde(default)]
    pub openai_code_api_key: String,
    #[serde(default)]
    pub openai_code_base_url: String,
    #[serde(default)]
    pub openai_code_model: String,
    // ASR 引擎配置
    #[serde(default = "default_asr_engine")]
    pub asr_engine: String, // "apple" | "dashscope" | "whisperkit"
    #[serde(default = "default_whisperkit_model")]
    pub whisperkit_model: String, // "base" | "small" | "large-v3-turbo"
    #[serde(default = "default_dashscope_asr_model")]
    pub dashscope_asr_model: String, // "qwen3-asr-flash" | "qwen3-asr-flash-filetrans"
    #[serde(default)]
    pub volcengine_asr_api_key: String,
    #[serde(default = "default_volcengine_asr_resource_id")]
    pub volcengine_asr_resource_id: String, // "volc.bigasr.auc" | "volc.seedasr.auc"
    #[serde(default)]
    pub siliconflow_asr_api_key: String,
    #[serde(default = "default_siliconflow_asr_model")]
    pub siliconflow_asr_model: String,
    #[serde(default)]
    pub zhipu_asr_api_key: String,
    // 首次启动引导
    #[serde(default)]
    pub sample_entry_created: bool,
    // Feishu bridge
    #[serde(default)]
    pub feishu_enabled: bool,
    #[serde(default)]
    pub feishu_app_id: String,
    #[serde(default)]
    pub feishu_app_secret: String,
    #[serde(default)]
    pub feishu_session_id: Option<String>,
}

pub fn augmented_path() -> String {
    let path_env = std::env::var("PATH").unwrap_or_default();
    let home = std::env::var("HOME").unwrap_or_default();
    let mut dirs: Vec<String> = path_env.split(':').map(|s| s.to_string()).collect();

    // Standard locations
    for d in &[
        "/usr/bin",
        "/bin",
        "/usr/sbin",
        "/sbin",
        "/usr/local/bin",
        "/opt/homebrew/bin",
    ] {
        dirs.push(d.to_string());
    }
    if !home.is_empty() {
        dirs.push(format!("{}/.local/bin", home));
    }

    // Node version managers — tools installed as global npm packages may live here.

    // Volta: its bin dir contains shims directly (no version subdirs to scan).
    let volta_bin = format!("{}/.volta/bin", home);
    if std::path::Path::new(&volta_bin).exists() {
        dirs.push(volta_bin);
    }

    // nvm / fnm / n: scan version directories for bin/
    let node_manager_roots: Vec<std::path::PathBuf> = vec![
        // nvm
        std::path::PathBuf::from(
            std::env::var("NVM_DIR").unwrap_or_else(|_| format!("{}/.nvm", home)),
        )
        .join("versions/node"),
        // fnm (node-versions subdir)
        std::path::PathBuf::from(
            std::env::var("FNM_DIR").unwrap_or_else(|_| format!("{}/.local/share/fnm", home)),
        )
        .join("node-versions"),
        // n (tj/n)
        std::path::PathBuf::from(
            std::env::var("N_PREFIX").unwrap_or_else(|_| "/usr/local".to_string()),
        )
        .join("n/versions/node"),
    ];

    // For nvm / fnm / n: scan version directories for bin/
    for root in &node_manager_roots {
        if let Ok(entries) = std::fs::read_dir(root) {
            let mut versions: Vec<_> = entries
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().map(|t| t.is_dir()).unwrap_or(false))
                .map(|e| e.path())
                .collect();
            versions.sort();
            for v in versions {
                let bin = v.join("bin");
                if bin.exists() {
                    dirs.push(bin.to_string_lossy().to_string());
                }
            }
        }
    }

    // Also check fnm aliases (e.g. ~/.local/share/fnm/aliases/default/bin)
    let fnm_aliases = format!(
        "{}/aliases",
        std::env::var("FNM_DIR").unwrap_or_else(|_| format!("{}/.local/share/fnm", home))
    );
    if let Ok(entries) = std::fs::read_dir(&fnm_aliases) {
        for e in entries.filter_map(|e| e.ok()) {
            let bin = e.path().join("bin");
            if bin.exists() {
                dirs.push(bin.to_string_lossy().to_string());
            }
        }
    }

    dirs.dedup();
    dirs.join(":")
}

fn default_active_vendor() -> String {
    "anthropic".to_string()
}

fn default_active_engine() -> String {
    "claude".to_string()
}

fn default_asr_engine() -> String {
    "apple".to_string()
}

fn default_whisperkit_model() -> String {
    "base".to_string()
}

fn default_dashscope_asr_model() -> String {
    "qwen3-asr-flash".to_string()
}

fn default_volcengine_asr_resource_id() -> String {
    "volc.seedasr.auc".to_string()
}

fn default_siliconflow_asr_model() -> String {
    "FunAudioLLM/SenseVoiceSmall".to_string()
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
    // Migration v1 → v2: legacy per-engine fields → vendor_configs map
    if config.vendor_configs.is_empty() {
        if !config.vendor_api_key.is_empty() {
            config.vendor_configs.insert(
                config.active_vendor.clone(),
                VendorConfig {
                    api_key: config.vendor_api_key.clone(),
                    base_url: config.vendor_base_url.clone(),
                    model: config.vendor_model.clone(),
                },
            );
        }
        if !config.claude_code_api_key.is_empty() {
            let vendor = "anthropic".to_string();
            config.vendor_configs.entry(vendor).or_default().api_key =
                config.claude_code_api_key.clone();
            if !config.claude_code_base_url.is_empty() {
                config.vendor_configs.get_mut("anthropic").unwrap().base_url =
                    config.claude_code_base_url.clone();
            }
            if !config.claude_code_model.is_empty() {
                config.vendor_configs.get_mut("anthropic").unwrap().model =
                    config.claude_code_model.clone();
            }
            if config.active_ai_engine == "claude" {
                config.active_vendor = "anthropic".to_string();
            }
        }
        if !config.openai_code_api_key.is_empty() {
            let vendor = "dashscope".to_string();
            config.vendor_configs.entry(vendor).or_default().api_key =
                config.openai_code_api_key.clone();
            if !config.openai_code_base_url.is_empty() {
                config.vendor_configs.get_mut("dashscope").unwrap().base_url =
                    config.openai_code_base_url.clone();
            }
            if !config.openai_code_model.is_empty() {
                config.vendor_configs.get_mut("dashscope").unwrap().model =
                    config.openai_code_model.clone();
            }
            if config.active_ai_engine == "openai" {
                config.active_vendor = "dashscope".to_string();
            }
        }
    }

    // Migration v2 → v3: vendor_configs map → providers list
    // Iterate in BUILTIN_PRESETS order to get a stable, deterministic result.
    if config.providers.is_empty() && !config.vendor_configs.is_empty() {
        for preset in BUILTIN_PRESETS {
            if let Some(vc) = config.vendor_configs.get(preset.id) {
                config.providers.push(ProviderEntry {
                    id: preset.id.to_string(),
                    label: preset.label.to_string(),
                    api_key: vc.api_key.clone(),
                    base_url: vc.base_url.clone(),
                    model: vc.model.clone(),
                });
            }
        }
        // Any custom (non-builtin) entries, sorted by key for stability
        let mut extra: Vec<_> = config
            .vendor_configs
            .iter()
            .filter(|(id, _)| BUILTIN_PRESETS.iter().all(|p| p.id != id.as_str()))
            .collect();
        extra.sort_by_key(|(id, _)| id.as_str());
        for (vendor_id, vc) in extra {
            config.providers.push(ProviderEntry {
                id: vendor_id.clone(),
                label: vendor_id.clone(),
                api_key: vc.api_key.clone(),
                base_url: vc.base_url.clone(),
                model: vc.model.clone(),
            });
        }
        if !config.active_vendor.is_empty() && config.active_provider == default_active_vendor() {
            config.active_provider = config.active_vendor.clone();
        }
    }

    // Ensure active_provider points to a valid entry; fall back to first provider or "anthropic"
    if !config
        .providers
        .iter()
        .any(|p| p.id == config.active_provider)
    {
        config.active_provider = config
            .providers
            .first()
            .map(|p| p.id.clone())
            .unwrap_or_else(default_active_vendor);
    }

    // Legacy field validation (kept for serde compat)
    let valid_engines = ["claude", "openai", ""];
    if !valid_engines.contains(&config.active_ai_engine.as_str()) {
        config.active_ai_engine = default_active_engine();
    }

    let valid_asr_engines = ["apple", "dashscope", "whisperkit", "siliconflow", "zhipu"];
    if !valid_asr_engines.contains(&config.asr_engine.as_str()) {
        config.asr_engine = default_asr_engine();
    }

    // 默认引擎迁移逻辑（Requirements 7.1, 7.2, 7.3）：
    // - 升级用户 + whisperkit + cli 未安装 → 自动切换为 apple
    // - 升级用户 + dashscope + API Key 已配置 → 保持不变
    // - 新用户默认 apple（已通过 default_asr_engine 实现）
    if config.asr_engine == "whisperkit" && !cfg!(test) && find_whisperkit_cli_path().is_none() {
        config.asr_engine = "apple".to_string();
    }
    if config.asr_engine == "volcengine" && config.volcengine_asr_api_key.is_empty() {
        config.asr_engine = "apple".to_string();
    }
    if config.asr_engine == "siliconflow" && config.siliconflow_asr_api_key.trim().is_empty() {
        config.asr_engine = "apple".to_string();
    }
    if config.asr_engine == "zhipu" && config.zhipu_asr_api_key.is_empty() {
        config.asr_engine = "apple".to_string();
    }
    if config.asr_engine == "dashscope" && config.dashscope_api_key.trim().is_empty() {
        config.asr_engine = "apple".to_string();
    }

    let valid_volcengine_resources = ["volc.bigasr.auc", "volc.seedasr.auc"];
    if !valid_volcengine_resources.contains(&config.volcengine_asr_resource_id.as_str()) {
        config.volcengine_asr_resource_id = default_volcengine_asr_resource_id();
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

/// 检查 WhisperKit 模型目录是否包含所有必需文件。
/// 下载中断会留下不完整的目录，仅检查 exists() 不够。
fn is_whisperkit_model_complete(path: &std::path::Path) -> bool {
    if !path.is_dir() {
        return false;
    }
    const REQUIRED: &[&str] = &[
        "config.json",
        "generation_config.json",
        "AudioEncoder.mlmodelc",
        "MelSpectrogram.mlmodelc",
        "TextDecoder.mlmodelc",
    ];
    REQUIRED.iter().all(|f| path.join(f).exists())
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
        .filter(|path| is_whisperkit_model_complete(path));
    if bundled.is_some() {
        return bundled;
    }

    let source_resource = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("whisperkit-models")
        .join(&relative);
    if is_whisperkit_model_complete(&source_resource) {
        return Some(source_resource);
    }

    whisperkit_models_dir(app)
        .ok()
        .map(|dir| dir.join(relative))
        .filter(|path| is_whisperkit_model_complete(path))
}

/// 在 PATH（含 /usr/local/bin, /opt/homebrew/bin）中查找 whisperkit-cli。
/// 返回绝对路径，若未找到返回 None。
pub fn find_whisperkit_cli_path() -> Option<String> {
    let output = std::process::Command::new("/usr/bin/which")
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

/// 通过 `brew install whisperkit-cli` 安装 whisperkit-cli。
/// 立即返回，安装进度通过 "engine-install-log" 事件流式推送（engine: "whisperkit-cli"）。
#[tauri::command]
pub fn install_whisperkit_cli(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Emitter;

    let mut child = std::process::Command::new("brew")
        .args(["install", "whisperkit-cli"])
        .env("PATH", augmented_path())
        .env("HOMEBREW_NO_AUTO_UPDATE", "1")
        .env("HOMEBREW_NO_ENV_HINTS", "1")
        .env("HOMEBREW_NO_ANALYTICS", "1")
        .env("CI", "1")
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("启动 brew 失败（请确认已安装 Homebrew）: {}", e))?;

    // Spawn a background thread to stream output and wait for completion.
    // The command returns immediately so it doesn't block the IPC bridge.
    tauri::async_runtime::spawn_blocking(move || {
        use std::io::{BufRead, BufReader};

        let emit = |app: &tauri::AppHandle, line: &str, done: bool, success: bool| {
            let _ = app.emit(
                "engine-install-log",
                serde_json::json!({
                    "engine": "whisperkit-cli",
                    "line": line,
                    "done": done,
                    "success": success,
                }),
            );
        };

        // Stream stderr (brew writes progress to stderr)
        if let Some(stderr) = child.stderr.take() {
            let app_clone = app.clone();
            std::thread::spawn(move || {
                for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                    if !line.trim().is_empty() {
                        let _ = app_clone.emit(
                            "engine-install-log",
                            serde_json::json!({ "engine": "whisperkit-cli", "line": line.trim(), "done": false, "success": false }),
                        );
                    }
                }
            });
        }

        // Stream stdout
        if let Some(stdout) = child.stdout.take() {
            let app_clone = app.clone();
            std::thread::spawn(move || {
                for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                    if !line.trim().is_empty() {
                        let _ = app_clone.emit(
                            "engine-install-log",
                            serde_json::json!({ "engine": "whisperkit-cli", "line": line.trim(), "done": false, "success": false }),
                        );
                    }
                }
            });
        }

        let success = child.wait().map(|s| s.success()).unwrap_or(false);
        emit(
            &app,
            if success {
                "安装完成"
            } else {
                "安装失败"
            },
            true,
            success,
        );
    });

    Ok(())
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
pub fn get_engine_config(app: AppHandle) -> Result<EngineConfig, String> {
    let c = load_config(&app)?;

    Ok(EngineConfig {
        active_provider: c.active_provider.clone(),
        providers: c.providers.clone(),
    })
}

#[tauri::command]
pub fn set_engine_config(app: AppHandle, config: EngineConfig) -> Result<(), String> {
    if !config
        .providers
        .iter()
        .any(|p| p.id == config.active_provider)
        && !config.providers.is_empty()
    {
        return Err(format!(
            "active_provider '{}' not found in providers list",
            config.active_provider
        ));
    }
    let mut c = load_config(&app)?;
    c.active_provider = config.active_provider;
    c.providers = config.providers;
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
        dashscope_asr_model: c.dashscope_asr_model,
        volcengine_asr_api_key: c.volcengine_asr_api_key,
        volcengine_asr_resource_id: c.volcengine_asr_resource_id,
        siliconflow_asr_api_key: c.siliconflow_asr_api_key,
        siliconflow_asr_model: c.siliconflow_asr_model,
        zhipu_asr_api_key: c.zhipu_asr_api_key,
    })
}

/// 返回当前系统 Apple 语音识别使用的底层引擎：
/// - macOS 26+: "speech_analyzer" (新一代 SpeechAnalyzer API)
/// - macOS < 26: "sf_speech_recognizer" (旧版 SFSpeechRecognizer)
#[tauri::command]
pub fn get_apple_stt_variant() -> String {
    let major = std::process::Command::new("sw_vers")
        .arg("-productVersion")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .and_then(|v| v.trim().split('.').next().map(String::from))
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(0);
    if major >= 26 {
        "speech_analyzer".to_string()
    } else {
        "sf_speech_recognizer".to_string()
    }
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn set_asr_config(
    app: AppHandle,
    asr_engine: String,
    dashscope_api_key: String,
    whisperkit_model: String,
    dashscope_asr_model: String,
    siliconflow_asr_api_key: String,
    siliconflow_asr_model: String,
    zhipu_asr_api_key: String,
) -> Result<(), String> {
    let valid_engines = ["apple", "dashscope", "whisperkit", "siliconflow", "zhipu"];
    if !valid_engines.contains(&asr_engine.as_str()) {
        return Err(format!("invalid asr_engine: {}", asr_engine));
    }
    let Some(normalized_model) = normalize_whisperkit_model(&whisperkit_model) else {
        return Err(format!("invalid whisperkit_model: {}", whisperkit_model));
    };
    let valid_asr_models = ["qwen3-asr-flash", "qwen3-asr-flash-filetrans"];
    let asr_model = if valid_asr_models.contains(&dashscope_asr_model.as_str()) {
        dashscope_asr_model
    } else {
        default_dashscope_asr_model()
    };
    let mut c = load_config(&app)?;
    c.asr_engine = asr_engine;
    c.dashscope_api_key = dashscope_api_key;
    c.whisperkit_model = normalized_model.to_string();
    c.dashscope_asr_model = asr_model;
    c.siliconflow_asr_api_key = siliconflow_asr_api_key;
    c.siliconflow_asr_model = siliconflow_asr_model;
    c.zhipu_asr_api_key = zhipu_asr_api_key;
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

    let cli_path = match find_whisperkit_cli_path() {
        Some(path) => path,
        None => {
            let msg = "未找到 whisperkit-cli，请先安装：brew install whisperkit-cli".to_string();
            let _ = app.emit(
                "whisperkit-download-progress",
                serde_json::json!({
                    "model": model, "status": "error", "message": msg
                }),
            );
            return Err(msg);
        }
    };

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
    cmd.env("HF_ENDPOINT", "https://hf-mirror.com");
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

// ── Feishu bridge config ─────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeishuConfig {
    pub enabled: bool,
    pub app_id: String,
    pub app_secret: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeishuStatus {
    pub state: String, // "idle" | "connecting" | "connected" | "error"
    pub error: Option<String>,
}

#[tauri::command]
pub fn get_feishu_config(app: AppHandle) -> Result<FeishuConfig, String> {
    let cfg = load_config(&app)?;
    Ok(FeishuConfig {
        enabled: cfg.feishu_enabled,
        app_id: cfg.feishu_app_id,
        app_secret: cfg.feishu_app_secret,
    })
}

#[tauri::command]
pub fn set_feishu_config(app: AppHandle, config: FeishuConfig) -> Result<(), String> {
    let mut cfg = load_config(&app)?;
    let creds_changed =
        cfg.feishu_app_id != config.app_id || cfg.feishu_app_secret != config.app_secret;
    cfg.feishu_enabled = config.enabled;
    cfg.feishu_app_id = config.app_id;
    cfg.feishu_app_secret = config.app_secret;
    if creds_changed {
        cfg.feishu_session_id = None;
    }
    save_config(&app, &cfg)?;
    let _ = app.emit("feishu-config-changed", ());
    Ok(())
}

#[tauri::command]
pub fn get_feishu_status(app: AppHandle) -> FeishuStatus {
    use crate::feishu_bridge::BridgeStatusState;
    let state = app.state::<BridgeStatusState>();
    let guard = state.0.lock().unwrap_or_else(|e| e.into_inner());
    guard.clone()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn config_defaults() {
        let c: Config = serde_json::from_str("{}").unwrap();
        assert_eq!(c.workspace_path, "");
        assert_eq!(c.dashscope_api_key, "");
    }

    #[test]
    fn config_roundtrip() {
        let c = Config {
            dashscope_api_key: "key".into(),
            workspace_path: "/Users/test/notebook".into(),
            window_state: None,
            ..Config::default()
        };
        let json = serde_json::to_string(&c).unwrap();
        let c2: Config = serde_json::from_str(&json).unwrap();
        assert_eq!(c2.workspace_path, "/Users/test/notebook");
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
        assert_eq!(c.active_provider, "anthropic");
        assert!(c.providers.is_empty());
    }

    #[test]
    fn config_engine_fields_roundtrip() {
        let mut c = Config::default();
        c.active_provider = "ds1".into();
        c.providers.push(ProviderEntry {
            id: "ds1".into(),
            label: "阿里云百炼".into(),
            api_key: "sk-test".into(),
            base_url: "https://coding.dashscope.aliyuncs.com/apps/anthropic".into(),
            model: "qwen-max".into(),
        });
        let json = serde_json::to_string(&c).unwrap();
        let c2: Config = serde_json::from_str(&json).unwrap();
        assert_eq!(c2.active_provider, "ds1");
        assert_eq!(c2.providers[0].api_key, "sk-test");
    }

    #[test]
    fn config_legacy_migration_claude() {
        let json = r#"{"active_ai_engine":"claude","claude_code_api_key":"sk-ant-old","claude_code_model":"claude-3-opus"}"#;
        let mut c: Config = serde_json::from_str(json).unwrap();
        sanitize_engine_config(&mut c);
        assert_eq!(c.active_provider, "anthropic");
        let p = c.providers.iter().find(|p| p.id == "anthropic").unwrap();
        assert_eq!(p.api_key, "sk-ant-old");
        assert_eq!(p.model, "claude-3-opus");
    }

    #[test]
    fn config_legacy_migration_openai() {
        let json = r#"{"active_ai_engine":"openai","openai_code_api_key":"sk-qwen","openai_code_base_url":"https://dashscope.aliyuncs.com"}"#;
        let mut c: Config = serde_json::from_str(json).unwrap();
        sanitize_engine_config(&mut c);
        assert_eq!(c.active_provider, "dashscope");
        let p = c.providers.iter().find(|p| p.id == "dashscope").unwrap();
        assert_eq!(p.api_key, "sk-qwen");
    }

    #[test]
    fn config_asr_fields_default() {
        let c: Config = serde_json::from_str("{}").unwrap();
        assert_eq!(c.asr_engine, "apple");
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
        assert_eq!(c.active_provider, "anthropic");
        assert_eq!(c.asr_engine, "apple");
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

    #[test]
    fn sample_entry_created_defaults_to_false() {
        let c: Config = serde_json::from_str("{}").unwrap();
        assert!(!c.sample_entry_created);
    }

    #[test]
    fn sample_entry_created_roundtrip() {
        let c = Config {
            sample_entry_created: true,
            ..Config::default()
        };
        let json = serde_json::to_string(&c).unwrap();
        let c2: Config = serde_json::from_str(&json).unwrap();
        assert!(c2.sample_entry_created);
    }

    #[test]
    fn migration_dashscope_with_api_key_preserved() {
        // 升级用户 + dashscope + API Key 已配置 → 保持不变
        let mut c = Config {
            asr_engine: "dashscope".into(),
            dashscope_api_key: "sk-test-key".into(),
            ..Config::default()
        };
        sanitize_engine_config(&mut c);
        assert_eq!(c.asr_engine, "dashscope");
        assert_eq!(c.dashscope_api_key, "sk-test-key");
    }

    #[test]
    fn migration_apple_engine_stays_apple() {
        // Apple 引擎保持不变
        let mut c = Config {
            asr_engine: "apple".into(),
            ..Config::default()
        };
        sanitize_engine_config(&mut c);
        assert_eq!(c.asr_engine, "apple");
    }

    #[test]
    fn migration_new_user_defaults_to_apple() {
        // 新用户默认 apple（通过 default_asr_engine 实现）
        let c: Config = serde_json::from_str("{}").unwrap();
        assert_eq!(c.asr_engine, "apple");
    }

    #[test]
    fn migration_invalid_engine_falls_back_to_apple() {
        // 无效引擎名称回退为 apple
        let mut c = Config {
            asr_engine: "invalid_engine".into(),
            ..Config::default()
        };
        sanitize_engine_config(&mut c);
        assert_eq!(c.asr_engine, "apple");
    }
}

/// List available models from the configured engine's API.
#[tauri::command]
pub async fn list_models(
    _app: AppHandle,
    engine: String,
    api_key: String,
    base_url: String,
) -> Result<Vec<String>, String> {
    let effective_base_url = if base_url.is_empty() {
        default_base_url_for_vendor(&engine)
    } else {
        base_url
    };

    if api_key.is_empty() {
        return Err("API Key 未配置".to_string());
    }

    let client = reqwest::Client::new();
    let url = format!("{}/v1/models", effective_base_url.trim_end_matches('/'));

    let mut req = client.get(&url);
    req = req
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01");

    let response = req.send().await.map_err(|e| format!("请求失败: {}", e))?;

    let status = response.status().as_u16();
    if status >= 400 {
        let text = response.text().await.unwrap_or_default();
        return Err(format!("API 错误 ({}): {}", status, text));
    }

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析失败: {}", e))?;

    let mut models: Vec<String> = body["data"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|m| m["id"].as_str().map(|s| s.to_string()))
        .collect();

    models.sort();
    Ok(models)
}
