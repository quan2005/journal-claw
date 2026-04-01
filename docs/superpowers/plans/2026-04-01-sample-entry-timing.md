# Sample Entry Timing & Guide Button Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix sample entry insertion timing (insert only when workspace has no .md files) and replace the「看示例条目」button (shown when sample exists) with a「创建示例条目」button (shown when workspace is empty, creates the sample on click).

**Architecture:** Two independent changes — (1) Rust `create_sample_entry_if_needed` gains a workspace-empty pre-check before writing; (2) Frontend `DetailPanel` empty-state logic flips from "show button when sample exists" to "show button when entries list is empty, create on click."

**Tech Stack:** Rust (Tauri command), React + TypeScript (DetailPanel, App.tsx), Vitest (frontend tests), cargo test (Rust tests).

---

## Files

- Modify: `src-tauri/src/journal.rs` — `create_sample_entry_if_needed` adds workspace-empty check
- Modify: `src/components/DetailPanel.tsx` — replace `hasSample` logic with `entries.length === 0` + new button
- Modify: `src/App.tsx` — `onSelectSample` callback calls `createSampleEntryIfNeeded()` then refresh + select
- Modify: `src/tests/DetailPanel.test.tsx` — update tests to match new behavior

---

## Task 1: Update Rust — workspace-empty guard in `create_sample_entry_if_needed`

**Files:**
- Modify: `src-tauri/src/journal.rs:324-341`

### Background

`create_sample_entry_if_needed` currently inserts the sample if `!cfg.sample_entry_created`. We need to also check that the workspace contains no `.md` files across all `yyMM/` directories. If the workspace already has `.md` files, return `false` without setting the flag (so a later fresh start still can't re-insert).

The workspace layout is:
```
workspace/
  yyMM/       ← 4-digit all-numeric directory names
    raw/      ← skip this subdirectory
    DD-title.md
```

We need a helper `workspace_has_any_md` that walks only the top-level `yyMM/` directories (skipping `raw/`) and returns `true` if any `.md` file is found.

- [ ] **Step 1: Write the failing Rust test**

In `src-tauri/src/journal.rs`, inside the `#[cfg(test)] mod tests` block, add:

```rust
#[test]
fn create_sample_skips_when_md_exists() {
    // workspace already has a .md file → function should return Ok(false) and NOT set flag
    // We test the helper directly since the command needs AppHandle.
    let tmp = std::env::temp_dir().join(format!(
        "journal_skip_test_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let ws = tmp.to_str().unwrap();
    // Create a yyMM dir with an existing .md file
    let ym_dir = tmp.join("2604");
    std::fs::create_dir_all(&ym_dir).unwrap();
    std::fs::write(ym_dir.join("01-existing.md"), "# hi").unwrap();
    // Helper should report the workspace is NOT empty
    assert!(workspace_has_any_md(ws), "should detect existing .md");
    std::fs::remove_dir_all(&tmp).ok();
}

#[test]
fn create_sample_proceeds_when_no_md_exists() {
    let tmp = std::env::temp_dir().join(format!(
        "journal_empty_test_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let ws = tmp.to_str().unwrap();
    // Workspace dir exists but has no yyMM dirs
    std::fs::create_dir_all(&tmp).unwrap();
    assert!(!workspace_has_any_md(ws), "empty workspace should return false");
    std::fs::remove_dir_all(&tmp).ok();
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd src-tauri && cargo test create_sample_skips_when_md_exists create_sample_proceeds_when_no_md_exists 2>&1 | tail -20
```

Expected: compile error — `workspace_has_any_md` not found.

- [ ] **Step 3: Add `workspace_has_any_md` helper and update `create_sample_entry_if_needed`**

In `src-tauri/src/journal.rs`, add the helper just before `create_sample_entry_if_needed`:

```rust
/// Returns true if the workspace contains at least one .md file in any yyMM/ directory.
/// Raw materials (in raw/) are ignored. Non-existent workspace returns false.
fn workspace_has_any_md(workspace: &str) -> bool {
    use crate::workspace;
    let ws_path = std::path::PathBuf::from(workspace);
    if !ws_path.exists() {
        return false;
    }
    let Ok(read_dir) = std::fs::read_dir(&ws_path) else {
        return false;
    };
    for entry in read_dir.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        // Only 4-digit all-numeric dirs (yyMM format)
        if name.len() != 4 || !name.chars().all(|c| c.is_ascii_digit()) {
            continue;
        }
        let ym_dir = workspace::year_month_dir(workspace, &name);
        let Ok(inner) = std::fs::read_dir(&ym_dir) else {
            continue;
        };
        for file in inner.flatten() {
            let fname = file.file_name().to_string_lossy().to_string();
            if fname.ends_with(".md") {
                return true;
            }
        }
    }
    false
}
```

Then update `create_sample_entry_if_needed` — replace the body after the `sample_entry_created` check:

```rust
#[tauri::command]
pub fn create_sample_entry_if_needed(app: AppHandle) -> Result<bool, String> {
    use crate::config;
    use crate::workspace;
    use chrono::Datelike;
    let mut cfg = config::load_config(&app)?;
    if cfg.sample_entry_created {
        return Ok(false);
    }
    if cfg.workspace_path.is_empty() {
        return Ok(false);
    }
    // Only insert if workspace has no existing .md files
    if workspace_has_any_md(&cfg.workspace_path) {
        return Ok(false);
    }
    let year_month = workspace::current_year_month();
    let day = chrono::Local::now().day();
    write_sample_entry(&cfg.workspace_path, &year_month, day)?;
    cfg.sample_entry_created = true;
    config::save_config(&app, &cfg)?;
    Ok(true)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd src-tauri && cargo test create_sample_skips_when_md_exists create_sample_proceeds_when_no_md_exists 2>&1 | tail -20
```

Expected: both tests PASS.

- [ ] **Step 5: Run full Rust test suite**

```bash
cd src-tauri && cargo test 2>&1 | tail -20
```

Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/journal.rs
git commit -m "feat(rust): skip sample entry insertion when workspace already has .md files"
```

---

## Task 2: Update frontend tests for new button behavior

**Files:**
- Modify: `src/tests/DetailPanel.test.tsx`

### Background

Current tests check that the「看示例条目」button appears when a sample entry exists in `entries`. The new behavior is:
- Show「创建示例条目」button when `entries.length === 0`
- Do NOT show it when `entries` has any entries

We update the tests to match before touching the component (TDD).

- [ ] **Step 1: Update the test file**

Replace the contents of `src/tests/DetailPanel.test.tsx` with:

```tsx
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DetailPanel } from '../components/DetailPanel'
import type { JournalEntry } from '../types'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

vi.mock('../lib/tauri', () => ({
  getJournalEntryContent: vi.fn().mockResolvedValue('# Test'),
  createSampleEntryIfNeeded: vi.fn().mockResolvedValue(false),
}))

describe('empty state guidance cards', () => {
  const baseProps = {
    entry: null as JournalEntry | null,
    onDeselect: vi.fn(),
    onRecord: vi.fn(),
    onOpenDock: vi.fn(),
    onSelectSample: vi.fn(),
  }

  const fakeEntry: JournalEntry = {
    filename: '01-test.md', path: '/ws/2604/01-test.md',
    title: 'test', summary: '', tags: [], year_month: '2604',
    day: 1, created_time: '10:00', mtime_secs: 0, materials: [],
  }

  it('shows recording and paste cards when entries is empty', () => {
    render(<DetailPanel {...baseProps} entries={[]} />)
    expect(screen.getByText('录音记录')).toBeTruthy()
    expect(screen.getByText('粘贴 / 拖文件')).toBeTruthy()
  })

  it('shows 创建示例条目 card when entries is empty', () => {
    render(<DetailPanel {...baseProps} entries={[]} />)
    expect(screen.getByText('创建示例条目')).toBeTruthy()
  })

  it('does not show 创建示例条目 card when entries exist', () => {
    render(<DetailPanel {...baseProps} entries={[fakeEntry]} />)
    expect(screen.queryByText('创建示例条目')).toBeNull()
  })

  it('shows recording and paste cards whenever no entry is selected', () => {
    render(<DetailPanel {...baseProps} entries={[fakeEntry]} />)
    expect(screen.getByText('录音记录')).toBeTruthy()
    expect(screen.getByText('粘贴 / 拖文件')).toBeTruthy()
  })

  it('calls onRecord when 录音记录 card is clicked', () => {
    const onRecord = vi.fn()
    render(<DetailPanel {...baseProps} entries={[]} onRecord={onRecord} />)
    fireEvent.click(screen.getByText('录音记录').closest('button')!)
    expect(onRecord).toHaveBeenCalledOnce()
  })

  it('calls onOpenDock when paste card is clicked', () => {
    const onOpenDock = vi.fn()
    render(<DetailPanel {...baseProps} entries={[]} onOpenDock={onOpenDock} />)
    fireEvent.click(screen.getByText('粘贴 / 拖文件').closest('button')!)
    expect(onOpenDock).toHaveBeenCalledOnce()
  })

  it('calls onSelectSample when 创建示例条目 card is clicked', () => {
    const onSelectSample = vi.fn()
    render(<DetailPanel {...baseProps} entries={[]} onSelectSample={onSelectSample} />)
    fireEvent.click(screen.getByText('创建示例条目').closest('button')!)
    expect(onSelectSample).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/tests/DetailPanel.test.tsx 2>&1 | tail -30
```

Expected: failures on the new「创建示例条目」tests (button doesn't exist yet).

- [ ] **Step 3: Commit failing tests**

```bash
git add src/tests/DetailPanel.test.tsx
git commit -m "test: update DetailPanel tests for empty-workspace sample button behavior"
```

---

## Task 3: Update `DetailPanel` component

**Files:**
- Modify: `src/components/DetailPanel.tsx:156-248`

### Background

Replace:
- `const hasSample = entries.some(e => e.title === '产品评审示例')` with `const isEmpty = entries.length === 0`
- `{hasSample && <button>看示例条目</button>}` with `{isEmpty && <button>创建示例条目</button>}`
- Button text: 「看示例条目」→「创建示例条目」
- Sub-text: 「先了解 AI 整理↵结果长什么样」→「生成一条示例↵了解 AI 整理效果」

The `onSelectSample` prop name stays unchanged (renaming is not needed and would break App.tsx).

- [ ] **Step 1: Edit `DetailPanel.tsx` — replace hasSample block**

In `src/components/DetailPanel.tsx`, replace lines 157–247 (the `if (!entry)` return block internals):

Old:
```tsx
  if (!entry) {
    const hasSample = entries.some(e => e.title === '产品评审示例')
    return (
```

New:
```tsx
  if (!entry) {
    const isEmpty = entries.length === 0
    return (
```

Then replace the sample card block (the `{hasSample && (...)}` section):

Old:
```tsx
            {/* 看示例卡片：只在示例条目实际存在时显示 */}
            {hasSample && (
              <button
                onClick={onSelectSample}
                style={{
                  flex: 1, background: 'var(--detail-bg)',
                  border: '1px dashed var(--divider)', borderStyle: 'dashed',
                  borderRadius: 10, padding: '16px 12px', textAlign: 'center', cursor: 'pointer',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.borderStyle = 'solid'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--item-hover-bg)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--divider)'; (e.currentTarget as HTMLButtonElement).style.borderStyle = 'dashed'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--detail-bg)' }}
              >
                <div style={{ fontSize: 24, marginBottom: 8 }}>✨</div>
                <div style={{ fontSize: 11, color: 'var(--item-text)', fontWeight: 600, marginBottom: 4 }}>看示例条目</div>
                <div style={{ fontSize: 10, color: 'var(--item-meta)', lineHeight: 1.6 }}>先了解 AI 整理<br/>结果长什么样</div>
              </button>
            )}
```

New:
```tsx
            {/* 创建示例卡片：只在工作目录为空时显示 */}
            {isEmpty && (
              <button
                onClick={onSelectSample}
                style={{
                  flex: 1, background: 'var(--detail-bg)',
                  border: '1px dashed var(--divider)', borderStyle: 'dashed',
                  borderRadius: 10, padding: '16px 12px', textAlign: 'center', cursor: 'pointer',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.borderStyle = 'solid'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--item-hover-bg)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--divider)'; (e.currentTarget as HTMLButtonElement).style.borderStyle = 'dashed'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--detail-bg)' }}
              >
                <div style={{ fontSize: 24, marginBottom: 8 }}>✨</div>
                <div style={{ fontSize: 11, color: 'var(--item-text)', fontWeight: 600, marginBottom: 4 }}>创建示例条目</div>
                <div style={{ fontSize: 10, color: 'var(--item-meta)', lineHeight: 1.6 }}>生成一条示例<br/>了解 AI 整理效果</div>
              </button>
            )}
```

- [ ] **Step 2: Run frontend tests**

```bash
npx vitest run src/tests/DetailPanel.test.tsx 2>&1 | tail -30
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/DetailPanel.tsx
git commit -m "feat(ui): show 创建示例条目 button when workspace is empty instead of when sample exists"
```

---

## Task 4: Update `App.tsx` — `onSelectSample` callback creates sample

**Files:**
- Modify: `src/App.tsx:376-379`

### Background

Currently `onSelectSample` just finds the existing sample in `entries` and selects it. Now it must:
1. Call `createSampleEntryIfNeeded()` (Rust command)
2. Await `refresh()` to reload entries
3. Fetch the full list via `listAllJournalEntries()` and select the sample entry

This mirrors the existing startup logic at `App.tsx:80-86`.

Note: `createSampleEntryIfNeeded` and `listAllJournalEntries` are already imported at line 14.

- [ ] **Step 1: Update `onSelectSample` callback in `App.tsx`**

Find and replace in `src/App.tsx`:

Old:
```tsx
                  onSelectSample={() => {
                    const sample = entries.find(e => e.title === '产品评审示例')
                    if (sample) setSelectedEntry(sample)
                  }}
```

New:
```tsx
                  onSelectSample={() => {
                    createSampleEntryIfNeeded().then(async () => {
                      await refresh()
                      const all = await listAllJournalEntries()
                      const sample = all.find(e => e.title === '产品评审示例')
                      if (sample) setSelectedEntry(sample)
                    }).catch(() => {})
                  }}
```

- [ ] **Step 2: Run full frontend test suite**

```bash
npm test 2>&1 | tail -30
```

Expected: all tests PASS.

- [ ] **Step 3: Run TypeScript build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): onSelectSample creates sample entry if needed then refreshes and selects"
```

---

## Self-Review

**Spec coverage:**
- ✅ Rust: `create_sample_entry_if_needed` skips insertion when workspace has `.md` files
- ✅ Rust: flag logic unchanged (won't re-insert after first successful insert)
- ✅ Frontend: button shown only when `entries.length === 0`
- ✅ Frontend: button text updated to「创建示例条目」
- ✅ Frontend: button click creates sample, refreshes, selects
- ✅ Tests updated for all changed behavior

**Placeholder scan:** None found.

**Type consistency:**
- `onSelectSample: () => void` — consistent across `DetailPanelProps`, `baseProps` in tests, and `App.tsx` callback
- `createSampleEntryIfNeeded(): Promise<boolean>` — used in Task 1 (Rust) and Task 4 (App.tsx); return value ignored in App.tsx (`.then(async () => ...)` — correct)
- `workspace_has_any_md(workspace: &str) -> bool` — defined and used only in `journal.rs`
