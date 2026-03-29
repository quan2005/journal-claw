# AI Processing Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fire-and-forget AI processing with a visible serial queue showing queued/processing/failed status per file, floating above the CommandDock.

**Architecture:** Rust-side `tokio::sync::mpsc` channel ensures serial Claude CLI execution. Frontend `useJournal` tracks a `QueueItem[]` instead of `string[]`. New `ProcessingQueue` component renders the queue panel above CommandDock. `InboxStrip` removed.

**Tech Stack:** Rust (tokio mpsc, Tauri State), React, TypeScript, CSS animations

---

### Task 1: Rust — Refactor ai_processor.rs to use mpsc queue

**Files:**
- Modify: `src-tauri/src/ai_processor.rs`

- [ ] **Step 1: Write tests for the simplified build_args helper**

Replace the existing `build_command_structure` test with a test for the new function that no longer includes `--cwd`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_args_no_cwd() {
        let args = build_args("/nb/2603/raw/note.txt");
        assert_eq!(args[0], "-p");
        assert!(args[1].starts_with("@/nb/2603/raw/note.txt"));
        assert!(args[1].contains("新增资料"));
        // Must NOT contain --cwd
        assert!(!args.iter().any(|a| a == "--cwd"));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src-tauri && cargo test build_args_no_cwd -- --nocapture`
Expected: FAIL — `build_args` not found.

- [ ] **Step 3: Rewrite ai_processor.rs with queue architecture**

Replace the entire file with:

```rust
use tauri::{AppHandle, Emitter};
use crate::{config, workspace};
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;

// ── Types ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingUpdate {
    pub material_path: String,
    pub status: String,        // "queued" | "processing" | "completed" | "failed"
    pub error: Option<String>,
}

struct QueueTask {
    material_path: String,
    year_month: String,
}

/// Holds the sender half — stored in Tauri managed state.
pub struct AiQueue(pub mpsc::Sender<QueueTask>);

// ── Helpers ──────────────────────────────────────────────

fn build_prompt(_material_path: &str) -> String {
    "新增资料，请阅读并整理记录".to_string()
}

/// Build CLI args (without --cwd — working dir set via .current_dir()).
fn build_args(material_path: &str) -> Vec<String> {
    vec![
        "-p".to_string(),
        format!("@{} {}", material_path, build_prompt(material_path)),
    ]
}

fn augmented_path() -> String {
    let path_env = std::env::var("PATH").unwrap_or_default();
    format!(
        "{}:/usr/local/bin:/opt/homebrew/bin:{}/.local/bin",
        path_env,
        std::env::var("HOME").unwrap_or_default()
    )
}

// ── Queue consumer ───────────────────────────────────────

/// Spawn a single-threaded consumer that processes tasks serially.
/// Call once during app setup; pass the receiver half.
pub fn start_queue_consumer(app: AppHandle, mut rx: mpsc::Receiver<QueueTask>) {
    tokio::spawn(async move {
        while let Some(task) = rx.recv().await {
            let _ = process_material(&app, &task.material_path, &task.year_month).await;
        }
    });
}

async fn process_material(
    app: &AppHandle,
    material_path: &str,
    year_month: &str,
) -> Result<(), String> {
    let cfg = config::load_config(app)?;
    let cli = if cfg.claude_cli_path.is_empty() {
        "claude".to_string()
    } else {
        cfg.claude_cli_path.clone()
    };
    let ym_dir = workspace::year_month_dir(&cfg.workspace_path, year_month);

    // Emit "processing"
    let _ = app.emit("ai-processing", ProcessingUpdate {
        material_path: material_path.to_string(),
        status: "processing".to_string(),
        error: None,
    });

    let args = build_args(material_path);
    let output = tokio::process::Command::new(&cli)
        .args(&args)
        .current_dir(&ym_dir)
        .env("PATH", augmented_path())
        .output()
        .await
        .map_err(|e| format!("启动 Claude CLI 失败 ({}): {}", &cli, e))?;

    if output.status.success() {
        let _ = app.emit("ai-processing", ProcessingUpdate {
            material_path: material_path.to_string(),
            status: "completed".to_string(),
            error: None,
        });
        let _ = app.emit("journal-updated", year_month);
        Ok(())
    } else {
        let err = String::from_utf8_lossy(&output.stderr).to_string();
        let _ = app.emit("ai-processing", ProcessingUpdate {
            material_path: material_path.to_string(),
            status: "failed".to_string(),
            error: Some(err.clone()),
        });
        Err(err)
    }
}

// ── Tauri command ────────────────────────────────────────

#[tauri::command]
pub async fn trigger_ai_processing(
    app: AppHandle,
    queue: tauri::State<'_, AiQueue>,
    material_path: String,
    year_month: String,
) -> Result<(), String> {
    // Emit "queued" immediately
    let _ = app.emit("ai-processing", ProcessingUpdate {
        material_path: material_path.clone(),
        status: "queued".to_string(),
        error: None,
    });

    queue.0.send(QueueTask {
        material_path,
        year_month,
    }).await.map_err(|e| format!("队列发送失败: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_args_no_cwd() {
        let args = build_args("/nb/2603/raw/note.txt");
        assert_eq!(args[0], "-p");
        assert!(args[1].starts_with("@/nb/2603/raw/note.txt"));
        assert!(args[1].contains("新增资料"));
        assert!(!args.iter().any(|a| a == "--cwd"));
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd src-tauri && cargo test build_args_no_cwd -- --nocapture`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/ai_processor.rs
git commit -m "refactor(rust): serial mpsc queue for AI processing, use .current_dir()"
```

---

### Task 2: Rust — Wire queue into main.rs setup

**Files:**
- Modify: `src-tauri/src/main.rs:24-83` (the setup closure)

- [ ] **Step 1: Add queue initialization to setup**

In `main.rs`, inside the `setup` closure (after the menu setup, before `Ok(())`), add:

```rust
            // ── AI processing queue ──
            let (tx, rx) = tokio::sync::mpsc::channel(32);
            app.manage(ai_processor::AiQueue(tx));
            ai_processor::start_queue_consumer(app.handle().clone(), rx);
```

The full `setup` closure ending should look like:

```rust
            let app_handle = app.handle().clone();
            app.on_menu_event(move |_app, event| {
                if event.id() == "settings" {
                    let _ = config::open_settings(app_handle.clone());
                }
            });

            // ── AI processing queue ──
            let (tx, rx) = tokio::sync::mpsc::channel(32);
            app.manage(ai_processor::AiQueue(tx));
            ai_processor::start_queue_consumer(app.handle().clone(), rx);

            Ok(())
```

- [ ] **Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: No errors. (There may be warnings about unused imports — fine.)

- [ ] **Step 3: Run all Rust tests**

Run: `cd src-tauri && cargo test`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/main.rs
git commit -m "feat(rust): wire AI queue into Tauri setup"
```

---

### Task 3: Frontend — Add QueueItem types

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add new types to types.ts**

Append after the `ProcessingUpdate` interface (line 45):

```ts
// ── Processing queue ────────────────────────────────────
export type QueueItemStatus = 'queued' | 'processing' | 'completed' | 'failed'

export interface QueueItem {
  path: string
  filename: string
  status: QueueItemStatus
  error?: string
  addedAt: number
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat(types): add QueueItem and QueueItemStatus"
```

---

### Task 4: Frontend — Refactor useJournal hook

**Files:**
- Modify: `src/hooks/useJournal.ts`

- [ ] **Step 1: Rewrite useJournal to track QueueItem[]**

Replace the entire file:

```ts
import { useState, useEffect, useCallback, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import { listAllJournalEntries } from '../lib/tauri'
import type { JournalEntry, ProcessingUpdate, QueueItem } from '../types'

export function useJournal() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [queueItems, setQueueItems] = useState<QueueItem[]>([])
  const removalTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const refresh = useCallback(async () => {
    try {
      const result = await listAllJournalEntries()
      setEntries(result)
    } catch (e) {
      console.error('Failed to load journal entries:', e)
    }
  }, [])

  const dismissQueueItem = useCallback((path: string) => {
    const timer = removalTimers.current.get(path)
    if (timer) clearTimeout(timer)
    removalTimers.current.delete(path)
    setQueueItems(prev => prev.filter(i => i.path !== path))
  }, [])

  useEffect(() => {
    refresh()

    const unlistenProcessing = listen<ProcessingUpdate>('ai-processing', (event) => {
      const { material_path, status, error } = event.payload
      console.log('[ai-processing]', status, material_path, error ?? '')

      if (status === 'queued') {
        setQueueItems(prev => {
          // Don't add duplicates
          if (prev.some(i => i.path === material_path)) return prev
          const filename = material_path.split('/').pop() ?? material_path
          return [...prev, {
            path: material_path,
            filename,
            status: 'queued',
            addedAt: Date.now(),
          }]
        })
      } else if (status === 'processing') {
        setQueueItems(prev =>
          prev.map(i => i.path === material_path ? { ...i, status: 'processing' } : i)
        )
      } else if (status === 'completed') {
        setQueueItems(prev =>
          prev.map(i => i.path === material_path ? { ...i, status: 'completed' } : i)
        )
        // Auto-remove after 1s
        const timer = setTimeout(() => {
          removalTimers.current.delete(material_path)
          setQueueItems(prev => prev.filter(i => i.path !== material_path))
        }, 1000)
        removalTimers.current.set(material_path, timer)
      } else if (status === 'failed') {
        setQueueItems(prev =>
          prev.map(i => i.path === material_path
            ? { ...i, status: 'failed', error }
            : i
          )
        )
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
      // Clean up timers
      removalTimers.current.forEach(t => clearTimeout(t))
      removalTimers.current.clear()
    }
  }, [refresh])

  const isProcessing = queueItems.some(
    i => i.status === 'processing' || i.status === 'queued'
  )

  return { entries, queueItems, isProcessing, dismissQueueItem, refresh }
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npm run build`
Expected: Likely errors in `App.tsx` and `JournalList.tsx` (they still reference `processingPaths`). That's correct — we fix them in later tasks.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useJournal.ts
git commit -m "refactor(hook): useJournal tracks QueueItem[] instead of string[]"
```

---

### Task 5: Frontend — Add queue-enter / queue-fade-out animations

**Files:**
- Modify: `src/styles/animations.css`

- [ ] **Step 1: Add two new keyframes**

Append to the end of `src/styles/animations.css`:

```css
/* Queue item enter — slide up from below */
@keyframes queue-enter {
  from { transform: translateY(8px); opacity: 0; }
  to   { transform: translateY(0);   opacity: 1; }
}

/* Queue item completed — fade out */
@keyframes queue-fade-out {
  from { opacity: 1; }
  to   { opacity: 0; }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles/animations.css
git commit -m "feat(css): add queue-enter and queue-fade-out animations"
```

---

### Task 6: Frontend — Create ProcessingQueue component

**Files:**
- Create: `src/components/ProcessingQueue.tsx`

- [ ] **Step 1: Create the component**

```tsx
import type { QueueItem } from '../types'
import { fileKindFromName } from '../lib/fileKind'
import { Spinner } from './Spinner'

interface ProcessingQueueProps {
  items: QueueItem[]
  onDismiss: (path: string) => void
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
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--item-meta)', fontSize: 10 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--item-meta)', opacity: 0.5 }} />
        排队中
      </span>
    )
  }
  if (item.status === 'processing') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ai-pill-active-text)', fontSize: 10 }}>
        <Spinner size={10} borderWidth={1.5} />
        处理中
      </span>
    )
  }
  if (item.status === 'failed') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ color: '#ff453a', fontSize: 10 }}>失败</span>
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
  // completed — brief fade-out state
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ai-pill-text)', fontSize: 10 }}>
      <span style={{ fontSize: 11 }}>✓</span>
      完成
    </span>
  )
}

export function ProcessingQueue({ items, onDismiss }: ProcessingQueueProps) {
  if (items.length === 0) return null

  return (
    <div style={{
      background: 'var(--dock-bg)',
      borderTop: '0.5px solid var(--dock-border)',
      borderRadius: '8px 8px 0 0',
      maxHeight: 180,
      overflowY: 'auto',
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
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              height: 36,
              padding: '0 20px',
              borderBottom: isLast ? 'none' : '0.5px solid var(--dock-border)',
              ...animStyle,
            }}
          >
            <span style={{ fontSize: 13, flexShrink: 0 }}>{emoji}</span>
            <span style={{
              flex: 1,
              fontSize: 11,
              color: item.status === 'failed' ? '#ff453a' : 'var(--item-text)',
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
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ProcessingQueue.tsx
git commit -m "feat(ui): add ProcessingQueue component"
```

---

### Task 7: Frontend — Wire everything in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update imports and hook usage**

Replace the import of `useJournal` destructuring and add `ProcessingQueue` import. Find:

```ts
import { useJournal } from './hooks/useJournal'
```

Keep it. Add after the other component imports:

```ts
import { ProcessingQueue } from './components/ProcessingQueue'
```

Replace the hook call:

```ts
  const { entries, processingPaths, refresh } = useJournal()
```

with:

```ts
  const { entries, queueItems, isProcessing, dismissQueueItem, refresh } = useJournal()
```

- [ ] **Step 2: Update TitleBar prop**

Replace:

```tsx
      <TitleBar theme={theme} onThemeChange={setTheme} isProcessing={processingPaths.length > 0} />
```

with:

```tsx
      <TitleBar theme={theme} onThemeChange={setTheme} isProcessing={isProcessing} />
```

- [ ] **Step 3: Remove processingPaths from JournalList**

Replace:

```tsx
          <JournalList
            entries={entries}
            processingPaths={processingPaths}
            selectedPath={selectedEntry?.path ?? null}
            onSelect={setSelectedEntry}
          />
```

with:

```tsx
          <JournalList
            entries={entries}
            selectedPath={selectedEntry?.path ?? null}
            onSelect={setSelectedEntry}
          />
```

- [ ] **Step 4: Add ProcessingQueue above CommandDock**

Wrap the CommandDock area in a relative container and place ProcessingQueue above it. Replace the `<CommandDock ... />` block (the closing tag area starting around line 165) with:

```tsx
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: 0,
          right: 0,
          zIndex: 10,
        }}>
          <ProcessingQueue items={queueItems} onDismiss={dismissQueueItem} />
        </div>
        <CommandDock
          isDragOver={isDragOver}
          pendingFiles={pendingFiles}
          onPasteSubmit={handlePasteSubmit}
          onFilesSubmit={handleFilesSubmit}
          onFilesCancel={handleFilesCancel}
          onRemoveFile={handleRemoveFile}
          recorderStatus={status}
          onRecord={handleRecord}
        />
      </div>
```

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): wire ProcessingQueue into layout"
```

---

### Task 8: Frontend — Remove InboxStrip from JournalList

**Files:**
- Modify: `src/components/JournalList.tsx`
- Delete: `src/components/InboxStrip.tsx`

- [ ] **Step 1: Remove InboxStrip from JournalList**

Remove the import line:

```ts
import { InboxStrip } from './InboxStrip'
```

Remove `processingPaths` from the props interface:

```ts
interface JournalListProps {
  entries: JournalEntry[]
  processingPaths: string[]
  selectedPath: string | null
  onSelect: (entry: JournalEntry) => void
}
```

Replace with:

```ts
interface JournalListProps {
  entries: JournalEntry[]
  selectedPath: string | null
  onSelect: (entry: JournalEntry) => void
}
```

Update function signature:

```ts
export function JournalList({ entries, processingPaths, selectedPath, onSelect }: JournalListProps) {
```

Replace with:

```ts
export function JournalList({ entries, selectedPath, onSelect }: JournalListProps) {
```

Remove the `<InboxStrip>` render line:

```tsx
      <InboxStrip processingPaths={processingPaths} />
```

Delete this line entirely.

- [ ] **Step 2: Delete InboxStrip.tsx**

```bash
rm src/components/InboxStrip.tsx
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/JournalList.tsx
git rm src/components/InboxStrip.tsx
git commit -m "refactor(ui): remove InboxStrip, replaced by ProcessingQueue"
```

---

### Task 9: Update test file

**Files:**
- Modify: `src/tests/JournalItem.test.tsx`

- [ ] **Step 1: Check if test references processingPaths or InboxStrip**

Read `src/tests/JournalItem.test.tsx`. If it imports or uses `processingPaths` or `InboxStrip`, remove those references. The test focuses on `JournalItem` which has no changes to its props interface, so it should be unaffected. Verify with:

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 2: Commit (if changes were needed)**

```bash
git add src/tests/JournalItem.test.tsx
git commit -m "test: update tests for queue refactor"
```

---

### Task 10: Full integration verification

- [ ] **Step 1: Run frontend build**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 2: Run Rust build**

Run: `cd src-tauri && cargo check`
Expected: No errors.

- [ ] **Step 3: Run all tests**

Run: `npm test && cd src-tauri && cargo test`
Expected: All tests pass.

- [ ] **Step 4: Manual smoke test**

Run: `npm run tauri dev`

Verify:
1. App launches without console errors
2. TitleBar shows AiStatusPill in idle state ("Agent 待命中")
3. InboxStrip no longer appears at top of journal list
4. Dragging a file → submitting → queue panel appears above CommandDock
5. Queue shows "排队中" → "处理中" → completes and fades out (or shows "失败" if CLI not configured)
6. Failed items show `×` button, clicking removes them
7. AiStatusPill changes to "整理中…" during processing
