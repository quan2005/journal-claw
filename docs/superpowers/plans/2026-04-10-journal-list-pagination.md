# Journal List Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load journal entries in 3-month batches with a "load more" button, replacing the current full-scan approach.

**Architecture:** Two new Rust commands (`list_available_months`, `list_journal_entries_by_months`) provide paginated data. `useJournal` hook manages loaded/available month state. `JournalList` renders a load-more button at the bottom. Existing `list_all_journal_entries` is preserved for callers in `App.tsx`.

**Tech Stack:** Rust (Tauri v2 commands), React hooks, TypeScript

---

### Task 1: Rust — Add `list_available_months` and `list_journal_entries_by_months` commands

**Files:**
- Modify: `src-tauri/src/journal.rs` (append after `list_all_journal_entries` at ~line 280)
- Modify: `src-tauri/src/main.rs:317-318` (add to invoke_handler)

- [ ] **Step 1: Add `list_available_months` command to `journal.rs`**

Append after the existing `list_all_journal_entries` function (around line 280):

```rust
#[tauri::command]
pub async fn list_available_months(app: AppHandle) -> Result<Vec<String>, String> {
    let cfg = config::load_config(&app)?;
    if cfg.workspace_path.is_empty() {
        return Ok(vec![]);
    }
    let workspace = cfg.workspace_path.clone();
    tokio::task::spawn_blocking(move || {
        let ws_path = std::path::PathBuf::from(&workspace);
        if !ws_path.exists() {
            return Ok(vec![]);
        }
        let read_dir = std::fs::read_dir(&ws_path).map_err(|e| e.to_string())?;
        let mut months: Vec<String> = read_dir
            .flatten()
            .filter_map(|entry| {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.len() == 4 && name.chars().all(|c| c.is_ascii_digit()) {
                    Some(name)
                } else {
                    None
                }
            })
            .collect();
        months.sort_by(|a, b| b.cmp(a));
        Ok(months)
    })
    .await
    .map_err(|e| e.to_string())?
}
```

- [ ] **Step 2: Add `list_journal_entries_by_months` command to `journal.rs`**

Append directly after `list_available_months`:

```rust
#[tauri::command]
pub async fn list_journal_entries_by_months(
    app: AppHandle,
    months: Vec<String>,
) -> Result<Vec<JournalEntry>, String> {
    let cfg = config::load_config(&app)?;
    if cfg.workspace_path.is_empty() {
        return Ok(vec![]);
    }
    let workspace = cfg.workspace_path.clone();
    tokio::task::spawn_blocking(move || {
        let mut all: Vec<JournalEntry> = vec![];
        for ym in &months {
            let mut batch = list_entries(&workspace, ym)?;
            all.append(&mut batch);
        }
        all.sort_by(|a, b| {
            b.year_month
                .cmp(&a.year_month)
                .then(b.day.cmp(&a.day))
                .then(b.created_at_secs.cmp(&a.created_at_secs))
        });
        Ok(all)
    })
    .await
    .map_err(|e| e.to_string())?
}
```

- [ ] **Step 3: Register new commands in `main.rs`**

In `src-tauri/src/main.rs`, after line 318 (`journal::list_journal_entries,`), add:

```rust
            journal::list_available_months,
            journal::list_journal_entries_by_months,
```

- [ ] **Step 4: Run Rust tests to verify compilation**

Run: `cd /Users/yanwu/Projects/github/journal/src-tauri && cargo test`
Expected: All existing tests pass, no compilation errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/journal.rs src-tauri/src/main.rs
git commit -m "feat(journal): add paginated month listing commands"
```

---

### Task 2: Frontend — Add IPC wrappers and i18n strings

**Files:**
- Modify: `src/lib/tauri.ts:50` (after `listAllJournalEntries`)
- Modify: `src/locales/en.ts:358` (before closing brace)
- Modify: `src/locales/zh.ts:360` (before closing brace)

- [ ] **Step 1: Add IPC wrappers to `src/lib/tauri.ts`**

After the existing `listAllJournalEntries` wrapper (line 51), add:

```typescript
export const listAvailableMonths = () =>
  invoke<string[]>('list_available_months')

export const listJournalEntriesByMonths = (months: string[]) =>
  invoke<JournalEntry[]>('list_journal_entries_by_months', { months })
```

Note: `JournalEntry` is already imported in this file's type imports.

- [ ] **Step 2: Add i18n string to `src/locales/en.ts`**

Before the closing `}` (line 359), add:

```typescript
  loadMore: 'Load earlier entries',
```

- [ ] **Step 3: Add i18n string to `src/locales/zh.ts`**

Before the closing `}` (line 361), add:

```typescript
  loadMore: '加载更早的记录',
```

- [ ] **Step 4: Run frontend build check**

Run: `npm run build`
Expected: No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tauri.ts src/locales/en.ts src/locales/zh.ts
git commit -m "feat(journal): add paginated IPC wrappers and i18n strings"
```

---

### Task 3: Frontend — Refactor `useJournal` to use paginated loading

**Files:**
- Modify: `src/hooks/useJournal.ts`

- [ ] **Step 1: Update imports**

Replace line 3:
```typescript
import { listAllJournalEntries } from '../lib/tauri'
```
with:
```typescript
import { listAvailableMonths, listJournalEntriesByMonths } from '../lib/tauri'
```

- [ ] **Step 2: Add new state variables**

After line 10 (`const [loading, setLoading] = useState(true)`), add:

```typescript
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [loadedMonths, setLoadedMonths] = useState<string[]>([])
```

- [ ] **Step 3: Rewrite `refresh` callback**

Replace the existing `refresh` callback (the `useCallback` block that calls `listAllJournalEntries`) with:

```typescript
  const loadedMonthsRef = useRef<string[]>([])

  const refresh = useCallback(async () => {
    if (refreshing.current) return
    const months = loadedMonthsRef.current
    if (months.length === 0) return
    refreshing.current = true
    try {
      const result = await listJournalEntriesByMonths(months)
      setEntries(prev => {
        if (prev.length !== result.length) return result
        for (let i = 0; i < prev.length; i++) {
          if (prev[i].path !== result[i].path || prev[i].mtime_secs !== result[i].mtime_secs) return result
        }
        return prev
      })
    } catch (e) {
      console.error('Failed to load journal entries:', e)
    } finally {
      setLoading(false)
      refreshing.current = false
    }
  }, [])
```

- [ ] **Step 4: Add initialization logic**

Replace the `refresh()` call at the top of the existing `useEffect` (the one that sets up polling and event listeners) with an `init` function. Change the first few lines inside the `useEffect` from:

```typescript
    refresh()
```

to:

```typescript
    const init = async () => {
      try {
        const months = await listAvailableMonths()
        setAvailableMonths(months)
        const initial = months.slice(0, 3)
        setLoadedMonths(initial)
        loadedMonthsRef.current = initial
        if (initial.length > 0) {
          const result = await listJournalEntriesByMonths(initial)
          setEntries(result)
        }
      } catch (e) {
        console.error('Failed to initialize journal:', e)
      } finally {
        setLoading(false)
      }
    }
    init()
```

- [ ] **Step 5: Update `journal-updated` event handler to refresh available months**

Find the existing `unlistenUpdated` listener:

```typescript
    const unlistenUpdated = listen<string>('journal-updated', () => {
      refresh()
    })
```

Replace with:

```typescript
    const unlistenUpdated = listen<string>('journal-updated', async () => {
      const months = await listAvailableMonths()
      setAvailableMonths(months)
      // If a new month appeared (e.g. first entry of the month), add it to loaded
      const currentLoaded = loadedMonthsRef.current
      const newMonths = months.filter(m => !currentLoaded.includes(m) && m > (currentLoaded[0] ?? ''))
      if (newMonths.length > 0) {
        const updated = [...new Set([...currentLoaded, ...newMonths])].sort((a, b) => b.localeCompare(a))
        setLoadedMonths(updated)
        loadedMonthsRef.current = updated
      }
      refresh()
    })
```

- [ ] **Step 6: Add `loadMore` callback**

After the `refresh` callback, add:

```typescript
  const loadMore = useCallback(async () => {
    const currentLoaded = loadedMonthsRef.current
    const remaining = availableMonths.filter(m => !currentLoaded.includes(m))
    const next = remaining.slice(0, 3)
    if (next.length === 0) return
    const updated = [...currentLoaded, ...next]
    setLoadedMonths(updated)
    loadedMonthsRef.current = updated
    // Fetch only the new months and append
    try {
      const newEntries = await listJournalEntriesByMonths(next)
      setEntries(prev => {
        const merged = [...prev, ...newEntries]
        merged.sort((a, b) =>
          b.year_month.localeCompare(a.year_month)
          || b.day - a.day
          || b.created_at_secs - a.created_at_secs
        )
        return merged
      })
    } catch (e) {
      console.error('Failed to load more entries:', e)
    }
  }, [availableMonths])
```

- [ ] **Step 7: Compute `hasMore` and update return value**

Before the return statement, add:

```typescript
  const hasMore = availableMonths.length > loadedMonths.length
```

Update the return statement to include `hasMore` and `loadMore`:

```typescript
  return { entries, loading, queueItems, isProcessing, hasMore, loadMore, dismissQueueItem, addConvertingItem, addQueuedItem, markItemFailed, retryQueueItem, refresh }
```

- [ ] **Step 8: Run frontend build check**

Run: `cd /Users/yanwu/Projects/github/journal && npm run build`
Expected: No TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add src/hooks/useJournal.ts
git commit -m "feat(journal): paginated loading in useJournal hook"
```

---

### Task 4: Frontend — Add load-more button to `JournalList` and wire up in `App.tsx`

**Files:**
- Modify: `src/components/JournalList.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add `hasMore` and `onLoadMore` props to `JournalList`**

In `src/components/JournalList.tsx`, update the `JournalListProps` interface (line 8-14):

```typescript
interface JournalListProps {
  entries: JournalEntry[]
  loading?: boolean
  selectedPath: string | null
  onSelect: (entry: JournalEntry) => void
  onProcess?: (entry: JournalEntry) => void
  hasMore?: boolean
  onLoadMore?: () => void
}
```

Update the destructured props in the function signature:

```typescript
export function JournalList({ entries, loading, selectedPath, onSelect, onProcess, hasMore, onLoadMore }: JournalListProps) {
```

- [ ] **Step 2: Add load-more button at the end of the list**

In `JournalList`, after the `entries.length === 0` empty state block and before the closing `</div>` of the scroll container, add:

```tsx
        {hasMore && (
          <div style={{ padding: '20px 16px 8px', textAlign: 'center' }}>
            <button
              onClick={onLoadMore}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px 8px',
                fontSize: 'var(--text-xs)',
                color: 'var(--item-meta)',
                cursor: 'pointer',
                letterSpacing: '0.04em',
                transition: 'color 0.15s ease-out',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--item-meta)')}
            >
              {t('loadMore')}
            </button>
          </div>
        )}
```

- [ ] **Step 3: Wire up in `App.tsx`**

In `src/App.tsx`, update the `useJournal` destructuring (around line 22) to include `hasMore` and `loadMore`:

```typescript
  const { entries, loading, queueItems, isProcessing, hasMore, loadMore, dismissQueueItem, addConvertingItem, addQueuedItem, markItemFailed, retryQueueItem, refresh } = useJournal()
```

Update the `<JournalList>` usage (around line 459) to pass the new props:

```tsx
                  <JournalList
                    entries={entries}
                    loading={loading}
                    selectedPath={selectedEntry?.path ?? null}
                    onSelect={setSelectedEntry}
                    onProcess={(entry) => {
                      const rel = `${entry.year_month}/${entry.filename}`
                      setDockAppendText(`@${rel}`)
                    }}
                    hasMore={hasMore}
                    onLoadMore={loadMore}
                  />
```

- [ ] **Step 4: Run frontend build check**

Run: `cd /Users/yanwu/Projects/github/journal && npm run build`
Expected: No TypeScript errors.

- [ ] **Step 5: Run existing tests**

Run: `cd /Users/yanwu/Projects/github/journal && npm test`
Expected: All existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/JournalList.tsx src/App.tsx
git commit -m "feat(journal): add load-more button to journal list"
```

---

### Task 5: Manual smoke test

- [ ] **Step 1: Start the dev server**

User runs: `npm run tauri dev`

- [ ] **Step 2: Verify initial load**

- App loads and shows entries from the most recent 3 months only
- If workspace has fewer than 3 months, all entries show and no button appears

- [ ] **Step 3: Verify load-more button**

- If more than 3 months of data exist, a "加载更早的记录" button appears at the bottom of the list
- Clicking it loads the next 3 months
- Button disappears when all months are loaded

- [ ] **Step 4: Verify AI processing still works**

- Submit a file or recording
- New entry appears in the list after processing completes
- 3-second polling refreshes correctly

- [ ] **Step 5: Verify workspace switch**

- Switch workspace in settings
- List resets and loads the new workspace's recent 3 months
