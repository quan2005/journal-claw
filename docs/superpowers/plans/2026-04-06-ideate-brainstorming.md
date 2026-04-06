# Ideate — 内置灵感探讨功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从待办右键菜单启动交互式灵感探讨，通过系统终端运行 Claude CLI `/ideate` skill，支持 session 复用和 resume。

**Architecture:** 新增 `brainstorm.rs` 模块管理 session 映射和 AppleScript 终端控制。Workspace 模板新增 `skills/ideate/` 目录，Claude CLI 自动发现。前端在 TodoSidebar 右键菜单新增入口。

**Tech Stack:** Rust (Tauri commands, AppleScript via osascript), TypeScript/React (TodoSidebar), Claude CLI skills

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src-tauri/src/brainstorm.rs` | Session 映射管理 + AppleScript 终端控制 + Tauri command |
| Modify | `src-tauri/src/main.rs` | 注册 `mod brainstorm` 和 `open_brainstorm_terminal` command |
| Modify | `src-tauri/src/todos.rs` | `update_todo_text` 时同步更新 session key |
| Modify | `src-tauri/src/ai_processor.rs` | `ensure_workspace_dot_claude` 同步 skills 目录 |
| Modify | `src/lib/tauri.ts` | 新增 `openBrainstormTerminal` IPC wrapper |
| Modify | `src/components/TodoSidebar.tsx` | 右键菜单新增"深入探讨" |
| Modify | `src/locales/zh.ts` | 新增 `exploreInDepth` |
| Modify | `src/locales/en.ts` | 新增 `exploreInDepth` |
| Create | `src-tauri/resources/workspace-template/.claude/skills/ideate/SKILL.md` | Skill 定义 |
| Create | `src-tauri/resources/workspace-template/.claude/skills/ideate/visual-companion.md` | Visual companion 指南 |
| Create | `src-tauri/resources/workspace-template/.claude/skills/ideate/scripts/start-server.sh` | 启动 visual companion server |
| Create | `src-tauri/resources/workspace-template/.claude/skills/ideate/scripts/stop-server.sh` | 停止 server |
| Create | `src-tauri/resources/workspace-template/.claude/skills/ideate/scripts/server.cjs` | Server 实现 |
| Create | `src-tauri/resources/workspace-template/.claude/skills/ideate/scripts/frame-template.html` | HTML 框架模板 |
| Create | `src-tauri/resources/workspace-template/.claude/skills/ideate/scripts/helper.js` | 客户端辅助脚本 |

---

### Task 1: Workspace 模板 — Ideate Skill 文件

从现有 brainstorming skill 复制并适配为 `/ideate`，打包到 workspace 模板中。

**Files:**
- Create: `src-tauri/resources/workspace-template/.claude/skills/ideate/SKILL.md`
- Create: `src-tauri/resources/workspace-template/.claude/skills/ideate/visual-companion.md`
- Create: `src-tauri/resources/workspace-template/.claude/skills/ideate/scripts/start-server.sh`
- Create: `src-tauri/resources/workspace-template/.claude/skills/ideate/scripts/stop-server.sh`
- Create: `src-tauri/resources/workspace-template/.claude/skills/ideate/scripts/server.cjs`
- Create: `src-tauri/resources/workspace-template/.claude/skills/ideate/scripts/frame-template.html`
- Create: `src-tauri/resources/workspace-template/.claude/skills/ideate/scripts/helper.js`

- [ ] **Step 1: 创建 SKILL.md**

从 `/Users/yanwu/.claude/plugins/cache/superpowers-marketplace/superpowers/5.0.7/skills/brainstorming/SKILL.md` 复制，做以下修改：

1. frontmatter `name` 改为 `ideate`
2. frontmatter `description` 改为中文描述灵感探讨
3. 在 "After the Design" 部分，修改 spec 输出规则：
   - 过程 HTML 写入 `yyMM/raw/brainstorm-*.html`（yyMM 为当前年月目录）
   - 最终 spec 写入 `yyMM/DD-标题.md`，frontmatter 必须包含 `tags: [idea]`
4. 删除 "Transition to implementation" 相关内容（不需要自动调用 writing-plans）
5. Visual Companion 部分：删除 "Offering the companion" 的询问逻辑，改为默认启用
6. 修改 `visual-companion.md` 的引用路径为相对路径 `skills/ideate/visual-companion.md`

```markdown
---
name: ideate
description: "灵感探讨 — 通过交互式对话将想法打磨成完整的设计方案。默认启用浏览器可视化伴侣。"
---

# 灵感探讨

通过自然对话将想法打磨成完整的设计方案。

先了解当前项目上下文，然后逐个提问细化想法。理解清楚后呈现设计方案并获得用户确认。

<HARD-GATE>
在呈现设计方案并获得用户确认之前，不要写任何代码或执行任何实现操作。
</HARD-GATE>

## 输出规则

- 过程中产生的 HTML 文件（mockup、对比图等）写入 `yyMM/raw/brainstorm-*.html`
  - yyMM 为当前年月目录（如 2604）
  - 文件名用语义前缀：`brainstorm-layout.html`、`brainstorm-style-v2.html`
  - 不要复用文件名，每个版本用新文件
- 最终设计方案写入 `yyMM/DD-标题.md`，frontmatter 格式：

```yaml
---
summary: 一句话描述设计方案
tags: [idea]
---
```

## 流程

1. **探索项目上下文** — 查看文件、文档、最近提交
2. **逐个提问** — 一次一个问题，理解目的/约束/成功标准
3. **提出 2-3 种方案** — 附带权衡分析和推荐
4. **呈现设计** — 按复杂度分段呈现，每段确认后继续
5. **写入设计文档** — 保存为日志条目

## 可视化伴侣

默认启用浏览器可视化伴侣。首次使用时启动 server：

阅读详细指南：`skills/ideate/visual-companion.md`

**逐问题决策：** 对每个问题判断是否需要可视化：
- **用浏览器**：UI mockup、线框图、布局对比、架构图
- **用终端**：需求问题、概念选择、权衡列表、技术决策

## 关键原则

- **一次一个问题** — 不要同时抛出多个问题
- **优先选择题** — 比开放式问题更容易回答
- **YAGNI** — 删除不必要的功能
- **探索替代方案** — 总是提出 2-3 种方案再做决定
- **增量验证** — 呈现设计，获得确认后再继续
```

- [ ] **Step 2: 复制 visual-companion.md**

从 `/Users/yanwu/.claude/plugins/cache/superpowers-marketplace/superpowers/5.0.7/skills/brainstorming/visual-companion.md` 复制到 `src-tauri/resources/workspace-template/.claude/skills/ideate/visual-companion.md`。

修改其中的路径引用：`scripts/` 改为 `skills/ideate/scripts/`。

- [ ] **Step 3: 复制 scripts 目录**

从 `/Users/yanwu/.claude/plugins/cache/superpowers-marketplace/superpowers/5.0.7/skills/brainstorming/scripts/` 复制所有文件到 `src-tauri/resources/workspace-template/.claude/skills/ideate/scripts/`：

```bash
cp /Users/yanwu/.claude/plugins/cache/superpowers-marketplace/superpowers/5.0.7/skills/brainstorming/scripts/* \
   src-tauri/resources/workspace-template/.claude/skills/ideate/scripts/
```

确保 `start-server.sh` 和 `stop-server.sh` 保持可执行权限。

- [ ] **Step 4: Commit**

```bash
git add src-tauri/resources/workspace-template/.claude/skills/ideate/
git commit -m "feat: add ideate skill to workspace template

Adapted from brainstorming skill with:
- Renamed to /ideate to avoid plugin conflict
- Output rules: process HTML to raw/, spec to journal entry with idea tag
- Visual companion enabled by default

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Rust — ensure_workspace_dot_claude 同步 skills 目录

扩展 `ensure_workspace_dot_claude` 函数，将 skills/ideate/ 目录同步到 workspace。

**Files:**
- Modify: `src-tauri/src/ai_processor.rs:77-129`

- [ ] **Step 1: 新增 include_str! 常量**

在 `ai_processor.rs` 的现有 `include_str!` 常量块之后（约第 90 行），新增 ideate skill 文件的嵌入：

```rust
// ── Ideate skill template ───────────────────────
const SKILL_IDEATE_MD: &str =
    include_str!("../resources/workspace-template/.claude/skills/ideate/SKILL.md");
const SKILL_IDEATE_VISUAL_COMPANION: &str =
    include_str!("../resources/workspace-template/.claude/skills/ideate/visual-companion.md");
const SKILL_IDEATE_START_SERVER: &str =
    include_str!("../resources/workspace-template/.claude/skills/ideate/scripts/start-server.sh");
const SKILL_IDEATE_STOP_SERVER: &str =
    include_str!("../resources/workspace-template/.claude/skills/ideate/scripts/stop-server.sh");
const SKILL_IDEATE_SERVER_CJS: &str =
    include_str!("../resources/workspace-template/.claude/skills/ideate/scripts/server.cjs");
const SKILL_IDEATE_FRAME_TEMPLATE: &str =
    include_str!("../resources/workspace-template/.claude/skills/ideate/scripts/frame-template.html");
const SKILL_IDEATE_HELPER_JS: &str =
    include_str!("../resources/workspace-template/.claude/skills/ideate/scripts/helper.js");
```

- [ ] **Step 2: 扩展 ensure_workspace_dot_claude 函数**

在 `ensure_workspace_dot_claude` 函数末尾（`user_claude_md` 逻辑之前），新增 skills 目录同步：

```rust
    // ── Sync ideate skill ───────────────────────────
    let ideate_dir = dot_claude.join("skills").join("ideate");
    let ideate_scripts = ideate_dir.join("scripts");
    if let Err(e) = std::fs::create_dir_all(&ideate_scripts) {
        eprintln!("[ai_processor] warn: failed to create skills/ideate/scripts dir: {}", e);
    } else {
        let _ = std::fs::write(ideate_dir.join("SKILL.md"), SKILL_IDEATE_MD);
        let _ = std::fs::write(ideate_dir.join("visual-companion.md"), SKILL_IDEATE_VISUAL_COMPANION);

        let skill_scripts: &[(&str, &str, bool)] = &[
            ("start-server.sh", SKILL_IDEATE_START_SERVER, true),
            ("stop-server.sh", SKILL_IDEATE_STOP_SERVER, true),
            ("server.cjs", SKILL_IDEATE_SERVER_CJS, false),
            ("frame-template.html", SKILL_IDEATE_FRAME_TEMPLATE, false),
            ("helper.js", SKILL_IDEATE_HELPER_JS, false),
        ];
        for (name, content, executable) in skill_scripts {
            let path = ideate_scripts.join(name);
            if std::fs::write(&path, content).is_ok() && *executable {
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755));
                }
            }
        }
    }
```

- [ ] **Step 3: 验证编译**

```bash
cd src-tauri && cargo check
```

Expected: 编译通过，无错误。

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/ai_processor.rs
git commit -m "feat: sync ideate skill to workspace on startup

ensure_workspace_dot_claude now copies skills/ideate/ directory
including SKILL.md, visual-companion.md, and all scripts.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Rust — brainstorm.rs 模块（Session 映射 + AppleScript）

新增核心模块，管理 session 映射和终端控制。

**Files:**
- Create: `src-tauri/src/brainstorm.rs`

- [ ] **Step 1: 编写 brainstorm.rs — 数据结构和 session 映射**

```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SessionInfo {
    session_id: String,
    created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct SessionStore {
    sessions: HashMap<String, SessionInfo>,
}

fn sessions_path(workspace: &str) -> PathBuf {
    Path::new(workspace).join(".brainstorm-sessions.json")
}

fn load_sessions(workspace: &str) -> SessionStore {
    let p = sessions_path(workspace);
    if p.exists() {
        std::fs::read_to_string(&p)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    } else {
        SessionStore::default()
    }
}

fn save_sessions(workspace: &str, store: &SessionStore) -> Result<(), String> {
    let p = sessions_path(workspace);
    let json = serde_json::to_string_pretty(store).map_err(|e| e.to_string())?;
    std::fs::write(&p, json).map_err(|e| format!("写入 session 映射失败: {}", e))
}

fn generate_session_id() -> String {
    let t = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let nanos = t.as_nanos();
    format!(
        "{:08x}-{:04x}-4{:03x}-{:04x}-{:012x}",
        (nanos & 0xFFFFFFFF) as u32,
        ((nanos >> 32) & 0xFFFF) as u16,
        ((nanos >> 48) & 0x0FFF) as u16,
        ((nanos >> 60) & 0xFFFF) as u16,
        ((nanos >> 76) & 0xFFFFFFFFFFFF) as u64 & 0xFFFFFFFFFFFF,
    )
}

/// 更新 session key（待办文本编辑时调用）
pub fn rename_session_key(workspace: &str, old_text: &str, new_text: &str) {
    let mut store = load_sessions(workspace);
    if let Some(info) = store.sessions.remove(old_text) {
        store.sessions.insert(new_text.to_string(), info);
        let _ = save_sessions(workspace, &store);
    }
}
```

- [ ] **Step 2: 编写 AppleScript 终端控制函数**

在同一文件中继续添加：

```rust
/// 检测 iTerm2 是否正在运行
fn is_iterm_running() -> bool {
    let output = std::process::Command::new("osascript")
        .args(["-e", "tell application \"System Events\" to (name of processes) contains \"iTerm2\""])
        .output();
    match output {
        Ok(o) => String::from_utf8_lossy(&o.stdout).trim() == "true",
        Err(_) => false,
    }
}

/// 尝试激活已有终端 tab（按 tab title 查找）
fn activate_terminal_tab(tab_title: &str) -> bool {
    if is_iterm_running() {
        activate_iterm_tab(tab_title)
    } else {
        activate_terminal_app_tab(tab_title)
    }
}

fn activate_iterm_tab(tab_title: &str) -> bool {
    let script = format!(
        r#"tell application "iTerm2"
    repeat with w in windows
        repeat with t in tabs of w
            repeat with s in sessions of t
                if name of s contains "{}" then
                    select t
                    set index of w to 1
                    activate
                    return true
                end if
            end repeat
        end repeat
    end repeat
    return false
end tell"#,
        tab_title
    );
    let output = std::process::Command::new("osascript")
        .args(["-e", &script])
        .output();
    match output {
        Ok(o) => String::from_utf8_lossy(&o.stdout).trim() == "true",
        Err(_) => false,
    }
}

fn activate_terminal_app_tab(tab_title: &str) -> bool {
    let script = format!(
        r#"tell application "Terminal"
    repeat with w in windows
        repeat with t in tabs of w
            if custom title of t is "{}" then
                set selected tab of w to t
                set index of w to 1
                activate
                return true
            end if
        end repeat
    end repeat
    return false
end tell"#,
        tab_title
    );
    let output = std::process::Command::new("osascript")
        .args(["-e", &script])
        .output();
    match output {
        Ok(o) => String::from_utf8_lossy(&o.stdout).trim() == "true",
        Err(_) => false,
    }
}

/// 打开新终端 tab 并执行命令
fn open_terminal_tab(tab_title: &str, command: &str) {
    if is_iterm_running() {
        open_iterm_tab(tab_title, command);
    } else {
        open_terminal_app_tab(tab_title, command);
    }
}

fn open_iterm_tab(tab_title: &str, command: &str) {
    let script = format!(
        r#"tell application "iTerm2"
    activate
    tell current window
        set newTab to (create tab with default profile)
        tell current session of newTab
            set name to "{}"
            write text "{}"
        end tell
    end tell
end tell"#,
        tab_title,
        command.replace('"', "\\\"")
    );
    let _ = std::process::Command::new("osascript")
        .args(["-e", &script])
        .spawn();
}

fn open_terminal_app_tab(tab_title: &str, command: &str) {
    let script = format!(
        r#"tell application "Terminal"
    activate
    do script "{}"
    set custom title of selected tab of front window to "{}"
end tell"#,
        command.replace('"', "\\\""),
        tab_title
    );
    let _ = std::process::Command::new("osascript")
        .args(["-e", &script])
        .spawn();
}
```

- [ ] **Step 3: 编写 Tauri command**

在同一文件中继续添加：

```rust
#[tauri::command]
pub fn open_brainstorm_terminal(
    app: tauri::AppHandle,
    text: String,
    line_index: usize,
    done_file: bool,
) -> Result<(), String> {
    let _ = (line_index, done_file); // reserved for future use

    let cfg = crate::config::load_config(&app)?;
    let workspace = &cfg.workspace_path;
    let cli = if cfg.claude_cli_path.is_empty() {
        crate::config::default_claude_cli_detect()
    } else {
        cfg.claude_cli_path.clone()
    };

    let mut store = load_sessions(workspace);
    let tab_title_prefix = "ideate";

    if let Some(info) = store.sessions.get(&text) {
        // Session exists — try to activate existing tab
        let tab_title = format!("{}-{}", tab_title_prefix, &info.session_id[..8]);
        if activate_terminal_tab(&tab_title) {
            return Ok(());
        }
        // Tab gone — resume session
        let cmd = format!(
            "cd '{}' && '{}' --resume --session-id {}",
            workspace.replace('\'', "'\\''"),
            cli.replace('\'', "'\\''"),
            info.session_id
        );
        open_terminal_tab(&tab_title, &cmd);
    } else {
        // New session
        let session_id = generate_session_id();
        let tab_title = format!("{}-{}", tab_title_prefix, &session_id[..8]);

        let escaped_text = text.replace('\'', "'\\''").replace('"', "\\\"");
        let cmd = format!(
            "cd '{}' && '{}' -p '/ideate {}' --session-id {}",
            workspace.replace('\'', "'\\''"),
            cli.replace('\'', "'\\''"),
            escaped_text,
            session_id
        );
        open_terminal_tab(&tab_title, &cmd);

        let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
        store.sessions.insert(
            text,
            SessionInfo {
                session_id,
                created_at: now,
            },
        );
        save_sessions(workspace, &store)?;
    }

    Ok(())
}
```

- [ ] **Step 4: 验证编译**

```bash
cd src-tauri && cargo check
```

Expected: 编译失败 — `brainstorm` 模块尚未在 `main.rs` 注册。这是预期的，Task 4 会修复。

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/brainstorm.rs
git commit -m "feat: add brainstorm module for session management and terminal control

- Session mapping via .brainstorm-sessions.json
- AppleScript detection: iTerm2 vs Terminal.app
- Tab activation (reuse) and new tab creation
- Session resume when tab is closed

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Rust — main.rs 注册模块和命令

**Files:**
- Modify: `src-tauri/src/main.rs:1-18` (mod declarations)
- Modify: `src-tauri/src/main.rs:284-355` (invoke_handler)

- [ ] **Step 1: 添加 mod 声明**

在 `main.rs` 第 2 行（`mod audio_pipeline;` 之后）添加：

```rust
mod brainstorm;
```

- [ ] **Step 2: 注册 Tauri command**

在 `invoke_handler![]` 的 `todos::update_todo_text,` 之后添加：

```rust
            brainstorm::open_brainstorm_terminal,
```

- [ ] **Step 3: 验证编译**

```bash
cd src-tauri && cargo check
```

Expected: 编译通过。

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/main.rs
git commit -m "feat: register brainstorm module and open_brainstorm_terminal command

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Rust — todos.rs 同步 session key

编辑待办文本时，同步更新 `.brainstorm-sessions.json` 中的 key。

**Files:**
- Modify: `src-tauri/src/todos.rs:348-352`

- [ ] **Step 1: 修改 update_todo_text 命令**

将 `update_todo_text` 函数（第 348-352 行）改为：

```rust
#[tauri::command]
pub fn update_todo_text(app: tauri::AppHandle, line_index: usize, text: String, done_file: bool) -> Result<(), String> {
    let cfg = crate::config::load_config(&app)?;
    // Read old text before updating
    let old_text = {
        let content = if done_file { read_done_file(&cfg.workspace_path) } else { read_todos_file(&cfg.workspace_path) };
        let lines: Vec<&str> = content.lines().collect();
        if line_index < lines.len() {
            parse_todo_line(lines[line_index], line_index).map(|t| t.text)
        } else {
            None
        }
    };
    update_todo_text_in_workspace(&cfg.workspace_path, line_index, &text, done_file)?;
    // Sync brainstorm session key if text changed
    if let Some(old) = old_text {
        if old != text {
            crate::brainstorm::rename_session_key(&cfg.workspace_path, &old, &text);
        }
    }
    Ok(())
}
```

- [ ] **Step 2: 验证编译**

```bash
cd src-tauri && cargo check
```

Expected: 编译通过。

- [ ] **Step 3: 运行 Rust 测试**

```bash
cd src-tauri && cargo test
```

Expected: 所有现有测试通过。

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/todos.rs
git commit -m "feat: sync brainstorm session key when todo text is edited

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: 前端 — IPC wrapper + i18n + 右键菜单

**Files:**
- Modify: `src/lib/tauri.ts`
- Modify: `src/locales/en.ts`
- Modify: `src/locales/zh.ts`
- Modify: `src/components/TodoSidebar.tsx`

- [ ] **Step 1: 添加 IPC wrapper**

在 `src/lib/tauri.ts` 末尾（`updateTodoText` 之后）添加：

```typescript
// Brainstorm (灵感探讨)
export const openBrainstormTerminal = (text: string, lineIndex: number, doneFile: boolean): Promise<void> =>
  invoke<void>('open_brainstorm_terminal', { text, lineIndex, doneFile })
```

- [ ] **Step 2: 添加 i18n 字符串**

在 `src/locales/en.ts` 的 `deleteTodo: 'Delete',` 之后添加：

```typescript
  exploreInDepth: 'Explore in Depth',
```

在 `src/locales/zh.ts` 的 `deleteTodo: '删除',` 之后添加：

```typescript
  exploreInDepth: '深入探讨',
```

- [ ] **Step 3: 修改 TodoSidebar 右键菜单**

在 `src/components/TodoSidebar.tsx` 的右键菜单渲染部分（约第 394-433 行），在"清除截止日期"和分隔线之间，添加"深入探讨"菜单项。

在文件顶部的 import 中添加 `openBrainstormTerminal`：

```typescript
import { openBrainstormTerminal } from '../lib/tauri'
```

在右键菜单的 JSX 中，在 `{contextMenu.due && (` 块之后、`<div style={{ height: 1, ...` 分隔线之前，添加：

```tsx
            {!contextMenu.doneFile && (
              <div style={menuItemStyle} onMouseEnter={hi} onMouseLeave={ho}
                onClick={() => { openBrainstormTerminal(contextMenu.text, contextMenu.lineIndex, contextMenu.doneFile); setContextMenu(null) }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--item-meta)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18h6"/><path d="M10 22h4"/>
                  <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>
                </svg>
                {t('exploreInDepth')}
              </div>
            )}
```

同时需要在 contextMenu state 中确保 `doneFile` 字段可用（已有，当前 state 类型包含 `doneFile: boolean`）。

- [ ] **Step 4: 验证 TypeScript 编译**

```bash
npm run build
```

Expected: 编译通过。

- [ ] **Step 5: Commit**

```bash
git add src/lib/tauri.ts src/locales/en.ts src/locales/zh.ts src/components/TodoSidebar.tsx
git commit -m "feat: add 'Explore in Depth' context menu item for todos

- IPC wrapper for open_brainstorm_terminal
- i18n strings (zh: 深入探讨, en: Explore in Depth)
- Lightbulb icon, only shown for uncompleted todos

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: 集成验证

**Files:** (none — manual testing)

- [ ] **Step 1: 完整编译验证**

```bash
cd src-tauri && cargo check && cd .. && npm run build
```

Expected: Rust 和 TypeScript 均编译通过。

- [ ] **Step 2: 运行所有测试**

```bash
cd src-tauri && cargo test && cd .. && npm test
```

Expected: 所有测试通过。

- [ ] **Step 3: 手动验证 workspace 模板同步**

启动 app（`npm run tauri dev`），检查 workspace 下 `.claude/skills/ideate/` 目录是否被创建，包含 SKILL.md 和 scripts/。

- [ ] **Step 4: 手动验证右键菜单**

在 app 中添加一个待办，右键点击，确认看到"深入探讨"菜单项（灯泡图标）。已完成的待办不应显示此项。

- [ ] **Step 5: 手动验证终端启动**

点击"深入探讨"，确认系统终端打开并运行 `claude -p '/ideate ...'` 命令。再次点击同一待办，确认激活已有 tab 而非打开新 tab。
