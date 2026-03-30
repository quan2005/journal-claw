# Settings & Speech-to-Text Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a settings window for DashScope API key configuration, and automatic speech-to-text transcription for recordings > 30s using DashScope's qwen3-asr-flash-filetrans model.

**Architecture:** All DashScope API calls happen in Rust (reqwest). Config stored as JSON file. Transcription auto-triggers after recording stops. Results pushed to frontend via Tauri events. Frontend uses master-detail layout with a right-side detail panel.

**Tech Stack:** Rust (reqwest, serde), React 19, Tauri v2 (multi-window, events), DashScope ASR API, Vite (multi-entry)

**Design Spec:** `docs/superpowers/specs/2026-03-13-settings-and-stt-design.md`

---

## Chunk 1: Config Module (Rust Side)

### Task 1: Create config.rs with read/write

**Files:**
- Create: `src-tauri/src/config.rs`

- [ ] **Step 1: Create config.rs**

```rust
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct Config {
    #[serde(default)]
    pub dashscope_api_key: String,
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join("config.json"))
}

pub fn load_config(app: &AppHandle) -> Result<Config, String> {
    let path = config_path(app)?;
    if !path.exists() {
        return Ok(Config::default());
    }
    let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&data).map_err(|e| e.to_string())
}

fn save_config(app: &AppHandle, config: &Config) -> Result<(), String> {
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
```

- [ ] **Step 2: Register config module in main.rs**

In `src-tauri/src/main.rs`, add `mod config;` at the top and register commands:

```rust
mod config;
mod types;
mod recordings;
mod recorder;
mod audio_process;

fn main() {
    tauri::Builder::default()
        .manage(recorder::RecorderState(std::sync::Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            recordings::list_recordings,
            recordings::delete_recording,
            recordings::reveal_in_finder,
            recordings::play_recording,
            recorder::start_recording,
            recorder::stop_recording,
            config::get_api_key,
            config::set_api_key,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Update capabilities**

In `src-tauri/capabilities/default.json`, add event permission for transcription events:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-start-dragging",
    "core:event:default"
  ]
}
```

- [ ] **Step 4: Build to verify Rust compiles**

Run: `cd /Users/yanwu/Projects/github/journal && cargo check --manifest-path src-tauri/Cargo.toml`
Expected: Compiles successfully

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/config.rs src-tauri/src/main.rs src-tauri/capabilities/default.json
git commit -m "feat: add config module for API key storage"
```

---

## Chunk 2: Settings Window

### Task 2: Configure Vite multi-entry + create settings HTML

**Files:**
- Modify: `vite.config.ts`
- Create: `settings.html` (in project root, next to `index.html`)

- [ ] **Step 1: Update vite.config.ts for multi-entry build**

Add `build.rollupOptions.input` to handle two HTML entry points:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        settings: resolve(__dirname, 'settings.html'),
      },
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
```

- [ ] **Step 2: Create settings.html**

In project root (`/Users/yanwu/Projects/github/journal/settings.html`):

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>设置 - Journal</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/settings/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts settings.html
git commit -m "feat: configure Vite multi-entry for settings window"
```

---

### Task 3: Create settings React app

**Files:**
- Create: `src/settings/main.tsx`
- Create: `src/settings/App.tsx`

- [ ] **Step 1: Create src/settings/main.tsx**

```typescript
import '../styles/globals.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import SettingsApp from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SettingsApp />
  </React.StrictMode>
)
```

- [ ] **Step 2: Create src/settings/App.tsx**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'

export default function SettingsApp() {
  const [key, setKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    invoke<string | null>('get_api_key').then(k => {
      setKey(k ?? '')
      setLoading(false)
    })
  }, [])

  const handleSave = useCallback(async () => {
    await invoke('set_api_key', { key })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [key])

  if (loading) return null

  return (
    <div style={{
      padding: 24,
      maxWidth: 480,
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
    }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>DashScope API Key</h2>
      <input
        type="password"
        value={key}
        onChange={e => setKey(e.target.value)}
        placeholder="sk-..."
        style={{
          width: '100%',
          padding: '8px 12px',
          fontSize: 14,
          border: '1px solid var(--divider)',
          borderRadius: 8,
          outline: 'none',
          background: 'var(--bg)',
          color: 'var(--item-text)',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 12, gap: 12 }}>
        <button
          onClick={handleSave}
          style={{
            padding: '6px 16px',
            fontSize: 14,
            background: 'var(--record-btn)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          保存
        </button>
        {saved && <span style={{ fontSize: 13, color: 'var(--item-meta)' }}>已保存</span>}
      </div>
      <p style={{ fontSize: 12, color: 'var(--item-meta)', marginTop: 16, lineHeight: 1.5 }}>
        配置后，超过 30 秒的录音将自动转写为文字。
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Verify dev server starts with both entry points**

Run: `cd /Users/yanwu/Projects/github/journal && npx vite build 2>&1 | head -20`
Expected: Both `index.html` and `settings.html` are processed

- [ ] **Step 4: Commit**

```bash
git add src/settings/
git commit -m "feat: create settings React app for API key configuration"
```

---

### Task 4: Add open_settings Tauri command

**Files:**
- Modify: `src-tauri/src/config.rs`
- Modify: `src-tauri/src/main.rs`
- Create: `src-tauri/capabilities/settings.json`
- Modify: `src-tauri/tauri.conf.json` — update main window minWidth

- [ ] **Step 1: Add open_settings command to config.rs**

Append to `src-tauri/src/config.rs`:

```rust
use tauri::WebviewUrl;
use tauri::WebviewWindowBuilder;

#[tauri::command]
pub fn open_settings(app: AppHandle) -> Result<(), String> {
    // If settings window already exists, focus it
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
```

- [ ] **Step 2: Register open_settings in main.rs**

Add `config::open_settings` to the `invoke_handler` list in `src-tauri/src/main.rs`:

```rust
        .invoke_handler(tauri::generate_handler![
            recordings::list_recordings,
            recordings::delete_recording,
            recordings::reveal_in_finder,
            recordings::play_recording,
            recorder::start_recording,
            recorder::stop_recording,
            config::get_api_key,
            config::set_api_key,
            config::open_settings,
        ])
```

- [ ] **Step 3: Create settings capability**

Create `src-tauri/capabilities/settings.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "settings-capability",
  "description": "Capability for the settings window",
  "windows": ["settings"],
  "permissions": [
    "core:default"
  ]
}
```

- [ ] **Step 4: Update main window minWidth in tauri.conf.json**

In `src-tauri/tauri.conf.json`, change `minWidth` from 280 to 500:

```json
"windows": [
  {
    "title": "Journal",
    "width": 320,
    "height": 480,
    "minWidth": 500,
    "minHeight": 360,
    "resizable": true,
    "titleBarStyle": "Overlay"
  }
]
```

- [ ] **Step 5: Build to verify**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: Compiles successfully

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/config.rs src-tauri/src/main.rs src-tauri/capabilities/settings.json src-tauri/tauri.conf.json
git commit -m "feat: add settings window with open_settings command"
```

---

### Task 5: Add settings button to TitleBar

**Files:**
- Modify: `src/components/TitleBar.tsx`
- Modify: `src/App.tsx` — pass onOpenSettings to TitleBar

- [ ] **Step 1: Update TitleBar.tsx with gear button**

```typescript
import { invoke } from '@tauri-apps/api/core'

interface TitleBarProps {
  onOpenSettings: () => void
}

export function TitleBar({ onOpenSettings }: TitleBarProps) {
  return (
    <div
      data-tauri-drag-region
      style={{
        height: 36,
        background: 'var(--titlebar-bg)',
        borderBottom: '1px solid var(--divider)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        paddingLeft: 70,
        paddingRight: 16,
      }}
    >
      <div style={{ marginLeft: 'auto' }} />
      <button
        onClick={onOpenSettings}
        style={{
          position: 'absolute',
          right: 16,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--item-meta)',
          padding: 4,
          display: 'flex',
          alignItems: 'center',
        }}
        title="设置"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6.5 1.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zM1.5 6.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM14.5 6.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM6.5 14.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0z" />
          <circle cx="8" cy="8" r="2" />
        </svg>
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Update App.tsx to pass onOpenSettings**

In `src/App.tsx`, update the TitleBar usage:

```typescript
import { openSettings } from './lib/tauri'

// In the App component, add handler:
const handleOpenSettings = useCallback(async () => {
  await openSettings().catch(() => {})
}, [])

// In the JSX, update TitleBar:
<TitleBar onOpenSettings={handleOpenSettings} />
```

- [ ] **Step 3: Add openSettings to lib/tauri.ts**

Append to `src/lib/tauri.ts`:

```typescript
export const openSettings = (): Promise<void> =>
  invoke('open_settings')
```

- [ ] **Step 4: Commit**

```bash
git add src/components/TitleBar.tsx src/App.tsx src/lib/tauri.ts
git commit -m "feat: add settings gear button to title bar"
```

---

## Chunk 3: Transcription Module (Rust Side)

### Task 6: Add reqwest dependency

**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add reqwest to Cargo.toml**

In `src-tauri/Cargo.toml`, add to `[dependencies]`:

```toml
reqwest = { version = "0.12", features = ["multipart"] }
tokio = { version = "1", features = ["full"] }
```

Note: reqwest's async runtime requires tokio. We need this for the background transcription task.

- [ ] **Step 2: Verify compilation**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: Compiles (may take a while to download reqwest)

- [ ] **Step 3: Commit**

```bash
git add src-tauri/Cargo.toml
git commit -m "feat: add reqwest + tokio dependencies for HTTP calls"
```

---

### Task 7: Create transcription.rs — full module

**Files:**
- Create: `src-tauri/src/transcription.rs`

- [ ] **Step 1: Create transcription.rs**

This is the core module. It handles: file upload to DashScope, submit transcription task, poll for results, save transcript to disk, and emit Tauri events.

```rust
use crate::config;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

const UPLOAD_URL: &str = "https://dashscope.aliyuncs.com/api/v1/uploads";
const TRANSCRIBE_URL: &str =
    "https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription";
const MIN_DURATION_SECS: f64 = 30.0;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transcript {
    pub status: String,
    pub text: String,
}

fn transcripts_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let dir = dir.join("transcripts");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn transcript_path(app: &AppHandle, filename: &str) -> Result<PathBuf, String> {
    let base = filename.trim_end_matches(".m4a");
    Ok(transcripts_dir(app)?.join(format!("{}.json", base)))
}

#[derive(Deserialize)]
struct UploadResponse {
    output: Option<UploadOutput>,
}

#[derive(Deserialize)]
struct UploadOutput {
    uploaded_file: Option<UploadedFile>,
}

#[derive(Deserialize)]
struct UploadedFile {
    file_url: Option<String>,
}

#[derive(Deserialize)]
struct TaskResponse {
    output: Option<TaskOutput>,
}

#[derive(Deserialize)]
struct TaskOutput {
    task_id: Option<String>,
    task_status: Option<String>,
    results: Option<Vec<TaskResult>>,
}

#[derive(Deserialize)]
struct TaskResult {
    transcription_url: Option<String>,
}

#[derive(Deserialize)]
struct TranscriptionContent {
    outputs: Option<Vec<TranscriptionOutput>>,
}

#[derive(Deserialize)]
struct TranscriptionOutput {
    text: Option<String>,
}

fn emit_progress(app: &AppHandle, filename: &str, status: &str) {
    let event_name = format!("transcription-progress:{}", filename);
    let _ = app.emit(&event_name, serde_json::json!({ "status": status }));
}

/// Upload a local audio file to DashScope and return the file_url.
async fn upload_file(client: &reqwest::Client, api_key: &str, path: &PathBuf) -> Result<String, String> {
    let file_name = path
        .file_name()
        .ok_or("no filename")?
        .to_string_lossy()
        .to_string();
    let file_bytes = fs::read(path).map_err(|e| e.to_string())?;

    let part = reqwest::multipart::Part::bytes(file_bytes)
        .file_name(file_name)
        .mime_str("audio/mp4")
        .map_err(|e| e.to_string())?;

    let form = reqwest::multipart::Form::new().part("file", part);

    let resp = client
        .post(UPLOAD_URL)
        .header("Authorization", format!("Bearer {}", api_key))
        .multipart(form)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Upload failed ({}): {}", status, body));
    }

    let data: UploadResponse = resp.json().await.map_err(|e| e.to_string())?;
    let url = data
        .output
        .and_then(|o| o.uploaded_file)
        .and_then(|f| f.file_url)
        .ok_or("No file_url in upload response")?;
    Ok(url)
}

/// Submit a transcription task and return the task_id.
async fn submit_transcription(
    client: &reqwest::Client,
    api_key: &str,
    file_url: &str,
) -> Result<String, String> {
    let body = serde_json::json!({
        "model": "qwen3-asr-flash-filetrans",
        "input": {
            "file_url": file_url
        },
        "parameters": {
            "channel_id": [0]
        }
    });

    let resp = client
        .post(TRANSCRIBE_URL)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .header("X-DashScope-Async", "enable")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Submit failed ({}): {}", status, body));
    }

    let data: TaskResponse = resp.json().await.map_err(|e| e.to_string())?;
    let task_id = data
        .output
        .and_then(|o| o.task_id)
        .ok_or("No task_id in submit response")?;
    Ok(task_id)
}

/// Poll a task until it reaches a terminal state. Returns the transcription URL if available.
async fn poll_task(
    client: &reqwest::Client,
    api_key: &str,
    task_id: &str,
    app: &AppHandle,
) -> Result<Option<String>, String> {
    let url = format!(
        "https://dashscope.aliyuncs.com/api/v1/tasks/{}",
        task_id
    );

    loop {
        tokio::time::sleep(Duration::from_secs(3)).await;

        let resp = client
            .get(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Poll failed: {}", body));
        }

        let data: TaskResponse = resp.json().await.map_err(|e| e.to_string())?;
        let status = data
            .output
            .as_ref()
            .and_then(|o| o.task_status.as_deref())
            .unwrap_or("UNKNOWN");

        match status {
            "PENDING" | "RUNNING" => {
                emit_progress(app, "status", "transcribing");
            }
            "SUCCEEDED" => {
                let transcription_url = data
                    .output
                    .and_then(|o| o.results)
                    .and_then(|r| r.into_iter().next())
                    .and_then(|r| r.transcription_url);
                return Ok(transcription_url);
            }
            "FAILED" | "UNKNOWN" => {
                return Err(format!("Task {}: {}", task_id, status));
            }
            _ => {
                emit_progress(app, "status", "transcribing");
            }
        }
    }
}

/// Fetch transcription text from a transcription_url.
async fn fetch_transcription_text(
    client: &reqwest::Client,
    url: &str,
) -> Result<String, String> {
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let body: TranscriptionContent = resp.json().await.map_err(|e| e.to_string())?;
    let text = body
        .outputs
        .and_then(|o| o.into_iter().next())
        .and_then(|o| o.text)
        .unwrap_or_default();
    Ok(text)
}

/// Public entry point: start transcription in a background thread.
/// Called from stop_recording after the M4A file is ready.
pub fn start_transcription(app: AppHandle, filename: String, file_path: PathBuf, duration_secs: f64) {
    if duration_secs <= MIN_DURATION_SECS {
        return;
    }

    // Check if API key is configured (synchronous, quick)
    let api_key = match config::load_config(&app) {
        Ok(cfg) if !cfg.dashscope_api_key.is_empty() => cfg.dashscope_api_key,
        _ => return,
    };

    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let client = reqwest::Client::new();

            emit_progress(&app, &filename, "uploading");

            let file_url = match upload_file(&client, &api_key, &file_path).await {
                Ok(url) => url,
                Err(e) => {
                    eprintln!("Upload failed: {}", e);
                    emit_progress(&app, &filename, "failed");
                    save_transcript(&app, &filename, "failed", &format!("上传失败: {}", e));
                    return;
                }
            };

            emit_progress(&app, &filename, "transcribing");

            let task_id = match submit_transcription(&client, &api_key, &file_url).await {
                Ok(id) => id,
                Err(e) => {
                    eprintln!("Submit failed: {}", e);
                    emit_progress(&app, &filename, "failed");
                    save_transcript(&app, &filename, "failed", &format!("提交失败: {}", e));
                    return;
                }
            };

            let transcription_url = match poll_task(&client, &api_key, &task_id, &app).await {
                Ok(Some(url)) => url,
                Ok(None) => {
                    emit_progress(&app, &filename, "failed");
                    save_transcript(&app, &filename, "failed", "未获取到转写结果");
                    return;
                }
                Err(e) => {
                    eprintln!("Poll failed: {}", e);
                    emit_progress(&app, &filename, "failed");
                    save_transcript(&app, &filename, "failed", &format!("转写失败: {}", e));
                    return;
                }
            };

            let text = match fetch_transcription_text(&client, &transcription_url).await {
                Ok(t) => t,
                Err(e) => {
                    emit_progress(&app, &filename, "failed");
                    save_transcript(&app, &filename, "failed", &format!("获取转写文本失败: {}", e));
                    return;
                }
            };

            emit_progress(&app, &filename, "completed");
            save_transcript(&app, &filename, "completed", &text);
        });
    });
}

fn save_transcript(app: &AppHandle, filename: &str, status: &str, text: &str) {
    let transcript = Transcript {
        status: status.to_string(),
        text: text.to_string(),
    };
    let path = match transcript_path(app, filename) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("transcript_path error: {}", e);
            return;
        }
    };
    if let Ok(data) = serde_json::to_string_pretty(&transcript) {
        let _ = fs::write(&path, data);
    }
}

#[tauri::command]
pub fn get_transcript(app: AppHandle, filename: String) -> Result<Option<Transcript>, String> {
    let path = transcript_path(&app, &filename)?;
    if !path.exists() {
        return Ok(None);
    }
    let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let transcript: Transcript = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    Ok(Some(transcript))
}

#[tauri::command]
pub fn retry_transcription(app: AppHandle, filename: String) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let file_path = dir.join(&filename);
    if !file_path.exists() {
        return Err("file not found".to_string());
    }
    let duration_secs = crate::recordings::read_duration_pub(&file_path);
    start_transcription(app, filename, file_path, duration_secs);
    Ok(())
}
```

- [ ] **Step 2: Register transcription module in main.rs**

In `src-tauri/src/main.rs`:

```rust
mod config;
mod types;
mod recordings;
mod recorder;
mod audio_process;
mod transcription;

fn main() {
    tauri::Builder::default()
        .manage(recorder::RecorderState(std::sync::Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            recordings::list_recordings,
            recordings::delete_recording,
            recordings::reveal_in_finder,
            recordings::play_recording,
            recorder::start_recording,
            recorder::stop_recording,
            config::get_api_key,
            config::set_api_key,
            config::open_settings,
            transcription::get_transcript,
            transcription::retry_transcription,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Trigger auto-transcription in stop_recording**

In `src-tauri/src/recorder.rs`, update the `stop_recording` function. Change the signature to accept `AppHandle` (it's currently `_app`):

At the end of `stop_recording`, after building the `RecordingItem`, add the transcription trigger:

```rust
#[tauri::command]
pub fn stop_recording(
    app: AppHandle,
    state: State<'_, RecorderState>,
) -> Result<RecordingItem, String> {
    // ... existing code until Ok(RecordingItem { ... }) ...

    let result_item = RecordingItem {
        filename: filename.clone(),
        path: active.output_path.to_string_lossy().into_owned(),
        display_name,
        duration_secs,
        year_month,
    };

    // Auto-trigger transcription if duration > 30s
    crate::transcription::start_transcription(
        app,
        filename,
        active.output_path.clone(),
        duration_secs,
    );

    Ok(result_item)
}
```

Note: `active.output_path` is used before the function returns, so the `active` struct needs to be kept alive until after we clone the path. The final `Ok(result_item)` should use the pre-built struct.

- [ ] **Step 4: Build to verify**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: Compiles successfully

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/transcription.rs src-tauri/src/main.rs src-tauri/src/recorder.rs
git commit -m "feat: add transcription module with DashScope ASR integration"
```

---

### Task 8: Add transcript status to RecordingItem

**Files:**
- Modify: `src-tauri/src/types.rs`
- Modify: `src-tauri/src/recordings.rs`

- [ ] **Step 1: Add transcript_status field to RecordingItem**

In `src-tauri/src/types.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingItem {
    pub filename: String,
    pub path: String,
    pub display_name: String,
    pub duration_secs: f64,
    pub year_month: String,
    #[serde(default)]
    pub transcript_status: Option<String>,  // "completed", "failed", or null
}
```

- [ ] **Step 2: Update list_recordings to check transcript files**

In `src-tauri/src/recordings.rs`, update `list_recordings` to populate `transcript_status`:

```rust
#[tauri::command]
pub fn list_recordings(app: AppHandle) -> Result<Vec<RecordingItem>, String> {
    let dir = recordings_dir(&app)?;
    let transcripts_dir = dir.join("transcripts");
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
            let base = filename.trim_end_matches(".m4a");
            let transcript_file = transcripts_dir.join(format!("{}.json", base));
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
}
```

- [ ] **Step 3: Update all RecordingItem constructors to include transcript_status**

In `src-tauri/src/recorder.rs`, update the `stop_recording` return:

```rust
    let result_item = RecordingItem {
        filename: filename.clone(),
        path: active.output_path.to_string_lossy().into_owned(),
        display_name,
        duration_secs,
        year_month,
        transcript_status: None,  // transcription just started, not yet completed
    };
```

- [ ] **Step 4: Build to verify**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/types.rs src-tauri/src/recordings.rs src-tauri/src/recorder.rs
git commit -m "feat: add transcript_status to RecordingItem"
```

---

## Chunk 4: Detail Panel (Frontend)

### Task 9: Update frontend types and Tauri wrappers

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: Update types.ts**

```typescript
export interface RecordingItem {
  filename: string
  path: string
  display_name: string
  duration_secs: number
  year_month: string
  transcript_status: string | null  // "completed" | "failed" | null
}

export interface Transcript {
  status: string
  text: string
}

export type TranscriptionProgress = 'uploading' | 'transcribing' | 'completed' | 'failed'
```

- [ ] **Step 2: Update lib/tauri.ts**

```typescript
import { invoke } from '@tauri-apps/api/core'
import type { RecordingItem, Transcript } from '../types'

export const listRecordings = (): Promise<RecordingItem[]> =>
  invoke('list_recordings')

export const startRecording = (): Promise<string> =>
  invoke('start_recording')

export const stopRecording = (): Promise<RecordingItem> =>
  invoke('stop_recording')

export const deleteRecording = (path: string): Promise<void> =>
  invoke('delete_recording', { path })

export const revealInFinder = (path: string): Promise<void> =>
  invoke('reveal_in_finder', { path })

export const playRecording = (path: string): Promise<void> =>
  invoke('play_recording', { path })

export const openSettings = (): Promise<void> =>
  invoke('open_settings')

export const getTranscript = (filename: string): Promise<Transcript | null> =>
  invoke('get_transcript', { filename })

export const retryTranscription = (filename: string): Promise<void> =>
  invoke('retry_transcription', { filename })
```

- [ ] **Step 3: Commit**

```bash
git add src/types.ts src/lib/tauri.ts
git commit -m "feat: add transcript types and Tauri wrappers"
```

---

### Task 10: Create useTranscription hook

**Files:**
- Create: `src/hooks/useTranscription.ts`

- [ ] **Step 1: Create useTranscription hook**

This hook manages transcription state for all recordings by listening to Tauri events.

```typescript
import { useEffect, useRef, useCallback } from 'react'
import { listen } from '@tauri-apps/api/event'
import type { TranscriptionProgress } from '../types'

interface TranscriptionState {
  [filename: string]: TranscriptionProgress
}

interface UseTranscriptionReturn {
  transcriptionState: TranscriptionState
  loadTranscript: (filename: string) => Promise<string | null>
}

export function useTranscription(): UseTranscriptionReturn {
  const stateRef = useRef<TranscriptionState>({})
  const listenersRef = useRef<Array<() => void>>([])

  useEffect(() => {
    // Listen for all transcription-progress events using a wildcard-style approach
    // Since Tauri v2 event names are exact, we listen for events at mount time
    // and clean up on unmount. Events are emitted per-filename.
    const setupListener = async () => {
      // Listen to any transcription-progress:* events won't work with exact matching.
      // Instead, we use a single global event name.
      const unlisten = await listen<{ filename: string; status: TranscriptionProgress }>(
        'transcription-progress',
        (event) => {
          const { filename, status } = event.payload
          stateRef.current[filename] = status
        }
      )
      listenersRef.current.push(unlisten)
    }
    setupListener()

    return () => {
      listenersRef.current.forEach(unlisten => unlisten())
      listenersRef.current = []
    }
  }, [])

  const loadTranscript = useCallback(async (filename: string): Promise<string | null> => {
    const { invoke } = await import('@tauri-apps/api/core')
    try {
      const result = await invoke<{ status: string; text: string } | null>(
        'get_transcript',
        { filename }
      )
      if (result && result.status === 'completed') {
        return result.text
      }
      return null
    } catch {
      return null
    }
  }, [])

  return { transcriptionState: stateRef.current, loadTranscript }
}
```

**Important note on event naming:** The Rust side emits events like `transcription-progress:{filename}` (e.g., `transcription-progress:录音 2026-03-13 22:41.m4a`). However, filenames with spaces and Chinese characters can cause issues. **We should change the Rust side to emit a single event name `transcription-progress` with the filename in the payload.** Update `emit_progress` in `transcription.rs`:

```rust
fn emit_progress(app: &AppHandle, filename: &str, status: &str) {
    let _ = app.emit(
        "transcription-progress",
        serde_json::json!({ "filename": filename, "status": status }),
    );
}
```

This is a breaking change from the original design — event name changes from `transcription-progress:{filename}` to `transcription-progress` with filename in payload. This is simpler and avoids event name encoding issues.

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useTranscription.ts
git commit -m "feat: add useTranscription hook for event-driven state"
```

---

### Task 11: Update Rust event emission to use payload-based approach

**Files:**
- Modify: `src-tauri/src/transcription.rs`

- [ ] **Step 1: Update emit_progress function**

Replace the `emit_progress` function in `src-tauri/src/transcription.rs`:

```rust
fn emit_progress(app: &AppHandle, filename: &str, status: &str) {
    let _ = app.emit(
        "transcription-progress",
        serde_json::json!({ "filename": filename, "status": status }),
    );
}
```

Also update the `save_transcript` function to emit the final progress event with the transcript text:

```rust
fn save_transcript(app: &AppHandle, filename: &str, status: &str, text: &str) {
    let transcript = Transcript {
        status: status.to_string(),
        text: text.to_string(),
    };
    let path = match transcript_path(app, filename) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("transcript_path error: {}", e);
            return;
        }
    };
    if let Ok(data) = serde_json::to_string_pretty(&transcript) {
        let _ = fs::write(&path, data);
    }
    // Emit progress so frontend knows the final state
    emit_progress(app, filename, status);
}
```

Note: Since `emit_progress` is now called from within `save_transcript`, remove the standalone `emit_progress` calls in `start_transcription` that happen after `save_transcript` (to avoid duplicates).

- [ ] **Step 2: Build to verify**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/transcription.rs
git commit -m "fix: use payload-based event emission for transcription progress"
```

---

### Task 12: Create DetailPanel component

**Files:**
- Create: `src/components/DetailPanel.tsx`

- [ ] **Step 1: Create DetailPanel.tsx**

```typescript
import { useState, useEffect } from 'react'
import type { RecordingItem, TranscriptionProgress } from '../types'
import { getTranscript, retryTranscription } from '../lib/tauri'

interface DetailPanelProps {
  item: RecordingItem
  transcriptionState: TranscriptionProgress | undefined
  onClose: () => void
}

export function DetailPanel({ item, transcriptionState, onClose }: DetailPanelProps) {
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setText(null)
    setLoading(true)
    getTranscript(item.filename).then(t => {
      setText(t)
      setLoading(false)
    })
  }, [item.filename])

  // Reset text when transcription completes
  useEffect(() => {
    if (transcriptionState === 'completed') {
      getTranscript(item.filename).then(t => setText(t))
    }
  }, [transcriptionState, item.filename])

  const statusLabel: Record<string, string> = {
    uploading: '上传中...',
    transcribing: '转写中...',
    completed: '转写完成',
    failed: '转写失败',
  }

  const status = transcriptionState || item.transcript_status

  return (
    <div style={{
      width: 240,
      minWidth: 240,
      borderLeft: '1px solid var(--divider)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg)',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--divider)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 13, color: 'var(--item-text)', fontWeight: 500 }}>
          {item.display_name}
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--item-meta)',
            cursor: 'pointer',
            fontSize: 16,
            padding: '0 4px',
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {status === 'failed' && text === null && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--item-meta)', marginBottom: 8 }}>
              转写失败
            </p>
            <button
              onClick={() => retryTranscription(item.filename)}
              style={{
                fontSize: 12,
                color: 'var(--record-btn)',
                background: 'none',
                border: '1px solid var(--record-btn)',
                borderRadius: 4,
                padding: '4px 8px',
                cursor: 'pointer',
              }}
            >
              重试
            </button>
          </div>
        )}

        {(status === 'uploading' || status === 'transcribing') && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <div style={{
              width: 14,
              height: 14,
              border: '2px solid var(--item-meta)',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            <span style={{ fontSize: 13, color: 'var(--item-meta)' }}>
              {statusLabel[status] || status}
            </span>
          </div>
        )}

        {text && (
          <p style={{
            fontSize: 13,
            color: 'var(--item-text)',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {text}
          </p>
        )}

        {!status && loading && (
          <span style={{ fontSize: 13, color: 'var(--item-meta)' }}>加载中...</span>
        )}

        {!status && !loading && text === null && (
          <span style={{ fontSize: 13, color: 'var(--item-meta)' }}>暂无转写内容</span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add spin animation to animations.css**

In `src/styles/animations.css`, add:

```css
/* Detail panel loading spinner */
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/DetailPanel.tsx src/styles/animations.css
git commit -m "feat: create DetailPanel component for transcript display"
```

---

### Task 13: Update RecordingItem with click handler + status indicator

**Files:**
- Modify: `src/components/RecordingItem.tsx`

- [ ] **Step 1: Update RecordingItem component**

Add `onClick` prop and a small transcription status indicator:

```typescript
import { useState } from 'react'
import { formatDuration } from '../lib/format'
import type { RecordingItem as RecordingItemType, TranscriptionProgress } from '../types'

interface RecordingItemProps {
  item: RecordingItemType
  isActive?: boolean
  elapsedSecs?: number
  onContextMenu: (e: React.MouseEvent, item: RecordingItemType) => void
  onClick: (item: RecordingItemType) => void
  transcriptionStatus?: TranscriptionProgress | string | null
}

const MicIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="5" y="1" width="6" height="9" rx="3" />
    <path d="M3 8a5 5 0 0 0 10 0M8 13v2" />
  </svg>
)

export function RecordingItem({ item, isActive, elapsedSecs, onContextMenu, onClick, transcriptionStatus }: RecordingItemProps) {
  const [hovered, setHovered] = useState(false)
  const duration = isActive && elapsedSecs !== undefined
    ? formatDuration(elapsedSecs)
    : formatDuration(item.duration_secs)

  const bg = isActive
    ? 'var(--record-highlight)'
    : hovered ? 'var(--item-hover-bg)' : 'transparent'

  // Determine status indicator
  const statusIcon = (() => {
    if (!transcriptionStatus) return null
    if (transcriptionStatus === 'completed') {
      return (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none"
          stroke="var(--item-meta)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 8.5 6.5 12 13 4" />
        </svg>
      )
    }
    if (transcriptionStatus === 'failed') {
      return (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none"
          stroke="var(--record-btn)" strokeWidth="2" strokeLinecap="round">
          <line x1="4" y1="4" x2="12" y2="12" />
          <line x1="12" y1="4" x2="4" y2="12" />
        </svg>
      )
    }
    // uploading or transcribing — small spinner
    return (
      <div style={{
        width: 10,
        height: 10,
        border: '1.5px solid var(--item-meta)',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
    )
  })()

  return (
    <div
      onClick={() => onClick(item)}
      onContextMenu={e => onContextMenu(e, item)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 20px',
        gap: 12,
        cursor: 'default',
        background: bg,
      }}
    >
      <div style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: isActive ? 'var(--record-highlight-icon)' : 'var(--item-icon-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: isActive ? 'var(--record-btn)' : 'var(--item-meta)',
      }}>
        <MicIcon />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          color: isActive ? 'var(--record-btn)' : 'var(--item-text)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {item.display_name}
        </div>
        {isActive && (
          <div style={{ fontSize: 11, color: 'var(--item-meta)', marginTop: 2 }}>
            录制中…
          </div>
        )}
      </div>
      {statusIcon && (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {statusIcon}
        </div>
      )}
      <div style={{
        fontSize: 12,
        color: isActive ? 'var(--record-btn)' : 'var(--duration-text)',
        fontVariantNumeric: 'tabular-nums',
        flexShrink: 0,
        animation: isActive ? 'blink 1s ease-in-out infinite' : 'none',
      }}>
        {duration}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update RecordingList to pass onClick and transcriptionStatus**

In `src/components/RecordingList.tsx`, update props:

```typescript
interface RecordingListProps {
  recordings: RecordingItemType[]
  status: RecorderStatus
  activeItem: RecordingItemType | null
  elapsedSecs: number
  onContextMenu: (e: React.MouseEvent, item: RecordingItemType) => void
  onClick: (item: RecordingItemType) => void
  transcriptionStates: Record<string, string>  // filename -> status
}
```

Update the component to pass these to RecordingItem:

```typescript
<RecordingItem
  key={item.path}
  item={item}
  isActive={status === 'recording' && activeItem?.path === item.path}
  elapsedSecs={elapsedSecs}
  onContextMenu={onContextMenu}
  onClick={onClick}
  transcriptionStatus={transcriptionStates[item.filename] || item.transcript_status}
/>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/RecordingItem.tsx src/components/RecordingList.tsx
git commit -m "feat: add click handler and transcription status to RecordingItem"
```

---

### Task 14: Update App.tsx with master-detail layout

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Rewrite App.tsx**

```typescript
import { useState, useEffect, useCallback, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import { Menu, MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu'
import { TitleBar } from './components/TitleBar'
import { RecordingList } from './components/RecordingList'
import { DetailPanel } from './components/DetailPanel'
import { RecordButton } from './components/RecordButton'
import { useRecorder } from './hooks/useRecorder'
import { listRecordings, deleteRecording, revealInFinder, playRecording, openSettings } from './lib/tauri'
import { formatYearMonth } from './lib/format'
import type { RecordingItem, TranscriptionProgress } from './types'

export default function App() {
  const [recordings, setRecordings] = useState<RecordingItem[]>([])
  const [activeItem, setActiveItem] = useState<RecordingItem | null>(null)
  const [selectedItem, setSelectedItem] = useState<RecordingItem | null>(null)
  const [transcriptionStates, setTranscriptionStates] = useState<Record<string, TranscriptionProgress>>({})

  const loadRecordings = useCallback(async () => {
    const items = await listRecordings()
    setRecordings(items)
  }, [])

  useEffect(() => { loadRecordings() }, [loadRecordings])

  // Listen for transcription progress events
  useEffect(() => {
    const unlistenPromise = listen<{ filename: string; status: TranscriptionProgress }>(
      'transcription-progress',
      (event) => {
        const { filename, status } = event.payload
        setTranscriptionStates(prev => ({ ...prev, [filename]: status }))
        // Refresh recordings list to update transcript_status
        loadRecordings()
      }
    )
    return () => {
      unlistenPromise.then(unlisten => unlisten())
    }
  }, [loadRecordings])

  const handleStopped = useCallback((item: RecordingItem) => {
    setActiveItem(null)
    setRecordings(prev => [item, ...prev])
  }, [])

  const { status, elapsedSecs, start, stop } = useRecorder(handleStopped)

  const handleRecordButton = useCallback(async () => {
    if (status === 'idle') {
      try {
        await start()
        const now = new Date()
        const pad = (n: number) => String(n).padStart(2, '0')
        const displayName = `录音 ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
        setActiveItem({
          filename: displayName + '.m4a',
          path: '__active__',
          display_name: displayName,
          duration_secs: 0,
          year_month: formatYearMonth(displayName),
          transcript_status: null,
        })
      } catch (err: unknown) {
        if (typeof err === 'string' && err === 'permission_denied') {
          alert('Journal 需要麦克风权限。请前往「系统设置 → 隐私与安全性 → 麦克风」开启。')
        }
      }
    } else {
      await stop()
    }
  }, [status, start, stop])

  const handleContextMenu = useCallback(async (e: React.MouseEvent, item: RecordingItem) => {
    e.preventDefault()
    if (item.path === '__active__') return

    const playItem = await MenuItem.new({
      id: 'play',
      text: '播放',
      action: async () => {
        await playRecording(item.path).catch(() => {})
      },
    })

    const revealItem = await MenuItem.new({
      id: 'reveal',
      text: '在 Finder 中显示',
      action: async () => {
        await revealInFinder(item.path).catch(() => {})
      },
    })

    const separator = await PredefinedMenuItem.new({ item: 'Separator' })

    const deleteItem = await MenuItem.new({
      id: 'delete',
      text: '删除',
      action: async () => {
        await deleteRecording(item.path).catch(() => {})
        setRecordings(prev => prev.filter(r => r.path !== item.path))
        if (selectedItem?.path === item.path) setSelectedItem(null)
      },
    })

    const menu = await Menu.new({ items: [playItem, revealItem, separator, deleteItem] })
    await menu.popup()
  }, [selectedItem])

  const handleItemClick = useCallback((item: RecordingItem) => {
    if (item.path === '__active__') return
    if (selectedItem?.path === item.path) {
      setSelectedItem(null)
    } else {
      setSelectedItem(item)
    }
  }, [selectedItem])

  const handleOpenSettings = useCallback(async () => {
    await openSettings().catch(() => {})
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TitleBar onOpenSettings={handleOpenSettings} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <RecordingList
          recordings={recordings}
          status={status}
          activeItem={activeItem}
          elapsedSecs={elapsedSecs}
          onContextMenu={handleContextMenu}
          onClick={handleItemClick}
          transcriptionStates={transcriptionStates}
        />
        {selectedItem && (
          <DetailPanel
            item={selectedItem}
            transcriptionState={transcriptionStates[selectedItem.filename]}
            onClose={() => setSelectedItem(null)}
          />
        )}
      </div>
      <RecordButton status={status} onClick={handleRecordButton} />
    </div>
  )
}
```

- [ ] **Step 2: Verify the app builds**

Run: `cd /Users/yanwu/Projects/github/journal && npx vite build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 3: Full build test**

Run: `cd /Users/yanwu/Projects/github/journal && npx tauri build --no-bundle 2>&1 | tail -20`
Expected: Both Rust and frontend compile successfully

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: implement master-detail layout with transcription panel"
```

---

### Task 15: Clean up old App.css and unused imports

**Files:**
- Delete or empty: `src/App.css`

- [ ] **Step 1: Remove App.css import if present**

Check if `src/App.tsx` imports `App.css`. The current App.tsx does not import it, so no change needed. If there was an import, remove it.

- [ ] **Step 2: Verify no unused imports remain**

Run: `cd /Users/yanwu/Projects/github/journal && npx tsc --noEmit 2>&1`
Expected: No errors

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: clean up unused styles and imports"
```

---

### Task 16: Run existing tests

**Files:**
- No changes expected

- [ ] **Step 1: Run frontend tests**

Run: `cd /Users/yanwu/Projects/github/journal && npm test 2>&1`
Expected: All existing tests pass

- [ ] **Step 2: Run Rust tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml 2>&1`
Expected: All existing tests pass

---

### Task 17: End-to-end verification

- [ ] **Step 1: Launch dev mode**

Run: `cd /Users/yanwu/Projects/github/journal && npm run tauri dev`

- [ ] **Step 2: Verify settings window**
  - Click gear icon in title bar
  - Settings window opens
  - Enter API key, click save
  - Close and reopen — key persists

- [ ] **Step 3: Verify recording and auto-transcription**
  - Record audio for > 30 seconds
  - Stop recording
  - Click the recording in the list
  - Detail panel opens showing transcription status
  - Wait for transcription to complete
  - Text appears in detail panel

- [ ] **Step 4: Verify status indicators**
  - Recording items show spinner during transcription
  - Show checkmark after completion
  - Status persists after app restart
