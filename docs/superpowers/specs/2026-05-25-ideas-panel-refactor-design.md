# Ideas Panel Refactor: Left Sidebar + Center DetailView

## Summary

Move "想法" (ideas/todos) from right panel tab into a permanent top entry in the left sidebar. Clicking it displays the todo list in the center DetailView area, reusing the existing `TodoSidebar` component.

## Motivation

- Ideas/todos are a core daily workflow, not a secondary panel
- The right panel should be dedicated to chat only
- Follows existing TreeSelection → DetailView interaction pattern

## Design

### Data Flow

```
TreeSidebar "想法" click
  → onSelect({ type: 'ideas', path: '__ideas__' })
  → App saves previousSelection, sets treeSelection
  → DetailView detects type === 'ideas', renders <TodoSidebar />
  → Click "想法" again → onDeselect() → restore previousSelection
```

### File Changes

#### 1. `src/types.ts`

Add `'ideas'` to `TreeNodeType`:

```typescript
export type TreeNodeType =
  | 'pinned-section'
  | 'identity'
  | 'journal'
  | 'journal-month'
  | 'topic'
  | 'topic-file'
  | 'ideas'
```

#### 2. `src/components/TreeSidebar.tsx`

- New prop: `ideasCount: number`
- New prop: `ideasSelected: boolean`
- New callback: `onSelectIdeas: () => void`
- Render a non-collapsible "想法" entry at the very top (above pinned section)
- Icon: checkmark SVG (same as current RightPanel ideas tab)
- Right side: display `ideasCount` (unchecked count)
- Selected state: background highlight + accent text color
- Click → `onSelectIdeas()`

Layout:

```
┌─────────────────────────┐
│  ✓  想法           3个  │  ← New: permanent, non-collapsible
├─────────────────────────┤
│  ▾  📌  置顶         2  │  ← Existing pinned section
│  ▾  👤  画像         5  │  ← Existing
│  ▾  🕐  流水        42  │  ← Existing
│  ▾  📁  专题           │  ← Existing
└─────────────────────────┘
```

#### 3. `src/App.tsx`

- Add `previousSelection: TreeSelection | null` state
- Before setting `treeSelection` to ideas, save current selection
- On deselect from ideas, restore `previousSelection`
- Pass todo props to DetailView: `todos`, `onToggle`, `onAdd`, `onDelete`, `onSetDue`, `onUpdateText`, `onSetPath`, `onRemovePath`, `onOpenConversation`, `onNavigateToSource`
- Simplify RightPanel usage: remove `activeTab`/`onTabChange`/`ideasContent` props

#### 4. `src/components/DetailView.tsx`

- Extend `type` prop to include `'ideas'`
- Add todo-related props (same as TodoSidebarProps)
- When `type === 'ideas'`:
  - Render toolbar with title "想法" and unchecked count
  - Render `<TodoSidebar />` in the content area (no right-click context menu)
  - No loading/content fetching logic needed

#### 5. `src/components/RightPanel.tsx`

- Remove `RightPanelTab` type export
- Remove `activeTab`/`onTabChange`/`ideasContent` props
- Remove tab bar UI
- Render `chatContent` directly
- Keep `chatInputBar`, `activeSessionId`, `onHistorySelect` props

### Behavior

| Action | Result |
|---|---|
| Click "想法" | Center shows todo list, entry highlights |
| Click "想法" again | Deselect, restore previous journal/identity |
| Escape key | Same as click again |
| Select journal/identity | "想法" entry auto-deselects |
| Cmd+T / Cmd+K | Toggle right panel (chat only) |

### Edge Cases

- **Empty todos**: "想法" still clickable, DetailView shows empty TodoSidebar (with add button)
- **No previous selection**: deselecting ideas shows empty state (same as initial launch)
- **Theme**: TodoSidebar in center area respects current theme (it uses CSS variables)
- **Right panel closed**: selecting ideas doesn't auto-open right panel
