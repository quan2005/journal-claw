# Design: AiStatusPill 点击打开终端运行 Claude CLI

Date: 2026-04-04

## Overview

点击 TitleBar 中的 AiStatusPill（无论 idle/processing 状态），打开用户默认终端并运行 Claude CLI，工作目录为 workspace 根目录。

## Behavior

| Pill 状态 | 终端命令 | 说明 |
|-----------|---------|------|
| Idle | `claude --allow-dangerously-skip-permissions` | 新交互会话 |
| Processing | `claude --continue --allow-dangerously-skip-permissions` | 恢复最近的处理会话 |
| Linger (完成 2s 内) | `claude --continue --allow-dangerously-skip-permissions` | 恢复会话，可追问修改 |

## Data Flow

1. 用户点击 AiStatusPill（任何状态）
2. 前端调用 `invoke('open_claude_terminal', { continueSession: isProcessing })`
3. Rust 读取 `config.workspace_path`
4. 写入临时 `.command` 文件：`cd workspace_path && claude [--continue] --allow-dangerously-skip-permissions`
5. `chmod +x && open /tmp/xxx.command`
6. macOS 用默认终端打开并执行

## Prerequisite: Remove --no-session-persistence

当前 `ai_processor.rs` 的 `build_claude_args_with_creds()` 使用 `--no-session-persistence`，导致后台处理的 session 不可恢复。需移除此标志，使 `--continue` 能找到最近的处理会话。

**副作用**: session 文件累积在 `~/.claude/` 下，Claude CLI 自行管理清理。

## File Changes

### 1. `src-tauri/src/ai_processor.rs` (line 167)

Remove `--no-session-persistence` from the args vector:

```rust
// Before
let mut args = vec![
    "-p".to_string(),
    prompt,
    "--permission-mode".to_string(),
    "bypassPermissions".to_string(),
    "--output-format".to_string(),
    "stream-json".to_string(),
    "--verbose".to_string(),
    "--no-session-persistence".to_string(),  // REMOVE THIS
    "--disallowed-tools".to_string(),
    "AskToolQuestion".to_string(),
];

// After
let mut args = vec![
    "-p".to_string(),
    prompt,
    "--permission-mode".to_string(),
    "bypassPermissions".to_string(),
    "--output-format".to_string(),
    "stream-json".to_string(),
    "--verbose".to_string(),
    "--disallowed-tools".to_string(),
    "AskToolQuestion".to_string(),
];
```

### 2. `src-tauri/src/main.rs`

New Tauri command `open_claude_terminal`:

```rust
#[tauri::command]
fn open_claude_terminal(app: tauri::AppHandle, continue_session: bool) -> Result<(), String> {
    let cfg = config::load_config(&app).map_err(|e| e.to_string())?;
    let workspace = &cfg.workspace_path;

    let claude_cmd = if continue_session {
        "claude --continue --allow-dangerously-skip-permissions"
    } else {
        "claude --allow-dangerously-skip-permissions"
    };

    let script = format!(
        "#!/bin/bash\ncd '{}'\n{}",
        workspace, claude_cmd
    );

    let tmp_dir = std::env::temp_dir();
    let tmp_path = tmp_dir.join("journal-open-claude.command");
    std::fs::write(&tmp_path, &script).map_err(|e| e.to_string())?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&tmp_path, std::fs::Permissions::from_mode(0o755))
            .map_err(|e| e.to_string())?;
    }

    std::process::Command::new("open")
        .arg(&tmp_path)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}
```

Register in `invoke_handler`:

```rust
invoke_handler(tauri::generate_handler![
    // ... existing commands ...
    open_claude_terminal,
])
```

### 3. `src/lib/tauri.ts`

Add wrapper:

```typescript
export const openClaudeTerminal = (continueSession: boolean): Promise<void> =>
  invoke('open_claude_terminal', { continueSession })
```

### 4. `src/components/AiStatusPill.tsx`

- Make pill always clickable (remove `active && onLogClick` condition)
- Set `cursor: 'pointer'` always
- On click, call `openClaudeTerminal(isProcessing)` instead of `onLogClick`
- Remove `onLogClick` prop (no longer needed)

```typescript
// Before
onClick={active && onLogClick ? onLogClick : undefined}
cursor: active && onLogClick ? 'pointer' : 'default',

// After
onClick={() => openClaudeTerminal(isProcessing)}
cursor: 'pointer',
```

### 5. `src/components/TitleBar.tsx`

- Remove `onLogClick` prop from TitleBar and AiStatusPill usage
- Simplify props passed down from App.tsx

## Out of Scope

- Terminal path configuration (future: method C enhancement)
- AiLogModal and ProcessingQueue remain unchanged (for background processing visibility)
- Workspace `.claude/` directory interaction (already handled by existing code)
