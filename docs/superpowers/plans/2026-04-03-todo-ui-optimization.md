# Todo UI 优化：紧凑布局 + 来源文档标识 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 压缩待办事项垂直空间约 40-50%，添加左侧状态竖线区分状态，新增来源文档标识支持跳转回源日志。

**Architecture:** Rust 端 TodoItem 新增 source 字段，解析/写入 `<!-- source:... -->` HTML 注释。前端 TodoSidebar 重构为紧凑单行布局，左侧 3px 状态竖线，行尾链条图标跳转来源。DetailPanel 右键添加待办时自动附带当前日志文件名。

**Tech Stack:** Rust (Tauri v2), React, TypeScript

---

### Task 1: Rust — TodoItem 新增 source 字段 + 解析/写入

**Files:**
- Modify: `src-tauri/src/todos.rs:1-11` (TodoItem struct)
- Modify: `src-tauri/src/todos.rs:14-52` (parse_todo_line)
- Modify: `src-tauri/src/todos.rs:81-117` (add_todo_to_workspace)
- Modify: `src-tauri/src/todos.rs:180-187` (add_todo command)

- [ ] **Step 1: Add source field to TodoItem struct**

```rust
#[derive(Debug, Clone, Serialize)]
pub struct TodoItem {
    pub text: String,
    pub done: bool,
    pub due: Option<String>,
    pub done_date: Option<String>,
    pub source: Option<String>,
    pub line_index: usize,
}
```

- [ ] **Step 2: Update parse_todo_line to extract source comment**

In the `while let Some(start) = text.find("<!--")` loop, add a branch:

```rust
} else if let Some(val) = comment.strip_prefix("source:") {
    source = Some(val.trim().to_string());
}
```

And initialize `let mut source: Option<String> = None;` before the loop. Include `source` in the returned `TodoItem`.

- [ ] **Step 3: Update add_todo_to_workspace to accept and write source**

Change signature:
```rust
pub fn add_todo_to_workspace(workspace: &str, text: &str, due: Option<&str>, source: Option<&str>) -> Result<(), String> {
```

Update new_line construction:
```rust
let mut new_line = format!("- [ ] {}", text);
if let Some(d) = due {
    new_line.push_str(&format!(" <!-- due:{} -->", d));
}
if let Some(s) = source {
    new_line.push_str(&format!(" <!-- source:{} -->", s));
}
```

- [ ] **Step 4: Update add_todo Tauri command to accept source**

```rust
#[tauri::command]
pub fn add_todo(app: tauri::AppHandle, text: String, due: Option<String>, source: Option<String>) -> Result<TodoItem, String> {
    let cfg = crate::config::load_config(&app)?;
    add_todo_to_workspace(&cfg.workspace_path, &text, due.as_deref(), source.as_deref())?;
    let items = list_todos_from_workspace(&cfg.workspace_path);
    items.into_iter().filter(|t| !t.done && t.text == text).last()
        .ok_or_else(|| "添加后未找到该待办".to_string())
}
```

- [ ] **Step 5: Update existing tests and add source tests**

Add test for parsing source comment:
```rust
#[test]
fn parse_item_with_source() {
    let items = parse_todos("- [ ] 确认权限 <!-- source:02-研发沟通.md -->\n");
    assert_eq!(items.len(), 1);
    assert_eq!(items[0].source.as_deref(), Some("02-研发沟通.md"));
    assert_eq!(items[0].text, "确认权限");
}

#[test]
fn parse_item_with_all_metadata() {
    let items = parse_todos("- [x] 写代码 <!-- due:2026-04-05 --> <!-- done:2026-04-03 --> <!-- source:25-泼墨体.md -->\n");
    assert_eq!(items.len(), 1);
    assert!(items[0].done);
    assert_eq!(items[0].due.as_deref(), Some("2026-04-05"));
    assert_eq!(items[0].done_date.as_deref(), Some("2026-04-03"));
    assert_eq!(items[0].source.as_deref(), Some("25-泼墨体.md"));
}
```

Update `add_todo_creates_file_if_missing` and `add_todo_with_due_date` and `add_todo_appends_before_completed` to pass `None` for the new source parameter.

Add test for adding with source:
```rust
#[test]
fn add_todo_with_source() {
    let tmp = std::env::temp_dir().join("journal_todo_add_source_test");
    let _ = std::fs::remove_dir_all(&tmp);
    std::fs::create_dir_all(&tmp).unwrap();
    add_todo_to_workspace(tmp.to_str().unwrap(), "确认权限", None, Some("02-研发沟通.md")).unwrap();
    let content = std::fs::read_to_string(tmp.join("todos.md")).unwrap();
    assert!(content.contains("- [ ] 确认权限 <!-- source:02-研发沟通.md -->"));
    std::fs::remove_dir_all(&tmp).ok();
}
```

- [ ] **Step 6: Run Rust tests**

Run: `cd src-tauri && cargo test`
Expected: All tests pass including new source tests.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/todos.rs
git commit -m "feat(todos): add source field to TodoItem for tracking origin document"
```

---

### Task 2: TypeScript 类型 + IPC 层更新

**Files:**
- Modify: `src/types.ts:89-95` (TodoItem interface)
- Modify: `src/lib/tauri.ts:255-256` (addTodo function)
- Modify: `src/hooks/useTodos.ts:33-35` (addTodo callback)

- [ ] **Step 1: Update TodoItem TypeScript interface**

In `src/types.ts`, add `source` field:

```typescript
export interface TodoItem {
  text: string
  done: boolean
  due: string | null
  done_date: string | null
  source: string | null
  line_index: number
}
```

- [ ] **Step 2: Update addTodo IPC wrapper**

In `src/lib/tauri.ts`:

```typescript
export const addTodo = (text: string, due?: string, source?: string): Promise<TodoItem> =>
  invoke<TodoItem>('add_todo', { text, due: due ?? null, source: source ?? null })
```

- [ ] **Step 3: Update useTodos hook**

In `src/hooks/useTodos.ts`, update addTodo callback:

```typescript
const addTodo = useCallback(async (text: string, due?: string, source?: string) => {
  await addTodoIpc(text, due, source)
  await refresh()
}, [refresh])
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/francis/Projects/github/journal && npm run build`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/lib/tauri.ts src/hooks/useTodos.ts
git commit -m "feat(todos): update TypeScript types and IPC for source field"
```

---

### Task 3: DetailPanel — 添加待办时附带来源文件名

**Files:**
- Modify: `src/components/DetailPanel.tsx:577-579` (onAddToTodo handler)
- Modify: `src/components/DetailPanel.tsx:11-18` (DetailPanelProps)
- Modify: `src/App.tsx:485-488` (onAddToTodo wiring)

- [ ] **Step 1: Update DetailPanelProps to pass source info**

Change `onAddToTodo` prop type in `src/components/DetailPanel.tsx`:

```typescript
onAddToTodo?: (text: string, source: string) => void
```

- [ ] **Step 2: Update onAddToTodo call in DetailContextMenu usage**

In `DetailPanel`, update the onAddToTodo callback passed to `DetailContextMenu` (around line 577-579):

```typescript
onAddToTodo={() => {
  const sel = window.getSelection()?.toString()?.trim()
  if (sel && onAddToTodo && entry) onAddToTodo(sel, entry.filename)
}}
```

- [ ] **Step 3: Update App.tsx wiring**

In `src/App.tsx`, update the onAddToTodo handler (around line 485-488):

```typescript
onAddToTodo={(text: string, source: string) => {
  addTodo(text, undefined, source)
  setTodoOpen(true)
}}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npm run build`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/DetailPanel.tsx src/App.tsx
git commit -m "feat(todos): pass source filename when adding todo from journal context menu"
```

---

### Task 4: TodoSidebar — 紧凑布局重构 + 状态竖线

**Files:**
- Modify: `src/components/TodoSidebar.tsx` (full component rewrite of TodoRow + layout)

- [ ] **Step 1: Add statusBarColor helper function**

Replace the existing `dueDateColor` function with `statusBarColor`:

```typescript
function statusBarColor(item: TodoItem): string {
  if (item.done) return 'rgba(255,255,255,0.12)'
  if (item.due) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const d = new Date(item.due + 'T00:00:00')
    if (d < today) return '#ff3b30'
  }
  return 'rgba(255,255,255,0.3)'
}

function dueBadgeStyle(due: string): { color: string; background: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(due + 'T00:00:00')
  if (d.getTime() < today.getTime()) return { color: '#ff3b30', background: 'rgba(255,59,48,0.1)' }
  if (d.getTime() === today.getTime()) return { color: '#ff3b30', background: 'rgba(255,59,48,0.08)' }
  return { color: 'var(--duration-text)', background: 'rgba(255,255,255,0.05)' }
}

function formatDueShort(due: string): string {
  const parts = due.split('-')
  return `${parts[1]}/${parts[2]}`
}
```

- [ ] **Step 2: Rewrite TodoRow to compact single-line layout with status bar**

Replace the entire `TodoRow` function:

```typescript
function TodoRow({ item, onToggle, onSetDue, onUpdateText, onContextMenu, onNavigateToSource }: {
  item: TodoItem
  onToggle: (lineIndex: number, checked: boolean) => void
  onSetDue: (lineIndex: number, due: string | null) => void
  onUpdateText: (lineIndex: number, text: string) => void
  onContextMenu: (e: React.MouseEvent) => void
  onNavigateToSource?: (filename: string) => void
}) {
  const [editingDue, setEditingDue] = useState(false)
  const [editingText, setEditingText] = useState(false)
  const dateRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editingDue && dateRef.current) dateRef.current.showPicker?.()
  }, [editingDue])

  useEffect(() => {
    if (editingText && textRef.current) {
      const el = textRef.current
      el.focus()
      const range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  }, [editingText])

  const handleTextSubmit = () => {
    const trimmed = (textRef.current?.textContent ?? '').trim()
    if (trimmed && trimmed !== item.text) {
      onUpdateText(item.line_index, trimmed)
    } else if (textRef.current) {
      textRef.current.textContent = item.text
    }
    setEditingText(false)
  }

  const badge = item.due ? dueBadgeStyle(item.due) : null

  return (
    <div
      onContextMenu={onContextMenu}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 8px',
        borderBottom: '0.5px solid rgba(255,255,255,0.06)',
        transition: 'background 0.1s',
        cursor: 'default',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      {/* Status bar */}
      <div style={{
        width: 3, alignSelf: 'stretch', borderRadius: 1.5, flexShrink: 0,
        minHeight: 20, background: statusBarColor(item),
      }} />

      {/* Checkbox */}
      <div
        onClick={() => onToggle(item.line_index, !item.done)}
        onMouseEnter={e => {
          if (!item.done) (e.currentTarget as HTMLElement).style.borderColor = 'var(--record-btn)'
        }}
        onMouseLeave={e => {
          if (!item.done) (e.currentTarget as HTMLElement).style.borderColor = 'var(--divider)'
        }}
        style={{
          width: 13, height: 13, flexShrink: 0, cursor: 'pointer',
          border: `1.5px solid ${item.done ? 'var(--record-btn)' : 'var(--divider)'}`,
          borderRadius: 3,
          background: item.done ? 'var(--record-btn)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s ease, border-color 0.15s ease',
        }}
      >
        {item.done && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>

      {/* Text + due badge inline */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 6 }}>
        {editingText ? (
          <div
            ref={textRef}
            contentEditable
            suppressContentEditableWarning
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleTextSubmit() }
              if (e.key === 'Escape') { if (textRef.current) textRef.current.textContent = item.text; setEditingText(false) }
            }}
            onBlur={() => handleTextSubmit()}
            style={{
              flex: 1, fontSize: 12, lineHeight: '17px',
              fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontWeight: 400,
              color: 'var(--item-text)', outline: 'none',
            }}
          >
            {item.text}
          </div>
        ) : (
          <span
            onClick={() => !item.done && setEditingText(true)}
            style={{
              fontSize: 12, lineHeight: '17px',
              fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontWeight: 400,
              color: item.done ? '#555' : 'var(--item-text)',
              textDecoration: item.done ? 'line-through' : 'none',
              cursor: item.done ? 'default' : 'text',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              flex: 1, minWidth: 0,
            }}
          >
            {item.text}
          </span>
        )}

        {/* Due badge (inline) */}
        {!editingDue && item.due && (
          <span
            onClick={() => !item.done && setEditingDue(true)}
            style={{
              fontSize: 8, padding: '1px 4px', borderRadius: 3,
              whiteSpace: 'nowrap', flexShrink: 0,
              color: item.done ? 'var(--duration-text)' : badge!.color,
              background: item.done ? 'transparent' : badge!.background,
              cursor: item.done ? 'default' : 'pointer',
            }}
          >
            {formatDueShort(item.due)}
          </span>
        )}
        {!item.done && !editingDue && !item.due && (
          <span
            onClick={() => setEditingDue(true)}
            className="todo-calendar-icon"
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--record-btn)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--duration-text)' }}
            style={{ cursor: 'pointer', color: 'var(--duration-text)', display: 'flex', alignItems: 'center', flexShrink: 0, opacity: 0 }}
            title="设置截止日期"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </span>
        )}
        {editingDue && (
          <input
            ref={dateRef}
            type="date"
            defaultValue={item.due ?? ''}
            onKeyDown={e => {
              if (e.key === 'Escape') { setEditingDue(false); return }
              if (e.key === 'Enter') {
                const val = (e.target as HTMLInputElement).value
                onSetDue(item.line_index, val || null)
                setEditingDue(false)
              }
            }}
            onChange={e => {
              const val = e.target.value
              if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
                onSetDue(item.line_index, val)
                setEditingDue(false)
              }
            }}
            onBlur={() => setEditingDue(false)}
            style={{
              fontSize: 9, fontFamily: "'IBM Plex Mono', monospace",
              background: 'transparent', border: '0.5px solid var(--divider)',
              borderRadius: 3, color: 'var(--item-text)', padding: '1px 3px',
              outline: 'none', width: 90, flexShrink: 0,
              colorScheme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
            }}
          />
        )}
      </div>

      {/* Source link icon */}
      {item.source && onNavigateToSource && (
        <div
          className="todo-source-icon"
          onClick={() => onNavigateToSource(item.source!)}
          title={item.source}
          style={{
            flexShrink: 0, cursor: 'pointer', opacity: 0.35,
            transition: 'opacity 0.15s', display: 'flex', alignItems: 'center',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.35' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Update TodoSidebar props and TodoRow usage**

Add `onNavigateToSource` to `TodoSidebarProps`:

```typescript
interface TodoSidebarProps {
  width: number
  todos: TodoItem[]
  onToggle: (lineIndex: number, checked: boolean) => void
  onAdd: (text: string, due?: string, source?: string) => void
  onDelete: (lineIndex: number) => void
  onSetDue: (lineIndex: number, due: string | null) => void
  onUpdateText: (lineIndex: number, text: string) => void
  onNavigateToSource?: (filename: string) => void
}
```

Pass `onNavigateToSource` to each `TodoRow`:

```typescript
<TodoRow
  key={item.line_index}
  item={item}
  onToggle={onToggle}
  onSetDue={onSetDue}
  onUpdateText={onUpdateText}
  onNavigateToSource={onNavigateToSource}
  onContextMenu={(e) => { ... }}
/>
```

- [ ] **Step 4: Update add button to compact style**

Replace the dashed-border add button with:

```typescript
{adding ? (
  <div style={{ padding: '6px 8px', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
    <input
      ref={inputRef}
      value={inputText}
      onChange={e => setInputText(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleSubmit}
      placeholder="输入待办内容..."
      style={{
        width: '100%', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace",
        background: 'transparent', border: 'none', outline: 'none',
        color: 'var(--item-text)', padding: 0,
      }}
    />
  </div>
) : (
  <div
    onClick={() => setAdding(true)}
    style={{
      padding: '6px 8px', cursor: 'pointer',
      borderBottom: '0.5px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', gap: 6,
      transition: 'background 0.1s',
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)' }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
  >
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
    <span style={{ fontSize: 11, color: '#555' }}>添加待办</span>
  </div>
)}
```

- [ ] **Step 5: Update completed section styling**

```typescript
{checked.length > 0 && (
  <>
    <div
      onClick={() => setShowCompleted(!showCompleted)}
      style={{
        fontSize: 9, color: '#555', letterSpacing: '0.08em',
        textTransform: 'uppercase' as const, marginTop: 8,
        padding: '6px 8px 4px', cursor: 'pointer',
        userSelect: 'none' as const,
      }}
    >
      已完成 · {checked.length} {showCompleted ? '▾' : '▸'}
    </div>
    {showCompleted && checked.map(item => (
      <div key={item.line_index} style={{ opacity: 0.5 }}>
        <TodoRow
          item={item}
          onToggle={onToggle}
          onSetDue={onSetDue}
          onUpdateText={onUpdateText}
          onNavigateToSource={onNavigateToSource}
          onContextMenu={(e) => {
            e.preventDefault()
            setContextMenu({ x: e.clientX, y: e.clientY, lineIndex: item.line_index, text: item.text, due: item.due })
          }}
        />
      </div>
    ))}
  </>
)}
```

- [ ] **Step 6: Add CSS for hover-reveal calendar icon**

Add a `<style>` tag or inline approach. Since the project uses inline styles, use the row hover to reveal the calendar icon. Add this to the TodoRow container's `onMouseEnter`/`onMouseLeave`:

In the row's `onMouseEnter`, also set calendar icon opacity:
```typescript
onMouseEnter={e => {
  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'
  const cal = (e.currentTarget as HTMLElement).querySelector('.todo-calendar-icon') as HTMLElement | null
  if (cal) cal.style.opacity = '1'
}}
onMouseLeave={e => {
  (e.currentTarget as HTMLElement).style.background = 'transparent'
  const cal = (e.currentTarget as HTMLElement).querySelector('.todo-calendar-icon') as HTMLElement | null
  if (cal) cal.style.opacity = '0'
}}
```

Also update source icon opacity on row hover:
```typescript
// In onMouseEnter, also:
const src = (e.currentTarget as HTMLElement).querySelector('.todo-source-icon') as HTMLElement | null
if (src) src.style.opacity = '0.6'
// In onMouseLeave, also:
if (src) src.style.opacity = '0.35'
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `npm run build`
Expected: No type errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/TodoSidebar.tsx
git commit -m "feat(todos): compact layout with status bar, inline due badge, source icon"
```

---

### Task 5: App.tsx — 接线 onNavigateToSource + addTodo source

**Files:**
- Modify: `src/App.tsx:505-513` (TodoSidebar props)

- [ ] **Step 1: Add onNavigateToSource to TodoSidebar**

In `src/App.tsx`, update the TodoSidebar usage (around line 505):

```typescript
<TodoSidebar
  width={todoWidth}
  todos={todos}
  onToggle={toggleTodo}
  onAdd={addTodo}
  onDelete={deleteTodo}
  onSetDue={setTodoDue}
  onUpdateText={updateTodoText}
  onNavigateToSource={(filename: string) => {
    const match = entries.find(e => e.filename === filename)
    if (match) {
      setSidebarTab('journal')
      setSelectedEntry(match)
    }
  }}
/>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(todos): wire source navigation to jump back to origin journal entry"
```

---

### Task 6: 手动验证

- [ ] **Step 1: Start dev server**

User runs: `npm run tauri dev`

- [ ] **Step 2: Verify compact layout**

Open todo sidebar (Cmd+T). Confirm:
- Each row is single-line with left status bar
- Overdue items have red bar
- Normal items have gray bar
- Completed items have faint bar

- [ ] **Step 3: Verify source tracking**

1. Open a journal entry
2. Select text, right-click → "添加到待办"
3. Confirm todo appears in sidebar
4. Confirm chain icon appears at row end
5. Click chain icon → should jump to the source journal entry

- [ ] **Step 4: Verify existing features still work**

- Add todo manually (no source icon should appear)
- Toggle todo done/undone
- Edit todo text inline
- Set/clear due date
- Delete todo via context menu
- Completed section collapse/expand
