# Settings Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重写设置页为左侧目录导航 + 右侧单栏滚动布局，支持六个分组（通用、AI 引擎、语音转写、工作引导、技能插件、关于），完整接入 CSS 变量主题体系，并新增 AI 引擎一键安装检测流程。

**Architecture:** 前端完全重写 `src/settings/App.tsx`，拆分为若干小组件文件。Rust 侧新增 `check_engine_installed` / `install_engine` / `get_app_version` 命令，并扩展 `Config` struct 存储 AI 引擎配置字段。工作引导复用已有的 `get_workspace_prompt` / `set_workspace_prompt` 命令（已读写 `CLAUDE.md`）。

**Tech Stack:** React + TypeScript, Tauri v2, Rust/tokio, tauri-plugin-dialog（需新增），CSS variables

---

## File Structure

### 新建
- `src/settings/components/SectionGeneral.tsx` — 通用分组
- `src/settings/components/SectionAiEngine.tsx` — AI 引擎分组（引擎卡片 + 安装 + 配置字段）
- `src/settings/components/SectionVoice.tsx` — 语音转写分组
- `src/settings/components/SectionGuide.tsx` — 工作引导分组（编辑器）
- `src/settings/components/SectionPlugins.tsx` — 技能插件分组
- `src/settings/components/SectionAbout.tsx` — 关于分组

### 修改
- `src/settings/App.tsx` — 完全重写：左侧导航 + 右侧滚动容器，挂载各分组
- `src/lib/tauri.ts` — 新增：`checkEngineInstalled`, `installEngine`, `getAppVersion`, `getEngineConfig`, `setEngineConfig`
- `src-tauri/src/config.rs` — 扩展 `Config` struct 新增 AI 引擎字段；新增 `get_app_version` 命令
- `src-tauri/src/ai_processor.rs` — 新增 `check_engine_installed` / `install_engine` 命令
- `src-tauri/src/main.rs` — 注册新命令
- `src-tauri/Cargo.toml` — 新增 `tauri-plugin-dialog`
- `package.json` — 新增 `@tauri-apps/plugin-dialog`
- `src-tauri/tauri.conf.json` — 设置窗口尺寸 600×500，注册 dialog plugin

---

## Task 1: 扩展 Config struct，新增 AI 引擎存储字段

**Files:**
- Modify: `src-tauri/src/config.rs`

- [ ] **Step 1: 在 `Config` struct 中新增字段**

打开 `src-tauri/src/config.rs`，在现有字段后添加：

```rust
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

fn default_active_engine() -> String {
    "claude".to_string()
}
```

- [ ] **Step 2: 新增 get/set 命令**

在 `config.rs` 末尾（`#[cfg(test)]` 之前）添加：

```rust
#[tauri::command]
pub fn get_engine_config(app: AppHandle) -> Result<serde_json::Value, String> {
    let c = load_config(&app)?;
    Ok(serde_json::json!({
        "active_ai_engine": c.active_ai_engine,
        "claude_code_api_key": c.claude_code_api_key,
        "claude_code_base_url": c.claude_code_base_url,
        "claude_code_model": c.claude_code_model,
        "qwen_code_api_key": c.qwen_code_api_key,
        "qwen_code_base_url": c.qwen_code_base_url,
        "qwen_code_model": c.qwen_code_model,
    }))
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
```

- [ ] **Step 3: 更新现有 config_roundtrip 测试以覆盖新字段**

在 `config.rs` 的 `#[cfg(test)]` 块中，在现有测试后追加：

```rust
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
```

- [ ] **Step 4: 运行 Rust 测试验证**

```bash
cd src-tauri && cargo test config
```

Expected: 全部 PASS（`config_defaults`, `config_roundtrip`, `config_new_engine_fields_default`, `config_engine_fields_roundtrip`）

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/config.rs
git commit -m "feat(config): add AI engine config fields and get/set commands"
```

---

## Task 2: 新增引擎检测和安装 Rust 命令

**Files:**
- Modify: `src-tauri/src/ai_processor.rs`

- [ ] **Step 1: 在 `ai_processor.rs` 末尾新增两个命令**

```rust
/// 检测引擎是否已安装。engine: "claude" | "qwen"
#[tauri::command]
pub fn check_engine_installed(engine: String) -> Result<bool, String> {
    let bin = match engine.as_str() {
        "claude" => "claude",
        "qwen" => "qwen",
        _ => return Err(format!("unknown engine: {}", engine)),
    };
    let output = std::process::Command::new("which")
        .arg(bin)
        .output()
        .map_err(|e| e.to_string())?;
    Ok(output.status.success())
}

/// 安装引擎，通过 Tauri 事件流式推送日志。
/// 事件名："engine-install-log"，payload: { line: String, done: bool, success: bool }
#[tauri::command]
pub async fn install_engine(app: tauri::AppHandle, engine: String) -> Result<(), String> {
    use tokio::io::AsyncBufReadExt;

    let (program, args): (&str, Vec<&str>) = match engine.as_str() {
        "claude" => ("npm", vec!["install", "-g", "@anthropic-ai/claude-code"]),
        "qwen" => ("bash", vec!["-c", "$(curl -fsSL https://qwen-code-assets.oss-cn-hangzhou.aliyuncs.com/installation/install-qwen.sh) -s --source qwenchat"]),
        _ => return Err(format!("unknown engine: {}", engine)),
    };

    let mut child = tokio::process::Command::new(program)
        .args(&args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to spawn: {}", e))?;

    // Stream stdout
    if let Some(stdout) = child.stdout.take() {
        let app_clone = app.clone();
        let engine_clone = engine.clone();
        tokio::spawn(async move {
            let reader = tokio::io::BufReader::new(stdout);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app_clone.emit("engine-install-log", serde_json::json!({
                    "engine": engine_clone,
                    "line": line,
                    "done": false,
                    "success": false,
                }));
            }
        });
    }

    // Stream stderr
    if let Some(stderr) = child.stderr.take() {
        let app_clone = app.clone();
        let engine_clone = engine.clone();
        tokio::spawn(async move {
            let reader = tokio::io::BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app_clone.emit("engine-install-log", serde_json::json!({
                    "engine": engine_clone,
                    "line": line,
                    "done": false,
                    "success": false,
                }));
            }
        });
    }

    let status = child.wait().await.map_err(|e| e.to_string())?;
    let success = status.success();
    let _ = app.emit("engine-install-log", serde_json::json!({
        "engine": engine,
        "line": if success { "安装完成" } else { "安装失败" },
        "done": true,
        "success": success,
    }));

    if success { Ok(()) } else { Err("installation failed".to_string()) }
}
```

- [ ] **Step 2: 在 `main.rs` 的 `invoke_handler!` 中注册新命令**

打开 `src-tauri/src/main.rs`，在 `invoke_handler` 列表中追加：

```rust
config::get_engine_config,
config::set_engine_config,
config::get_app_version,
ai_processor::check_engine_installed,
ai_processor::install_engine,
```

- [ ] **Step 3: 编译确认无错误**

```bash
cd src-tauri && cargo build 2>&1 | grep -E "^error"
```

Expected: 无输出（无编译错误）

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/ai_processor.rs src-tauri/src/main.rs
git commit -m "feat(engine): add check_engine_installed and install_engine commands"
```

---

## Task 3: 安装 tauri-plugin-dialog，新增前端 tauri.ts wrappers

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `package.json`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: 安装 dialog 插件**

```bash
cd src-tauri && cargo add tauri-plugin-dialog
```

- [ ] **Step 2: 注册 dialog 插件到 Tauri builder**

在 `src-tauri/src/main.rs` 的 `tauri::Builder::default()` 链中，在 `.plugin(tauri_plugin_clipboard::init())` 后追加：

```rust
.plugin(tauri_plugin_dialog::init())
```

- [ ] **Step 3: 安装前端 dialog 包**

```bash
npm install @tauri-apps/plugin-dialog
```

- [ ] **Step 4: 在 `src/lib/tauri.ts` 末尾追加新 wrappers**

```typescript
import { open as dialogOpen } from '@tauri-apps/plugin-dialog'

// Engine
export const checkEngineInstalled = (engine: 'claude' | 'qwen'): Promise<boolean> =>
  invoke('check_engine_installed', { engine })

export const installEngine = (engine: 'claude' | 'qwen'): Promise<void> =>
  invoke('install_engine', { engine })

// App version
export const getAppVersion = (): Promise<string> =>
  invoke('get_app_version')

// Engine config
export interface EngineConfig {
  active_ai_engine: 'claude' | 'qwen'
  claude_code_api_key: string
  claude_code_base_url: string
  claude_code_model: string
  qwen_code_api_key: string
  qwen_code_base_url: string
  qwen_code_model: string
}

export const getEngineConfig = (): Promise<EngineConfig> =>
  invoke('get_engine_config')

export const setEngineConfig = (cfg: EngineConfig): Promise<void> =>
  invoke('set_engine_config', cfg)

// Folder picker
export const pickFolder = (): Promise<string | null> =>
  dialogOpen({ directory: true, multiple: false }).then(r => r as string | null)
```

- [ ] **Step 5: 编译前端确认无类型错误**

```bash
npm run build 2>&1 | grep -E "error TS"
```

Expected: 无输出

- [ ] **Step 6: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/main.rs package.json package-lock.json src/lib/tauri.ts
git commit -m "feat(dialog): install tauri-plugin-dialog and add frontend wrappers"
```

---

## Task 4: 重写 `src/settings/App.tsx` — 骨架布局

**Files:**
- Modify: `src/settings/App.tsx`

- [ ] **Step 1: 重写为左栏导航 + 右侧滚动容器骨架**

完整替换 `src/settings/App.tsx`：

```tsx
import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../hooks/useTheme'
import SectionGeneral from './components/SectionGeneral'
import SectionAiEngine from './components/SectionAiEngine'
import SectionVoice from './components/SectionVoice'
import SectionGuide from './components/SectionGuide'
import SectionPlugins from './components/SectionPlugins'
import SectionAbout from './components/SectionAbout'

type NavId = 'general' | 'ai' | 'voice' | 'guide' | 'plugins' | 'about'

const NAV_ITEMS: { id: NavId; label: string; icon: string }[] = [
  { id: 'general',  label: '通用',   icon: '⚙' },
  { id: 'ai',       label: 'AI 引擎', icon: '◈' },
  { id: 'voice',    label: '语音转写', icon: '◎' },
  { id: 'guide',    label: '工作引导', icon: '✦' },
  { id: 'plugins',  label: '技能插件', icon: '⬡' },
]

export default function SettingsApp() {
  const { theme } = useTheme()
  const [activeNav, setActiveNav] = useState<NavId>('general')
  const scrollRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Partial<Record<NavId, HTMLElement>>>({})

  // IntersectionObserver: sync active nav while scrolling
  useEffect(() => {
    const scroll = scrollRef.current
    if (!scroll) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveNav(entry.target.id as NavId)
          }
        }
      },
      { root: scroll, threshold: 0.4 }
    )
    Object.values(sectionRefs.current).forEach(el => el && observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const jumpTo = (id: NavId) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth' })
  }

  const setRef = (id: NavId) => (el: HTMLElement | null) => {
    if (el) sectionRefs.current[id] = el
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', color: 'var(--item-text)' }}>
      {/* Left nav */}
      <nav style={{
        width: 140, flexShrink: 0,
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--divider)',
        padding: '12px 8px',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        {NAV_ITEMS.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => jumpTo(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 12, textAlign: 'left', width: '100%',
              background: activeNav === id ? 'rgba(200,147,58,0.12)' : 'transparent',
              color: activeNav === id ? 'var(--record-btn)' : 'var(--item-meta)',
            }}
          >
            <span style={{ width: 16, textAlign: 'center', fontSize: 13 }}>{icon}</span>
            {label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => jumpTo('about')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
            fontSize: 12, textAlign: 'left', width: '100%',
            background: activeNav === 'about' ? 'rgba(200,147,58,0.12)' : 'transparent',
            color: activeNav === 'about' ? 'var(--record-btn)' : 'var(--item-meta)',
          }}
        >
          <span style={{ width: 16, textAlign: 'center', fontSize: 13 }}>◌</span>
          关于
        </button>
      </nav>

      {/* Right scroll area */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', scrollBehavior: 'smooth' }}>
        <section id="general" ref={setRef('general')}><SectionGeneral /></section>
        <section id="ai"      ref={setRef('ai')}><SectionAiEngine /></section>
        <section id="voice"   ref={setRef('voice')}><SectionVoice /></section>
        <section id="guide"   ref={setRef('guide')}><SectionGuide /></section>
        <section id="plugins" ref={setRef('plugins')}><SectionPlugins /></section>
        <section id="about"   ref={setRef('about')} style={{ paddingBottom: 40 }}><SectionAbout /></section>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 创建空桩组件（让项目能编译）**

创建 `src/settings/components/` 目录，然后为每个分组创建最小桩文件：

```bash
mkdir -p src/settings/components
```

为 `SectionGeneral.tsx` / `SectionAiEngine.tsx` / `SectionVoice.tsx` / `SectionGuide.tsx` / `SectionPlugins.tsx` / `SectionAbout.tsx` 各创建内容：

```tsx
// 例：src/settings/components/SectionGeneral.tsx
export default function SectionGeneral() {
  return <div style={{ padding: '20px 24px' }}>通用（待实现）</div>
}
```

其余五个文件同样结构，只改函数名和占位文字。

- [ ] **Step 3: 确认编译通过**

```bash
npm run build 2>&1 | grep -E "error TS"
```

Expected: 无输出

- [ ] **Step 4: Commit**

```bash
git add src/settings/App.tsx src/settings/components/
git commit -m "feat(settings): scaffold left-nav + scroll layout with stub sections"
```

---

## Task 5: 实现 `SectionGeneral` — 通用分组

**Files:**
- Modify: `src/settings/components/SectionGeneral.tsx`

- [ ] **Step 1: 实现完整通用分组**

```tsx
import { useState, useEffect } from 'react'
import { getWorkspacePath, setWorkspacePath, pickFolder } from '../../lib/tauri'
import { useTheme } from '../../hooks/useTheme'
import type { Theme } from '../../types'

const sectionStyle: React.CSSProperties = { padding: '20px 24px', borderBottom: '1px solid var(--divider)' }
const labelStyle: React.CSSProperties = { fontSize: 11, color: 'var(--item-meta)', marginBottom: 5, display: 'block' }
const hintStyle: React.CSSProperties = { fontSize: 10, color: 'var(--duration-text)', marginTop: 4, lineHeight: 1.5 }
const inputStyle: React.CSSProperties = {
  flex: 1, background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
  borderRadius: 6, padding: '7px 10px', fontSize: 12, color: 'var(--item-text)',
  fontFamily: 'ui-monospace, monospace', outline: 'none',
}

export default function SectionGeneral() {
  const [workspacePath, setWorkspacePathState] = useState('')
  const [saved, setSaved] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    getWorkspacePath().then(setWorkspacePathState)
  }, [])

  const handlePickFolder = async () => {
    const picked = await pickFolder()
    if (picked) setWorkspacePathState(picked)
  }

  const handleSave = async () => {
    await setWorkspacePath(workspacePath)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const THEMES: { value: Theme; label: string; icon: string }[] = [
    { value: 'light', label: '浅色', icon: '☀' },
    { value: 'dark',  label: '深色', icon: '◑' },
    { value: 'system',label: '跟随系统', icon: '⊙' },
  ]

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 11, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, fontWeight: 500 }}>通用</div>

      {/* Workspace 路径 */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Workspace 路径</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={inputStyle}
            value={workspacePath}
            onChange={e => setWorkspacePathState(e.target.value)}
            placeholder="/Users/you/Documents/journal"
          />
          <button
            onClick={handlePickFolder}
            style={{
              background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
              borderRadius: 6, padding: '0 12px', fontSize: 12, color: 'var(--item-meta)',
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            选择…
          </button>
        </div>
        <div style={hintStyle}>日志和素材的存储根目录</div>
      </div>

      {/* 分割线 */}
      <div style={{ height: 1, background: 'var(--divider)', margin: '14px 0' }} />

      {/* 主题 */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>主题</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {THEMES.map(({ value, label, icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              style={{
                flex: 1, background: theme === value ? 'rgba(200,147,58,0.08)' : 'var(--detail-case-bg)',
                border: `1px solid ${theme === value ? 'var(--record-btn)' : 'var(--divider)'}`,
                borderRadius: 6, padding: 8, cursor: 'pointer', textAlign: 'center',
                color: theme === value ? 'var(--record-btn)' : 'var(--item-meta)', fontSize: 11,
              }}
            >
              <div style={{ fontSize: 16, marginBottom: 3 }}>{icon}</div>
              <div>{label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 保存 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
        {saved && <span style={{ fontSize: 11, color: '#34c759' }}>已保存</span>}
        <button
          onClick={handleSave}
          style={{
            background: 'var(--record-btn)', border: 'none', borderRadius: 5,
            padding: '6px 18px', fontSize: 12, fontWeight: 600,
            color: 'var(--bg)', cursor: 'pointer',
          }}
        >
          保存
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 运行开发服务器手动测试**

```bash
npm run tauri dev
```

打开设置页，验证：
- Workspace 路径显示当前值
- 点击「选择…」弹出文件夹选择器
- 主题三选一按钮高亮当前选中态
- 点击其他主题后页面立即切换颜色
- 点击「保存」后显示「已保存」提示

- [ ] **Step 3: Commit**

```bash
git add src/settings/components/SectionGeneral.tsx
git commit -m "feat(settings): implement SectionGeneral with workspace path and theme selector"
```

---

## Task 6: 实现 `SectionAiEngine` — AI 引擎分组

**Files:**
- Modify: `src/settings/components/SectionAiEngine.tsx`

- [ ] **Step 1: 实现完整 AI 引擎分组**

```tsx
import { useState, useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import {
  checkEngineInstalled, installEngine,
  getEngineConfig, setEngineConfig,
  type EngineConfig,
} from '../../lib/tauri'

type InstallStatus = 'checking' | 'installed' | 'not_installed' | 'installing'
type EngineId = 'claude' | 'qwen'

const sectionStyle: React.CSSProperties = { padding: '20px 24px', borderBottom: '1px solid var(--divider)' }
const labelStyle: React.CSSProperties = { fontSize: 11, color: 'var(--item-meta)', marginBottom: 5, display: 'block' }
const hintStyle: React.CSSProperties = { fontSize: 10, color: 'var(--duration-text)', marginTop: 4, lineHeight: 1.5 }
const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
  borderRadius: 6, padding: '7px 10px', fontSize: 12, color: 'var(--item-text)',
  fontFamily: 'ui-monospace, monospace', outline: 'none',
}

const ENGINES = [
  { id: 'claude' as EngineId, label: 'Claude Code', vendor: 'Anthropic', icon: '◈' },
  { id: 'qwen'   as EngineId, label: 'Qwen Code',   vendor: '阿里云',     icon: '◇' },
]

export default function SectionAiEngine() {
  const [status, setStatus] = useState<Record<EngineId, InstallStatus>>({
    claude: 'checking', qwen: 'checking',
  })
  const [installLogs, setInstallLogs] = useState<Record<EngineId, string[]>>({
    claude: [], qwen: [],
  })
  const [cfg, setCfg] = useState<EngineConfig>({
    active_ai_engine: 'claude',
    claude_code_api_key: '', claude_code_base_url: '', claude_code_model: '',
    qwen_code_api_key: '', qwen_code_base_url: '', qwen_code_model: '',
  })
  const [saved, setSaved] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Load install status and config on mount
  useEffect(() => {
    ENGINES.forEach(({ id }) => {
      checkEngineInstalled(id).then(installed => {
        setStatus(prev => ({ ...prev, [id]: installed ? 'installed' : 'not_installed' }))
      })
    })
    getEngineConfig().then(setCfg)
  }, [])

  // Listen for install progress events
  useEffect(() => {
    const unlisten = listen<{ engine: EngineId; line: string; done: boolean; success: boolean }>(
      'engine-install-log',
      ({ payload }) => {
        setInstallLogs(prev => ({
          ...prev,
          [payload.engine]: [...prev[payload.engine], payload.line],
        }))
        if (payload.done) {
          setStatus(prev => ({
            ...prev,
            [payload.engine]: payload.success ? 'installed' : 'not_installed',
          }))
        }
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    )
    return () => { unlisten.then(fn => fn()) }
  }, [])

  const handleInstall = (engine: EngineId) => {
    setStatus(prev => ({ ...prev, [engine]: 'installing' }))
    setInstallLogs(prev => ({ ...prev, [engine]: [] }))
    installEngine(engine)
  }

  const handleSave = async () => {
    await setEngineConfig(cfg)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const active = cfg.active_ai_engine as EngineId

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 11, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, fontWeight: 500 }}>AI 引擎</div>

      {/* Engine cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
        {ENGINES.map(({ id, label, vendor, icon }) => {
          const s = status[id]
          const isActive = active === id
          return (
            <div
              key={id}
              onClick={() => s === 'installed' && setCfg(prev => ({ ...prev, active_ai_engine: id }))}
              style={{
                background: isActive ? 'rgba(200,147,58,0.08)' : 'var(--detail-case-bg)',
                border: `1px solid ${isActive ? 'var(--record-btn)' : 'var(--divider)'}`,
                borderRadius: 10, padding: '14px 12px 12px',
                textAlign: 'center', position: 'relative',
                cursor: s === 'installed' ? 'pointer' : 'default',
                opacity: s === 'checking' ? 0.6 : 1,
              }}
            >
              {/* Status badge */}
              {s === 'checking' && (
                <div style={{
                  position: 'absolute', top: 8, right: 8,
                  width: 14, height: 14, border: '2px solid var(--divider)',
                  borderTopColor: 'var(--record-btn)', borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} />
              )}
              {s === 'installed' && (
                <div style={{
                  position: 'absolute', top: 8, right: 8,
                  width: 16, height: 16, background: '#27c93f', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, color: '#fff', fontWeight: 700,
                }}>✓</div>
              )}
              <div style={{ fontSize: 22, marginBottom: 6, opacity: s === 'not_installed' || s === 'installing' ? 0.5 : 1 }}>{icon}</div>
              <div style={{ fontSize: 12, fontWeight: 500, color: isActive ? 'var(--record-btn)' : 'var(--item-meta)' }}>{label}</div>
              <div style={{ fontSize: 10, color: 'var(--duration-text)', marginTop: 2 }}>{vendor}</div>
              {/* Install button */}
              {s === 'not_installed' && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleInstall(id) }}
                  style={{
                    position: 'absolute', bottom: 8, right: 8,
                    background: 'var(--record-btn)', border: 'none', borderRadius: 4,
                    padding: '3px 8px', fontSize: 10, color: 'var(--bg)',
                    fontWeight: 600, cursor: 'pointer',
                  }}
                >安装</button>
              )}
            </div>
          )
        })}
      </div>

      {/* Install progress for any engine currently installing */}
      {ENGINES.map(({ id }) => status[id] === 'installing' && (
        <div key={id} style={{
          background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
          borderRadius: 8, padding: '12px 14px', marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--record-btn)', animation: 'pulse 1s ease-in-out infinite' }} />
            <span style={{ fontSize: 11, color: 'var(--item-meta)' }}>正在安装 {ENGINES.find(e => e.id === id)?.label}…</span>
          </div>
          <div style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 10,
            color: 'var(--item-meta)', maxHeight: 120, overflowY: 'auto', lineHeight: 1.7,
          }}>
            {installLogs[id].map((line, i) => <div key={i}>{line}</div>)}
            <div ref={logsEndRef} />
          </div>
        </div>
      ))}

      {/* Config fields for active installed engine */}
      {status[active] === 'installed' && (
        <>
          <div style={{ height: 1, background: 'var(--divider)', margin: '14px 0' }} />

          {active === 'claude' && (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>API Key</label>
                <input type="password" style={inputStyle} placeholder="sk-ant-…"
                  value={cfg.claude_code_api_key}
                  onChange={e => setCfg(prev => ({ ...prev, claude_code_api_key: e.target.value }))} />
                <div style={hintStyle}>留空则使用 CLI 默认配置</div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Base URL</label>
                <input style={inputStyle} placeholder="https://api.anthropic.com"
                  value={cfg.claude_code_base_url}
                  onChange={e => setCfg(prev => ({ ...prev, claude_code_base_url: e.target.value }))} />
                <div style={hintStyle}>自定义 API 端点，留空使用默认值（代理场景）</div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Model</label>
                <input style={inputStyle} placeholder="claude-sonnet-4-6"
                  value={cfg.claude_code_model}
                  onChange={e => setCfg(prev => ({ ...prev, claude_code_model: e.target.value }))} />
                <div style={hintStyle}>留空使用 CLI 默认模型</div>
              </div>
            </>
          )}

          {active === 'qwen' && (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>API Key</label>
                <input type="password" style={inputStyle} placeholder="sk-…"
                  value={cfg.qwen_code_api_key}
                  onChange={e => setCfg(prev => ({ ...prev, qwen_code_api_key: e.target.value }))} />
                <div style={hintStyle}>阿里云 DashScope API Key（独立于语音转写配置）</div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Base URL</label>
                <input style={inputStyle} placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
                  value={cfg.qwen_code_base_url}
                  onChange={e => setCfg(prev => ({ ...prev, qwen_code_base_url: e.target.value }))} />
                <div style={hintStyle}>自定义 API 端点，留空使用默认值</div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Model</label>
                <input style={inputStyle} placeholder="qwen-coder-plus"
                  value={cfg.qwen_code_model}
                  onChange={e => setCfg(prev => ({ ...prev, qwen_code_model: e.target.value }))} />
                <div style={hintStyle}>留空使用默认模型</div>
              </div>
            </>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
            {saved && <span style={{ fontSize: 11, color: '#34c759' }}>已保存</span>}
            <button onClick={handleSave} style={{
              background: 'var(--record-btn)', border: 'none', borderRadius: 5,
              padding: '6px 18px', fontSize: 12, fontWeight: 600,
              color: 'var(--bg)', cursor: 'pointer',
            }}>保存</button>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  )
}
```

- [ ] **Step 2: 手动测试**

```bash
npm run tauri dev
```

验证：
- 窗口打开时两张卡片显示旋转角标（检测中）
- 检测完成后已安装的显示绿色 ✓，未安装的显示「安装」按钮
- 点击已安装的引擎卡片切换选中态（accent 色边框）
- 选中已安装引擎后显示对应配置字段
- 点击「安装」后展开进度区域，实时输出日志

- [ ] **Step 3: Commit**

```bash
git add src/settings/components/SectionAiEngine.tsx
git commit -m "feat(settings): implement SectionAiEngine with install detection and config fields"
```

---

## Task 7: 实现 `SectionVoice`、`SectionGuide`、`SectionPlugins`、`SectionAbout`

**Files:**
- Modify: `src/settings/components/SectionVoice.tsx`
- Modify: `src/settings/components/SectionGuide.tsx`
- Modify: `src/settings/components/SectionPlugins.tsx`
- Modify: `src/settings/components/SectionAbout.tsx`

- [ ] **Step 1: 实现 `SectionVoice.tsx`**

```tsx
import { useState, useEffect } from 'react'
import { getApiKey, setApiKey } from '../../lib/tauri'

const sectionStyle: React.CSSProperties = { padding: '20px 24px', borderBottom: '1px solid var(--divider)' }
const labelStyle: React.CSSProperties = { fontSize: 11, color: 'var(--item-meta)', marginBottom: 5, display: 'block' }
const hintStyle: React.CSSProperties = { fontSize: 10, color: 'var(--duration-text)', marginTop: 4, lineHeight: 1.5 }
const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
  borderRadius: 6, padding: '7px 10px', fontSize: 12, color: 'var(--item-text)',
  fontFamily: 'ui-monospace, monospace', outline: 'none',
}

export default function SectionVoice() {
  const [apiKey, setApiKeyState] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getApiKey().then(k => setApiKeyState(k ?? ''))
  }, [])

  const handleSave = async () => {
    await setApiKey(apiKey)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 11, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, fontWeight: 500 }}>语音转写</div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>转写引擎</label>
        <div style={{ ...inputStyle, color: 'var(--item-meta)', pointerEvents: 'none' }}>阿里云 DashScope</div>
        <div style={hintStyle}>当前仅支持 DashScope，更多引擎即将支持</div>
      </div>

      <div style={{ height: 1, background: 'var(--divider)', margin: '14px 0' }} />

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>DashScope API Key</label>
        <input type="password" style={inputStyle} placeholder="sk-…"
          value={apiKey} onChange={e => setApiKeyState(e.target.value)} />
        <div style={hintStyle}>配置后，超过 30 秒的录音将自动转写为文字</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
        {saved && <span style={{ fontSize: 11, color: '#34c759' }}>已保存</span>}
        <button onClick={handleSave} style={{
          background: 'var(--record-btn)', border: 'none', borderRadius: 5,
          padding: '6px 18px', fontSize: 12, fontWeight: 600,
          color: 'var(--bg)', cursor: 'pointer',
        }}>保存</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 实现 `SectionGuide.tsx`**

```tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { getWorkspacePrompt, setWorkspacePrompt } from '../../lib/tauri'

const sectionStyle: React.CSSProperties = { padding: '20px 24px', borderBottom: '1px solid var(--divider)', display: 'flex', flexDirection: 'column' }

// Minimal Markdown syntax highlight: applies color to # headings and leading -
function highlightMarkdown(text: string): React.ReactNode[] {
  return text.split('\n').map((line, i) => {
    let color = 'var(--md-text)'
    if (/^# /.test(line)) color = 'var(--item-text)'
    else if (/^## /.test(line)) color = 'var(--item-meta)'
    const bulletMatch = line.match(/^(\s*)(- )(.*)/)
    if (bulletMatch) {
      return (
        <div key={i} style={{ color: 'var(--md-text)' }}>
          {bulletMatch[1]}
          <span style={{ color: 'var(--record-btn)' }}>{bulletMatch[2]}</span>
          {bulletMatch[3]}
        </div>
      )
    }
    return <div key={i} style={{ color }}>{line || '\u00A0'}</div>
  })
}

export default function SectionGuide() {
  const [content, setContent] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    getWorkspacePrompt().then(setContent)
  }, [])

  const save = useCallback(async (text: string) => {
    setSaveStatus('saving')
    await setWorkspacePrompt(text)
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setContent(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => save(text), 800)
  }

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 11, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 500 }}>工作引导</div>
      <div style={{ fontSize: 11, color: 'var(--duration-text)', marginBottom: 12, lineHeight: 1.6 }}>
        告诉 AI 你的工作习惯和偏好，它会在处理日志时参考这些引导。
      </div>

      {/* Editor: highlight div + transparent textarea overlay */}
      <div style={{ position: 'relative', minHeight: 200, flex: 1 }}>
        {/* Syntax-highlighted backdrop */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0,
          background: 'var(--detail-case-bg)', border: '1px solid var(--divider)', borderRadius: 6,
          padding: '12px 14px', fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
          fontSize: 11.5, lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          pointerEvents: 'none', overflow: 'hidden',
        }}>
          {highlightMarkdown(content)}
        </div>
        {/* Transparent textarea on top */}
        <textarea
          value={content}
          onChange={handleChange}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            background: 'transparent', border: '1px solid transparent', borderRadius: 6,
            padding: '12px 14px', fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
            fontSize: 11.5, lineHeight: 1.75, color: 'transparent', caretColor: 'var(--item-text)',
            resize: 'none', outline: 'none', boxSizing: 'border-box',
          }}
          spellCheck={false}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <span style={{ fontSize: 10, color: 'var(--duration-text)' }}>
          {saveStatus === 'saving' ? '保存中…' : saveStatus === 'saved' ? '已自动保存' : ''}
        </span>
        <button onClick={() => save(content)} style={{
          background: 'var(--record-btn)', border: 'none', borderRadius: 5,
          padding: '6px 18px', fontSize: 12, fontWeight: 600,
          color: 'var(--bg)', cursor: 'pointer',
        }}>保存</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 实现 `SectionPlugins.tsx`**

```tsx
const sectionStyle: React.CSSProperties = { padding: '20px 24px', borderBottom: '1px solid var(--divider)' }

const PLUGINS = [
  {
    icon: '🗂', iconBg: 'rgba(200,147,58,0.12)',
    name: '定时文件整理',
    desc: '按规则自动归档 Workspace 中的素材和日志，保持目录整洁',
  },
  {
    icon: '✦', iconBg: 'rgba(120,100,200,0.12)',
    name: '图文可视化美化',
    desc: '将日志内容转换为图文并茂的可视化卡片，便于分享',
  },
]

export default function SectionPlugins() {
  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 11, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, fontWeight: 500 }}>技能插件</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {PLUGINS.map(({ icon, iconBg, name, desc }) => (
          <div key={name} style={{
            background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
            borderRadius: 8, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--item-text)', marginBottom: 2 }}>{name}</div>
              <div style={{ fontSize: 10, color: 'var(--duration-text)', lineHeight: 1.4 }}>{desc}</div>
            </div>
            <div style={{ fontSize: 9, color: 'var(--record-btn)', background: 'rgba(200,147,58,0.08)', border: '1px solid rgba(200,147,58,0.15)', borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap' }}>即将推出</div>
          </div>
        ))}
        {/* More placeholder */}
        <div style={{ border: '1px dashed var(--divider)', borderRadius: 8, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, opacity: 0.4 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, border: '1px dashed var(--divider)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: 'var(--item-meta)', flexShrink: 0 }}>+</div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--item-meta)' }}>更多插件</div>
            <div style={{ fontSize: 10, color: 'var(--duration-text)' }}>插件市场即将开放</div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 实现 `SectionAbout.tsx`**

```tsx
import { useState, useEffect } from 'react'
import { getAppVersion } from '../../lib/tauri'

const sectionStyle: React.CSSProperties = { padding: '20px 24px' }

export default function SectionAbout() {
  const [version, setVersion] = useState('…')

  useEffect(() => {
    getAppVersion().then(setVersion)
  }, [])

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 11, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, fontWeight: 500 }}>关于</div>
      <div style={{
        background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
        borderRadius: 8, padding: 20, textAlign: 'center',
      }}>
        <div style={{ fontSize: 18, color: 'var(--item-text)', fontWeight: 500, marginBottom: 4 }}>谨迹</div>
        <div style={{ fontSize: 11, color: 'var(--duration-text)' }}>版本 {version}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: 运行开发服务器，完整验证所有分组**

```bash
npm run tauri dev
```

验证：
- 语音转写分组：DashScope API Key 可编辑，保存后持久化
- 工作引导分组：输入内容有 Markdown 语法色（# 标题亮色，- 前缀 accent 色），停止输入 800ms 后自动保存，底部状态提示变化
- 技能插件分组：两张预告卡片 + 底部「更多」占位
- 关于分组：显示正确版本号

- [ ] **Step 6: Commit**

```bash
git add src/settings/components/
git commit -m "feat(settings): implement all section components (voice, guide, plugins, about)"
```

---

## Task 8: 调整窗口尺寸，最终收尾

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/src/config.rs`（调整 `open_settings` 窗口尺寸）

- [ ] **Step 1: 更新 `open_settings` 中的窗口尺寸**

在 `src-tauri/src/config.rs` 找到 `open_settings` 函数，将尺寸从 `400×250` 改为 `600×500`：

```rust
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
```

- [ ] **Step 2: 完整编译验证**

```bash
npm run build 2>&1 | grep -E "error TS"
cd src-tauri && cargo build 2>&1 | grep -E "^error"
```

Expected: 两条命令均无输出

- [ ] **Step 3: 运行完整应用，端到端手动验证**

```bash
npm run tauri dev
```

验证清单：
- [ ] 设置窗口以 600×500 打开，居中显示
- [ ] 深色/浅色/跟随系统主题在设置窗口内正确渲染（CSS 变量生效）
- [ ] 左侧导航点击后右侧平滑滚动到对应分组
- [ ] 向下滚动右侧时，左侧对应项自动高亮
- [ ] 通用：Workspace 路径可手动输入和点击「选择…」选取，保存后持久化
- [ ] 通用：主题切换立即生效，重开设置窗口后仍保持
- [ ] AI 引擎：两张卡片初始显示检测动画，检测后显示安装状态
- [ ] AI 引擎：点击已安装引擎卡片可切换活跃引擎，配置字段随之切换
- [ ] AI 引擎：配置保存后重开窗口仍保持
- [ ] 语音转写：API Key 保存后持久化（与 AI 引擎 Key 独立）
- [ ] 工作引导：输入内容有语法高亮，停止输入 800ms 自动保存，手动保存按钮也有效
- [ ] 技能插件：两张预告卡片正常显示
- [ ] 关于：版本号正确

- [ ] **Step 4: Final commit**

```bash
git add src-tauri/src/config.rs
git commit -m "feat(settings): set window size 600x500, settings redesign complete"
```
