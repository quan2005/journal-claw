# Journal 重定位实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Journal 从录音工具重定位为智能日志平台——支持多种素材输入，AI 实时整理成符合 notebook 规范的 markdown 日志条目。

**Architecture:** Rust 后端新增 workspace 管理、素材存储、Claude CLI 调用三个模块；前端数据模型从 `RecordingItem` 扩展为 `JournalEntry` + `RawMaterial` 双层结构，列表和详情组件全部重写，录音管道保持不变。

**Tech Stack:** Tauri v2 + React 19 + TypeScript + Rust；Claude CLI（外部进程）；现有 cpal/hound/afconvert 音频链路不变。

---

## 文件结构

### 新增文件

| 文件 | 职责 |
|------|------|
| `src-tauri/src/workspace.rs` | workspace 路径管理、目录创建、yyMM/raw/ 结构 |
| `src-tauri/src/materials.rs` | 素材文件的增删查、文件类型识别、拖入处理 |
| `src-tauri/src/ai_processor.rs` | 调用 Claude CLI、管理处理状态、写回日志文件 |
| `src-tauri/src/journal.rs` | 日志条目扫描、解析 frontmatter、列表排序 |
| `src/types.ts` | 新增 `JournalEntry`、`RawMaterial`、`ProcessingState` 类型 |
| `src/components/JournalList.tsx` | 日志条目列表，按月/日分组，B+C 样式 |
| `src/components/JournalItem.tsx` | 单条日志行：日期列、标题、内联标签、摘要、素材计数 |
| `src/components/InboxStrip.tsx` | 顶部处理中条，显示正在被 AI 整理的素材 chip |
| `src/components/DetailPanel.tsx` | 右侧详情面板：可编辑 markdown + 原始素材列表 |
| `src/components/DropOverlay.tsx` | 全屏拖放遮罩 |
| `src/hooks/useJournal.ts` | 日志列表、处理状态、事件订阅 |
| `src/lib/tauri.ts` | 新增命令 wrapper（扩展现有文件） |
| `src/tests/JournalItem.test.tsx` | JournalItem 渲染测试 |
| `src/tests/useJournal.test.ts` | useJournal hook 测试 |
| `src/tests/workspace.test.ts` | workspace 路径逻辑测试（Rust 单元测试，在 rs 文件内） |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src-tauri/src/main.rs` | 注册新命令、管理新 State |
| `src-tauri/src/config.rs` | 新增 `workspace_path`、`claude_cli_path` 字段 |
| `src-tauri/src/recorder.rs` | 录音完成后写入 `yyMM/raw/` 而非 app_data_dir |
| `src-tauri/src/transcription.rs` | 路径从 app_data_dir 改为 workspace raw 路径 |
| `src-tauri/Cargo.toml` | 新增依赖：`gray_matter`（frontmatter 解析） |
| `src/App.tsx` | 替换为新数据模型和组件 |
| `src/settings/App.tsx` | 新增 workspace 路径和 claude CLI 路径配置项 |
| `src/styles/globals.css` | 新增日志列表相关 CSS 变量 |

---

## Task 1: 扩展 Config — 新增 workspace_path 和 claude_cli_path

**Files:**
- Modify: `src-tauri/src/config.rs`
- Modify: `src/settings/App.tsx`
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: 写失败测试（Rust）**

在 `src-tauri/src/config.rs` 末尾的 `#[cfg(test)]` 块新增：

```rust
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
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
cd src-tauri && cargo test config_defaults config_roundtrip 2>&1 | tail -20
```

Expected: `error[E0609]: no field 'workspace_path' on type 'Config'`

- [ ] **Step 3: 更新 Config struct 和命令**

将 `src-tauri/src/config.rs` 中的 `Config` struct 替换为：

```rust
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
    "claude".to_string()
}
```

在文件末尾（`open_settings` 之后）新增两个命令：

```rust
#[tauri::command]
pub fn get_workspace_path(app: AppHandle) -> Result<String, String> {
    let config = load_config(&app)?;
    Ok(config.workspace_path)
}

#[tauri::command]
pub fn set_workspace_path(app: AppHandle, path: String) -> Result<(), String> {
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
```

- [ ] **Step 4: 注册新命令到 main.rs**

在 `src-tauri/src/main.rs` 的 `invoke_handler` 列表中新增：

```rust
config::get_workspace_path,
config::set_workspace_path,
config::get_claude_cli_path,
config::set_claude_cli_path,
```

- [ ] **Step 5: 运行测试，确认通过**

```bash
cd src-tauri && cargo test config_defaults config_roundtrip 2>&1 | tail -10
```

Expected: `test config::tests::config_defaults ... ok` 和 `test config::tests::config_roundtrip ... ok`

- [ ] **Step 6: 更新前端 tauri.ts wrapper**

在 `src/lib/tauri.ts` 末尾新增：

```typescript
export const getWorkspacePath = () =>
  invoke<string>('get_workspace_path')

export const setWorkspacePath = (path: string) =>
  invoke<void>('set_workspace_path', { path })

export const getClaudeCliPath = () =>
  invoke<string>('get_claude_cli_path')

export const setClaudeCliPath = (path: string) =>
  invoke<void>('set_claude_cli_path', { path })
```

- [ ] **Step 7: 更新设置界面**

将 `src/settings/App.tsx` 全部替换为：

```tsx
import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

export default function SettingsApp() {
  const [apiKey, setApiKey] = useState('')
  const [workspacePath, setWorkspacePath] = useState('')
  const [claudeCli, setClaudeCli] = useState('claude')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    invoke<string | null>('get_api_key').then(k => setApiKey(k ?? ''))
    invoke<string>('get_workspace_path').then(p => setWorkspacePath(p))
    invoke<string>('get_claude_cli_path').then(p => setClaudeCli(p))
  }, [])

  const handleSave = async () => {
    await invoke('set_api_key', { key: apiKey })
    await invoke('set_workspace_path', { path: workspacePath })
    await invoke('set_claude_cli_path', { path: claudeCli })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '6px 8px', fontSize: 13,
    border: '1px solid #e5e5ea', borderRadius: 6,
    fontFamily: 'inherit', outline: 'none', marginTop: 4,
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 500, color: '#636366', display: 'block',
  }
  const sectionStyle: React.CSSProperties = { marginBottom: 16 }

  return (
    <div style={{ padding: '20px 20px 16px', fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Text, sans-serif' }}>
      <div style={sectionStyle}>
        <label style={labelStyle}>Workspace 路径</label>
        <input style={inputStyle} value={workspacePath}
          onChange={e => setWorkspacePath(e.target.value)}
          placeholder="/Users/you/notebook" />
        <div style={{ fontSize: 11, color: '#aeaeb2', marginTop: 4 }}>
          日志和素材的存储根目录（如 ~/Projects/github/notebook）
        </div>
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>Claude CLI 路径</label>
        <input style={inputStyle} value={claudeCli}
          onChange={e => setClaudeCli(e.target.value)}
          placeholder="claude" />
        <div style={{ fontSize: 11, color: '#aeaeb2', marginTop: 4 }}>
          claude 可执行文件路径，默认直接填 claude
        </div>
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>DashScope API Key</label>
        <input style={inputStyle} value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder="sk-..." type="password" />
        <div style={{ fontSize: 11, color: '#aeaeb2', marginTop: 4 }}>
          配置后，超过 30 秒的录音将自动转写为文字
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={handleSave} style={{
          background: '#ff3b30', color: 'white', border: 'none',
          borderRadius: 6, padding: '7px 18px', fontSize: 13,
          fontWeight: 500, cursor: 'pointer',
        }}>保存</button>
        {saved && <span style={{ fontSize: 12, color: '#34c759' }}>已保存</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 8: 构建确认**

```bash
cd /Users/yanwu/Projects/github/daynote && npm run build 2>&1 | tail -20
```

Expected: 无 TypeScript 错误，build 成功

- [ ] **Step 9: Commit**

```bash
git add src-tauri/src/config.rs src-tauri/src/main.rs src/lib/tauri.ts src/settings/App.tsx
git commit -m "feat: add workspace_path and claude_cli_path to config"
```

---

## Task 2: workspace 模块 — 路径管理和目录结构

**Files:**
- Create: `src-tauri/src/workspace.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: 写失败测试**

创建 `src-tauri/src/workspace.rs`，内容如下（先只有测试）：

```rust
use std::path::PathBuf;

pub fn year_month_dir(workspace: &str, year_month: &str) -> PathBuf {
    // e.g. workspace="/Users/x/notebook", year_month="2603"
    // returns /Users/x/notebook/2603
    todo!()
}

pub fn raw_dir(workspace: &str, year_month: &str) -> PathBuf {
    // returns /Users/x/notebook/2603/raw
    todo!()
}

pub fn ensure_dirs(workspace: &str, year_month: &str) -> Result<(), String> {
    // creates yyMM/ and yyMM/raw/ if they don't exist
    todo!()
}

pub fn current_year_month() -> String {
    // returns current date as "yyMM", e.g. "2603"
    todo!()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn year_month_dir_structure() {
        let p = year_month_dir("/tmp/nb", "2603");
        assert_eq!(p, PathBuf::from("/tmp/nb/2603"));
    }

    #[test]
    fn raw_dir_structure() {
        let p = raw_dir("/tmp/nb", "2603");
        assert_eq!(p, PathBuf::from("/tmp/nb/2603/raw"));
    }

    #[test]
    fn ensure_dirs_creates_structure() {
        let tmp = std::env::temp_dir().join("journal_test_workspace");
        let ws = tmp.to_str().unwrap();
        ensure_dirs(ws, "2603").unwrap();
        assert!(tmp.join("2603").exists());
        assert!(tmp.join("2603/raw").exists());
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn current_year_month_format() {
        let ym = current_year_month();
        assert_eq!(ym.len(), 4);
        assert!(ym.chars().all(|c| c.is_ascii_digit()));
    }
}
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
cd src-tauri && cargo test workspace 2>&1 | tail -15
```

Expected: 编译错误 `todo!()` panics 或函数未实现

- [ ] **Step 3: 实现 workspace.rs**

将 `src-tauri/src/workspace.rs` 替换为完整实现：

```rust
use std::path::PathBuf;
use chrono::Local;

pub fn year_month_dir(workspace: &str, year_month: &str) -> PathBuf {
    PathBuf::from(workspace).join(year_month)
}

pub fn raw_dir(workspace: &str, year_month: &str) -> PathBuf {
    year_month_dir(workspace, year_month).join("raw")
}

pub fn ensure_dirs(workspace: &str, year_month: &str) -> Result<(), String> {
    let raw = raw_dir(workspace, year_month);
    std::fs::create_dir_all(&raw)
        .map_err(|e| format!("创建目录失败 {}: {}", raw.display(), e))
}

pub fn current_year_month() -> String {
    Local::now().format("%y%m").to_string()
}
```

- [ ] **Step 4: 在 main.rs 中声明模块**

在 `src-tauri/src/main.rs` 顶部的 mod 列表中新增：

```rust
mod workspace;
```

- [ ] **Step 5: 运行测试，确认通过**

```bash
cd src-tauri && cargo test workspace 2>&1 | tail -10
```

Expected: 4 个测试全部 `ok`

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/workspace.rs src-tauri/src/main.rs
git commit -m "feat: add workspace module with yyMM/raw/ path management"
```

---

## Task 3: 更新 recorder.rs — 录音写入 workspace raw 目录

**Files:**
- Modify: `src-tauri/src/recorder.rs`
- Modify: `src-tauri/src/transcription.rs`

- [ ] **Step 1: 写失败测试**

在 `src-tauri/src/recorder.rs` 的测试块中新增：

```rust
#[test]
fn unique_filename_uses_yyMM_format() {
    // 文件名格式应为 "录音 YYYY-MM-DD HH:mm.m4a"，不含路径
    let dir = std::env::temp_dir();
    let name = unique_filename(&dir);
    assert!(name.starts_with("录音 "));
    assert!(name.ends_with(".m4a"));
}
```

这个测试已存在类似版本，先确认现有测试仍通过：

```bash
cd src-tauri && cargo test recorder 2>&1 | tail -10
```

Expected: 现有测试全部通过

- [ ] **Step 2: 修改 start_recording，改用 workspace raw 目录**

在 `src-tauri/src/recorder.rs` 中，找到 `start_recording` 命令，将获取录音目录的逻辑从：

```rust
let dir = recordings::recordings_dir(&app)?;
```

改为：

```rust
use crate::{config, workspace};
let cfg = config::load_config(&app)?;
if cfg.workspace_path.is_empty() {
    return Err("请先在设置中配置 Workspace 路径".to_string());
}
let ym = workspace::current_year_month();
workspace::ensure_dirs(&cfg.workspace_path, &ym)?;
let dir = workspace::raw_dir(&cfg.workspace_path, &ym);
```

- [ ] **Step 3: 在 config.rs 中暴露 save_config 为 pub**

`load_config` 在 `config.rs` 中已经是 `pub fn`，无需改动。只需将 `save_config` 也改为 pub，供其他模块调用：

```rust
// 将第 26 行的 fn save_config 改为：
pub fn save_config(app: &AppHandle, config: &Config) -> Result<(), String> {
```

- [ ] **Step 4: 更新 stop_recording 中的 recording-processed 事件 payload**

在 `stop_recording` 中，`emit("recording-processed", ...)` 的 payload 现在应包含 workspace 路径，方便前端刷新正确目录。将 emit 改为：

```rust
let _ = app.emit("recording-processed", serde_json::json!({
    "filename": filename,
    "path": output_path_str,
}));
```

（如果当前已是这种格式则跳过此步）

- [ ] **Step 5: 更新 transcription.rs — 路径改为跟随素材文件**

在 `src-tauri/src/transcription.rs` 中：

**a) `save_transcript` 签名改为接受 `file_path: &PathBuf`：**

```rust
fn save_transcript(app: &AppHandle, file_path: &PathBuf, status: &str, text: &str) {
    // transcript 放在素材所在 raw/ 目录上一级的 transcripts/ 下
    // raw/录音.m4a → ../transcripts/录音.json
    let raw_dir = file_path.parent().unwrap_or(file_path.as_path());
    let transcripts_dir = raw_dir.parent().unwrap_or(raw_dir).join("transcripts");
    let _ = std::fs::create_dir_all(&transcripts_dir);
    let base = file_path.file_stem().unwrap_or_default().to_string_lossy();
    let json_path = transcripts_dir.join(format!("{}.json", base));
    let transcript = Transcript { status: status.to_string(), text: text.to_string() };
    if let Ok(data) = serde_json::to_string(&transcript) {
        let _ = std::fs::write(&json_path, data);
    }
    let filename = file_path.file_name().unwrap_or_default().to_string_lossy().to_string();
    let _ = app.emit("transcription-progress", serde_json::json!({
        "filename": filename, "status": status
    }));
}
```

**b) `get_transcript` 命令改为接受完整路径：**

```rust
#[tauri::command]
pub fn get_transcript(path: String) -> Result<Option<Transcript>, String> {
    let file_path = PathBuf::from(&path);
    let raw_dir = file_path.parent().ok_or("invalid path")?;
    let transcripts_dir = raw_dir.parent().ok_or("invalid path")?.join("transcripts");
    let base = file_path.file_stem().unwrap_or_default().to_string_lossy();
    let json_path = transcripts_dir.join(format!("{}.json", base));
    if !json_path.exists() { return Ok(None); }
    let data = std::fs::read_to_string(&json_path).map_err(|e| e.to_string())?;
    let t: Transcript = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    Ok(Some(t))
}
```

**c) `retry_transcription` 命令改为接受完整路径：**

```rust
#[tauri::command]
pub fn retry_transcription(app: AppHandle, path: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);
    if !file_path.exists() {
        return Err(format!("文件不存在: {}", path));
    }
    let filename = file_path.file_name().unwrap_or_default().to_string_lossy().to_string();
    let duration = crate::recordings::read_duration_pub(&file_path);
    start_transcription(app, filename, file_path, duration);
    Ok(())
}
```

**d) 更新 `src/lib/tauri.ts` 中 getTranscript 和 retryTranscription 的参数：**

```typescript
// 将原来接受 filename: string 改为接受 path: string
export const getTranscript = (path: string) =>
  invoke<Transcript | null>('get_transcript', { path })

export const retryTranscription = (path: string) =>
  invoke<void>('retry_transcription', { path })
```

- [ ] **Step 6: 构建确认**

```bash
cd src-tauri && cargo build 2>&1 | grep -E "^error" | head -20
```

Expected: 无 error

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/recorder.rs src-tauri/src/transcription.rs src-tauri/src/config.rs
git commit -m "feat: recorder writes to workspace/yyMM/raw/, transcript path follows material"
```

---

## Task 4: journal.rs — 扫描和解析日志条目

**Files:**
- Create: `src-tauri/src/journal.rs`
- Modify: `src-tauri/Cargo.toml`（新增 `gray_matter`）
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: 添加 gray_matter 依赖**

在 `src-tauri/Cargo.toml` 的 `[dependencies]` 中新增：

```toml
gray_matter = "0.2"
```

- [ ] **Step 2: 写失败测试**

创建 `src-tauri/src/journal.rs`，先只有测试：

```rust
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawMaterial {
    pub filename: String,
    pub path: String,
    pub kind: String,    // "audio" | "text" | "pdf" | "docx" | "markdown"
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalEntry {
    pub filename: String,       // "28-AI平台产品会议纪要.md"
    pub path: String,           // absolute path
    pub title: String,          // "AI平台产品会议纪要"
    pub summary: String,        // from frontmatter
    pub tags: Vec<String>,      // from frontmatter
    pub year_month: String,     // "2603"
    pub day: u32,               // 28
    pub created_time: String,   // "10:15" (from file mtime)
    pub materials: Vec<RawMaterial>,
}

pub fn parse_entry_filename(filename: &str) -> Option<(u32, String)> {
    // "28-AI平台产品会议纪要.md" → Some((28, "AI平台产品会议纪要"))
    todo!()
}

pub fn material_kind(filename: &str) -> String {
    todo!()
}

pub fn list_entries(workspace: &str, year_month: &str) -> Result<Vec<JournalEntry>, String> {
    todo!()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_entry_filename_standard() {
        let r = parse_entry_filename("28-AI平台产品会议纪要.md");
        assert_eq!(r, Some((28, "AI平台产品会议纪要".to_string())));
    }

    #[test]
    fn parse_entry_filename_single_digit_day() {
        let r = parse_entry_filename("03-春日感想.md");
        assert_eq!(r, Some((3, "春日感想".to_string())));
    }

    #[test]
    fn parse_entry_filename_no_match() {
        assert_eq!(parse_entry_filename("README.md"), None);
        assert_eq!(parse_entry_filename("not-a-journal"), None);
    }

    #[test]
    fn material_kind_audio() {
        assert_eq!(material_kind("录音.m4a"), "audio");
        assert_eq!(material_kind("rec.wav"), "audio");
        assert_eq!(material_kind("clip.mp3"), "audio");
    }

    #[test]
    fn material_kind_documents() {
        assert_eq!(material_kind("note.txt"), "text");
        assert_eq!(material_kind("note.md"), "markdown");
        assert_eq!(material_kind("report.pdf"), "pdf");
        assert_eq!(material_kind("meeting.docx"), "docx");
    }

    #[test]
    fn material_kind_unknown() {
        assert_eq!(material_kind("image.png"), "other");
    }
}
```

- [ ] **Step 3: 运行测试，确认失败**

```bash
cd src-tauri && cargo test journal 2>&1 | tail -15
```

Expected: `error` 因为 `todo!()`

- [ ] **Step 4: 实现 parse_entry_filename 和 material_kind**

```rust
pub fn parse_entry_filename(filename: &str) -> Option<(u32, String)> {
    let stem = filename.strip_suffix(".md")?;
    let dash_pos = stem.find('-')?;
    let day_str = &stem[..dash_pos];
    let title = &stem[dash_pos + 1..];
    if title.is_empty() { return None; }
    let day: u32 = day_str.parse().ok()?;
    Some((day, title.to_string()))
}

pub fn material_kind(filename: &str) -> String {
    let ext = std::path::Path::new(filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    match ext.as_str() {
        "m4a" | "wav" | "mp3" | "aac" | "ogg" | "flac" => "audio",
        "txt" => "text",
        "md" | "markdown" => "markdown",
        "pdf" => "pdf",
        "docx" | "doc" => "docx",
        _ => "other",
    }.to_string()
}
```

- [ ] **Step 5: 实现 list_entries**

```rust
pub fn list_entries(workspace: &str, year_month: &str) -> Result<Vec<JournalEntry>, String> {
    use gray_matter::{Matter, engine::YAML};
    use crate::workspace;

    let ym_dir = workspace::year_month_dir(workspace, year_month);
    if !ym_dir.exists() {
        return Ok(vec![]);
    }

    let raw_dir = workspace::raw_dir(workspace, year_month);
    let mut entries: Vec<JournalEntry> = vec![];

    let read_dir = std::fs::read_dir(&ym_dir)
        .map_err(|e| format!("读取目录失败: {}", e))?;

    for entry in read_dir {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let filename = path.file_name().unwrap_or_default().to_string_lossy().to_string();

        let (day, title) = match parse_entry_filename(&filename) {
            Some(v) => v,
            None => continue,
        };

        let content = std::fs::read_to_string(&path)
            .unwrap_or_default();

        let matter = Matter::<YAML>::new();
        let parsed = matter.parse(&content);

        let summary = parsed.data.as_ref()
            .and_then(|d| d["summary"].as_string())
            .unwrap_or_default();

        let tags: Vec<String> = parsed.data.as_ref()
            .and_then(|d| d["tags"].as_vec())
            .map(|v| v.iter().filter_map(|t| t.as_string()).collect())
            .unwrap_or_default();

        // mtime as HH:mm
        let created_time = entry.metadata().ok()
            .and_then(|m| m.modified().ok())
            .map(|t| {
                let dt: chrono::DateTime<chrono::Local> = t.into();
                dt.format("%H:%M").to_string()
            })
            .unwrap_or_default();

        // collect materials from raw/
        let mut materials: Vec<RawMaterial> = vec![];
        if raw_dir.exists() {
            if let Ok(rdir) = std::fs::read_dir(&raw_dir) {
                for rentry in rdir.flatten() {
                    let rpath = rentry.path();
                    let rname = rpath.file_name().unwrap_or_default().to_string_lossy().to_string();
                    let size = rentry.metadata().map(|m| m.len()).unwrap_or(0);
                    materials.push(RawMaterial {
                        filename: rname.clone(),
                        path: rpath.to_string_lossy().to_string(),
                        kind: material_kind(&rname),
                        size_bytes: size,
                    });
                }
            }
        }

        entries.push(JournalEntry {
            filename,
            path: path.to_string_lossy().to_string(),
            title,
            summary,
            tags,
            year_month: year_month.to_string(),
            day,
            created_time,
            materials,
        });
    }

    // Sort by day descending, then by filename descending within same day
    entries.sort_by(|a, b| b.day.cmp(&a.day).then(b.filename.cmp(&a.filename)));
    Ok(entries)
}
```

- [ ] **Step 6: 新增 Tauri 命令**

在 `journal.rs` 末尾新增：

```rust
use tauri::AppHandle;
use crate::config;

#[tauri::command]
pub fn list_journal_entries(
    app: AppHandle,
    year_month: String,
) -> Result<Vec<JournalEntry>, String> {
    let cfg = config::load_config(&app)?;
    if cfg.workspace_path.is_empty() {
        return Ok(vec![]);
    }
    list_entries(&cfg.workspace_path, &year_month)
}

#[tauri::command]
pub fn list_all_journal_entries(app: AppHandle) -> Result<Vec<JournalEntry>, String> {
    let cfg = config::load_config(&app)?;
    if cfg.workspace_path.is_empty() {
        return Ok(vec![]);
    }
    let workspace = &cfg.workspace_path;
    let ws_path = std::path::PathBuf::from(workspace);
    if !ws_path.exists() {
        return Ok(vec![]);
    }

    let mut all: Vec<JournalEntry> = vec![];
    let read_dir = std::fs::read_dir(&ws_path)
        .map_err(|e| e.to_string())?;

    for entry in read_dir.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        // yyMM dirs: 4 digits
        if name.len() == 4 && name.chars().all(|c| c.is_ascii_digit()) {
            let mut batch = list_entries(workspace, &name)?;
            all.append(&mut batch);
        }
    }

    all.sort_by(|a, b| {
        b.year_month.cmp(&a.year_month)
            .then(b.day.cmp(&a.day))
            .then(b.filename.cmp(&a.filename))
    });
    Ok(all)
}

#[tauri::command]
pub fn get_journal_entry_content(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_journal_entry_content(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}
```

- [ ] **Step 7: 注册到 main.rs**

```rust
mod journal;
// invoke_handler 中新增：
journal::list_all_journal_entries,
journal::list_journal_entries,
journal::get_journal_entry_content,
journal::save_journal_entry_content,
```

- [ ] **Step 8: 运行测试**

```bash
cd src-tauri && cargo test journal 2>&1 | tail -15
```

Expected: 全部 ok

- [ ] **Step 9: Commit**

```bash
git add src-tauri/src/journal.rs src-tauri/src/main.rs src-tauri/Cargo.toml
git commit -m "feat: add journal module with entry scanning and frontmatter parsing"
```

---

## Task 5: materials.rs — 素材导入（拖放文件）

**Files:**
- Create: `src-tauri/src/materials.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: 写测试**

创建 `src-tauri/src/materials.rs`：

```rust
use std::path::PathBuf;
use crate::workspace;

pub fn dest_filename(src_path: &str) -> String {
    // 保留原文件名，若同名则加时间戳后缀
    PathBuf::from(src_path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string()
}

pub fn copy_to_raw(src_path: &str, workspace: &str, year_month: &str) -> Result<PathBuf, String> {
    workspace::ensure_dirs(workspace, year_month)?;
    let raw = workspace::raw_dir(workspace, year_month);
    let filename = dest_filename(src_path);
    let dest = raw.join(&filename);
    // If dest exists, add timestamp suffix
    let dest = if dest.exists() {
        let stem = PathBuf::from(&filename)
            .file_stem().unwrap_or_default().to_string_lossy().to_string();
        let ext = PathBuf::from(&filename)
            .extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
        let ts = chrono::Local::now().format("%H%M%S").to_string();
        raw.join(format!("{}-{}{}", stem, ts, ext))
    } else {
        dest
    };
    std::fs::copy(src_path, &dest)
        .map_err(|e| format!("复制文件失败: {}", e))?;
    Ok(dest)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dest_filename_extracts_name() {
        assert_eq!(dest_filename("/tmp/meeting notes.docx"), "meeting notes.docx");
        assert_eq!(dest_filename("/Users/x/note.txt"), "note.txt");
    }

    #[test]
    fn copy_to_raw_creates_file() {
        let tmp = std::env::temp_dir().join("journal_mat_test");
        let src = tmp.join("source.txt");
        std::fs::create_dir_all(&tmp).unwrap();
        std::fs::write(&src, b"hello").unwrap();

        let dest = copy_to_raw(src.to_str().unwrap(), tmp.to_str().unwrap(), "2603").unwrap();
        assert!(dest.exists());
        assert_eq!(std::fs::read_to_string(&dest).unwrap(), "hello");

        std::fs::remove_dir_all(&tmp).ok();
    }
}
```

- [ ] **Step 2: 运行测试，确认通过**

```bash
cd src-tauri && cargo test materials 2>&1 | tail -10
```

Expected: 2 tests ok

- [ ] **Step 3: 新增 Tauri 命令**

在 `materials.rs` 末尾新增：

```rust
use tauri::AppHandle;
use serde::{Deserialize, Serialize};
use crate::{config, workspace};

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportResult {
    pub path: String,
    pub filename: String,
    pub year_month: String,
}

#[tauri::command]
pub fn import_file(app: AppHandle, src_path: String) -> Result<ImportResult, String> {
    let cfg = config::load_config(&app)?;
    if cfg.workspace_path.is_empty() {
        return Err("请先在设置中配置 Workspace 路径".to_string());
    }
    let ym = workspace::current_year_month();
    let dest = copy_to_raw(&src_path, &cfg.workspace_path, &ym)?;
    Ok(ImportResult {
        filename: dest.file_name().unwrap_or_default().to_string_lossy().to_string(),
        path: dest.to_string_lossy().to_string(),
        year_month: ym,
    })
}
```

- [ ] **Step 4: 注册到 main.rs**

```rust
mod materials;
// invoke_handler:
materials::import_file,
```

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/materials.rs src-tauri/src/main.rs
git commit -m "feat: add materials module with file import to workspace/yyMM/raw/"
```

---

## Task 6: ai_processor.rs — 调用 Claude CLI 整理日志

**Files:**
- Create: `src-tauri/src/ai_processor.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: 写测试**

创建 `src-tauri/src/ai_processor.rs`：

```rust
use std::path::PathBuf;

pub fn build_prompt(_material_path: &str) -> String {
    "新增资料，请阅读并整理记录".to_string()
}

pub fn build_command(cli_path: &str, material_path: &str, workspace_ym_dir: &str) -> Vec<String> {
    // Returns: ["claude", "-p", "@/path/to/material 新增资料，请阅读并整理记录"]
    // with --cwd set to workspace yyMM dir so claude writes output there
    vec![
        cli_path.to_string(),
        "--cwd".to_string(),
        workspace_ym_dir.to_string(),
        "-p".to_string(),
        format!("@{} {}", material_path, build_prompt(material_path)),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_command_structure() {
        let cmd = build_command("claude", "/nb/2603/raw/note.txt", "/nb/2603");
        assert_eq!(cmd[0], "claude");
        assert_eq!(cmd[1], "--cwd");
        assert_eq!(cmd[2], "/nb/2603");
        assert_eq!(cmd[3], "-p");
        assert!(cmd[4].starts_with("@/nb/2603/raw/note.txt"));
        assert!(cmd[4].contains("新增资料"));
    }
}
```

- [ ] **Step 2: 运行测试**

```bash
cd src-tauri && cargo test ai_processor 2>&1 | tail -10
```

Expected: ok

- [ ] **Step 3: 实现异步处理函数**

在 `ai_processor.rs` 中新增：

```rust
use tauri::{AppHandle, Emitter};
use crate::{config, workspace};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingUpdate {
    pub material_path: String,
    pub status: String,   // "processing" | "completed" | "failed"
    pub error: Option<String>,
}

pub async fn process_material(
    app: AppHandle,
    material_path: String,
    year_month: String,
) -> Result<(), String> {
    let cfg = config::load_config(&app)?;
    let cli = if cfg.claude_cli_path.is_empty() {
        "claude".to_string()
    } else {
        cfg.claude_cli_path.clone()
    };
    let ym_dir = workspace::year_month_dir(&cfg.workspace_path, &year_month);

    let _ = app.emit("ai-processing", ProcessingUpdate {
        material_path: material_path.clone(),
        status: "processing".to_string(),
        error: None,
    });

    let args = build_command(&cli, &material_path, ym_dir.to_str().unwrap_or(""));
    // args[0] is the binary, rest are arguments
    let output = tokio::process::Command::new(&args[0])
        .args(&args[1..])
        .output()
        .await
        .map_err(|e| format!("启动 Claude CLI 失败: {}", e))?;

    if output.status.success() {
        let _ = app.emit("ai-processing", ProcessingUpdate {
            material_path: material_path.clone(),
            status: "completed".to_string(),
            error: None,
        });
        // Emit journal-updated so frontend can refresh list
        let _ = app.emit("journal-updated", &year_month);
        Ok(())
    } else {
        let err = String::from_utf8_lossy(&output.stderr).to_string();
        let _ = app.emit("ai-processing", ProcessingUpdate {
            material_path: material_path.clone(),
            status: "failed".to_string(),
            error: Some(err.clone()),
        });
        Err(err)
    }
}
```

- [ ] **Step 4: 新增 Tauri 命令**

```rust
#[tauri::command]
pub async fn trigger_ai_processing(
    app: AppHandle,
    material_path: String,
    year_month: String,
) -> Result<(), String> {
    tokio::spawn(async move {
        let _ = process_material(app, material_path, year_month).await;
    });
    Ok(()) // Returns immediately, processing happens in background
}
```

- [ ] **Step 5: 注册到 main.rs**

```rust
mod ai_processor;
// invoke_handler:
ai_processor::trigger_ai_processing,
```

- [ ] **Step 6: 在 recorder.rs 的 stop_recording 中自动触发**

在 `stop_recording` 的 spawn 块末尾（afconvert 完成、emit recording-processed 之后）新增：

```rust
// Auto-trigger AI processing for new recording
let ym = workspace::current_year_month();
let _ = ai_processor::process_material(app.clone(), output_path_str.clone(), ym).await;
```

- [ ] **Step 7: 构建确认**

```bash
cd src-tauri && cargo build 2>&1 | grep "^error" | head -20
```

Expected: 无 error

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/ai_processor.rs src-tauri/src/main.rs src-tauri/src/recorder.rs
git commit -m "feat: add AI processor, auto-trigger claude CLI after recording/import"
```

---

## Task 7: 前端类型定义和 tauri.ts 扩展

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: 写类型测试**

在 `src/tests/` 新建 `types.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'
import type { JournalEntry, RawMaterial, ProcessingUpdate } from '../types'

describe('JournalEntry type', () => {
  it('accepts valid entry', () => {
    const entry: JournalEntry = {
      filename: '28-AI平台产品会议纪要.md',
      path: '/nb/2603/28-AI平台产品会议纪要.md',
      title: 'AI平台产品会议纪要',
      summary: '探索可继续，需同步做场景化表达',
      tags: ['journal', 'meeting'],
      year_month: '2603',
      day: 28,
      created_time: '10:15',
      materials: [],
    }
    expect(entry.day).toBe(28)
    expect(entry.tags).toContain('meeting')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败（类型不存在）**

```bash
npm test 2>&1 | grep -A3 "types.test"
```

Expected: `Cannot find module` 或 type error

- [ ] **Step 3: 更新 src/types.ts**

将 `src/types.ts` 全部替换为：

```typescript
// ── 旧类型（保留，录音管道仍在使用）──────────────────────
export type TranscriptionProgress = 'uploading' | 'transcribing' | 'completed' | 'failed'

export interface RecordingItem {
  filename: string
  path: string
  display_name: string
  duration_secs: number
  year_month: string
  transcript_status: TranscriptionProgress | null
}

export interface Transcript {
  status: TranscriptionProgress
  text: string
}

// ── 新类型（日志平台）────────────────────────────────────
export interface RawMaterial {
  filename: string
  path: string
  kind: 'audio' | 'text' | 'markdown' | 'pdf' | 'docx' | 'other'
  size_bytes: number
}

export interface JournalEntry {
  filename: string        // "28-AI平台产品会议纪要.md"
  path: string            // absolute path
  title: string           // "AI平台产品会议纪要"
  summary: string         // from frontmatter summary field
  tags: string[]          // from frontmatter tags field
  year_month: string      // "2603"
  day: number             // 28
  created_time: string    // "10:15"
  materials: RawMaterial[]
}

export interface ProcessingUpdate {
  material_path: string
  status: 'processing' | 'completed' | 'failed'
  error?: string
}
```

- [ ] **Step 4: 扩展 src/lib/tauri.ts**

在现有内容末尾新增：

```typescript
import type { JournalEntry } from '../types'

// Journal
export const listAllJournalEntries = () =>
  invoke<JournalEntry[]>('list_all_journal_entries')

export const getJournalEntryContent = (path: string) =>
  invoke<string>('get_journal_entry_content', { path })

export const saveJournalEntryContent = (path: string, content: string) =>
  invoke<void>('save_journal_entry_content', { path, content })

// Materials
export const importFile = (srcPath: string) =>
  invoke<{ path: string; filename: string; year_month: string }>('import_file', { src_path: srcPath })

// AI Processing
export const triggerAiProcessing = (materialPath: string, yearMonth: string) =>
  invoke<void>('trigger_ai_processing', { material_path: materialPath, year_month: yearMonth })
```

- [ ] **Step 5: 运行测试**

```bash
npm test 2>&1 | tail -15
```

Expected: 全部通过

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/lib/tauri.ts src/tests/types.test.ts
git commit -m "feat: add JournalEntry/RawMaterial types and tauri wrappers"
```

---

## Task 8: useJournal hook

**Files:**
- Create: `src/hooks/useJournal.ts`
- Create: `src/tests/useJournal.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `src/tests/useJournal.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useJournal } from '../hooks/useJournal'

vi.mock('../lib/tauri', () => ({
  listAllJournalEntries: vi.fn().mockResolvedValue([
    {
      filename: '28-AI平台产品会议纪要.md',
      path: '/nb/2603/28-AI平台产品会议纪要.md',
      title: 'AI平台产品会议纪要',
      summary: '探索可继续',
      tags: ['meeting'],
      year_month: '2603',
      day: 28,
      created_time: '10:15',
      materials: [],
    },
  ]),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}))

describe('useJournal', () => {
  it('loads entries on mount', async () => {
    const { result } = renderHook(() => useJournal())
    await act(async () => {})
    expect(result.current.entries).toHaveLength(1)
    expect(result.current.entries[0].title).toBe('AI平台产品会议纪要')
  })

  it('starts with no processing items', () => {
    const { result } = renderHook(() => useJournal())
    expect(result.current.processingPaths).toEqual([])
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npm test 2>&1 | grep -A5 "useJournal"
```

Expected: `Cannot find module '../hooks/useJournal'`

- [ ] **Step 3: 实现 useJournal.ts**

创建 `src/hooks/useJournal.ts`：

```typescript
import { useState, useEffect, useCallback } from 'react'
import { listen } from '@tauri-apps/api/event'
import { listAllJournalEntries } from '../lib/tauri'
import type { JournalEntry, ProcessingUpdate } from '../types'

export function useJournal() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [processingPaths, setProcessingPaths] = useState<string[]>([])

  const refresh = useCallback(async () => {
    try {
      const result = await listAllJournalEntries()
      setEntries(result)
    } catch (e) {
      console.error('Failed to load journal entries:', e)
    }
  }, [])

  useEffect(() => {
    refresh()

    const unlistenProcessing = listen<ProcessingUpdate>('ai-processing', (event) => {
      const { material_path, status } = event.payload
      if (status === 'processing') {
        setProcessingPaths(prev => [...new Set([...prev, material_path])])
      } else {
        setProcessingPaths(prev => prev.filter(p => p !== material_path))
      }
    })

    const unlistenUpdated = listen<string>('journal-updated', () => {
      refresh()
    })

    const unlistenProcessed = listen('recording-processed', () => {
      refresh()
    })

    return () => {
      unlistenProcessing.then(fn => fn())
      unlistenUpdated.then(fn => fn())
      unlistenProcessed.then(fn => fn())
    }
  }, [refresh])

  return { entries, processingPaths, refresh }
}
```

- [ ] **Step 4: 运行测试**

```bash
npm test 2>&1 | grep -A5 "useJournal"
```

Expected: 2 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useJournal.ts src/tests/useJournal.test.ts
git commit -m "feat: add useJournal hook with entry loading and processing state"
```

---

## Task 9: JournalItem 组件

**Files:**
- Create: `src/components/JournalItem.tsx`
- Create: `src/tests/JournalItem.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `src/tests/JournalItem.test.tsx`：

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { JournalItem } from '../components/JournalItem'
import type { JournalEntry } from '../types'

const entry: JournalEntry = {
  filename: '28-AI平台产品会议纪要.md',
  path: '/nb/2603/28-AI平台产品会议纪要.md',
  title: 'AI平台产品会议纪要',
  summary: '探索可继续，需同步做场景化表达',
  tags: ['meeting'],
  year_month: '2603',
  day: 28,
  created_time: '10:15',
  materials: [{ filename: '录音.m4a', path: '/nb/2603/raw/录音.m4a', kind: 'audio', size_bytes: 1024 }],
}

describe('JournalItem', () => {
  it('renders title', () => {
    render(<JournalItem entry={entry} showDate={false} isSelected={false} onClick={vi.fn()} />)
    expect(screen.getByText('AI平台产品会议纪要')).toBeTruthy()
  })

  it('shows date when showDate=true', () => {
    render(<JournalItem entry={entry} showDate={true} isSelected={false} onClick={vi.fn()} />)
    expect(screen.getByText('28')).toBeTruthy()
  })

  it('hides date when showDate=false', () => {
    render(<JournalItem entry={entry} showDate={false} isSelected={false} onClick={vi.fn()} />)
    expect(screen.queryByText('28')).toBeNull()
  })

  it('renders summary', () => {
    render(<JournalItem entry={entry} showDate={false} isSelected={false} onClick={vi.fn()} />)
    expect(screen.getByText('探索可继续，需同步做场景化表达')).toBeTruthy()
  })

  it('renders meeting tag', () => {
    render(<JournalItem entry={entry} showDate={false} isSelected={false} onClick={vi.fn()} />)
    expect(screen.getByText('会议')).toBeTruthy()
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npm test 2>&1 | grep -A5 "JournalItem"
```

Expected: `Cannot find module '../components/JournalItem'`

- [ ] **Step 3: 实现 JournalItem.tsx**

创建 `src/components/JournalItem.tsx`：

```tsx
import type { JournalEntry } from '../types'

// Tag display names and colors
const TAG_DISPLAY: Record<string, { label: string; color: string; bg: string }> = {
  meeting: { label: '会议', color: '#5856d6', bg: 'rgba(88,86,214,0.10)' },
  reading: { label: '阅读', color: '#ff9500', bg: 'rgba(255,149,0,0.10)' },
  design:  { label: '设计', color: '#30b0c7', bg: 'rgba(48,176,199,0.10)' },
  report:  { label: '报告', color: '#34c759', bg: 'rgba(52,199,89,0.10)' },
  goal:    { label: '目标', color: '#ff3b30', bg: 'rgba(255,59,48,0.10)' },
  plan:    { label: '计划', color: '#007aff', bg: 'rgba(0,122,255,0.10)' },
}

// Pick the first non-journal tag to display
function pickDisplayTag(tags: string[]) {
  for (const tag of tags) {
    if (tag !== 'journal' && TAG_DISPLAY[tag]) return TAG_DISPLAY[tag]
  }
  return null
}

// Day of week from year_month + day
function getDayOfWeek(yearMonth: string, day: number): string {
  // yearMonth: "2603" → year=2026, month=03
  const year = 2000 + parseInt(yearMonth.slice(0, 2))
  const month = parseInt(yearMonth.slice(2, 4)) - 1
  const d = new Date(year, month, day)
  return ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()]
}

function formatSourceCount(materials: JournalEntry['materials']): string {
  const audio = materials.filter(m => m.kind === 'audio').length
  const docs = materials.filter(m => m.kind !== 'audio').length
  const parts = []
  if (audio > 0) parts.push(`🎙×${audio}`)
  if (docs > 0) parts.push(`📄×${docs}`)
  return parts.join(' ')
}

interface JournalItemProps {
  entry: JournalEntry
  showDate: boolean
  isSelected: boolean
  onClick: (entry: JournalEntry) => void
}

export function JournalItem({ entry, showDate, isSelected, onClick }: JournalItemProps) {
  const tag = pickDisplayTag(entry.tags)
  const srcCount = formatSourceCount(entry.materials)

  return (
    <div
      onClick={() => onClick(entry)}
      style={{
        display: 'flex',
        padding: isSelected ? '7px 16px 8px 14px' : '7px 16px 8px',
        gap: 10,
        alignItems: 'flex-start',
        cursor: 'pointer',
        background: isSelected ? 'rgba(0,0,0,0.055)' : 'transparent',
        borderLeft: isSelected ? '2px solid #ff3b30' : '2px solid transparent',
      }}
      onMouseEnter={e => {
        if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0.035)'
      }}
      onMouseLeave={e => {
        if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
      }}
    >
      {/* Date column */}
      <div style={{ width: 28, flexShrink: 0, textAlign: 'center', paddingTop: 1 }}>
        {showDate && (
          <>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--item-text)', lineHeight: 1 }}>
              {entry.day}
            </div>
            <div style={{ fontSize: 10, color: 'var(--item-meta)', marginTop: 1 }}>
              {getDayOfWeek(entry.year_month, entry.day)}
            </div>
          </>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Title + tag */}
        <div style={{
          fontSize: 13, fontWeight: 500, color: 'var(--item-text)',
          display: 'flex', alignItems: 'center', gap: 5,
          whiteSpace: 'nowrap', overflow: 'hidden',
        }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1 }}>
            {entry.title}
          </span>
          {tag && (
            <span style={{
              fontSize: 10, flexShrink: 0, padding: '1px 6px',
              borderRadius: 4, fontWeight: 500,
              color: tag.color, background: tag.bg,
            }}>
              {tag.label}
            </span>
          )}
        </div>

        {/* Summary */}
        {entry.summary && (
          <div style={{
            fontSize: 12, color: 'var(--item-meta)', marginTop: 2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {entry.summary}
          </div>
        )}

        {/* Meta */}
        <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
          <span style={{ fontSize: 11, color: 'var(--item-meta)' }}>{entry.created_time}</span>
          {srcCount && <span style={{ fontSize: 11, color: '#c7c7cc' }}>{srcCount}</span>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 运行测试**

```bash
npm test 2>&1 | grep -A10 "JournalItem"
```

Expected: 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/JournalItem.tsx src/tests/JournalItem.test.tsx
git commit -m "feat: add JournalItem component with inline tag, date column, summary"
```

---

## Task 10: InboxStrip、JournalList、DropOverlay 组件

**Files:**
- Create: `src/components/InboxStrip.tsx`
- Create: `src/components/JournalList.tsx`
- Create: `src/components/DropOverlay.tsx`

- [ ] **Step 1: 实现 InboxStrip.tsx**

```tsx
import { Spinner } from './Spinner'

interface InboxStripProps {
  processingPaths: string[]
}

function shortName(path: string): string {
  return path.split('/').pop() ?? path
}

export function InboxStrip({ processingPaths }: InboxStripProps) {
  if (processingPaths.length === 0) return null

  return (
    <div style={{
      padding: '8px 16px', background: '#fafafa',
      borderBottom: '1px solid #f0f0f0',
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 11, color: 'var(--item-meta)', flexShrink: 0 }}>整理中</span>
      {processingPaths.map(p => (
        <div key={p} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'white', border: '1px solid var(--divider)',
          borderRadius: 6, padding: '3px 7px', fontSize: 11, color: '#636366',
          maxWidth: 160,
        }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {shortName(p)}
          </span>
          <Spinner size={10} borderWidth={1.5} />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: 实现 JournalList.tsx**

```tsx
import type { JournalEntry } from '../types'
import { JournalItem } from './JournalItem'
import { InboxStrip } from './InboxStrip'

interface JournalListProps {
  entries: JournalEntry[]
  processingPaths: string[]
  selectedPath: string | null
  onSelect: (entry: JournalEntry) => void
}

export function JournalList({ entries, processingPaths, selectedPath, onSelect }: JournalListProps) {
  // Group by year_month, then by day
  const grouped: Record<string, Record<number, JournalEntry[]>> = {}
  for (const entry of entries) {
    if (!grouped[entry.year_month]) grouped[entry.year_month] = {}
    if (!grouped[entry.year_month][entry.day]) grouped[entry.year_month][entry.day] = []
    grouped[entry.year_month][entry.day].push(entry)
  }

  const months = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  function formatMonthLabel(ym: string): string {
    const year = 2000 + parseInt(ym.slice(0, 2))
    const month = parseInt(ym.slice(2, 4))
    return `${year}年${month}月`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <InboxStrip processingPaths={processingPaths} />

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 72 }}>
        {months.map(ym => {
          const days = Object.keys(grouped[ym]).map(Number).sort((a, b) => b - a)
          // Flatten all entries in this month for "last entry" detection
          const allInMonth = days.flatMap(d => grouped[ym][d])

          return (
            <div key={ym}>
              {/* Month divider — C style */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px 6px' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#8e8e93', whiteSpace: 'nowrap' }}>
                  {formatMonthLabel(ym)}
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--divider)' }} />
              </div>

              {days.map(day => {
                const dayEntries = grouped[ym][day]
                return dayEntries.map((entry, idx) => {
                  const isLastInMonth = entry === allInMonth[allInMonth.length - 1]
                  const isLastInDay = idx === dayEntries.length - 1

                  return (
                    <div key={entry.path}>
                      <JournalItem
                        entry={entry}
                        showDate={idx === 0}
                        isSelected={entry.path === selectedPath}
                        onClick={onSelect}
                      />
                      {/* Divider: between entries, but not after the last entry in a month */}
                      {!isLastInMonth && isLastInDay && (
                        <div style={{ height: 1, background: 'var(--divider)', margin: '0 16px' }} />
                      )}
                      {!isLastInDay && (
                        <div style={{ height: 1, background: 'var(--divider)', margin: '0 16px' }} />
                      )}
                    </div>
                  )
                })
              })}
            </div>
          )
        })}

        {entries.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--item-meta)', fontSize: 13 }}>
            还没有日志条目。点击录音按钮或拖入文件开始记录。
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 实现 DropOverlay.tsx**

```tsx
interface DropOverlayProps {
  visible: boolean
}

export function DropOverlay({ visible }: DropOverlayProps) {
  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,122,255,0.08)',
      border: '3px dashed #007aff',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 8, pointerEvents: 'none',
    }}>
      <div style={{ fontSize: 36 }}>📥</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#007aff' }}>拖入即可添加</div>
      <div style={{ fontSize: 13, color: '#8e8e93' }}>支持 录音 / txt / md / pdf / docx</div>
    </div>
  )
}
```

- [ ] **Step 4: 构建确认**

```bash
npm run build 2>&1 | tail -10
```

Expected: 无 TypeScript 错误

- [ ] **Step 5: Commit**

```bash
git add src/components/InboxStrip.tsx src/components/JournalList.tsx src/components/DropOverlay.tsx
git commit -m "feat: add JournalList, InboxStrip, DropOverlay components"
```

---

## Task 11: DetailPanel 组件（可编辑 markdown + 原始素材）

**Files:**
- Create: `src/components/DetailPanel.tsx`

- [ ] **Step 1: 实现 DetailPanel.tsx**

```tsx
import { useState, useEffect } from 'react'
import type { JournalEntry } from '../types'
import { getJournalEntryContent, saveJournalEntryContent } from '../lib/tauri'
import { Spinner } from './Spinner'

interface DetailPanelProps {
  entry: JournalEntry
  onClose: () => void
}

function kindIcon(kind: string): string {
  return kind === 'audio' ? '🎙' : kind === 'pdf' ? '📋' : kind === 'docx' ? '📝' : '📄'
}

export function DetailPanel({ entry, onClose }: DetailPanelProps) {
  const [content, setContent] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setContent(null)
    setEditing(false)
    getJournalEntryContent(entry.path).then(c => {
      setContent(c)
      setDraft(c)
    })
  }, [entry.path])

  const handleSave = async () => {
    setSaving(true)
    await saveJournalEntryContent(entry.path, draft)
    setContent(draft)
    setSaving(false)
    setEditing(false)
  }

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !editing) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editing, onClose])

  return (
    <div style={{
      width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column',
      borderLeft: '1px solid var(--divider)', background: 'var(--sheet-bg)',
      height: '100%',
    }}>
      {/* Header */}
      <div style={{
        height: 52, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 16px',
        borderBottom: '1px solid var(--divider)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--item-text)' }}>
          {entry.title}
        </span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 18, color: 'var(--item-meta)', padding: '4px 8px',
        }}>✕</button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Meta */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--item-meta)' }}>{entry.created_time}</span>
          {entry.tags.filter(t => t !== 'journal').map(t => (
            <span key={t} style={{
              fontSize: 11, color: '#8e8e93', background: '#f2f2f7',
              borderRadius: 4, padding: '1px 6px',
            }}>{t}</span>
          ))}
        </div>

        {/* Content */}
        {content === null ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 32 }}>
            <Spinner size={20} />
          </div>
        ) : editing ? (
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            style={{
              width: '100%', minHeight: 300, fontSize: 13, lineHeight: 1.75,
              color: 'var(--item-text)', border: '1px solid var(--divider)',
              borderRadius: 6, padding: 10, fontFamily: 'inherit',
              resize: 'vertical', background: 'var(--sheet-bg)', outline: 'none',
            }}
            autoFocus
          />
        ) : (
          <div
            onClick={() => setEditing(true)}
            title="点击编辑"
            style={{
              fontSize: 13, lineHeight: 1.75, color: 'var(--item-text)',
              whiteSpace: 'pre-wrap', cursor: 'text', minHeight: 100,
            }}
          >
            {content}
          </div>
        )}

        {/* Edit actions */}
        {editing && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={handleSave} disabled={saving} style={{
              background: '#ff3b30', color: 'white', border: 'none',
              borderRadius: 6, padding: '5px 14px', fontSize: 12,
              fontWeight: 500, cursor: saving ? 'default' : 'pointer',
            }}>
              {saving ? '保存中...' : '保存'}
            </button>
            <button onClick={() => { setEditing(false); setDraft(content ?? '') }} style={{
              background: '#f2f2f7', color: 'var(--item-text)', border: 'none',
              borderRadius: 6, padding: '5px 14px', fontSize: 12, cursor: 'pointer',
            }}>
              取消
            </button>
          </div>
        )}

        {/* Raw materials */}
        {entry.materials.length > 0 && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--divider)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#8e8e93', textTransform: 'uppercase', marginBottom: 8 }}>
              原始素材
            </div>
            {entry.materials.map(m => (
              <div key={m.path} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', borderRadius: 7, marginBottom: 4,
                background: '#f9f9f9', cursor: 'pointer',
              }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#f0f0f0'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = '#f9f9f9'}
              >
                <span style={{ fontSize: 16 }}>{kindIcon(m.kind)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--item-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.filename}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 构建确认**

```bash
npm run build 2>&1 | grep "error" | head -10
```

Expected: 无 error

- [ ] **Step 3: Commit**

```bash
git add src/components/DetailPanel.tsx
git commit -m "feat: add DetailPanel with editable markdown content and raw materials list"
```

---

## Task 11b: DetailPanel — 添加"添加素材到此条目"按钮

**Files:**
- Modify: `src/components/DetailPanel.tsx`

规格要求在详情面板中有"**添加素材到此条目** 按钮"，允许用户将额外文件关联到已选条目。

- [ ] **Step 1: 在 DetailPanel.tsx 的原始素材区块下方新增按钮**

找到 `{entry.materials.length > 0 && (` 区块末尾的闭合 `</div>)`，在其后、组件 `</div>` 之前插入：

```tsx
        {/* Add material button */}
        <button
          onClick={async () => {
            // Use Tauri file dialog via dynamic import
            const { open } = await import('@tauri-apps/plugin-dialog')
            const selected = await open({
              multiple: true,
              filters: [{ name: '素材文件', extensions: ['m4a', 'wav', 'mp3', 'txt', 'md', 'pdf', 'docx'] }],
            })
            if (!selected) return
            const paths = Array.isArray(selected) ? selected : [selected]
            const { importFile, triggerAiProcessing } = await import('../lib/tauri')
            for (const p of paths) {
              const result = await importFile(p)
              await triggerAiProcessing(result.path, result.year_month)
            }
          }}
          style={{
            marginTop: 12, width: '100%', background: 'none',
            border: '1px dashed var(--divider)', borderRadius: 7,
            padding: '8px 0', fontSize: 12, color: '#8e8e93',
            cursor: 'pointer', textAlign: 'center',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#f5f5f7'}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'none'}
        >
          + 添加素材到此条目
        </button>
```

- [ ] **Step 2: 确认 @tauri-apps/plugin-dialog 已安装**

```bash
grep "plugin-dialog" src-tauri/Cargo.toml src-tauri/tauri.conf.json 2>/dev/null | head -5
```

如果没有结果，安装：

```bash
cd src-tauri && cargo add tauri-plugin-dialog
```

在 `src-tauri/src/main.rs` 的 `Builder` 中注册插件：

```rust
.plugin(tauri_plugin_dialog::init())
```

并在前端 package.json 确认已有 `@tauri-apps/plugin-dialog`；如没有：

```bash
npm install @tauri-apps/plugin-dialog
```

- [ ] **Step 3: 构建确认**

```bash
npm run build 2>&1 | grep -E "^error|Error" | head -10
```

Expected: 无 error

- [ ] **Step 4: Commit**

```bash
git add src/components/DetailPanel.tsx src-tauri/src/main.rs
git commit -m "feat: add '添加素材到此条目' button in DetailPanel"
```

---

## Task 11c: JournalItem — 右键菜单（播放 / Finder / 删除）

**Files:**
- Create: `src/components/JournalContextMenu.tsx`
- Modify: `src/components/JournalItem.tsx`
- Modify: `src-tauri/src/journal.rs`（新增 delete_journal_entry 命令）
- Modify: `src-tauri/src/main.rs`

规格"保留不变"部分要求保留右键菜单：播放 / Finder / 删除。新条目格式是 markdown 文件（无录音直接关联），右键菜单针对**日志条目文件**提供：在 Finder 中显示 / 删除。

- [ ] **Step 1: 在 journal.rs 新增 delete_journal_entry 命令**

在 `src-tauri/src/journal.rs` 末尾新增：

```rust
#[tauri::command]
pub fn delete_journal_entry(path: String) -> Result<(), String> {
    std::fs::remove_file(&path).map_err(|e| e.to_string())
}
```

- [ ] **Step 2: 注册到 main.rs**

```rust
journal::delete_journal_entry,
```

- [ ] **Step 3: 新增 tauri.ts wrapper**

在 `src/lib/tauri.ts` 末尾新增：

```typescript
export const deleteJournalEntry = (path: string) =>
  invoke<void>('delete_journal_entry', { path })
```

- [ ] **Step 4: 创建 JournalContextMenu.tsx**

```tsx
import { useEffect, useRef } from 'react'

interface JournalContextMenuProps {
  x: number
  y: number
  entryPath: string
  onShowInFinder: () => void
  onDelete: () => void
  onClose: () => void
}

export function JournalContextMenu({ x, y, entryPath, onShowInFinder, onDelete, onClose }: JournalContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [onClose])

  const menuStyle: React.CSSProperties = {
    position: 'fixed', top: y, left: x, zIndex: 9999,
    background: 'white', border: '1px solid #e5e5ea',
    borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    minWidth: 160, overflow: 'hidden',
  }
  const itemStyle: React.CSSProperties = {
    padding: '8px 14px', fontSize: 13, cursor: 'pointer',
    color: '#1c1c1e',
  }
  const deleteStyle: React.CSSProperties = { ...itemStyle, color: '#ff3b30' }

  return (
    <div ref={ref} style={menuStyle}>
      <div style={itemStyle}
        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#f2f2f7'}
        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
        onClick={() => { onShowInFinder(); onClose() }}
      >
        在 Finder 中显示
      </div>
      <div style={{ height: 1, background: '#e5e5ea' }} />
      <div style={deleteStyle}
        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,59,48,0.06)'}
        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
        onClick={() => { onDelete(); onClose() }}
      >
        删除
      </div>
    </div>
  )
}
```

- [ ] **Step 5: 在 JournalItem.tsx 接入右键菜单**

在 `JournalItem.tsx` 中，给最外层 `<div>` 添加 `onContextMenu` 事件，并通过 prop 回调通知父组件：

将 `JournalItemProps` 改为：

```tsx
interface JournalItemProps {
  entry: JournalEntry
  showDate: boolean
  isSelected: boolean
  onClick: (entry: JournalEntry) => void
  onContextMenu?: (entry: JournalEntry, x: number, y: number) => void
}
```

在 `JournalItem` 函数签名中解构 `onContextMenu`，并在外层 div 上加：

```tsx
onContextMenu={(e) => {
  e.preventDefault()
  onContextMenu?.(entry, e.clientX, e.clientY)
}}
```

- [ ] **Step 6: 在 JournalList.tsx 处理右键菜单状态**

在 `JournalList.tsx` 中新增：

```tsx
import { useState } from 'react'
import { JournalContextMenu } from './JournalContextMenu'
import { deleteJournalEntry } from '../lib/tauri'
import { invoke } from '@tauri-apps/api/core'
```

在组件内添加状态：

```tsx
const [contextMenu, setContextMenu] = useState<{ entry: JournalEntry; x: number; y: number } | null>(null)
```

将 `<JournalItem>` 传入 `onContextMenu`：

```tsx
onContextMenu={(entry, x, y) => setContextMenu({ entry, x, y })}
```

在 `JournalList` 返回的 JSX 末尾、闭合 `</div>` 前，追加：

```tsx
{contextMenu && (
  <JournalContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    entryPath={contextMenu.entry.path}
    onShowInFinder={async () => {
      await invoke('show_in_finder', { path: contextMenu.entry.path })
    }}
    onDelete={async () => {
      await deleteJournalEntry(contextMenu.entry.path)
      // trigger list refresh via parent — JournalList doesn't own refresh
      // so emit a custom event
      window.dispatchEvent(new CustomEvent('journal-entry-deleted'))
    }}
    onClose={() => setContextMenu(null)}
  />
)}
```

- [ ] **Step 7: 在 App.tsx 监听 journal-entry-deleted**

在 `App.tsx` 的 `useEffect` 中（drop handling 之后）新增：

```tsx
useEffect(() => {
  const handler = () => refresh()
  window.addEventListener('journal-entry-deleted', handler)
  return () => window.removeEventListener('journal-entry-deleted', handler)
}, [refresh])
```

- [ ] **Step 8: 构建**

```bash
npm run build 2>&1 | grep -E "^error|Error TS" | head -20
```

Expected: 无 error

- [ ] **Step 9: Commit**

```bash
git add src/components/JournalContextMenu.tsx src/components/JournalItem.tsx src/components/JournalList.tsx src-tauri/src/journal.rs src-tauri/src/main.rs src/lib/tauri.ts src/App.tsx
git commit -m "feat: add right-click context menu (show in Finder / delete) to JournalItem"
```

---

## Task 12: 重写 App.tsx — 组装新 UI

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 重写 App.tsx**

将 `src/App.tsx` 全部替换为：

```tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { listen } from '@tauri-apps/api/event'
import { TitleBar } from './components/TitleBar'
import { RecordButton } from './components/RecordButton'
import { JournalList } from './components/JournalList'
import { DetailPanel } from './components/DetailPanel'
import { DropOverlay } from './components/DropOverlay'
import { useRecorder } from './hooks/useRecorder'
import { useJournal } from './hooks/useJournal'
import { importFile, triggerAiProcessing } from './lib/tauri'
import type { JournalEntry } from './types'

const BASE_WIDTH = 320
const PANEL_WIDTH = 340
const DIVIDER_WIDTH = 7

export default function App() {
  const { status, elapsedSecs, start, stop } = useRecorder()
  const { entries, processingPaths, refresh } = useJournal()

  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null)
  const [panelVisible, setPanelVisible] = useState(false)
  const [slideOpen, setSlideOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [baseWidth, setBaseWidth] = useState<number>(() => {
    const saved = localStorage.getItem('journal_base_width')
    return saved ? parseInt(saved) : BASE_WIDTH
  })

  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  // Window resize animation
  const setWindowWidth = useCallback(async (width: number) => {
    const win = getCurrentWindow()
    const inner = await win.innerSize()
    await win.setSize({ type: 'Logical', width, height: inner.height / (window.devicePixelRatio || 1) })
  }, [])

  const openPanel = useCallback(async (entry: JournalEntry) => {
    setSelectedEntry(entry)
    if (!panelVisible) {
      setPanelVisible(true)
      await setWindowWidth(baseWidth + DIVIDER_WIDTH + PANEL_WIDTH)
      requestAnimationFrame(() => setSlideOpen(true))
    }
  }, [panelVisible, baseWidth, setWindowWidth])

  const closePanel = useCallback(async () => {
    setSlideOpen(false)
    setTimeout(async () => {
      setPanelVisible(false)
      setSelectedEntry(null)
      await setWindowWidth(baseWidth)
    }, 250)
  }, [baseWidth, setWindowWidth])

  // Divider drag
  const onDividerMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    dragStartX.current = e.clientX
    dragStartWidth.current = baseWidth
  }
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging) return
      const delta = e.clientX - dragStartX.current
      const newWidth = Math.max(220, Math.min(560, dragStartWidth.current + delta))
      setBaseWidth(newWidth)
      localStorage.setItem('journal_base_width', String(newWidth))
      if (panelVisible) {
        setWindowWidth(newWidth + DIVIDER_WIDTH + PANEL_WIDTH)
      }
    }
    const onUp = () => setIsDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [isDragging, panelVisible, setWindowWidth])

  // Drop handling
  useEffect(() => {
    const onDragOver = (e: DragEvent) => { e.preventDefault(); setIsDragOver(true) }
    const onDragLeave = () => setIsDragOver(false)
    const onDrop = async (e: DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const files = Array.from(e.dataTransfer?.files ?? [])
      for (const file of files) {
        try {
          const result = await importFile(file.path ?? (file as unknown as { path: string }).path)
          await triggerAiProcessing(result.path, result.year_month)
        } catch (err) {
          console.error('Import failed:', err)
        }
      }
      refresh()
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [refresh])

  const handleRecord = async () => {
    if (status === 'idle') {
      await start()
    } else {
      await stop()
      refresh()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', overflow: 'hidden', position: 'relative' }}>
      <TitleBar />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Journal list */}
        <div style={{ width: baseWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          <JournalList
            entries={entries}
            processingPaths={processingPaths}
            selectedPath={selectedEntry?.path ?? null}
            onSelect={openPanel}
          />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', paddingBottom: 24, pointerEvents: 'none' }}>
            <div style={{ pointerEvents: 'auto' }}>
              <RecordButton status={status} onClick={handleRecord} />
            </div>
          </div>
        </div>

        {/* Divider */}
        {panelVisible && (
          <div
            onMouseDown={onDividerMouseDown}
            style={{
              width: DIVIDER_WIDTH, flexShrink: 0, background: 'var(--divider)',
              cursor: 'col-resize',
            }}
          />
        )}

        {/* Right: Detail panel */}
        {panelVisible && selectedEntry && (
          <div style={{
            transform: slideOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
            flexShrink: 0,
          }}>
            <DetailPanel entry={selectedEntry} onClose={closePanel} />
          </div>
        )}
      </div>

      <DropOverlay visible={isDragOver} />
    </div>
  )
}
```

- [ ] **Step 2: 构建**

```bash
npm run build 2>&1 | grep -E "error TS|Error" | head -20
```

Expected: 无 error

- [ ] **Step 3: 运行全部测试**

```bash
npm test 2>&1 | tail -20
```

Expected: 全部通过

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: rewrite App.tsx with JournalList, DetailPanel, drop handling"
```

---

## Task 13: CSS 变量补充 & 收尾

**Files:**
- Modify: `src/styles/globals.css`

- [ ] **Step 1: 确认所有新组件用到的 CSS 变量都已定义**

检查 `globals.css` 中已有：`--bg`、`--divider`、`--item-text`、`--item-meta`、`--sheet-bg`。

如缺少，在 `:root` 块补充：

```css
--card-selected-bar: #ff3b30;
```

- [ ] **Step 2: 完整构建 + 测试**

```bash
npm run build 2>&1 | tail -5 && npm test 2>&1 | tail -10
```

Expected: build success，all tests pass

- [ ] **Step 3: 最终 Commit**

```bash
git add src/styles/globals.css
git commit -m "chore: ensure CSS variables cover all new components"
```

---

## 验收标准

1. **设置界面** 可以保存 workspace 路径、Claude CLI 路径、DashScope Key
2. **录音** 结束后素材出现在 `{workspace}/yyMM/raw/`，自动触发 Claude CLI
3. **拖入文件** 出现拖放遮罩，文件复制到 `raw/`，自动触发 Claude CLI
4. **列表** 显示 workspace 中所有 `yyMM/dd-标题.md` 文件，按月/日倒序
5. **月份分隔线** 样式正确，月末最后一条无下方分隔线
6. **日期列** 首条目显示 15px 日数字 + 周几，同天后续条目空白
7. **标签 pill** 内联在标题后，按类型着色
8. **顶部处理条** 仅在 AI 处理中时显示，完成后消失
9. **详情面板** 右滑出，显示 markdown 内容可点击编辑，"添加素材到此条目"按钮可导入文件
10. **右键菜单** 日志条目右键显示"在 Finder 中显示"和"删除"
11. **所有现有测试** 仍然通过
