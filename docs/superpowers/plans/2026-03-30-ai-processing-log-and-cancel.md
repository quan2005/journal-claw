# AI Processing Log & Cancel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stream Claude CLI output as real-time log lines to the frontend, display them in a floating modal, and allow users to kill the running process.

**Architecture:** Switch Claude CLI invocation from `--output-format json` (waits for final result) to `--output-format stream-json` (NDJSON on stdout). A background tokio task reads stdout line-by-line and emits `ai-log` Tauri events. A `Mutex<Option<Child>>` managed state holds the current process handle for cancellation. The frontend listens to `ai-log` events, stores logs per `QueueItem`, and renders a floating modal on click.

**Tech Stack:** Rust/Tokio (async process I/O, `BufReader::lines()`), Tauri v2 events + commands, React/TypeScript (inline CSS, no new dependencies)

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `src-tauri/src/ai_processor.rs` | Modify | Stream stdout, emit `ai-log`, hold `Child` handle, add `cancel_ai_processing` command |
| `src-tauri/src/main.rs` | Modify | Register `CurrentTask` managed state + `cancel_ai_processing` command |
| `src/types.ts` | Modify | Add `AiLogLine` type; add `logs` field to `QueueItem` |
| `src/lib/tauri.ts` | Modify | Add `cancelAiProcessing()` wrapper |
| `src/hooks/useJournal.ts` | Modify | Listen to `ai-log` events, append to `queueItems[n].logs` |
| `src/components/ProcessingQueue.tsx` | Modify | Add click-to-open-modal on processing rows; add stop button |
| `src/components/AiLogModal.tsx` | Create | Floating modal: scrolling log lines + stop button |

---

### Task 1: Add `AiLogLine` type and `logs` to `QueueItem`

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Update types**

Replace the `QueueItem` interface and add `AiLogLine` in `src/types.ts`:

```typescript
export interface AiLogLine {
  material_path: string
  level: 'info' | 'error'
  message: string
}

// ── Processing queue ────────────────────────────────────
export type QueueItemStatus = 'queued' | 'processing' | 'completed' | 'failed'

export interface QueueItem {
  path: string
  filename: string
  status: QueueItemStatus
  error?: string
  addedAt: number
  logs: string[]   // ← new field
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/yanwu/Projects/github/journal && npm run build 2>&1 | tail -20
```

Expected: Build errors about `logs` missing — that is expected. They will be fixed in subsequent tasks. If the only errors are about `logs`, proceed.

- [ ] **Step 3: Commit**

```bash
cd /Users/yanwu/Projects/github/journal
git add src/types.ts
git commit -m "feat: add AiLogLine type and logs field to QueueItem"
```

---

### Task 2: Add `cancelAiProcessing` Tauri command wrapper in frontend

**Files:**
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: Add the wrapper**

Append to `src/lib/tauri.ts`:

```typescript
export const cancelAiProcessing = () =>
  invoke<void>('cancel_ai_processing')
```

- [ ] **Step 2: Commit**

```bash
cd /Users/yanwu/Projects/github/journal
git add src/lib/tauri.ts
git commit -m "feat: add cancelAiProcessing tauri wrapper"
```

---

### Task 3: Rust — add `CurrentTask` managed state and `cancel_ai_processing` command

**Files:**
- Modify: `src-tauri/src/ai_processor.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: Write the unit test first**

Add to the `#[cfg(test)]` block at the bottom of `src-tauri/src/ai_processor.rs`:

```rust
#[test]
fn cancel_with_no_task_is_noop() {
    let state = CurrentTask(std::sync::Mutex::new(None));
    // Should not panic when nothing is running
    let mut guard = state.0.lock().unwrap();
    assert!(guard.is_none());
    // If Some, we'd call child.start_kill() — but we can't easily test that without spawning
    drop(guard);
}
```

- [ ] **Step 2: Run the test to verify it compiles and passes**

```bash
cd /Users/yanwu/Projects/github/journal/src-tauri && cargo test cancel_with_no_task_is_noop 2>&1 | tail -15
```

Expected: FAIL with "cannot find struct `CurrentTask`" — that confirms it needs implementing.

- [ ] **Step 3: Add `CurrentTask` state and `cancel_ai_processing` command to `ai_processor.rs`**

Add these after the `AiQueue` struct definition (around line 21):

```rust
/// Holds a handle to the currently-running Claude CLI child process.
/// Wrapped in Mutex so the cancel command can reach in and kill it.
pub struct CurrentTask(pub std::sync::Mutex<Option<tokio::process::Child>>);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiLogLine {
    pub material_path: String,
    pub level: String,   // "info" | "error"
    pub message: String,
}
```

Add the cancel command after `set_workspace_prompt`:

```rust
#[tauri::command]
pub async fn cancel_ai_processing(
    current_task: tauri::State<'_, CurrentTask>,
) -> Result<(), String> {
    let mut guard = current_task.0.lock().map_err(|e| e.to_string())?;
    if let Some(child) = guard.as_mut() {
        child.start_kill().map_err(|e| e.to_string())?;
        eprintln!("[ai_processor] cancel: sent SIGKILL to child");
    } else {
        eprintln!("[ai_processor] cancel: no task running");
    }
    Ok(())
}
```

- [ ] **Step 4: Register state and command in `main.rs`**

In `main.rs`, add `.manage(ai_processor::CurrentTask(std::sync::Mutex::new(None)))` after the existing `.manage(ai_processor::AiQueue(ai_tx))` line:

```rust
.manage(ai_processor::AiQueue(ai_tx))
.manage(ai_processor::CurrentTask(std::sync::Mutex::new(None)))
```

Add `ai_processor::cancel_ai_processing` to the `invoke_handler![]` list (after `ai_processor::set_workspace_prompt`):

```rust
ai_processor::set_workspace_prompt,
ai_processor::cancel_ai_processing,
```

- [ ] **Step 5: Run the test again**

```bash
cd /Users/yanwu/Projects/github/journal/src-tauri && cargo test cancel_with_no_task_is_noop 2>&1 | tail -15
```

Expected: `test cancel_with_no_task_is_noop ... ok`

- [ ] **Step 6: Compile check**

```bash
cd /Users/yanwu/Projects/github/journal/src-tauri && cargo build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd /Users/yanwu/Projects/github/journal
git add src-tauri/src/ai_processor.rs src-tauri/src/main.rs
git commit -m "feat: add CurrentTask state and cancel_ai_processing command"
```

---

### Task 4: Rust — stream stdout as `ai-log` events and store Child handle

**Files:**
- Modify: `src-tauri/src/ai_processor.rs`

This is the core change: replace the blocking `.output().await` with a streaming approach.

- [ ] **Step 1: Write a unit test for log message extraction**

Add to the `#[cfg(test)]` block:

```rust
#[test]
fn extract_log_message_from_stream_json_lines() {
    // assistant text line
    let line = r#"{"type":"assistant","message":{"content":[{"type":"text","text":"正在读取文件...","citations":null,"signature":"","thinking":"","data":"","id":"","input":null,"name":"","content":{"OfWebSearchResultBlockArray":null,"error_code":"","type":"web_search_tool_result_error"},"tool_use_id":""}],"id":"","model":"","role":"assistant","stop_reason":"","stop_sequence":"","type":"message","usage":{"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"input_tokens":0,"output_tokens":0,"server_tool_use":{"web_search_requests":0},"service_tier":""},"context_management":null},"parent_tool_use_id":null,"session_id":"","uuid":""}"#;
    let msg = extract_log_line(line);
    assert_eq!(msg, Some("正在读取文件...".to_string()));

    // tool_use line
    let tool_line = r#"{"type":"assistant","message":{"content":[{"type":"tool_use","text":"","citations":null,"signature":"","thinking":"","data":"","id":"t1","input":null,"name":"Read","content":{"OfWebSearchResultBlockArray":null,"error_code":"","type":"web_search_tool_result_error"},"tool_use_id":""}],"id":"","model":"","role":"assistant","stop_reason":"","stop_sequence":"","type":"message","usage":{"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"input_tokens":0,"output_tokens":0,"server_tool_use":{"web_search_requests":0},"service_tier":""},"context_management":null},"parent_tool_use_id":null,"session_id":"","uuid":""}"#;
    let msg2 = extract_log_line(tool_line);
    assert_eq!(msg2, Some("[tool] Read".to_string()));

    // system init — should be ignored
    let sys_line = r#"{"type":"system","subtype":"init","cwd":"/tmp"}"#;
    assert_eq!(extract_log_line(sys_line), None);
}
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/yanwu/Projects/github/journal/src-tauri && cargo test extract_log_message 2>&1 | tail -10
```

Expected: FAIL with "cannot find function `extract_log_line`"

- [ ] **Step 3: Add `extract_log_line` helper function**

Add this function before `process_material` in `ai_processor.rs`:

```rust
/// Parse a single stream-json line and return a human-readable log message,
/// or None if the line should be silently ignored.
fn extract_log_line(line: &str) -> Option<String> {
    let val: serde_json::Value = serde_json::from_str(line).ok()?;
    let typ = val.get("type")?.as_str()?;
    match typ {
        "assistant" => {
            let contents = val.pointer("/message/content")?.as_array()?;
            for block in contents {
                let block_type = block.get("type")?.as_str()?;
                match block_type {
                    "text" => {
                        let text = block.get("text")?.as_str()?;
                        if !text.trim().is_empty() {
                            return Some(text.trim().to_string());
                        }
                    }
                    "tool_use" => {
                        let name = block.get("name")?.as_str()?;
                        return Some(format!("[tool] {}", name));
                    }
                    _ => {}
                }
            }
            None
        }
        "result" => {
            let is_error = val.get("is_error").and_then(|v| v.as_bool()).unwrap_or(false);
            if is_error {
                let msg = val.get("result").and_then(|v| v.as_str()).unwrap_or("失败");
                Some(format!("[error] {}", msg))
            } else {
                None  // success result is handled by the caller
            }
        }
        _ => None,  // system/init/hook lines are noise — ignore
    }
}
```

- [ ] **Step 4: Run the test again**

```bash
cd /Users/yanwu/Projects/github/journal/src-tauri && cargo test extract_log_message 2>&1 | tail -10
```

Expected: `test extract_log_message_from_stream_json_lines ... ok`

- [ ] **Step 5: Rewrite `process_material` to use streaming stdout**

Replace the entire `process_material` function with this streaming version:

```rust
pub async fn process_material(
    app: &AppHandle,
    material_path: &str,
    year_month: &str,
    current_task: &tauri::State<'_, CurrentTask>,
) -> Result<(), String> {
    let cfg = config::load_config(app)?;
    let cli = if cfg.claude_cli_path.is_empty() {
        "claude".to_string()
    } else {
        cfg.claude_cli_path.clone()
    };

    eprintln!("[ai_processor] start — material={} ym={}", material_path, year_month);
    eprintln!("[ai_processor] cli={} workspace={}", cli, cfg.workspace_path);

    ensure_workspace_prompt(&cfg.workspace_path);

    let _ = app.emit("ai-processing", ProcessingUpdate {
        material_path: material_path.to_string(),
        status: "processing".to_string(),
        error: None,
    });

    // Build args — switch to stream-json for real-time output
    let filename = std::path::PathBuf::from(material_path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let relative_ref = format!("{}/raw/{}", year_month, filename);
    let prompt = format!(
        "@{} 新增素材 @{}，请阅读内容并整理为日志条目。按 CLAUDE.md 中的规范输出，直接创建或更新 .md 文件。",
        relative_ref, filename
    );
    let args = vec![
        "-p".to_string(),
        prompt,
        "--permission-mode".to_string(),
        "bypassPermissions".to_string(),
        "--output-format".to_string(),
        "stream-json".to_string(),
        "--verbose".to_string(),
        "--no-session-persistence".to_string(),
        "--bare".to_string(),
    ];

    // Emit startup log
    let _ = app.emit("ai-log", AiLogLine {
        material_path: material_path.to_string(),
        level: "info".to_string(),
        message: format!("启动 {} ...", cli),
    });

    eprintln!("[ai_processor] running: {} {}", cli, args.join(" "));

    use tokio::io::AsyncBufReadExt;
    use tokio::process::Command;

    let mut child = Command::new(&cli)
        .args(&args)
        .current_dir(&cfg.workspace_path)
        .env("PATH", augmented_path())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("启动 Claude CLI 失败 ({}): {}", &cli, e))?;

    // Store child handle for potential cancellation
    {
        let mut guard = current_task.0.lock().map_err(|e| e.to_string())?;
        // We can't store child directly (it's moved below), so we store the pid temporarily
        // Instead: we'll read stdout/stderr then wait. Store before reading.
        // NOTE: We store a second child via unsafe raw pid trick is complex.
        // Simpler: take stdout/stderr handles FIRST, then store child.
        *guard = None; // clear any previous
    }

    let stdout = child.stdout.take().unwrap();
    let stderr_handle = child.stderr.take().unwrap();

    // Store child (without stdout/stderr — they're taken above)
    {
        let mut guard = current_task.0.lock().map_err(|e| e.to_string())?;
        *guard = Some(child);
    }

    let mp = material_path.to_string();
    let app_clone = app.clone();

    // Read stderr in background (for unexpected errors)
    let mp_stderr = mp.clone();
    let app_stderr = app_clone.clone();
    let stderr_task = tauri::async_runtime::spawn(async move {
        let mut reader = tokio::io::BufReader::new(stderr_handle).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            if !line.trim().is_empty() {
                eprintln!("[ai_processor:stderr] {}", line);
                let _ = app_stderr.emit("ai-log", AiLogLine {
                    material_path: mp_stderr.clone(),
                    level: "error".to_string(),
                    message: line,
                });
            }
        }
    });

    // Read stdout (stream-json NDJSON) and emit log lines
    let mut stdout_reader = tokio::io::BufReader::new(stdout).lines();
    let mut final_result: Result<(), String> = Ok(());

    while let Ok(Some(line)) = stdout_reader.next_line().await {
        eprintln!("[ai_processor:stream] {}", &line[..line.len().min(200)]);
        if let Some(msg) = extract_log_line(&line) {
            let level = if msg.starts_with("[error]") { "error" } else { "info" };
            let _ = app_clone.emit("ai-log", AiLogLine {
                material_path: mp.clone(),
                level: level.to_string(),
                message: msg.clone(),
            });
            if msg.starts_with("[error]") {
                final_result = Err(msg);
            }
        }
        // Check if this is the result line
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&line) {
            if val.get("type").and_then(|v| v.as_str()) == Some("result") {
                let is_error = val.get("is_error").and_then(|v| v.as_bool()).unwrap_or(false);
                if is_error {
                    let msg = val.get("result").and_then(|v| v.as_str()).unwrap_or("AI 处理失败");
                    final_result = Err(msg.to_string());
                }
            }
        }
    }

    let _ = stderr_task.await;

    // Wait for child and check exit status
    let exit_status = {
        let mut guard = current_task.0.lock().map_err(|e| e.to_string())?;
        if let Some(mut child) = guard.take() {
            child.wait().await.map_err(|e| e.to_string())?
        } else {
            // Child was killed via cancel
            let _ = app_clone.emit("ai-processing", ProcessingUpdate {
                material_path: mp.clone(),
                status: "failed".to_string(),
                error: Some("已取消".to_string()),
            });
            return Err("已取消".to_string());
        }
    };

    eprintln!("[ai_processor] exit_code={:?}", exit_status.code());

    if !exit_status.success() && final_result.is_ok() {
        final_result = Err(format!("进程退出码: {:?}", exit_status.code()));
    }

    match final_result {
        Ok(()) => {
            let _ = app_clone.emit("ai-processing", ProcessingUpdate {
                material_path: mp.clone(),
                status: "completed".to_string(),
                error: None,
            });
            let _ = app_clone.emit("journal-updated", year_month);
            Ok(())
        }
        Err(err) => {
            let _ = app_clone.emit("ai-processing", ProcessingUpdate {
                material_path: mp.clone(),
                status: "failed".to_string(),
                error: Some(err.clone()),
            });
            Err(err)
        }
    }
}
```

- [ ] **Step 6: Update `start_queue_consumer` to pass `current_task` state**

The queue consumer calls `process_material`. It needs to pass the `CurrentTask` state. Update `start_queue_consumer`:

```rust
pub fn start_queue_consumer(app: AppHandle, mut rx: mpsc::Receiver<QueueTask>) {
    tauri::async_runtime::spawn(async move {
        eprintln!("[ai_queue] consumer loop started");
        while let Some(task) = rx.recv().await {
            eprintln!("[ai_queue] dequeued task: {} ({})", task.material_path, task.year_month);
            let current_task = app.state::<CurrentTask>();
            let result = process_material(&app, &task.material_path, &task.year_month, &current_task).await;
            match &result {
                Ok(()) => eprintln!("[ai_queue] task completed: {}", task.material_path),
                Err(e) => eprintln!("[ai_queue] task failed: {} → {}", task.material_path, e),
            }
        }
        eprintln!("[ai_queue] consumer loop ended (channel closed)");
    });
}
```

- [ ] **Step 7: Remove `build_args` (now inlined) and update `parse_cli_output` usage**

The old `build_args` function is no longer used (args are now inlined in `process_material`). Remove `build_args` from `ai_processor.rs`. Also remove `parse_cli_output` — it is replaced by the streaming `extract_log_line`.

Also update the tests that used `build_args`:

```rust
#[test]
fn prompt_contains_material_reference() {
    // Verify the prompt format hasn't changed semantically
    let filename = "note.txt";
    let year_month = "2603";
    let prompt = format!(
        "@{}/raw/{} 新增素材 @{}，请阅读内容并整理为日志条目。按 CLAUDE.md 中的规范输出，直接创建或更新 .md 文件。",
        year_month, filename, filename
    );
    assert!(prompt.contains("@2603/raw/note.txt"));
    assert!(prompt.contains("新增素材"));
}
```

Replace the old `build_args_no_cwd` and `build_args_has_required_flags` tests with this single test.

- [ ] **Step 8: Run all Rust tests**

```bash
cd /Users/yanwu/Projects/github/journal/src-tauri && cargo test 2>&1 | tail -20
```

Expected: All tests pass. If `ensure_workspace_prompt_creates_file`, `parse_cli_output_*` tests fail due to removal, remove them too — those functions no longer exist.

- [ ] **Step 9: Compile check**

```bash
cd /Users/yanwu/Projects/github/journal/src-tauri && cargo build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
cd /Users/yanwu/Projects/github/journal
git add src-tauri/src/ai_processor.rs
git commit -m "feat: stream Claude CLI stdout as ai-log events, support cancel via SIGKILL"
```

---

### Task 5: Frontend — listen to `ai-log` events in `useJournal`

**Files:**
- Modify: `src/hooks/useJournal.ts`

- [ ] **Step 1: Add `ai-log` listener**

In `useJournal.ts`, import `AiLogLine` from types and add a new listener inside the `useEffect`. Add after the `unlistenProcessing` declaration:

```typescript
import type { JournalEntry, ProcessingUpdate, QueueItem, AiLogLine } from '../types'
```

Inside the `useEffect`, after `const unlistenProcessing = listen<ProcessingUpdate>(...)`, add:

```typescript
const unlistenLog = listen<AiLogLine>('ai-log', (event) => {
  const { material_path, message } = event.payload
  setQueueItems(prev =>
    prev.map(i =>
      i.path === material_path
        ? { ...i, logs: [...(i.logs ?? []), message] }
        : i
    )
  )
})
```

- [ ] **Step 2: Initialize `logs` when adding queued items**

In the `queued` branch of the `ai-processing` listener, add `logs: []`:

```typescript
return [...prev, {
  path: material_path,
  filename,
  status: 'queued',
  addedAt: Date.now(),
  logs: [],
}]
```

- [ ] **Step 3: Clean up the new listener in the return function**

```typescript
return () => {
  unlistenProcessing.then(fn => fn())
  unlistenLog.then(fn => fn())
  unlistenUpdated.then(fn => fn())
  unlistenProcessed.then(fn => fn())
  removalTimers.current.forEach(t => clearTimeout(t))
  removalTimers.current.clear()
}
```

- [ ] **Step 4: Build check**

```bash
cd /Users/yanwu/Projects/github/journal && npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/yanwu/Projects/github/journal
git add src/hooks/useJournal.ts
git commit -m "feat: collect ai-log events into QueueItem.logs"
```

---

### Task 6: Create `AiLogModal` component

**Files:**
- Create: `src/components/AiLogModal.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/AiLogModal.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import type { QueueItem } from '../types'
import { Spinner } from './Spinner'

interface AiLogModalProps {
  item: QueueItem
  onClose: () => void
  onCancel: () => void
}

export function AiLogModal({ item, onClose, onCancel }: AiLogModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom as new lines arrive
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [item.logs])

  const isActive = item.status === 'processing' || item.status === 'queued'

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 100,
        }}
      />
      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 520,
          maxWidth: 'calc(100vw - 48px)',
          background: 'var(--queue-bg)',
          border: '0.5px solid var(--queue-border)',
          borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          zIndex: 101,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          maxHeight: '70vh',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 16px',
          borderBottom: '0.5px solid var(--queue-border)',
          flexShrink: 0,
        }}>
          {isActive && <Spinner size={12} borderWidth={1.5} />}
          <span style={{ flex: 1, fontSize: 11, color: 'var(--item-meta)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.filename}
          </span>
          <span style={{
            fontSize: 9,
            color: item.status === 'failed' ? '#ff453a'
              : item.status === 'completed' ? 'var(--ai-pill-text)'
              : 'var(--ai-pill-active-text)',
            opacity: 0.8,
          }}>
            {item.status === 'queued' ? '排队中'
              : item.status === 'processing' ? '处理中'
              : item.status === 'completed' ? '已完成'
              : '失败'}
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--item-meta)', fontSize: 16, lineHeight: 1, padding: '0 2px' }}
          >
            ×
          </button>
        </div>

        {/* Log lines */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '10px 16px',
            fontFamily: 'ui-monospace, "SF Mono", monospace',
            fontSize: 10,
            lineHeight: 1.6,
            color: 'var(--item-meta)',
          }}
        >
          {item.logs.length === 0 ? (
            <span style={{ opacity: 0.4 }}>等待输出...</span>
          ) : (
            item.logs.map((line, i) => (
              <div
                key={i}
                style={{
                  color: line.startsWith('[error]') ? '#ff453a' : 'var(--item-meta)',
                  wordBreak: 'break-all',
                  marginBottom: 1,
                }}
              >
                {line}
              </div>
            ))
          )}
        </div>

        {/* Footer — cancel button only when active */}
        {isActive && (
          <div style={{
            padding: '8px 16px',
            borderTop: '0.5px solid var(--queue-border)',
            display: 'flex',
            justifyContent: 'flex-end',
            flexShrink: 0,
          }}>
            <button
              onClick={onCancel}
              style={{
                background: 'none',
                border: '0.5px solid var(--queue-border)',
                borderRadius: 5,
                padding: '4px 12px',
                fontSize: 10,
                color: '#ff453a',
                cursor: 'pointer',
              }}
            >
              停止处理
            </button>
          </div>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Build check**

```bash
cd /Users/yanwu/Projects/github/journal && npm run build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/yanwu/Projects/github/journal
git add src/components/AiLogModal.tsx
git commit -m "feat: add AiLogModal component with real-time log display and cancel button"
```

---

### Task 7: Wire `AiLogModal` into `ProcessingQueue`

**Files:**
- Modify: `src/components/ProcessingQueue.tsx`

- [ ] **Step 1: Update `ProcessingQueue` to open modal on row click**

Replace the entire content of `src/components/ProcessingQueue.tsx`:

```tsx
import { useState } from 'react'
import type { QueueItem } from '../types'
import { fileKindFromName } from '../lib/fileKind'
import { Spinner } from './Spinner'
import { AiLogModal } from './AiLogModal'

interface ProcessingQueueProps {
  items: QueueItem[]
  onDismiss: (path: string) => void
  onCancel: () => void
}

const kindEmoji: Record<string, string> = {
  audio: '\uD83C\uDFA4',
  text: '\uD83D\uDCC4',
  markdown: '\uD83D\uDCDD',
  pdf: '\uD83D\uDCC4',
  docx: '\uD83D\uDCC4',
  image: '\uD83D\uDDBC\uFE0F',
  other: '\uD83D\uDCC1',
}

function StatusIndicator({ item, onDismiss }: { item: QueueItem; onDismiss: () => void }) {
  if (item.status === 'queued') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--item-meta)', fontSize: 9, opacity: 0.7 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--item-meta)', opacity: 0.4 }} />
        排队中
      </span>
    )
  }
  if (item.status === 'processing') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ai-pill-active-text)', fontSize: 9, opacity: 0.8 }}>
        <Spinner size={10} borderWidth={1.5} />
        处理中
      </span>
    )
  }
  if (item.status === 'failed') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ color: '#ff453a', fontSize: 9 }}>失败</span>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss() }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px',
            color: 'var(--item-meta)', fontSize: 12, lineHeight: 1,
          }}
          title="关闭"
        >
          ×
        </button>
      </span>
    )
  }
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ai-pill-text)', fontSize: 9, opacity: 0.7 }}>
      <span style={{ fontSize: 11 }}>✓</span>
      完成
    </span>
  )
}

export function ProcessingQueue({ items, onDismiss, onCancel }: ProcessingQueueProps) {
  const [activeLogPath, setActiveLogPath] = useState<string | null>(null)

  if (items.length === 0) return null

  const activeItem = activeLogPath ? items.find(i => i.path === activeLogPath) : null

  return (
    <>
      <div style={{
        background: 'var(--queue-bg)',
        borderTop: '1px solid var(--queue-border)',
        borderRadius: '8px 8px 0 0',
        maxHeight: 160,
        overflowY: 'auto',
        boxShadow: '0 -2px 12px var(--queue-shadow)',
      }}>
        {items.map((item, idx) => {
          const emoji = kindEmoji[fileKindFromName(item.filename)] ?? '\uD83D\uDCC1'
          const isLast = idx === items.length - 1
          const animStyle: React.CSSProperties =
            item.status === 'completed'
              ? { animation: 'queue-fade-out 0.3s ease-out forwards' }
              : { animation: 'queue-enter 0.2s ease-out' }

          return (
            <div
              key={item.path}
              onClick={() => setActiveLogPath(item.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                height: 32,
                padding: '0 20px',
                borderBottom: isLast ? 'none' : '0.5px solid var(--queue-border)',
                cursor: 'pointer',
                ...animStyle,
              }}
            >
              <span style={{ fontSize: 11, flexShrink: 0, opacity: 0.7 }}>{emoji}</span>
              <span style={{
                flex: 1,
                fontSize: 10,
                color: item.status === 'failed' ? '#ff453a' : 'var(--item-meta)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 0,
              }}>
                {item.filename}
              </span>
              <StatusIndicator item={item} onDismiss={() => onDismiss(item.path)} />
            </div>
          )
        })}
      </div>

      {activeItem && (
        <AiLogModal
          item={activeItem}
          onClose={() => setActiveLogPath(null)}
          onCancel={() => {
            onCancel()
            setActiveLogPath(null)
          }}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: Update `App.tsx` to pass `onCancel` to `ProcessingQueue`**

In `App.tsx`, import `cancelAiProcessing` and pass the handler:

```typescript
import { importFile, triggerAiProcessing, submitPasteText, cancelAiProcessing } from './lib/tauri'
```

Update the `ProcessingQueue` usage in `App.tsx`:

```tsx
<ProcessingQueue
  items={queueItems}
  onDismiss={dismissQueueItem}
  onCancel={cancelAiProcessing}
/>
```

- [ ] **Step 3: Build check**

```bash
cd /Users/yanwu/Projects/github/journal && npm run build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 4: Run frontend tests**

```bash
cd /Users/yanwu/Projects/github/journal && npm test 2>&1 | tail -20
```

Expected: all pass (no tests touch ProcessingQueue yet, so no regressions).

- [ ] **Step 5: Commit**

```bash
cd /Users/yanwu/Projects/github/journal
git add src/components/ProcessingQueue.tsx src/components/AiLogModal.tsx src/App.tsx
git commit -m "feat: click queue row to open log modal, cancel button calls cancel_ai_processing"
```

---

### Task 8: Manual smoke test

**Files:** none — testing only

- [ ] **Step 1: Start the dev app**

```bash
cd /Users/yanwu/Projects/github/journal && npm run tauri dev
```

- [ ] **Step 2: Drop a file to trigger processing**

Drop any `.txt` or `.pdf` file onto the app. Verify:
1. A row appears in `ProcessingQueue` with "排队中" then "处理中"
2. Clicking the row opens `AiLogModal`
3. Log lines appear in the modal as Claude CLI runs (e.g., `[tool] Read`, text messages)
4. On completion the row shows "已完成" briefly then disappears; modal closes

- [ ] **Step 3: Test cancel**

Drop a large file (e.g., a long PDF) to trigger a slow processing. While "处理中":
1. Click the row to open modal
2. Click "停止处理"
3. Verify the row shows "失败" with error "已取消"
4. Verify no zombie claude processes: `ps aux | grep claude`

- [ ] **Step 4: Test error path**

If you have a file that Claude cannot process (binary garbage), verify the modal shows red error lines and the queue item shows "失败".

- [ ] **Step 5: Final commit if any tweaks needed**

```bash
cd /Users/yanwu/Projects/github/journal
git add -p  # stage only intentional tweaks
git commit -m "fix: smoke test adjustments"
```
