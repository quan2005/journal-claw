# Pill Open Terminal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Click AiStatusPill to open user's default terminal running Claude CLI in the workspace directory.

**Architecture:** Add a Rust Tauri command that writes a temp `.command` file and opens it via macOS `open`. Frontend pill becomes always-clickable and calls this command. Remove `--no-session-persistence` from background processing to enable `--continue` resume.

**Tech Stack:** Tauri v2 (Rust), React/TypeScript, macOS `open` command

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src-tauri/src/ai_processor.rs:176` | Remove `--no-session-persistence` flag |
| Modify | `src-tauri/src/main.rs` | Add `open_claude_terminal` command + register in invoke_handler |
| Modify | `src/lib/tauri.ts` | Add `openClaudeTerminal()` IPC wrapper |
| Modify | `src/components/AiStatusPill.tsx` | Always clickable, call new command instead of onLogClick |
| Modify | `src/components/TitleBar.tsx` | Remove `onLogClick` from props and passthrough |
| Modify | `src/App.tsx:420` | Remove `onLogClick` prop passed to TitleBar |

---

### Task 1: Remove --no-session-persistence from ai_processor.rs

**Files:**
- Modify: `src-tauri/src/ai_processor.rs:176`

- [ ] **Step 1: Remove the flag**

In `src-tauri/src/ai_processor.rs`, remove line 176 (`"--no-session-persistence".to_string(),`):

```rust
// Before (lines 159-170)
let mut args = vec![
    "-p".to_string(),
    prompt,
    "--permission-mode".to_string(),
    "bypassPermissions".to_string(),
    "--output-format".to_string(),
    "stream-json".to_string(),
    "--verbose".to_string(),
    "--no-session-persistence".to_string(),  // REMOVE THIS LINE
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

- [ ] **Step 2: Run Rust tests to verify nothing breaks**

Run: `cd src-tauri && cargo test`
Expected: All tests pass (the flag was a CLI argument, removal doesn't affect test logic)

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/ai_processor.rs
git commit -m "refactor: remove --no-session-persistence to enable session resume"
```

---

### Task 2: Add open_claude_terminal Rust command

**Files:**
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: Add the command function**

In `src-tauri/src/main.rs`, add this command function after the existing `open_with_system` function (after line 37):

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

- [ ] **Step 2: Register in invoke_handler**

In `src-tauri/src/main.rs`, add `open_claude_terminal` to the `invoke_handler` macro (around line 247, after the `open_with_system` entry):

```rust
// In invoke_handler(tauri::generate_handler![...]) array, add:
open_claude_terminal,
```

- [ ] **Step 3: Build to verify compilation**

Run: `cd src-tauri && cargo build`
Expected: Compiles successfully

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/main.rs
git commit -m "feat: add open_claude_terminal command to open default terminal"
```

---

### Task 3: Add frontend IPC wrapper

**Files:**
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: Add the wrapper function**

In `src/lib/tauri.ts`, add after the existing `openFile` function (around line 97):

```typescript
export const openClaudeTerminal = (continueSession: boolean): Promise<void> =>
  invoke('open_claude_terminal', { continueSession })
```

- [ ] **Step 2: Build to verify no TypeScript errors**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/lib/tauri.ts
git commit -m "feat: add openClaudeTerminal IPC wrapper"
```

---

### Task 4: Update AiStatusPill to always be clickable

**Files:**
- Modify: `src/components/AiStatusPill.tsx`
- Modify: `src/components/TitleBar.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Update AiStatusPill.tsx**

Replace the entire file content:

```typescript
import { useState, useEffect, useRef } from 'react'
import { openClaudeTerminal } from '../lib/tauri'

interface AiStatusPillProps {
  isProcessing: boolean
  processingFilename?: string
}

export function AiStatusPill({ isProcessing, processingFilename }: AiStatusPillProps) {
  // Track visual state separately to implement 2s linger after processing ends
  const [showActive, setShowActive] = useState(false)
  const [lingerName, setLingerName] = useState<string | undefined>(undefined)
  const wasProcessing = useRef(false)

  useEffect(() => {
    if (isProcessing) {
      wasProcessing.current = true
      setShowActive(true)
      setLingerName(processingFilename)
      return
    }
    // Processing just ended — linger for 2s before reverting
    if (wasProcessing.current) {
      wasProcessing.current = false
      const t = setTimeout(() => {
        setShowActive(false)
        setLingerName(undefined)
      }, 2000)
      return () => clearTimeout(t)
    }
  }, [isProcessing, processingFilename])

  const active = showActive

  return (
    <div
      onClick={() => openClaudeTerminal(isProcessing)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: active ? 'var(--ai-pill-active-bg)' : 'var(--ai-pill-bg)',
        border: `0.5px solid ${active ? 'var(--ai-pill-active-border)' : 'var(--ai-pill-border)'}`,
        borderRadius: 20,
        padding: '3px 11px',
        fontSize: 13,
        color: active ? 'var(--ai-pill-active-text)' : 'var(--ai-pill-text)',
        letterSpacing: '0.05em',
        userSelect: 'none',
        transition: 'background 0.3s, color 0.3s, border-color 0.3s',
        WebkitAppRegion: 'no-drag',
        cursor: 'pointer',
      } as React.CSSProperties}
    >
      <div
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: active ? 'var(--ai-pill-active-text)' : 'var(--ai-pill-dot)',
          animation: 'ai-breathe 2s ease-in-out infinite',
          flexShrink: 0,
        }}
      />
      <span style={{
        maxWidth: 180,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {active
          ? lingerName ? `${lingerName} · 整理中` : '整理中…'
          : '谨迹待命中'}
      </span>
    </div>
  )
}
```

Key changes:
- Removed `onLogClick` prop
- Added `import { openClaudeTerminal } from '../lib/tauri'`
- `onClick` now always calls `openClaudeTerminal(isProcessing)`
- `cursor` is always `'pointer'`

- [ ] **Step 2: Update TitleBar.tsx — remove onLogClick prop**

In `src/components/TitleBar.tsx`:
- Remove `onLogClick?: () => void` from the `TitleBarProps` interface
- Remove `onLogClick` from the `TitleBar` function parameters
- Remove `onLogClick={onLogClick}` from the `<AiStatusPill>` JSX

- [ ] **Step 3: Update App.tsx — remove onLogClick prop**

In `src/App.tsx`, find the `<TitleBar>` component usage and remove the `onLogClick` prop:

```typescript
// Before
<TitleBar
  theme={theme}
  onThemeChange={handleThemeChange}
  isProcessing={isProcessing}
  processingFilename={processingFilename}
  onLogClick={processingPath ? () => setActiveLogPath(processingPath) : undefined}
  view={view}
  todoOpen={todoOpen}
  todoCount={todoCount}
  onToggleTodo={() => setTodoOpen(!todoOpen)}
/>

// After
<TitleBar
  theme={theme}
  onThemeChange={handleThemeChange}
  isProcessing={isProcessing}
  processingFilename={processingFilename}
  view={view}
  todoOpen={todoOpen}
  todoCount={todoCount}
  onToggleTodo={() => setTodoOpen(!todoOpen)}
/>
```

Note: `activeLogPath` state and `ProcessingQueue` usage remain unchanged — they still handle the AiLogModal for bottom queue interactions.

- [ ] **Step 4: Build to verify**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add src/components/AiStatusPill.tsx src/components/TitleBar.tsx src/App.tsx
git commit -m "feat: AiStatusPill click opens terminal with Claude CLI"
```

---

### Task 5: Manual verification

- [ ] **Step 1: Run the app**

Run: `npm run tauri dev`

- [ ] **Step 2: Test idle state click**

1. Wait for pill to show "谨迹待命中"
2. Click the pill
3. Verify: Default terminal opens, `cd`s to workspace_path, runs `claude --allow-dangerously-skip-permissions`
4. Close the terminal

- [ ] **Step 3: Test processing state click**

1. Drop a file into the app or paste text to trigger AI processing
2. While pill shows "XXX · 整理中", click it
3. Verify: Default terminal opens, runs `claude --continue --allow-dangerously-skip-permissions`
4. Verify: Terminal resumes the session that just processed the file

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address manual testing findings"
```
