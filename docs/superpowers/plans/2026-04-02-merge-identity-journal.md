# Merge Identity & Journal into Left Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the standalone IdentityView into the main journal view by adding a Segmented Control (icon + text) at the top of the left sidebar, allowing users to switch between journal list and identity list without leaving the page.

**Architecture:** Replace the tri-state `view` (`journal | settings | identity`) with a bi-state `view` (`journal | settings`) plus a new `sidebarTab` state (`journal | identity`) that controls which list renders in the left panel and which detail component renders on the right. Identity-related state (useIdentity hook, selectedIdentity, mergeSource, handleDelete) moves from the deleted IdentityView into App.tsx.

**Tech Stack:** React, TypeScript, Tauri v2, inline styles with CSS custom properties

**Spec:** `docs/superpowers/specs/2026-04-02-merge-identity-journal-design.md`

---

### Task 1: Add CSS variables for Segmented Control

**Files:**
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Add segment variables to light theme (`:root`)**

After the existing `--card-selected-bar` line (~line 28), add:

```css
  --segment-bg: rgba(128,128,128,0.06);
  --segment-active-bg: rgba(74,106,122,0.10);
  --segment-text: #6a7278;
  --segment-active-text: var(--record-btn);
```

- [ ] **Step 2: Add segment variables to dark media query**

Inside the `@media (prefers-color-scheme: dark)` block for `:root`, after the `--record-btn-icon` line (~line 139), add:

```css
    --segment-bg: rgba(128,128,128,0.08);
    --segment-active-bg: rgba(200,147,58,0.12);
    --segment-text: #666;
    --segment-active-text: #C8933B;
```

- [ ] **Step 3: Add segment variables to `[data-theme="dark"]`**

Inside `[data-theme="dark"]`, after `--record-btn-icon` (~line 251), add:

```css
  --segment-bg: rgba(128,128,128,0.08);
  --segment-active-bg: rgba(200,147,58,0.12);
  --segment-text: #666;
  --segment-active-text: #C8933B;
```

- [ ] **Step 4: Add segment variables to `[data-theme="light"]`**

Inside `[data-theme="light"]`, find the block and add after its `--record-btn-icon`:

```css
  --segment-bg: rgba(128,128,128,0.06);
  --segment-active-bg: rgba(74,106,122,0.10);
  --segment-text: #6a7278;
  --segment-active-text: var(--record-btn);
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/styles/globals.css
git commit -m "feat: add CSS variables for sidebar segmented control"
```

---

### Task 2: Create SidebarTabs component

**Files:**
- Create: `src/components/SidebarTabs.tsx`

- [ ] **Step 1: Create the component file**

```tsx
export type SidebarTab = 'journal' | 'identity'

interface SidebarTabsProps {
  active: SidebarTab
  onChange: (tab: SidebarTab) => void
}

export function SidebarTabs({ active, onChange }: SidebarTabsProps) {
  const btnStyle = (tab: SidebarTab): React.CSSProperties => ({
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    fontSize: 11,
    fontWeight: 500,
    padding: '5px 0',
    borderRadius: 4,
    color: active === tab ? 'var(--segment-active-text)' : 'var(--segment-text)',
    background: active === tab ? 'var(--segment-active-bg)' : 'transparent',
    cursor: 'pointer',
    fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
    letterSpacing: '0.03em',
    border: 'none',
    transition: 'color 0.15s, background 0.15s',
  })

  return (
    <div style={{
      display: 'flex',
      margin: '10px 12px 4px',
      background: 'var(--segment-bg)',
      borderRadius: 6,
      padding: 2,
      flexShrink: 0,
    }}>
      <button style={btnStyle('journal')} onClick={() => onChange('journal')}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        日志
      </button>
      <button style={btnStyle('identity')} onClick={() => onChange('identity')}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
        人设
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds (component not yet used, just compiled).

- [ ] **Step 3: Commit**

```bash
git add src/components/SidebarTabs.tsx
git commit -m "feat: add SidebarTabs segmented control component"
```

---

### Task 3: Simplify TitleBar — remove identity button

**Files:**
- Modify: `src/components/TitleBar.tsx`

- [ ] **Step 1: Remove identity-related props and button**

Replace the entire `TitleBar.tsx` with:

```tsx
import type { Theme } from '../types'
import { ThemeToggle } from './ThemeToggle'
import { AiStatusPill } from './AiStatusPill'

interface TitleBarProps {
  theme: Theme
  onThemeChange: (theme: Theme) => void
  isProcessing: boolean
  processingFilename?: string
  onLogClick?: () => void
  view: 'journal' | 'settings'
  todoOpen: boolean
  todoCount: number
  onToggleTodo: () => void
}

export function TitleBar({ theme, onThemeChange, isProcessing, processingFilename, onLogClick, view, todoOpen, todoCount, onToggleTodo }: TitleBarProps) {
  return (
    <div
      data-tauri-drag-region
      style={{
        height: 38,
        background: 'var(--titlebar-bg)',
        flexShrink: 0,
        paddingLeft: 70,
        paddingRight: 16,
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        borderBottom: '0.5px solid var(--divider)',
      }}
    >
      {/* Left: empty */}
      <div />

      {/* Center: title or AI status */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {view === 'settings' ? (
          <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--item-text)' }}>设置</span>
        ) : (
          <AiStatusPill isProcessing={isProcessing} processingFilename={processingFilename} onLogClick={onLogClick} />
        )}
      </div>

      {/* Right: theme toggle + todo button */}
      <div style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: 8 }}>
        {view !== 'settings' && <ThemeToggle theme={theme} onChange={onThemeChange} />}
        {view !== 'settings' && (
          <button
            onClick={onToggleTodo}
            title={todoOpen ? '收起待办 (⌘T)' : '待办 (⌘T)'}
            style={{
              background: todoOpen ? 'rgba(200,147,58,0.12)' : 'none',
              border: 'none', cursor: 'pointer',
              color: todoOpen ? 'var(--record-btn)' : 'var(--item-meta)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 24, height: 24, padding: 0, borderRadius: 4, lineHeight: 1,
              opacity: todoOpen ? 1 : 0.6,
              position: 'relative' as const,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            {!todoOpen && todoCount > 0 && (
              <span style={{
                position: 'absolute' as const, top: -2, right: -4,
                background: 'var(--record-btn)', color: 'var(--bg)',
                fontSize: 8, fontWeight: 700,
                width: 14, height: 14, borderRadius: 7,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{todoCount > 9 ? '9+' : todoCount}</span>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
```

Key changes:
- `view` type: `'journal' | 'settings'` (removed `'identity'`)
- Removed `onToggleIdentity` prop
- Removed the identity (person icon) button entirely
- ThemeToggle and Todo button show when `view !== 'settings'` (previously `view === 'journal'`, but now there's no identity view)

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build fails with type errors in App.tsx (it still passes `onToggleIdentity` and `view: 'identity'`). This is expected — we fix App.tsx in the next task.

- [ ] **Step 3: Commit**

```bash
git add src/components/TitleBar.tsx
git commit -m "refactor: remove identity button from TitleBar"
```

---

### Task 4: Rewrite App.tsx — merge identity into left sidebar

**Files:**
- Modify: `src/App.tsx`

This is the main integration task. Changes:
1. Add `useIdentity` hook and identity state
2. Replace `view: 'journal' | 'settings' | 'identity'` with `view: 'journal' | 'settings'`
3. Add `sidebarTab` state
4. Add SidebarTabs to left panel
5. Conditionally render JournalList or IdentityList in left panel
6. Conditionally render DetailPanel or IdentityDetail in right panel
7. Remove IdentityView import and branch
8. Remove ⌘P keyboard handler
9. Remove `onToggleIdentity` prop from TitleBar

- [ ] **Step 1: Update imports**

Replace line 10 (`import IdentityView from './components/IdentityView'`) with:

```tsx
import { IdentityList, SOUL_PATH } from './components/IdentityList'
import { IdentityDetail } from './components/IdentityDetail'
import { MergeIdentityDialog } from './components/MergeIdentityDialog'
import { SidebarTabs } from './components/SidebarTabs'
import type { SidebarTab } from './components/SidebarTabs'
import { useIdentity } from './hooks/useIdentity'
import { deleteIdentity } from './lib/tauri'
```

Update the types import on line 18 to include `IdentityEntry`:

```tsx
import type { JournalEntry, QueueItem, IdentityEntry } from './types'
```

- [ ] **Step 2: Add identity state and hook inside App()**

After the `useTodos` line (line 27), add:

```tsx
  const { identities, loading: identityLoading, refresh: refreshIdentity } = useIdentity()
```

After the `todoOpen` state (line 40), add:

```tsx
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('journal')
  const [selectedIdentity, setSelectedIdentity] = useState<IdentityEntry | null>(null)
  const [mergeSource, setMergeSource] = useState<IdentityEntry | null>(null)
```

- [ ] **Step 3: Change view type and remove ⌘P handler**

Change line 32 from:

```tsx
  const [view, setView] = useState<'journal' | 'settings' | 'identity'>('journal')
```

to:

```tsx
  const [view, setView] = useState<'journal' | 'settings'>('journal')
```

In the keyboard handler useEffect (~lines 175-194), remove the ⌘P block (lines 183-186):

```tsx
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault()
        setView(v => v === 'identity' ? 'journal' : 'identity')
      }
```

- [ ] **Step 4: Add virtual Soul entry and identity handlers**

Before the `return` statement (~line 342), add:

```tsx
  // Virtual Soul entry for identity list
  const SOUL_ENTRY: IdentityEntry = {
    filename: '__soul__',
    path: SOUL_PATH,
    name: '助理',
    region: '',
    summary: '定义谨迹的角色与工作偏好',
    tags: [],
    speaker_id: '',
    mtime_secs: 0,
  }
  const allIdentities: IdentityEntry[] = [SOUL_ENTRY, ...identities]

  const handleDeleteIdentity = async (identity: IdentityEntry) => {
    if (!window.confirm(`确认删除「${identity.name}」的档案？`)) return
    try {
      await deleteIdentity(identity.path)
      if (selectedIdentity?.path === identity.path) setSelectedIdentity(null)
      refreshIdentity()
    } catch (e) {
      console.error('[App] identity delete failed', e)
    }
  }
```

- [ ] **Step 5: Update TitleBar props**

Replace the TitleBar JSX (~lines 344-355) with:

```tsx
      <TitleBar
        theme={theme}
        onThemeChange={setTheme}
        isProcessing={isProcessing}
        processingFilename={processingFilename}
        onLogClick={processingPath ? () => setActiveLogPath(processingPath) : undefined}
        view={view}
        todoOpen={todoOpen}
        todoCount={todos.filter(t => !t.done).length}
        onToggleTodo={() => setTodoOpen(prev => !prev)}
      />
```

(Removed `onToggleIdentity` prop)

- [ ] **Step 6: Remove IdentityView branch, rewrite left panel**

Remove the entire `view === 'identity'` branch (~lines 361-366):

```tsx
      ) : view === 'identity' ? (
        <IdentityView
          baseWidth={baseWidth}
          dividerWidth={DIVIDER_WIDTH}
          onDividerMouseDown={onDividerMouseDown}
        />
```

Replace the left panel column (the `<div>` containing `<JournalList>`, ~lines 370-378) with:

```tsx
            <div style={{ width: baseWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '0.5px solid var(--divider)' }}>
              <SidebarTabs active={sidebarTab} onChange={setSidebarTab} />
              {sidebarTab === 'journal' ? (
                <JournalList
                  entries={entries}
                  loading={loading}
                  selectedPath={selectedEntry?.path ?? null}
                  onSelect={setSelectedEntry}
                />
              ) : (
                <IdentityList
                  identities={allIdentities}
                  loading={identityLoading}
                  selectedPath={selectedIdentity?.path ?? null}
                  onSelect={identity => setSelectedIdentity(identity)}
                  onMerge={identity => setMergeSource(identity)}
                  onDelete={handleDeleteIdentity}
                />
              )}
            </div>
```

- [ ] **Step 7: Rewrite right panel to be tab-aware**

Replace the right panel `<div>` containing `<DetailPanel>` (~lines 389-406) with:

```tsx
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {sidebarTab === 'journal' ? (
                <DetailPanel
                  entry={selectedEntry}
                  entries={entries}
                  onDeselect={() => setSelectedEntry(null)}
                  onRecord={handleRecord}
                  onOpenDock={() => setDockOpen(true)}
                  onSelectSample={() => {
                    createSampleEntry().then(async () => {
                      await refresh()
                      const all = await listAllJournalEntries()
                      const sample = all.find(e => e.title === '产品评审示例')
                      if (sample) setSelectedEntry(sample)
                    }).catch(() => {})
                  }}
                />
              ) : (
                <IdentityDetail identity={selectedIdentity} />
              )}
            </div>
```

- [ ] **Step 8: Hide todo sidebar when on identity tab**

Change the todo sidebar condition (~line 409) from:

```tsx
            {todoOpen && (
```

to:

```tsx
            {todoOpen && sidebarTab === 'journal' && (
```

- [ ] **Step 9: Add MergeIdentityDialog before closing tags**

Right before the closing `</>` of the journal view branch (before the `<div style={{ position: 'relative', flexShrink: 0 }}>` block), add:

```tsx
          {mergeSource && (
            <MergeIdentityDialog
              source={mergeSource}
              onClose={() => setMergeSource(null)}
              onMerged={() => {
                setMergeSource(null)
                if (selectedIdentity?.path === mergeSource.path) setSelectedIdentity(null)
                refreshIdentity()
              }}
            />
          )}
```

- [ ] **Step 10: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 11: Commit**

```bash
git add src/App.tsx
git commit -m "feat: merge identity list into left sidebar with segmented control"
```

---

### Task 5: Delete IdentityView component

**Files:**
- Delete: `src/components/IdentityView.tsx`

- [ ] **Step 1: Delete the file**

```bash
rm src/components/IdentityView.tsx
```

- [ ] **Step 2: Check for any remaining references**

Run: `grep -r "IdentityView" src/`
Expected: No results.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -u src/components/IdentityView.tsx
git commit -m "chore: remove unused IdentityView component"
```

---

### Task 6: Manual smoke test

**Files:** None (testing only)

- [ ] **Step 1: Start dev server**

Run: `npm run tauri dev`

- [ ] **Step 2: Verify segmented control renders**

Expected: Left sidebar shows a segmented control at top with document icon + "日志" (active, amber/teal highlight) and person icon + "人设" (inactive, muted).

- [ ] **Step 3: Click "人设" tab**

Expected:
- Left panel switches to identity list (shows "内置" section with AI 助理 and 我, plus any real identity entries grouped by region)
- Right panel shows "选择一个身份档案" empty state
- Segmented control highlights "人设" tab

- [ ] **Step 4: Select an identity**

Expected: Right panel shows IdentityDetail with toolbar (name, edit/save button), read-mode markdown content.

- [ ] **Step 5: Click "日志" tab**

Expected:
- Left panel switches back to journal list
- Previously selected journal entry (if any) is still selected
- Right panel shows DetailPanel

- [ ] **Step 6: Verify TitleBar**

Expected:
- No person icon button in TitleBar right area
- ThemeToggle and Todo button still present
- AiStatusPill in center

- [ ] **Step 7: Verify keyboard shortcuts**

Expected:
- ⌘P does NOT toggle identity view (should do nothing or browser default)
- ⌘, still opens settings
- ⌘T still toggles todo sidebar (only visible on journal tab)
- Esc still closes settings

- [ ] **Step 8: Verify todo sidebar**

Expected:
- Todo sidebar shows on journal tab when ⌘T pressed
- Switching to identity tab hides todo sidebar
- Switching back to journal tab: todo sidebar reappears if it was open

- [ ] **Step 9: Test identity context menu**

Expected:
- Right-click identity in list shows context menu (merge, copy content, copy path, finder, delete)
- Actions work correctly

- [ ] **Step 10: Test merge dialog**

Expected:
- "合并到…" from context menu opens MergeIdentityDialog
- Merge completes and refreshes identity list

- [ ] **Step 11: Verify light theme**

Toggle to light theme.
Expected: Segmented control uses teal accent (`#4a6a7a`-family) instead of amber.

- [ ] **Step 12: Commit any fixes needed, then final commit**

```bash
git add -A
git commit -m "test: verify merged identity/journal sidebar"
```
