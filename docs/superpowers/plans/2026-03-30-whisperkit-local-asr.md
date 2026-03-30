# WhisperKit 本地 ASR 引擎实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在谨迹中新增 WhisperKit 作为本地 ASR 引擎，支持说话人识别，内置二进制，零安装门槛，与现有 DashScope 引擎并列。

**Architecture:** `whisperkit-cli` 预编译二进制放入 `src-tauri/binaries/`，Rust 通过 `tokio::process::Command` 调用（与 Claude CLI 调用方式一致，无需额外插件）。转录结果同时写 `transcript.json` sidecar 和格式化 markdown，markdown 作为 `prompt_text` 传给现有 AI 队列。

**Tech Stack:** Rust (tokio), Swift CLI (whisperkit-cli 预编译二进制), React/TypeScript (设置 UI)

---

## 文件结构

| 文件 | 操作 | 说明 |
|------|------|------|
| `src-tauri/binaries/whisperkit-cli-aarch64-apple-darwin` | 新增 | 预编译二进制（需手动下载） |
| `src-tauri/tauri.conf.json` | 修改 | 注册 externalBin |
| `src-tauri/src/config.rs` | 修改 | 新增 asr_engine、whisperkit_model 字段及 get/set 命令 |
| `src-tauri/src/transcription.rs` | 修改 | 新增 WhisperKit 转录路径，扩展 Transcript 类型加 segments |
| `src-tauri/src/recorder.rs` | 修改 | stop_recording 按 asr_engine 分支调用 |
| `src-tauri/src/main.rs` | 修改 | 注册新增 Tauri 命令 |
| `src/lib/tauri.ts` | 修改 | 新增 getAsrConfig / setAsrConfig 前端封装 |
| `src/types.ts` | 修改 | Transcript 扩展可选 segments 字段 |
| `src/settings/components/SectionVoice.tsx` | 重建 | 激活语音转写设置，双引擎选择 UI |
| `src-tauri/resources/workspace-template/.claude/CLAUDE.md` | 修改 | 新增录音转写处理指令 |

---

### Task 1: 下载 whisperkit-cli 二进制并注册 sidecar

**Files:**
- Create: `src-tauri/binaries/whisperkit-cli-aarch64-apple-darwin`
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: 从 Homebrew 提取预编译二进制**

```bash
# 先确认 brew 已安装 whisperkit-cli（如果本机没有则临时安装）
brew install whisperkit-cli

# 找到二进制位置
which whisperkit-cli
# 通常是 /opt/homebrew/bin/whisperkit-cli

# 创建 binaries 目录并复制
mkdir -p src-tauri/binaries
cp /opt/homebrew/bin/whisperkit-cli src-tauri/binaries/whisperkit-cli-aarch64-apple-darwin
chmod +x src-tauri/binaries/whisperkit-cli-aarch64-apple-darwin
```

- [ ] **Step 2: 验证二进制可运行**

```bash
src-tauri/binaries/whisperkit-cli-aarch64-apple-darwin --help
```

期望输出：包含 `transcribe`、`diarize` 等子命令的帮助文本。

- [ ] **Step 3: 注册到 tauri.conf.json**

在 `src-tauri/tauri.conf.json` 的 `bundle` 节点下添加 `externalBin`：

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Jinji",
  "version": "0.4.2",
  "identifier": "com.journal.app",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "谨迹",
        "width": 960,
        "height": 680,
        "minWidth": 580,
        "minHeight": 400,
        "resizable": true,
        "titleBarStyle": "Overlay",
        "hiddenTitle": true,
        "dragDropEnabled": true
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "externalBin": [
      "binaries/whisperkit-cli"
    ]
  }
}
```

- [ ] **Step 4: 将二进制加入 .gitignore（体积太大不适合提交）**

在 `.gitignore` 或 `src-tauri/.gitignore` 中添加：

```
binaries/whisperkit-cli-aarch64-apple-darwin
```

- [ ] **Step 5: 确认构建不报错**

```bash
cd src-tauri && cargo build 2>&1 | tail -5
```

期望：无 error，可有警告。

- [ ] **Step 6: Commit**

```bash
git add src-tauri/tauri.conf.json src-tauri/.gitignore
git commit -m "chore: register whisperkit-cli as tauri sidecar externalBin"
```

---

### Task 2: Config — 新增 ASR 引擎配置字段和命令

**Files:**
- Modify: `src-tauri/src/config.rs`

- [ ] **Step 1: 写失败测试**

在 `src-tauri/src/config.rs` 的 `#[cfg(test)] mod tests` 块末尾添加：

```rust
#[test]
fn config_asr_fields_default() {
    let c: Config = serde_json::from_str("{}").unwrap();
    assert_eq!(c.asr_engine, "dashscope");
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
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd src-tauri && cargo test config_asr 2>&1 | tail -20
```

期望：编译错误 "no field `asr_engine`"。

- [ ] **Step 3: 在 Config struct 中添加字段和默认值函数**

在 `src-tauri/src/config.rs` 的 `Config` struct 中，在最后一个 `qwen_code_model` 字段后添加：

```rust
    // ASR 引擎配置
    #[serde(default = "default_asr_engine")]
    pub asr_engine: String,          // "dashscope" | "whisperkit"
    #[serde(default = "default_whisperkit_model")]
    pub whisperkit_model: String,    // "base" | "small" | "large-v3-turbo"
```

在 `default_active_engine()` 函数后添加两个默认值函数：

```rust
fn default_asr_engine() -> String {
    "dashscope".to_string()
}

fn default_whisperkit_model() -> String {
    "base".to_string()
}
```

- [ ] **Step 4: 添加 AsrConfig 结构体和 Tauri 命令**

在 `EngineConfig` struct 定义之后添加：

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AsrConfig {
    pub asr_engine: String,
    pub dashscope_api_key: String,
    pub whisperkit_model: String,
}
```

在文件末尾（`#[cfg(test)]` 之前）添加两个 Tauri 命令：

```rust
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
    let valid_models = ["base", "small", "large-v3-turbo"];
    if !valid_models.contains(&whisperkit_model.as_str()) {
        return Err(format!("invalid whisperkit_model: {}", whisperkit_model));
    }
    let mut c = load_config(&app)?;
    c.asr_engine = asr_engine;
    c.dashscope_api_key = dashscope_api_key;
    c.whisperkit_model = whisperkit_model;
    save_config(&app, &c)
}
```

- [ ] **Step 5: 运行测试确认通过**

```bash
cd src-tauri && cargo test config_asr 2>&1 | tail -10
```

期望：`test config_asr_fields_default ... ok` 和 `test config_asr_fields_roundtrip ... ok`

- [ ] **Step 6: 确认全量测试仍然通过**

```bash
cd src-tauri && cargo test 2>&1 | tail -10
```

期望：所有测试 ok，无 error。

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/config.rs
git commit -m "feat: add asr_engine and whisperkit_model config fields"
```

---

### Task 3: transcription.rs — 扩展 Transcript 类型和 WhisperKit 转录路径

**Files:**
- Modify: `src-tauri/src/transcription.rs`

注意：当前 `save_transcript` 把 sidecar 存到 `raw/../transcripts/<stem>.json`，即 workspace 的 `yyMM/transcripts/` 目录。`recordings.rs` 里的 `list_recordings` 读的是 `app_data_dir/transcripts/`。这两个路径不同，是现有设计——WhisperKit 路径沿用 `save_transcript` 的同一函数，不引入新路径。

- [ ] **Step 1: 写失败测试**

在 `transcription.rs` 末尾（文件最后，无 cfg(test) 块时新建，已有则在块内追加）：

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_segments_as_markdown_basic() {
        let segments = vec![
            WhisperSegment { speaker: Some("SPEAKER_00".into()), start: 0.0, end: 3.0, text: "大家好".into() },
            WhisperSegment { speaker: Some("SPEAKER_01".into()), start: 3.5, end: 7.0, text: "你好".into() },
        ];
        let md = format_diarized_markdown(&segments);
        assert!(md.contains("**Speaker A**"), "should map SPEAKER_00 to Speaker A");
        assert!(md.contains("**Speaker B**"), "should map SPEAKER_01 to Speaker B");
        assert!(md.contains("(0:00)"), "should format start time");
        assert!(md.contains("大家好"));
        assert!(md.contains("你好"));
    }

    #[test]
    fn format_segments_merges_adjacent_same_speaker() {
        let segments = vec![
            WhisperSegment { speaker: Some("SPEAKER_00".into()), start: 0.0, end: 2.0, text: "第一句".into() },
            WhisperSegment { speaker: Some("SPEAKER_00".into()), start: 2.1, end: 4.0, text: "第二句".into() },
            WhisperSegment { speaker: Some("SPEAKER_01".into()), start: 4.5, end: 6.0, text: "回应".into() },
        ];
        let md = format_diarized_markdown(&segments);
        // SPEAKER_00 header should appear only once
        let count = md.matches("**Speaker A**").count();
        assert_eq!(count, 1, "adjacent same-speaker segments should be merged");
    }

    #[test]
    fn format_segments_time_format() {
        let segments = vec![
            WhisperSegment { speaker: Some("SPEAKER_00".into()), start: 65.0, end: 70.0, text: "一分钟后".into() },
        ];
        let md = format_diarized_markdown(&segments);
        assert!(md.contains("(1:05)"), "65 seconds should format as 1:05");
    }

    #[test]
    fn format_segments_no_speaker_fallback() {
        let segments = vec![
            WhisperSegment { speaker: None, start: 0.0, end: 2.0, text: "无说话人".into() },
        ];
        let md = format_diarized_markdown(&segments);
        assert!(md.contains("无说话人"), "text should be present even without speaker");
    }
}
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd src-tauri && cargo test format_segments 2>&1 | tail -20
```

期望：编译错误 "cannot find type `WhisperSegment`" 或 "cannot find function `format_diarized_markdown`"。

- [ ] **Step 3: 扩展 Transcript 结构体，添加 WhisperSegment 和辅助函数**

在 `transcription.rs` 顶部的类型定义区域，修改 `Transcript` struct 并新增 `WhisperSegment`：

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhisperSegment {
    pub speaker: Option<String>,
    pub start: f64,
    pub end: f64,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transcript {
    pub status: String,
    pub text: String,
    #[serde(default)]
    pub segments: Vec<WhisperSegment>,
}
```

- [ ] **Step 4: 添加 format_diarized_markdown 函数**

在 `save_transcript` 函数之前添加：

```rust
/// 将说话人分段列表格式化为 markdown 纯文本。
/// 相邻同说话人段落合并；时间戳格式 M:SS。
pub fn format_diarized_markdown(segments: &[WhisperSegment]) -> String {
    if segments.is_empty() {
        return String::new();
    }

    // 说话人 ID → 匿名标签映射（SPEAKER_00 → A, SPEAKER_01 → B, ...）
    let mut speaker_map: std::collections::HashMap<String, char> = std::collections::HashMap::new();
    let mut next_label = b'A';
    for seg in segments {
        if let Some(ref sp) = seg.speaker {
            if !speaker_map.contains_key(sp) {
                speaker_map.insert(sp.clone(), next_label as char);
                next_label += 1;
            }
        }
    }

    let label_for = |speaker: &Option<String>| -> String {
        match speaker {
            Some(sp) => speaker_map.get(sp)
                .map(|c| format!("Speaker {}", c))
                .unwrap_or_else(|| "Speaker ?".to_string()),
            None => "Speaker ?".to_string(),
        }
    };

    let fmt_time = |secs: f64| -> String {
        let total = secs as u64;
        let m = total / 60;
        let s = total % 60;
        format!("{}:{:02}", m, s)
    };

    let mut result = String::new();
    let mut current_speaker: Option<String> = None;
    let mut current_start = 0.0f64;
    let mut current_text = String::new();

    for seg in segments {
        let same_speaker = current_speaker == seg.speaker;
        if same_speaker && !current_text.is_empty() {
            // 合并相邻同说话人段落
            current_text.push(' ');
            current_text.push_str(seg.text.trim());
        } else {
            // 写出上一个说话人块
            if !current_text.is_empty() {
                let label = label_for(&current_speaker);
                result.push_str(&format!(
                    "**{}** ({})\n{}\n\n",
                    label,
                    fmt_time(current_start),
                    current_text.trim()
                ));
            }
            current_speaker = seg.speaker.clone();
            current_start = seg.start;
            current_text = seg.text.trim().to_string();
        }
    }

    // 写出最后一个块
    if !current_text.is_empty() {
        let label = label_for(&current_speaker);
        result.push_str(&format!(
            "**{}** ({})\n{}\n\n",
            label,
            fmt_time(current_start),
            current_text.trim()
        ));
    }

    result.trim_end().to_string()
}
```

- [ ] **Step 5: 运行测试确认通过**

```bash
cd src-tauri && cargo test format_segments 2>&1 | tail -15
```

期望：4 个测试全部 ok。

- [ ] **Step 6: 添加 WhisperKit 转录主函数**

在 `start_transcription` 函数后添加（`get_transcript` 之前）：

```rust
/// WhisperKit 转录：调用 whisperkit-cli sidecar，返回格式化 markdown 文本。
/// 同时将 diarized transcript 写入 sidecar 文件（供 UI 展示）。
pub async fn transcribe_with_whisperkit(
    app: AppHandle,
    file_path: PathBuf,
    model: String,
) -> Result<String, String> {
    let filename = file_path.file_name().unwrap_or_default().to_string_lossy().to_string();

    // 模型缓存目录：app_data_dir/whisperkit-models/
    let model_cache_dir = app.path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("whisperkit-models");
    let _ = std::fs::create_dir_all(&model_cache_dir);

    // 找到 sidecar 二进制路径（dev 模式用系统 PATH，bundle 模式用 Tauri resource 路径）
    let cli_path = app.path()
        .resource_dir()
        .ok()
        .map(|d| d.join("binaries").join("whisperkit-cli-aarch64-apple-darwin"))
        .filter(|p| p.exists())
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "whisperkit-cli".to_string());

    let _ = app.emit("transcription-progress", serde_json::json!({
        "filename": filename, "status": "transcribing"
    }));

    let output = tokio::process::Command::new(&cli_path)
        .args([
            "transcribe",
            "--audio-path", file_path.to_str().unwrap_or(""),
            "--diarization",
            "--output-type", "verbose_json",
            "--language", "zh",
            "--model-cache-dir", model_cache_dir.to_str().unwrap_or(""),
            "--model", &model,
        ])
        .output()
        .await
        .map_err(|e| format!("启动 whisperkit-cli 失败: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        save_transcript(&app, &file_path, "failed", &format!("whisperkit 失败: {}", stderr));
        return Err(format!("whisperkit-cli 退出码非零: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();

    // 解析 verbose_json 输出
    let parsed: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|e| format!("解析 whisperkit 输出失败: {}", e))?;

    let segments: Vec<WhisperSegment> = parsed
        .get("segments")
        .and_then(|s| s.as_array())
        .map(|arr| arr.iter().filter_map(|item| {
            Some(WhisperSegment {
                speaker: item.get("speaker").and_then(|v| v.as_str()).map(String::from),
                start: item.get("start").and_then(|v| v.as_f64()).unwrap_or(0.0),
                end: item.get("end").and_then(|v| v.as_f64()).unwrap_or(0.0),
                text: item.get("text").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            })
        }).collect())
        .unwrap_or_default();

    // 全文拼接（向后兼容 UI 展示）
    let full_text: String = segments.iter()
        .map(|s| s.text.trim())
        .collect::<Vec<_>>()
        .join(" ");

    // 写 sidecar
    let raw_dir = file_path.parent().unwrap_or(file_path.as_path());
    let transcripts_dir = raw_dir.parent().unwrap_or(raw_dir).join("transcripts");
    let _ = std::fs::create_dir_all(&transcripts_dir);
    let base = file_path.file_stem().unwrap_or_default().to_string_lossy();
    let json_path = transcripts_dir.join(format!("{}.json", base));
    let transcript = Transcript {
        status: "completed".to_string(),
        text: full_text,
        segments: segments.clone(),
    };
    if let Ok(data) = serde_json::to_string(&transcript) {
        let _ = std::fs::write(&json_path, data);
    }

    let _ = app.emit("transcription-progress", serde_json::json!({
        "filename": filename, "status": "completed"
    }));

    Ok(format_diarized_markdown(&segments))
}
```

- [ ] **Step 7: 确认编译通过**

```bash
cd src-tauri && cargo build 2>&1 | grep -E "^error" | head -20
```

期望：无 error 行。

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/transcription.rs
git commit -m "feat: add WhisperKit transcription path with diarization and markdown formatting"
```

---

### Task 4: config.rs — 注册新命令到 main.rs

**Files:**
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: 在 invoke_handler 中注册新命令**

在 `src-tauri/src/main.rs` 的 `invoke_handler` 列表中，在 `config::get_app_version,` 后添加：

```rust
            config::get_asr_config,
            config::set_asr_config,
```

- [ ] **Step 2: 确认编译通过**

```bash
cd src-tauri && cargo build 2>&1 | grep -E "^error" | head -20
```

期望：无 error。

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/main.rs
git commit -m "feat: register get_asr_config and set_asr_config commands"
```

---

### Task 5: recorder.rs — 按 asr_engine 分支调用转录

**Files:**
- Modify: `src-tauri/src/recorder.rs`

- [ ] **Step 1: 修改 stop_recording 的后处理分支**

在 `recorder.rs` 的 `stop_recording` 函数中，找到 `spawn_blocking` 闭包内调用 `transcription::start_transcription` 的部分：

```rust
        crate::transcription::start_transcription(
            app_clone,
            filename,
            output_path,
            duration_secs,
        );

        tauri::async_runtime::spawn(async move {
            let current_task = app_for_ai.state::<crate::ai_processor::CurrentTask>();
            let _ = crate::ai_processor::process_material(&app_for_ai, &path_for_ai, &ym_for_ai, None, None, &current_task).await;
        });
```

替换为：

```rust
        let asr_engine = crate::config::load_config(&app_clone)
            .map(|c| c.asr_engine)
            .unwrap_or_else(|_| "dashscope".to_string());
        let whisperkit_model = crate::config::load_config(&app_clone)
            .map(|c| c.whisperkit_model)
            .unwrap_or_else(|_| "base".to_string());

        if asr_engine == "whisperkit" {
            let app_wk = app_clone.clone();
            let path_wk = output_path.clone();
            let ym_wk = ym_for_ai.clone();
            tauri::async_runtime::spawn(async move {
                let markdown = match crate::transcription::transcribe_with_whisperkit(
                    app_wk.clone(),
                    path_wk.clone(),
                    whisperkit_model,
                ).await {
                    Ok(md) => md,
                    Err(e) => {
                        eprintln!("[recorder] whisperkit failed: {}", e);
                        return;
                    }
                };
                let prompt_text = format!(
                    "以下是一段录音的说话人转写内容：\n\n{}\n\n请整理为日志条目并直接写文件，不要输出任何解释。\n文件名格式：DD-标题.md，写在 {}/ 目录下（不要写到 raw/ 里）。",
                    markdown, ym_wk
                );
                let current_task = app_wk.state::<crate::ai_processor::CurrentTask>();
                let path_str = path_wk.to_string_lossy().to_string();
                let _ = crate::ai_processor::process_material(
                    &app_wk, &path_str, &ym_wk, None, Some(&prompt_text), &current_task
                ).await;
            });
        } else {
            // 现有 DashScope 路径不变
            crate::transcription::start_transcription(
                app_clone,
                filename,
                output_path,
                duration_secs,
            );
            tauri::async_runtime::spawn(async move {
                let current_task = app_for_ai.state::<crate::ai_processor::CurrentTask>();
                let _ = crate::ai_processor::process_material(&app_for_ai, &path_for_ai, &ym_for_ai, None, None, &current_task).await;
            });
        }
```

- [ ] **Step 2: 确认编译通过**

```bash
cd src-tauri && cargo build 2>&1 | grep -E "^error" | head -20
```

期望：无 error。

- [ ] **Step 3: 全量 Rust 测试**

```bash
cd src-tauri && cargo test 2>&1 | tail -15
```

期望：所有测试通过。

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/recorder.rs
git commit -m "feat: branch stop_recording on asr_engine for WhisperKit path"
```

---

### Task 6: 前端类型和 IPC 封装

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: 扩展 Transcript 类型（src/types.ts）**

找到 `Transcript` interface：

```typescript
export interface Transcript {
  status: TranscriptionProgress
  text: string
}
```

替换为：

```typescript
export interface TranscriptSegment {
  speaker: string | null
  start: number
  end: number
  text: string
}

export interface Transcript {
  status: TranscriptionProgress
  text: string
  segments?: TranscriptSegment[]
}
```

- [ ] **Step 2: 添加 AsrConfig IPC 封装（src/lib/tauri.ts）**

在文件末尾追加：

```typescript
// ASR config
export interface AsrConfig {
  asr_engine: 'dashscope' | 'whisperkit'
  dashscope_api_key: string
  whisperkit_model: 'base' | 'small' | 'large-v3-turbo'
}

export const getAsrConfig = (): Promise<AsrConfig> =>
  invoke<AsrConfig>('get_asr_config')

export const setAsrConfig = (cfg: AsrConfig): Promise<void> =>
  invoke<void>('set_asr_config', { ...cfg })
```

- [ ] **Step 3: 确认前端编译通过**

```bash
npm run build 2>&1 | grep -E "error TS" | head -20
```

期望：无 TypeScript 错误。

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/lib/tauri.ts
git commit -m "feat: add TranscriptSegment type and AsrConfig IPC bindings"
```

---

### Task 7: SectionVoice.tsx — 激活语音转写设置 UI

**Files:**
- Modify: `src/settings/components/SectionVoice.tsx`

当前该组件是完全禁用的占位，本次完整重建为双引擎选择 UI，风格与 `SectionAiEngine.tsx` 一致。

- [ ] **Step 1: 完整替换 SectionVoice.tsx**

```typescript
import { useState, useEffect } from 'react'
import { Cloud, Cpu } from 'lucide-react'
import { getAsrConfig, setAsrConfig, type AsrConfig } from '../../lib/tauri'
import SkeletonRow from './SkeletonRow'

type AsrEngineId = 'dashscope' | 'whisperkit'
type WhisperModel = 'base' | 'small' | 'large-v3-turbo'

const sectionStyle: React.CSSProperties = { padding: '28px 28px 180px', borderBottom: '1px solid var(--divider)' }
const labelStyle: React.CSSProperties = { fontSize: 11, color: 'var(--item-meta)', marginBottom: 5, display: 'block' }
const hintStyle: React.CSSProperties = { fontSize: 10, color: 'var(--duration-text)', marginTop: 4, lineHeight: 1.5 }
const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
  borderRadius: 6, padding: '7px 10px', fontSize: 12, color: 'var(--item-text)',
  fontFamily: 'ui-monospace, monospace', outline: 'none', boxSizing: 'border-box',
}

const WHISPER_MODELS: { id: WhisperModel; label: string; size: string; hint: string }[] = [
  { id: 'base',           label: 'Base',           size: '~74MB',  hint: '默认，下载快，中文效果一般' },
  { id: 'small',          label: 'Small',          size: '~244MB', hint: '中文效果好，适合会议记录' },
  { id: 'large-v3-turbo', label: 'Large v3 Turbo', size: '~809MB', hint: '最佳中文效果，首次下载较慢' },
]

export default function SectionVoice() {
  const [cfg, setCfg] = useState<AsrConfig>({
    asr_engine: 'dashscope',
    dashscope_api_key: '',
    whisperkit_model: 'base',
  })
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getAsrConfig().then(c => {
      setCfg(c)
      setLoading(false)
    })
  }, [])

  const handleSave = async () => {
    await setAsrConfig(cfg)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const ENGINES: { id: AsrEngineId; label: string; vendor: string; icon: typeof Cloud }[] = [
    { id: 'dashscope',  label: 'DashScope',  vendor: '阿里云 · 云端', icon: Cloud },
    { id: 'whisperkit', label: 'WhisperKit', vendor: 'Argmax · 本地',  icon: Cpu  },
  ]

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 11, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 16, fontWeight: 500 }}>语音转写</div>

      {loading ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
            <SkeletonRow height={90} mb={0} />
            <SkeletonRow height={90} mb={0} />
          </div>
          <SkeletonRow height={32} mb={14} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <SkeletonRow height={30} width={60} mb={0} />
          </div>
        </>
      ) : (
        <div style={{ animation: 'section-fadein 160ms ease-out both' }}>
          {/* 引擎选择卡片 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
            {ENGINES.map(({ id, label, vendor, icon: Icon }) => {
              const isActive = cfg.asr_engine === id
              return (
                <div
                  key={id}
                  onClick={() => setCfg(prev => ({ ...prev, asr_engine: id }))}
                  style={{
                    background: isActive ? 'rgba(200,147,58,0.08)' : 'var(--detail-case-bg)',
                    border: `1px solid ${isActive ? 'var(--record-btn)' : 'var(--divider)'}`,
                    borderRadius: 10, padding: '14px 12px 12px',
                    textAlign: 'center' as const, cursor: 'pointer',
                  }}
                >
                  <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'center' }}>
                    <Icon size={22} strokeWidth={1.5} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: isActive ? 'var(--record-btn)' : 'var(--item-meta)' }}>{label}</div>
                  <div style={{ fontSize: 10, color: 'var(--duration-text)', marginTop: 2 }}>{vendor}</div>
                </div>
              )
            })}
          </div>

          <div style={{ height: 1, background: 'var(--divider)', margin: '0 0 14px' }} />

          {/* DashScope 配置 */}
          {cfg.asr_engine === 'dashscope' && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>DashScope API Key</label>
              <input
                type="password"
                style={inputStyle}
                placeholder="sk-…"
                value={cfg.dashscope_api_key}
                onChange={e => setCfg(prev => ({ ...prev, dashscope_api_key: e.target.value }))}
              />
              <div style={hintStyle}>配置后，录音将自动上传至阿里云转写</div>
            </div>
          )}

          {/* WhisperKit 配置 */}
          {cfg.asr_engine === 'whisperkit' && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>转写模型</label>
              <select
                style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' as const }}
                value={cfg.whisperkit_model}
                onChange={e => setCfg(prev => ({ ...prev, whisperkit_model: e.target.value as WhisperModel }))}
              >
                {WHISPER_MODELS.map(m => (
                  <option key={m.id} value={m.id}>{m.label} ({m.size})</option>
                ))}
              </select>
              <div style={hintStyle}>
                {WHISPER_MODELS.find(m => m.id === cfg.whisperkit_model)?.hint}
                <br />模型首次使用时自动下载，存储在本机，之后离线可用。
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
            {saved && <span style={{ fontSize: 11, color: '#34c759' }}>已保存</span>}
            <button onClick={handleSave} style={{
              background: 'var(--record-btn)', border: 'none', borderRadius: 5,
              padding: '6px 18px', fontSize: 12, fontWeight: 600,
              color: 'var(--bg)', cursor: 'pointer',
            }}>保存</button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 确认前端编译通过**

```bash
npm run build 2>&1 | grep -E "error TS" | head -20
```

期望：无错误。

- [ ] **Step 3: 启动开发模式目测 UI**

```bash
npm run dev
```

打开设置 → 语音转写，确认：
- 两个引擎卡片可点击切换
- 选 DashScope 显示 API Key 输入框
- 选 WhisperKit 显示模型下拉，hint 随选项变化

- [ ] **Step 4: Commit**

```bash
git add src/settings/components/SectionVoice.tsx
git commit -m "feat: rebuild SectionVoice with dual-engine ASR selection UI"
```

---

### Task 8: workspace CLAUDE.md — 新增录音转写处理指令

**Files:**
- Modify: `src-tauri/resources/workspace-template/.claude/CLAUDE.md`

- [ ] **Step 1: 在文件末尾追加录音转写章节**

读取当前内容后，在末尾追加：

```markdown

## 录音转写

收到带说话人标注的转写内容时（格式如下），按说话人整理对话，保留发言归属：

```
**Speaker A** (0:00)
发言内容...

**Speaker B** (0:15)
回应内容...
```

整理为日志时：每位说话人的发言单独成段，在段落开头标注说话人（如「A：」或「与会者 A：」），保留时间顺序。
```

- [ ] **Step 2: 确认 Rust 编译通过（include_str! 重新嵌入）**

```bash
cd src-tauri && cargo build 2>&1 | grep -E "^error" | head -10
```

期望：无 error。

- [ ] **Step 3: Commit**

```bash
git add src-tauri/resources/workspace-template/.claude/CLAUDE.md
git commit -m "feat: add diarized transcript handling instruction to workspace CLAUDE.md"
```

---

### Task 9: About 页面添加 WhisperKit 版权声明

**Files:**
- Modify: `src/settings/components/SectionAbout.tsx`

- [ ] **Step 1: 读取 SectionAbout.tsx 找到版权信息区域**

```bash
grep -n "MIT\|license\|License\|开源\|copyright\|Copyright" src/settings/components/SectionAbout.tsx
```

- [ ] **Step 2: 在现有版权信息区域添加 WhisperKit 声明**

找到展示版权或第三方组件的位置，添加：

```tsx
<div style={{ fontSize: 10, color: 'var(--duration-text)', marginTop: 8, lineHeight: 1.6 }}>
  本应用内置 <a
    href="#"
    onClick={e => { e.preventDefault(); invoke('open_with_system', { path: 'https://github.com/argmaxinc/WhisperKit' }) }}
    style={{ color: 'var(--item-meta)' }}
  >WhisperKit</a>（MIT License）by Argmax, Inc.
</div>
```

如果 SectionAbout 没有合适位置，在 section 最底部添加即可。

- [ ] **Step 3: 确认前端编译**

```bash
npm run build 2>&1 | grep -E "error TS" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add src/settings/components/SectionAbout.tsx
git commit -m "chore: add WhisperKit MIT license attribution in About section"
```

---

### Task 10: 端到端验证

**Files:** 无新文件，验证已有功能

- [ ] **Step 1: 全量 Rust 测试**

```bash
cd src-tauri && cargo test 2>&1 | tail -20
```

期望：所有测试通过，无 error。

- [ ] **Step 2: 全量前端测试**

```bash
npm test 2>&1 | tail -20
```

期望：所有测试通过。

- [ ] **Step 3: 构建 app**

```bash
npm run build
```

期望：tsc + vite 构建成功，无 error。

- [ ] **Step 4: 手动验证 DashScope 路径未受影响**

启动 app（`npm run tauri dev`），在设置 → 语音转写中选择 DashScope，确认：
- API Key 输入框正常显示
- 保存后 config.json 的 `asr_engine` 为 `"dashscope"`

- [ ] **Step 5: 手动验证 WhisperKit 路径**

在设置中切换到 WhisperKit，选模型 `base`，保存，然后录一段 10 秒以上的音频，确认：
- 录音结束后出现转写进度提示
- whisperkit-cli 被调用（可在终端日志中看到 `[recorder]` 输出）
- 转写完成后触发 AI 处理，最终生成 `.md` 日志文件

- [ ] **Step 6: 最终 commit（如有遗漏改动）**

```bash
git status
# 确认无意外未提交文件
```

---

## 自检结果

**Spec 覆盖：**
- [x] whisperkit-cli 内置 sidecar → Task 1
- [x] Config 字段 asr_engine / whisperkit_model → Task 2
- [x] transcription.rs WhisperKit 路径 + markdown 格式化 → Task 3
- [x] Tauri 命令注册 → Task 4
- [x] recorder.rs 分支调用 → Task 5
- [x] 前端类型 + IPC → Task 6
- [x] SectionVoice UI 重建 → Task 7
- [x] workspace CLAUDE.md 更新 → Task 8
- [x] MIT License 声明 → Task 9
- [x] 端到端验证 → Task 10
- [x] Intel Mac 处理：whisperkit-cli 在 Intel 上不存在（不在 PATH），`tokio::process::Command` 调用失败时 `transcribe_with_whisperkit` 返回 `Err`，recorder 中捕获并 `eprintln!` 记录；UI 侧可在后续 Task 加提示，但基本静默失败不崩溃（符合 spec 的"开放问题"处理方向）

**类型一致性：**
- `WhisperSegment` 定义于 Task 3，`format_diarized_markdown` 接受 `&[WhisperSegment]`，与测试一致
- `AsrConfig` 定义于 Task 2（Rust）和 Task 6（TypeScript），字段名完全对应
- `Transcript.segments` 在 Task 3（Rust）和 Task 6（TypeScript）均为可选字段，向后兼容
