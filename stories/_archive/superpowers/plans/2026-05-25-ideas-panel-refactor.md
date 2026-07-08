# Ideas Panel Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move "想法" (ideas/todos) from right panel tab into a permanent left sidebar entry, displaying todo list in center DetailView, simplifying RightPanel to chat-only.

**Architecture:** Follows existing TreeSelection → DetailView pattern. A new `'ideas'` TreeNodeType routes through the same select/deselect mechanism. App.tsx tracks `previousSelection` to restore on deselect. TodoSidebar renders in DetailView when ideas is selected.

**Tech Stack:** React 19 + TypeScript, no new dependencies

---

### Task 1: Add `'ideas'` to TreeNodeType

**Files:**

- Modify: `src/types.ts:206-212`

- [ ] **Step 1: Add `'ideas'` to the union type**

```typescript
// src/types.ts, lines 206-212
export type TreeNodeType =
  | 'pinned-section'
  | 'identity'
  | 'journal'
  | 'journal-month'
  | 'topic'
  | 'topic-file'
  | 'ideas'
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors related to TreeNodeType

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add 'ideas' to TreeNodeType for ideas panel routing

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: Simplify RightPanel to chat-only

**Files:**

- Modify: `src/components/RightPanel.tsx` (entire file)

- [ ] **Step 1: Rewrite RightPanel to remove tab system**

Replace the entire file content:

```typescript
import { type ReactNode } from 'react'
import { HistoryFloatingButton } from './HistoryFloatingButton'

interface RightPanelProps {
  chatContent: ReactNode
  chatInputBar?: ReactNode
  activeSessionId?: string | null
  onHistorySelect?: (id: string) => void
}

export function RightPanel({
  chatContent,
  chatInputBar,
  activeSessionId,
  onHistorySelect,
}: RightPanelProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {onHistorySelect && (
          <HistoryFloatingButton
            activeSessionId={activeSessionId ?? null}
            onSelect={onHistorySelect}
          />
        )}
        {chatContent}
      </div>
      {chatInputBar}
    </div>
  )
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors in RightPanel.tsx

- [ ] **Step 3: Commit**

```bash
git add src/components/RightPanel.tsx
git commit -m "refactor: simplify RightPanel to chat-only, remove ideas tab

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: Add ideas entry to TreeSidebar

**Files:**

- Modify: `src/components/TreeSidebar.tsx:13-26` (props interface)
- Modify: `src/components/TreeSidebar.tsx:188-196` (component function signature)
- Modify: `src/components/TreeSidebar.tsx:340-403` (render, before pinned section)

- [ ] **Step 1: Add new props to TreeSidebarProps interface**

```typescript
// src/components/TreeSidebar.tsx, replace lines 13-26
interface TreeSidebarProps {
  selected: TreeSelection | null
  onSelect: (sel: TreeSelection) => void
  onDeselect: () => void
  entries: JournalEntry[]
  identities: IdentityEntry[]
  identityLoading: boolean
  loadingMore: boolean
  hasMore: boolean
  onLoadMore: () => void
  onAtRef: (path: string) => void
  todayYearMonth: string
  todayDay: number
  ideasCount: number
  onSelectIdeas: () => void
}
```

- [ ] **Step 2: Destructure new props in component function**

```typescript
// src/components/TreeSidebar.tsx, replace lines 188-201
export function TreeSidebar({
  selected,
  onSelect,
  onDeselect,
  entries,
  identities,
  identityLoading,
  loadingMore,
  hasMore,
  onLoadMore,
  onAtRef,
  todayYearMonth,
  todayDay,
  ideasCount,
  onSelectIdeas,
}: TreeSidebarProps) {
```

- [ ] **Step 3: Add ideas entry before pinned section in render**

Insert before the pinned section (before the `{pinnedItems.length > 0 && (` block at line 345):

```typescript
// src/components/TreeSidebar.tsx, insert at line 342 (inside the scrollable div, before pinned section)
{/* ════════════════════════════════════════════════════════════════════
    Ideas Entry (想法) — permanent, non-collapsible
    ════════════════════════════════════════════════════════════════════ */}
<div
  onClick={onSelectIdeas}
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '12px 6px 8px',
    cursor: 'pointer',
    position: 'sticky' as const,
    top: 0,
    zIndex: 2,
    background: 'var(--sidebar-bg, #131210)',
    borderBottom: selected?.type === 'ideas'
      ? '1px solid var(--accent-border, rgba(184,120,42,0.25))'
      : '1px solid transparent',
    transition: 'background 0.15s ease-out',
  }}
  onMouseEnter={(e) => {
    if (selected?.type !== 'ideas') {
      (e.currentTarget as HTMLElement).style.background = 'var(--item-hover-bg)'
    }
  }}
  onMouseLeave={(e) => {
    if (selected?.type !== 'ideas') {
      (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-bg, #131210)'
    }
  }}
>
  {/* Checkmark icon */}
  <span
    style={{
      display: 'flex',
      alignItems: 'center',
      color: selected?.type === 'ideas'
        ? 'var(--accent, #B8782A)'
        : 'var(--text-secondary, #a0988c)',
    }}
  >
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  </span>

  {/* Label */}
  <span
    style={{
      fontSize: '0.75rem',
      fontWeight: 600,
      color: selected?.type === 'ideas'
        ? 'var(--accent, #B8782A)'
        : 'var(--text-secondary, #a0988c)',
    }}
  >
    想法
  </span>

  {/* Count badge */}
  {ideasCount > 0 && (
    <span
      style={{
        fontSize: '0.6875rem',
        fontWeight: 400,
        color: selected?.type === 'ideas'
          ? 'var(--accent, #B8782A)'
          : 'var(--text-tertiary, #5c5852)',
      }}
    >
      {ideasCount}
    </span>
  )}
</div>
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/TreeSidebar.tsx
git commit -m "feat: add permanent ideas entry at top of TreeSidebar

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: Extend DetailView to handle ideas type

**Files:**

- Modify: `src/components/DetailView.tsx:26-47` (Props interface)
- Modify: `src/components/DetailView.tsx:373-386` (component signature)
- Modify: `src/components/DetailView.tsx:596-616` (computed values + empty state)
- Add import: `src/components/DetailView.tsx:1` (import TodoSidebar)

- [ ] **Step 1: Import TodoSidebar and TodoItem type**

```typescript
// src/components/DetailView.tsx, add after line 2
import type { JournalEntry, IdentityEntry, TodoItem } from '../types'
import { TodoSidebar } from './TodoSidebar'
```

- [ ] **Step 2: Extend DetailViewProps to support ideas mode**

```typescript
// src/components/DetailView.tsx, replace lines 26-47
export interface DetailViewProps {
  type: 'journal' | 'identity' | 'topic-file' | 'ideas'

  // Journal
  entry?: JournalEntry
  entries?: JournalEntry[]

  // Identity
  identity?: IdentityEntry

  // Topic file
  file?: WorkspaceDirEntry

  // Ideas (todo list)
  todos?: TodoItem[]
  onToggleTodo?: (lineIndex: number, checked: boolean, doneFile: boolean) => void
  onAddTodo?: (text: string, due?: string, source?: string, path?: string) => void
  onDeleteTodo?: (lineIndex: number, doneFile: boolean) => void
  onSetTodoDue?: (lineIndex: number, due: string | null, doneFile: boolean) => void
  onUpdateTodoText?: (lineIndex: number, text: string, doneFile: boolean) => void
  onSetTodoPath?: (lineIndex: number, path: string | null, doneFile: boolean) => void
  onRemoveTodoPath?: (lineIndex: number, doneFile: boolean) => void
  onOpenTodoConversation?: (opts: {
    mode: 'chat'
    context: string
    sessionId: string | null
    lineIndex: number
    doneFile: boolean
  }) => void
  onNavigateTodoSource?: (filename: string) => void

  // Shared callbacks (all optional)
  onDeselect?: () => void
  onRecord?: () => void
  onOpenDock?: () => void
  onSelectSample?: () => void
  onAddToTodo?: (text: string, source: string) => void
  onProcess?: (entry: JournalEntry) => void
  onVisualDesign?: (entry: JournalEntry) => void
}
```

- [ ] **Step 3: Destructure new props in component**

```typescript
// src/components/DetailView.tsx, replace lines 373-386
export const DetailView = React.memo(function DetailView({
  type,
  entry,
  entries = [],
  identity,
  file,
  todos,
  onToggleTodo,
  onAddTodo,
  onDeleteTodo,
  onSetTodoDue,
  onUpdateTodoText,
  onSetTodoPath,
  onRemoveTodoPath,
  onOpenTodoConversation,
  onNavigateTodoSource,
  onDeselect,
  onRecord,
  onOpenDock,
  onSelectSample,
  onAddToTodo,
  onProcess,
  onVisualDesign,
}: DetailViewProps) {
```

- [ ] **Step 4: Add ideas mode rendering**

Insert after the `const hasSelection` check (line 614) and before the empty state return (line 616). The ideas mode should render before the `!hasSelection` check:

```typescript
// src/components/DetailView.tsx, insert after line 614 (const hasSelection = ...)
const isIdeasMode = type === 'ideas'

// Ideas mode: render TodoSidebar in center area
if (isIdeasMode) {
  const uncheckedCount = todos?.filter(t => !t.done).length ?? 0
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--detail-bg)',
        overflow: 'hidden',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 20px',
          flexShrink: 0,
          borderBottom: '0.5px solid var(--divider)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--accent, #B8782A)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
            fontWeight: 'var(--font-medium)',
          }}
        >
          想法
        </span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--duration-text)' }}>
          {uncheckedCount} 个待办
        </span>
      </div>

      {/* TodoSidebar content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {todos !== undefined && onToggleTodo && onAddTodo && onDeleteTodo ? (
          <TodoSidebar
            todos={todos}
            onToggle={onToggleTodo}
            onAdd={onAddTodo}
            onDelete={onDeleteTodo}
            onSetDue={onSetTodoDue ?? (() => {})}
            onUpdateText={onUpdateTodoText ?? (() => {})}
            onSetPath={onSetTodoPath ?? (() => {})}
            onRemovePath={onRemoveTodoPath ?? (() => {})}
            onOpenConversation={onOpenTodoConversation}
            onNavigateToSource={onNavigateTodoSource}
          />
        ) : null}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/components/DetailView.tsx
git commit -m "feat: add ideas mode rendering to DetailView with TodoSidebar

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5: Wire App.tsx with previousSelection, ideas routing, and updated RightPanel

**Files:**

- Modify: `src/App.tsx:34-37` (imports)
- Modify: `src/App.tsx:80-83` (add previousSelection state)
- Modify: `src/App.tsx:113-118` (remove rightPanelTab state)
- Modify: `src/App.tsx:475-478` (update handleDeselect)
- Modify: `src/App.tsx:493-498` (update handleAddToTodo)
- Modify: `src/App.tsx:766-793` (DetailView props)
- Modify: `src/App.tsx:830-878` (RightPanel usage)

- [ ] **Step 1: Update imports**

```typescript
// src/App.tsx, line 34: update import
import type { JournalEntry, QueueItem, IdentityEntry, TreeSelection } from './types'
import { RightPanel } from './components/RightPanel'
// Remove: import type { RightPanelTab } from './components/RightPanel'
```

- [ ] **Step 2: Add previousSelection state**

```typescript
// src/App.tsx, after line 83 (after treeSelection state)
const [treeSelection, setTreeSelection] = useState<TreeSelection | null>(null)
const [previousSelection, setPreviousSelection] = useState<TreeSelection | null>(null)
```

- [ ] **Step 3: Remove rightPanelTab state**

```typescript
// src/App.tsx, replace lines 113-118
const [rightPanelOpen, setRightPanelOpen] = useState(true)
const [rightPanelWidth, setRightPanelWidth] = useState<number>(() => {
  const saved = localStorage.getItem('journal_right_panel_width')
  return saved ? parseInt(saved) : 320
})
```

- [ ] **Step 4: Update handleDeselect with previousSelection logic**

```typescript
// src/App.tsx, replace lines 475-478
const handleDeselect = useCallback(() => {
  if (treeSelection?.type === 'ideas') {
    // Restore previous selection when deselecting ideas
    setTreeSelection(previousSelection)
    setPreviousSelection(null)
  } else {
    setSelectedEntry(null)
    setTreeSelection(null)
  }
}, [treeSelection, previousSelection])
```

- [ ] **Step 5: Add handleSelectIdeas callback**

Insert after `handleDeselect` (line 478):

```typescript
const handleSelectIdeas = useCallback(() => {
  if (treeSelection?.type === 'ideas') {
    // Deselect ideas, restore previous
    setTreeSelection(previousSelection)
    setPreviousSelection(null)
  } else {
    // Save current selection and switch to ideas
    setPreviousSelection(treeSelection)
    setTreeSelection({ type: 'ideas', path: '__ideas__' })
  }
}, [treeSelection, previousSelection])
```

- [ ] **Step 6: Update handleSelect to clear previousSelection when selecting non-ideas**

Modify the `handleSelect` passed to TreeSidebar or add a wrapper. Since TreeSidebar receives `onSelect` directly, add a wrapping handler in App.tsx:

```typescript
// src/App.tsx, insert before the return statement, near other callbacks
const handleTreeSelect = useCallback(
  (sel: TreeSelection) => {
    // Clear previousSelection when user navigates to something else
    if (sel.type !== 'ideas') {
      setPreviousSelection(null)
    }
    // Toggle logic: if already selected, deselect
    if (treeSelection?.type === sel.type && treeSelection?.path === sel.path) {
      if (sel.type === 'ideas') {
        setTreeSelection(previousSelection)
        setPreviousSelection(null)
      } else {
        setTreeSelection(null)
        setSelectedEntry(null)
      }
    } else {
      setTreeSelection(sel)
    }
  },
  [treeSelection, previousSelection],
)
```

Wait — TreeSidebar already has internal toggle logic via `handleSelect`. The existing `handleSelect` in TreeSidebar calls `onDeselect` if clicking the same item again, or `onSelect` otherwise. So the flow is:

- TreeSidebar internal `handleSelect` checks if same item → calls `onDeselect`
- Otherwise → calls `onSelect`

For ideas: TreeSidebar has its own `onSelectIdeas` callback that handles the toggle. So we just need `onSelectIdeas` in App.tsx and pass it to TreeSidebar.

Let me re-examine: in Task 3, the ideas entry uses `onClick={onSelectIdeas}` directly (not going through TreeSidebar's internal handleSelect). So `onSelectIdeas` IS the toggle handler. Good.

But we also need to ensure that when a non-ideas item is selected, `previousSelection` is cleared. TreeSidebar's `onSelect` is called, which is `setTreeSelection` directly from App.tsx. We need to wrap it.

Actually, looking at the current App.tsx, `onSelect` is passed as `setTreeSelection` directly (line 667-668):

```typescript
onSelect = { setTreeSelection }
```

We need to change this to a wrapper that also clears `previousSelection` and syncs `selectedEntry` for journal types. Let me look at the actual onSelect in TreeSidebar usage...

Looking at App.tsx line 667: `onSelect={setTreeSelection}`

And TreeSidebar internally:

- `handleSelect` checks if same item → `onDeselect()` else `onSelect(sel)`

So we need to wrap `onSelect` to also clear `previousSelection`. Let me update the plan.

- [ ] **Step 6: Wrap onSelect to clear previousSelection**

```typescript
// src/App.tsx, replace the onSelect prop passed to TreeSidebar
// Current (line ~667): onSelect={setTreeSelection}
// New:
const handleTreeSelect = useCallback((sel: TreeSelection) => {
  setPreviousSelection(null)
  setTreeSelection(sel)
}, [])

// Also update onDeselect for TreeSidebar to include previousSelection awareness:
const handleTreeDeselect = useCallback(() => {
  if (treeSelection?.type === 'ideas') {
    setTreeSelection(previousSelection)
    setPreviousSelection(null)
  } else {
    setTreeSelection(null)
    setSelectedEntry(null)
  }
}, [treeSelection, previousSelection])
```

And pass `onSelect={handleTreeSelect}` and `onDeselect={handleTreeDeselect}` to TreeSidebar.

- [ ] **Step 7: Update handleAddToTodo to not switch to ideas tab**

```typescript
// src/App.tsx, replace lines 493-498
const handleAddToTodo = useCallback(
  (text: string, source: string) => {
    addTodo(text, undefined, source)
    // Select ideas to show the newly added todo
    if (treeSelection?.type !== 'ideas') {
      setPreviousSelection(treeSelection)
    }
    setTreeSelection({ type: 'ideas', path: '__ideas__' })
  },
  [addTodo, treeSelection],
)
```

- [ ] **Step 8: Pass ideas props to TreeSidebar**

```typescript
// src/App.tsx, in TreeSidebar JSX (around line 665-685):
// Replace onSelect={setTreeSelection} with onSelect={handleTreeSelect}
// Replace onDeselect={() => setTreeSelection(null)} with onDeselect={handleTreeDeselect}
// Add new props:
<TreeSidebar
  // ... existing props (selected, entries, identities, loadingMore, hasMore, etc.)
  onSelect={handleTreeSelect}
  onDeselect={handleTreeDeselect}
  ideasCount={todos.filter(t => !t.done).length}
  onSelectIdeas={handleSelectIdeas}
/>
```

- [ ] **Step 9: Pass todo props to DetailView**

```typescript
// src/App.tsx, in DetailView JSX (around line 766-793), add new props:
<DetailView
  type={
    treeSelection?.type === 'ideas' ? 'ideas'
    : !treeSelection || treeSelection.type === 'journal' ? 'journal'
    : treeSelection.type === 'identity' ? 'identity'
    : 'topic-file'
  }
  // ... existing props ...
  // New todo props:
  todos={todos}
  onToggleTodo={toggleTodo}
  onAddTodo={addTodo}
  onDeleteTodo={deleteTodo}
  onSetTodoDue={setTodoDue}
  onUpdateTodoText={updateTodoText}
  onSetTodoPath={setTodoPath}
  onRemoveTodoPath={removeTodoPath}
  onOpenTodoConversation={async (opts) => {
    if (opts.sessionId) {
      openChatPanel(opts.sessionId)
    } else {
      openChatPanel(undefined, opts.context)
    }
  }}
  onNavigateTodoSource={(filename: string) => {
    const match = entries.find((e) => e.filename === filename)
    if (match) {
      setTreeSelection({ type: 'journal', path: `${match.year_month}/${match.filename}` })
    }
  }}
/>
```

Note: the `type` derivation needs careful attention. The current logic on line 767-771 is:

```typescript
type={!treeSelection || treeSelection.type === 'journal'
  ? 'journal'
  : treeSelection.type === 'identity'
  ? 'identity'
  : 'topic-file'}
```

This needs updating to also check for `'ideas'`.

- [ ] **Step 10: Update RightPanel usage**

```typescript
// src/App.tsx, replace lines 830-878 (RightPanel JSX)
<RightPanel
  activeSessionId={sessionId}
  chatContent={
    <ChatPanel
      sessionId={sessionId}
      messages={messages}
      isStreaming={isStreaming}
      usage={usage}
      stats={stats}
      pendingQueue={pendingQueue}
      initialInput={chatInitialText}
      onSend={send}
      onCancel={cancel}
      onRetry={retry}
      onEditAndResend={editAndResend}
      onRemovePendingItem={removePendingItem}
      onContinue={() => send('请继续')}
    />
  }
  onHistorySelect={(id: string) => openChatPanel(id)}
/>
```

- [ ] **Step 11: Update keyboard shortcut handlers**

The Cmd+N handler (line 353-358) switches to chat tab. No change needed since chat is the only mode now.

The `openChatPanel` helper (lines 298-314) sets `rightPanelTab` to `'chat'` — need to remove that line:

```typescript
// src/App.tsx, in openChatPanel callback, remove the line:
// setRightPanelTab('chat')
```

And the `handleOpenChat` (line 479-482) also sets `rightPanelTab`:

```typescript
const handleOpenChat = useCallback(() => {
  setRightPanelOpen(true)
  // Remove: setRightPanelTab('chat')
}, [])
```

Also the `handleAtRef` callback in TreeSidebar (line 675-682) sets `rightPanelTab`:

```typescript
onAtRef={(path: string) => {
  setRightPanelOpen(true)
  // Remove: setRightPanelTab('chat')
  window.dispatchEvent(
    new CustomEvent('chat-append-text', { detail: `@${path}` }),
  )
}}
```

Also the Cmd+N handler (line 353-358):

```typescript
if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
  e.preventDefault()
  newTab()
  setRightPanelOpen(true)
  // Remove: setRightPanelTab('chat')
}
```

- [ ] **Step 12: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 13: Verify app builds**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 14: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire ideas panel routing with previousSelection restore

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6: Clean up unused imports and final verification

**Files:**

- Modify: `src/App.tsx:36-37` (imports)

- [ ] **Step 1: Remove unused RightPanelTab import**

```typescript
// src/App.tsx, line 37 — remove this line:
// import type { RightPanelTab } from './components/RightPanel'
```

- [ ] **Step 2: Final type check**

Run: `npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 3: Final build check**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Quick smoke test**

Run: `npm test`
Expected: All existing tests pass

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "chore: remove unused RightPanelTab import

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```
