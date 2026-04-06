# Ideate — 内置灵感探讨功能设计

> 日期: 2026-04-06

## 概述

将 brainstorming skill 内置到谨迹 app 中，让用户可以从待办右键菜单直接启动交互式灵感探讨。过程文件存入 `raw/`，最终产物以带 `idea` 标签的日志条目沉淀。

## 核心决策

| 决策 | 选择 |
|------|------|
| 终端方式 | 系统终端（Terminal.app / iTerm2），AppleScript 检测 |
| 过程文件 | 平铺 `raw/`，前缀 `brainstorm-`，如 `brainstorm-layout.html` |
| 最终产物 | 普通日志条目 `DD-标题.md`，`tags: [idea]` |
| Skill 名称 | `/ideate`（中文：灵感探讨），避免与 `/brainstorming` 插件冲突 |
| Session 管理 | 一个待办对应一个 session，支持复用和 resume |

## 数据流

```
用户右键待办 → "深入探讨"
  → Rust: open_brainstorm_terminal(text, line_index, done_file)
  → 查找 session 映射：workspace/.brainstorm-sessions.json

  Case 1: 首次打开
    → 生成 session_id
    → 写入映射文件
    → AppleScript 打开终端新 tab，设 tab title = "ideate-<短码>"
    → 运行: claude -p "/ideate <todo_text>" --session-id <id> --cwd <workspace>

  Case 2: 终端仍在运行
    → AppleScript 按 tab title 查找
    → 找到 → 激活该 tab（前置窗口 + 切换 tab）

  Case 3: 终端已关闭
    → AppleScript 查找失败
    → 打开新 tab，同样设 title
    → 运行: claude --resume --session-id <id> --cwd <workspace>
```

## Workspace 文件布局

```
workspace/
  .brainstorm-sessions.json          ← session 映射
  2604/
    raw/
      brainstorm-layout.html         ← 过程文件
      brainstorm-style-v2.html       ← 过程文件
    06-标签筛选功能设计.md             ← 最终产物，tags: [idea]
```

### Session 映射文件格式

```json
{
  "sessions": {
    "设计标签筛选功能": {
      "session_id": "a1b2c3d4-5678-4abc-def0-123456789abc",
      "created_at": "2026-04-06T14:30:00"
    }
  }
}
```

key 使用待办 text 字段。同一待办只能同时打开一个终端，不同待办可并行多个终端。

注意：用户编辑待办文本时（`update_todo_text`），需同步更新 `.brainstorm-sessions.json` 中对应的 key。

## Rust 侧改动

### 新增模块 `src-tauri/src/brainstorm.rs`

```rust
#[tauri::command]
pub fn open_brainstorm_terminal(
    app: AppHandle,
    text: String,
    line_index: usize,
    done_file: bool,
) -> Result<(), String>
```

职责：
1. 从 config 读 `workspace_path` 和 `claude_cli_path`
2. 用 `text` 作为 key 查 `.brainstorm-sessions.json`
3. 有 session → `activate_terminal_tab(tab_title)`
   - 成功 → return Ok
   - 失败 → resume 路径
4. 无 session → 生成 session_id，`open_terminal_tab(tab_title, command)`
5. 更新映射文件

### AppleScript 封装

两个内部函数：

- `activate_terminal_tab(tab_title: &str) -> bool`
  - 检测 iTerm2 是否运行
  - 是 → iTerm AppleScript 按 tab name 查找并激活
  - 否 → Terminal.app AppleScript 按 custom title 查找并激活
  - 返回是否成功

- `open_terminal_tab(tab_title: &str, command: &str)`
  - 检测 iTerm2 是否运行
  - 是 → iTerm: create tab, set name, write text
  - 否 → Terminal.app: do script, set custom title

两者通过 `std::process::Command::new("osascript").arg("-e")` 执行。

### 注册

在 `main.rs` 的 `invoke_handler![]` 中注册 `open_brainstorm_terminal`。

## 前端改动

### `src/lib/tauri.ts`

新增 IPC wrapper：

```typescript
export async function openBrainstormTerminal(
  text: string,
  lineIndex: number,
  doneFile: boolean
): Promise<void> {
  return invoke('open_brainstorm_terminal', { text, lineIndex, doneFile })
}
```

### `src/components/TodoSidebar.tsx`

右键菜单新增"深入探讨"项，位于"清除截止日期"和"删除"之间：

```
复制文本
清除截止日期（如有）
─────────────
深入探讨              ← 新增，仅未完成待办显示
─────────────
删除
```

图标：灯泡风格 SVG，14x14，strokeWidth 1.5，与现有菜单项一致。

### i18n

| key | zh | en |
|-----|----|----|
| `exploreInDepth` | 深入探讨 | Explore in Depth |

## Workspace 模板改动

### Skill 文件打包

在 `src-tauri/resources/workspace-template/.claude/skills/ideate/` 下放置：

```
skills/ideate/
  SKILL.md                ← skill 定义，包含：
                             - 过程 HTML 写入 yyMM/raw/brainstorm-*.html
                             - 最终 spec 写入 yyMM/DD-标题.md，tags 含 idea
                             - 默认启用 visual companion
  visual-companion.md     ← visual companion 指南
  scripts/
    start-server.sh
    stop-server.sh
    frame-template.html
    helper.js
```

### `ensure_workspace_dot_claude` 扩展

在 `ai_processor.rs` 的 `ensure_workspace_dot_claude` 函数中，新增同步 `skills/ideate/` 目录的逻辑。每次启动强制覆盖，保持与 app 版本同步。

Claude CLI 自动发现 `.claude/skills/ideate/SKILL.md`，用户在终端输入 `/ideate` 即可触发。

不改 `.claude/CLAUDE.md`，不改 `.claude/settings.json`。

## 不做的事

- 不在 app 内嵌终端
- 不改现有 AI 处理管道（headless stream-json 流程不受影响）
- 不新增 journal entry type 字段，复用现有 tags 机制
- 不自动监听终端关闭事件（session 映射靠下次打开时 AppleScript 探测）
