# Todo 工作路径分组 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add workspace path grouping to TodoSidebar — todos are grouped by `<!-- path:~/... -->` tag, each group is collapsible, brainstorm terminal uses the path as cwd, with ideate symlink auto-setup.

**Architecture:** Extend the existing `TodoItem` struct/type with `path: Option<String>`. Parse/write `<!-- path:... -->` using the same HTML comment pattern as `due:/done:/source:`. Frontend groups todos by path into collapsible sections. Context menu adds set/remove path actions via system folder picker.

**Tech Stack:** Rust (Tauri commands), React + TypeScript (TodoSidebar), `@tauri-apps/plugin-dialog` (folder picker)

---

### Task 1: Rust — parse & store `path:` in TodoItem

**Files:**
- Modify: `src-tauri/src/todos.rs` (TodoItem struct + parse_todo_line + tests)

- [ ] **Step 1: Write failing tests for path parsing**

Add to the `#[cfg(test)] mod tests` block:

```rust
#[test]
fn parse_item_with_path() {
    let items = parse_todos("- [ ] 修复登录 bug <!-- path:~/Projects/app-x -->\n");
    assert_eq!(items.len(), 1);
    assert_eq!(items[0].text, "修复登录 bug");
    assert_eq!(items[0].path.as_deref(), Some("~/Projects/app-x"));
}

#[test]
fn parse_item_with_path_and_due() {
    let items = parse_todos("- [ ] 更新文档 <!-- path:~/Projects/app-x --> <!-- due:2026-04-15 -->\n");
    assert_eq!(items.len(), 1);
    assert_eq!(items[0].text, "更新文档");
    assert_eq!(items[0].path.as_deref(), Some("~/Projects/app-x"));
    assert_eq!(items[0].due.as_deref(), Some("2026-04-15"));
}

#[test]
fn parse_item_without_path() {
    let items = parse_todos("- [ ] 写周报\n");
    assert_eq!(items.len(), 1);
    assert!(items[0].path.is_none());
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd src-tauri && cargo test parse_item_with_path -- --nocapture`
Expected: FAIL — `TodoItem` has no field `path`

- [ ] **Step 3: Add `path` field to TodoItem and update parse_todo_line**

In `src-tauri/src/todos.rs`, add `path: Option<String>` to the `TodoItem` struct:

```rust
pub struct TodoItem {
    pub text: String,
    pub done: bool,
    pub due: Option<String>,
    pub done_date: Option<String>,
    pub source: Option<String>,
    pub path: Option<String>,
    pub line_index: usize,
    pub done_file: bool,
}
```

In `parse_todo_line`, add the `path` variable alongside `due`/`done_date`/`source`:

```rust
let mut path: Option<String> = None;
```

In the `while let Some(start) = text.find("<!--")` loop, add a branch:

```rust
} else if let Some(val) = comment.strip_prefix("path:") {
    path = Some(val.trim().to_string());
}
```

In the `Some(TodoItem { ... })` return, add `path,`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd src-tauri && cargo test parse_item_with_path -- --nocapture`
Expected: All 3 new tests PASS

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/todos.rs
git commit -m "feat(todos): parse path: comment in todo items"
```

---

### Task 2: Rust — set_todo_path / remove_todo_path commands

**Files:**
- Modify: `src-tauri/src/todos.rs` (new functions + commands)
- Modify: `src-tauri/src/main.rs` (register commands in invoke_handler)

- [ ] **Step 1: Write failing tests for set/remove path**

```rust
#[test]
fn set_todo_path_adds_path_comment() {
    let tmp = std::env::temp_dir().join("journal_todo_set_path_test");
    let _ = std::fs::remove_dir_all(&tmp);
    std::fs::create_dir_all(&tmp).unwrap();
    std::fs::write(tmp.join("todos.md"), "- [ ] 修复 bug\n").unwrap();
    set_todo_path_in_workspace(tmp.to_str().unwrap(), 0, "~/Projects/app-x", false).unwrap();
    let content = std::fs::read_to_string(tmp.join("todos.md")).unwrap();
    assert!(content.contains("- [ ] 修复 bug <!-- path:~/Projects/app-x -->"));
    std::fs::remove_dir_all(&tmp).ok();
}

#[test]
fn set_todo_path_replaces_existing() {
    let tmp = std::env::temp_dir().join("journal_todo_replace_path_test");
    let _ = std::fs::remove_dir_all(&tmp);
    std::fs::create_dir_all(&tmp).unwrap();
    std::fs::write(tmp.join("todos.md"), "- [ ] 修复 bug <!-- path:~/old -->\n").unwrap();
    set_todo_path_in_workspace(tmp.to_str().unwrap(), 0, "~/Projects/new", false).unwrap();
    let content = std::fs::read_to_string(tmp.join("todos.md")).unwrap();
    assert!(content.contains("<!-- path:~/Projects/new -->"));
    assert!(!content.contains("~/old"));
    std::fs::remove_dir_all(&tmp).ok();
}

#[test]
fn remove_todo_path_clears_comment() {
    let tmp = std::env::temp_dir().join("journal_todo_remove_path_test");
    let _ = std::fs::remove_dir_all(&tmp);
    std::fs::create_dir_all(&tmp).unwrap();
    std::fs::write(tmp.join("todos.md"), "- [ ] 修复 bug <!-- path:~/Projects/app-x --> <!-- due:2026-04-15 -->\n").unwrap();
    remove_todo_path_in_workspace(tmp.to_str().unwrap(), 0, false).unwrap();
    let content = std::fs::read_to_string(tmp.join("todos.md")).unwrap();
    assert!(!content.contains("path:"));
    assert!(content.contains("<!-- due:2026-04-15 -->"));
    std::fs::remove_dir_all(&tmp).ok();
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd src-tauri && cargo test set_todo_path -- --nocapture`
Expected: FAIL — functions don't exist

- [ ] **Step 3: Implement set_todo_path_in_workspace and remove_todo_path_in_workspace**

Add to `src-tauri/src/todos.rs`, following the existing `set_todo_due_in_workspace` pattern:

```rust
pub fn set_todo_path_in_workspace(workspace: &str, line_index: usize, path: &str, done_file: bool) -> Result<(), String> {
    let (content, writer): (String, Box<dyn Fn(&str, &str) -> Result<(), String>>) = if done_file {
        (read_done_file(workspace), Box::new(write_done_file))
    } else {
        (read_todos_file(workspace), Box::new(write_todos_file))
    };
    let mut lines: Vec<String> = content.lines().map(String::from).collect();

    if line_index >= lines.len() {
        return Err(format!("行号 {} 超出范围", line_index));
    }

    let cleaned = remove_comment(&lines[line_index], "path:");
    lines[line_index] = format!("{} <!-- path:{} -->", cleaned, path);

    writer(workspace, &(lines.join("\n") + "\n"))
}

pub fn remove_todo_path_in_workspace(workspace: &str, line_index: usize, done_file: bool) -> Result<(), String> {
    let (content, writer): (String, Box<dyn Fn(&str, &str) -> Result<(), String>>) = if done_file {
        (read_done_file(workspace), Box::new(write_done_file))
    } else {
        (read_todos_file(workspace), Box::new(write_todos_file))
    };
    let mut lines: Vec<String> = content.lines().map(String::from).collect();

    if line_index >= lines.len() {
        return Err(format!("行号 {} 超出范围", line_index));
    }

    lines[line_index] = remove_comment(&lines[line_index], "path:");

    writer(workspace, &(lines.join("\n") + "\n"))
}
```

- [ ] **Step 4: Add Tauri commands wrapping these functions**

```rust
#[tauri::command]
pub fn set_todo_path(app: tauri::AppHandle, line_index: usize, path: String, done_file: bool) -> Result<(), String> {
    let cfg = crate::config::load_config(&app)?;
    set_todo_path_in_workspace(&cfg.workspace_path, line_index, &path, done_file)
}

#[tauri::command]
pub fn remove_todo_path(app: tauri::AppHandle, line_index: usize, done_file: bool) -> Result<(), String> {
    let cfg = crate::config::load_config(&app)?;
    remove_todo_path_in_workspace(&cfg.workspace_path, line_index, done_file)
}
```

- [ ] **Step 5: Register commands in main.rs**

In `src-tauri/src/main.rs`, add to the `invoke_handler![]` list after `todos::update_todo_text`:

```rust
todos::set_todo_path,
todos::remove_todo_path,
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd src-tauri && cargo test set_todo_path -- --nocapture && cargo test remove_todo_path -- --nocapture`
Expected: All 3 PASS

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/todos.rs src-tauri/src/main.rs
git commit -m "feat(todos): add set_todo_path and remove_todo_path commands"
```

---

### Task 3: Rust — extend add_todo to accept optional path

**Files:**
- Modify: `src-tauri/src/todos.rs` (add_todo_to_workspace + add_todo command)

- [ ] **Step 1: Write failing test**

```rust
#[test]
fn add_todo_with_path() {
    let tmp = std::env::temp_dir().join("journal_todo_add_path_test");
    let _ = std::fs::remove_dir_all(&tmp);
    std::fs::create_dir_all(&tmp).unwrap();
    add_todo_to_workspace(tmp.to_str().unwrap(), "新任务", None, None, Some("~/Projects/app-x")).unwrap();
    let content = std::fs::read_to_string(tmp.join("todos.md")).unwrap();
    assert!(content.contains("- [ ] 新任务 <!-- path:~/Projects/app-x -->"));
    std::fs::remove_dir_all(&tmp).ok();
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src-tauri && cargo test add_todo_with_path -- --nocapture`
Expected: FAIL — signature mismatch

- [ ] **Step 3: Add `path` parameter to add_todo_to_workspace**

Update the function signature:

```rust
pub fn add_todo_to_workspace(workspace: &str, text: &str, due: Option<&str>, source: Option<&str>, path: Option<&str>) -> Result<(), String> {
```

After the `source` comment append, add:

```rust
if let Some(p) = path {
    new_line.push_str(&format!(" <!-- path:{} -->", p));
}
```

Update all existing callers of `add_todo_to_workspace` to pass the extra `None`:
- In `toggle_todo_in_workspace` (the unchecked branch does not call `add_todo_to_workspace`, so no change needed there — it builds the line manually)
- The `add_todo` command — update to pass `path`:

```rust
#[tauri::command]
pub fn add_todo(app: tauri::AppHandle, text: String, due: Option<String>, source: Option<String>, path: Option<String>) -> Result<TodoItem, String> {
    let cfg = crate::config::load_config(&app)?;
    add_todo_to_workspace(&cfg.workspace_path, &text, due.as_deref(), source.as_deref(), path.as_deref())?;
    let items = list_todos_from_workspace(&cfg.workspace_path);
    items.into_iter().filter(|t| !t.done && t.text == text).last()
        .ok_or_else(|| "添加后未找到该待办".to_string())
}
```

- [ ] **Step 4: Fix existing tests that call add_todo_to_workspace**

Every call site in tests needs the extra `None` parameter. Update:
- `add_todo_creates_file_if_missing`: `add_todo_to_workspace(..., "新待办", None, None, None)`
- `add_todo_with_due_date`: `add_todo_to_workspace(..., "截止任务", Some("2026-04-10"), None, None)`
- `add_todo_appends_at_end`: `add_todo_to_workspace(..., "新增任务", None, None, None)`
- `add_todo_with_source`: `add_todo_to_workspace(..., "确认权限", None, Some("02-研发沟通.md"), None)`

- [ ] **Step 5: Run all todo tests**

Run: `cd src-tauri && cargo test --lib todos -- --nocapture`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/todos.rs
git commit -m "feat(todos): add optional path param to add_todo"
```

---

### Task 4: TypeScript — types + IPC wrappers

**Files:**
- Modify: `src/types.ts` (TodoItem type)
- Modify: `src/lib/tauri.ts` (new IPC wrappers + update addTodo)
- Modify: `src/hooks/useTodos.ts` (pass path through addTodo)

- [ ] **Step 1: Add `path` field to TypeScript TodoItem**

In `src/types.ts`, add to the `TodoItem` interface:

```typescript
export interface TodoItem {
  text: string
  done: boolean
  due: string | null
  done_date: string | null
  source: string | null
  path: string | null        // NEW
  line_index: number
  done_file: boolean
}
```

- [ ] **Step 2: Add IPC wrappers in tauri.ts**

In `src/lib/tauri.ts`, update `addTodo` and add two new functions in the `// Todos` section:

```typescript
export const addTodo = (text: string, due?: string, source?: string, path?: string): Promise<TodoItem> =>
  invoke<TodoItem>('add_todo', { text, due: due ?? null, source: source ?? null, path: path ?? null })

export const setTodoPath = (lineIndex: number, path: string, doneFile: boolean): Promise<void> =>
  invoke<void>('set_todo_path', { lineIndex, path, doneFile })

export const removeTodoPath = (lineIndex: number, doneFile: boolean): Promise<void> =>
  invoke<void>('remove_todo_path', { lineIndex, doneFile })
```

- [ ] **Step 3: Update useTodos hook**

In `src/hooks/useTodos.ts`, update the `addTodo` callback:

```typescript
const addTodo = useCallback(async (text: string, due?: string, source?: string, path?: string) => {
    await addTodoIpc(text, due, source, path)
    await refresh()
}, [refresh])
```

Add new callbacks:

```typescript
const setTodoPath = useCallback(async (lineIndex: number, path: string, doneFile: boolean) => {
    await setTodoPathIpc(lineIndex, path, doneFile)
    await refresh()
}, [refresh])

const removeTodoPath = useCallback(async (lineIndex: number, doneFile: boolean) => {
    await removeTodoPathIpc(lineIndex, doneFile)
    await refresh()
}, [refresh])
```

Import the new functions:

```typescript
import { listTodos, addTodo as addTodoIpc, toggleTodo as toggleTodoIpc, deleteTodo as deleteTodoIpc, setTodoDue as setTodoDueIpc, updateTodoText as updateTodoTextIpc, setTodoPath as setTodoPathIpc, removeTodoPath as removeTodoPathIpc } from '../lib/tauri'
```

Return `setTodoPath` and `removeTodoPath` from the hook.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npm run build`
Expected: Build succeeds (no type errors)

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/lib/tauri.ts src/hooks/useTodos.ts
git commit -m "feat(todos): add path field to TodoItem type and IPC wrappers"
```

---

### Task 5: Frontend — collapsible path groups in TodoSidebar

**Files:**
- Modify: `src/components/TodoSidebar.tsx` (grouping logic + UI)
- Modify: `src/locales/zh.ts` (new i18n keys)
- Modify: `src/locales/en.ts` (new i18n keys)

This is the largest task. We'll break the UI work into sub-steps.

- [ ] **Step 1: Add i18n keys**

In `src/locales/zh.ts`, add in the `// TodoSidebar` section:

```typescript
setWorkspacePath: '设置工作路径',
removeWorkspacePath: '移除工作路径',
defaultGroup: '默认',
```

In `src/locales/en.ts`, add the same section:

```typescript
setWorkspacePath: 'Set Workspace Path',
removeWorkspacePath: 'Remove Workspace Path',
defaultGroup: 'Default',
```

- [ ] **Step 2: Add grouping utility function at top of TodoSidebar.tsx**

This goes right before the `TodoSidebar` component function. The function groups unchecked todos by path and handles basename dedup:

```typescript
interface TodoGroup {
  path: string | null      // null = default group
  displayName: string      // basename or disambiguated
  fullPath: string | null   // for tooltip
  items: TodoItem[]
}

function groupTodosByPath(todos: TodoItem[]): TodoGroup[] {
  // Collect unique paths
  const pathMap = new Map<string | null, TodoItem[]>()
  const pathOrder: (string | null)[] = []

  for (const todo of todos) {
    const key = todo.path
    if (!pathMap.has(key)) {
      pathMap.set(key, [])
      pathOrder.push(key)
    }
    pathMap.get(key)!.push(todo)
  }

  // Ensure default group (null) comes first
  const ordered = pathOrder.filter(p => p === null).concat(pathOrder.filter(p => p !== null))

  // Compute display names with basename dedup
  const basenames = new Map<string, string[]>()
  for (const p of ordered) {
    if (p === null) continue
    const base = p.split('/').pop() || p
    if (!basenames.has(base)) basenames.set(base, [])
    basenames.get(base)!.push(p)
  }

  return ordered.map(p => {
    if (p === null) {
      return { path: null, displayName: 'journal', fullPath: null, items: pathMap.get(null)! }
    }
    const base = p.split('/').pop() || p
    let displayName = base
    const siblings = basenames.get(base)!
    if (siblings.length > 1) {
      // Walk up path segments until unique
      const segments = p.split('/')
      for (let depth = 2; depth <= segments.length; depth++) {
        const candidate = segments.slice(-depth).join('/')
        const isUnique = siblings.every(s => s === p || !s.endsWith(candidate))
        if (isUnique) { displayName = candidate; break }
      }
    }
    return { path: p, displayName, fullPath: p, items: pathMap.get(p)! }
  })
}
```

- [ ] **Step 3: Update TodoSidebarProps and state**

Add new props to `TodoSidebarProps`:

```typescript
interface TodoSidebarProps {
  width: number
  todos: TodoItem[]
  onToggle: (lineIndex: number, checked: boolean, doneFile: boolean) => void
  onAdd: (text: string, due?: string, source?: string, path?: string) => void
  onDelete: (lineIndex: number, doneFile: boolean) => void
  onSetDue: (lineIndex: number, due: string | null, doneFile: boolean) => void
  onUpdateText: (lineIndex: number, text: string, doneFile: boolean) => void
  onSetPath: (lineIndex: number, path: string, doneFile: boolean) => void
  onRemovePath: (lineIndex: number, doneFile: boolean) => void
  onNavigateToSource?: (filename: string) => void
}
```

Add state for collapsed groups:

```typescript
const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
  try {
    return JSON.parse(localStorage.getItem('todo-collapsed-groups') || '{}')
  } catch { return {} }
})
```

Persist collapsed state on change:

```typescript
useEffect(() => {
  localStorage.setItem('todo-collapsed-groups', JSON.stringify(collapsed))
}, [collapsed])
```

Compute groups from unchecked todos:

```typescript
const unchecked = todos.filter(t => !t.done).sort((a, b) => a.line_index - b.line_index)
const groups = groupTodosByPath(unchecked)
```

- [ ] **Step 4: Replace flat unchecked list with grouped rendering**

Replace the `{unchecked.map(item => ...)}` block with:

```tsx
{groups.map(group => {
  const groupKey = group.path ?? '__default__'
  const isCollapsed = collapsed[groupKey] ?? false
  return (
    <div key={groupKey}>
      {/* Group header */}
      <div
        onClick={() => setCollapsed(prev => ({ ...prev, [groupKey]: !isCollapsed }))}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 14px 4px', cursor: 'pointer', userSelect: 'none',
        }}
        title={group.fullPath ?? undefined}
      >
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--duration-text)' }}>
          {isCollapsed ? '▸' : '▾'}
        </span>
        <span style={{
          fontSize: 'var(--text-xs)', color: 'var(--item-text)',
          fontWeight: 'var(--font-medium)', letterSpacing: '0.02em',
        }}>
          {group.displayName}
        </span>
        {group.path === null && (
          <span style={{ fontSize: '9px', color: 'var(--duration-text)', opacity: 0.6 }}>
            {t('defaultGroup')}
          </span>
        )}
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--duration-text)', marginLeft: 'auto' }}>
          {group.items.length}
        </span>
      </div>

      {/* Group items */}
      {!isCollapsed && (
        <>
          {group.items.map(item => (
            <TodoRow key={item.line_index} item={item} onToggle={onToggle} onSetDue={onSetDue}
              onUpdateText={onUpdateText} onDelete={onDelete} onNavigateToSource={onNavigateToSource}
              hasBrainstorm={brainstormKeys.has(item.text)} onBrainstorm={refreshBrainstormKeys}
              onContextMenu={e => {
                e.preventDefault()
                setContextMenu({
                  x: e.clientX, y: e.clientY, lineIndex: item.line_index,
                  text: item.text, due: item.due, doneFile: item.done_file,
                  path: item.path,
                })
              }}
            />
          ))}
          {/* Per-group add button */}
          {adding === groupKey ? (
            <div style={{ padding: '6px 14px', borderBottom: '0.5px solid var(--divider)' }}>
              <input ref={inputRef} value={inputText} onChange={e => setInputText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleGroupSubmit(group.path)
                  if (e.key === 'Escape') { setAdding(null); setInputText('') }
                }}
                onBlur={() => handleGroupSubmit(group.path)}
                placeholder={t('addTodo')}
                style={{ width: '100%', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', background: 'transparent', border: 'none', outline: 'none', color: 'var(--item-text)', padding: 0 }}
              />
            </div>
          ) : (
            <div onClick={() => setAdding(groupKey)}
              style={{ padding: '6px 14px', cursor: 'pointer', borderBottom: '0.5px solid var(--divider)', display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.1s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--item-hover-bg)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              <span style={{ fontSize: 'var(--text-xs)', color: '#555' }}>{t('addTodoBtn')}</span>
            </div>
          )}
        </>
      )}
    </div>
  )
})}
```

- [ ] **Step 5: Update state types for per-group add and context menu path**

Change the `adding` state from `boolean` to `string | null` (group key):

```typescript
const [adding, setAdding] = useState<string | null>(null)
```

Update context menu state to include path:

```typescript
const [contextMenu, setContextMenu] = useState<{
  x: number; y: number; lineIndex: number; text: string;
  due: string | null; doneFile: boolean; path: string | null
} | null>(null)
```

Add the group-aware submit handler:

```typescript
const handleGroupSubmit = (groupPath: string | null) => {
  const text = inputText.trim()
  if (text) {
    onAdd(text, undefined, undefined, groupPath ?? undefined)
    setInputText('')
  }
  setAdding(null)
}
```

Remove the old `handleSubmit` function.

Update the `useEffect` for input focus:

```typescript
useEffect(() => { if (adding !== null && inputRef.current) inputRef.current.focus() }, [adding])
```

- [ ] **Step 6: Add path actions to context menu**

In the context menu rendering block, add "设置工作路径" and "移除工作路径" menu items. Insert before the delete separator:

```tsx
{/* Set workspace path — always available on unchecked todos */}
{!contextMenu.doneFile && (
  <div style={menuItemStyle} onMouseEnter={hi} onMouseLeave={ho}
    onClick={async () => {
      const picked = await pickFolder()
      if (picked) {
        const homedir = picked.replace(/^\/Users\/[^/]+/, '~')
        onSetPath(contextMenu.lineIndex, homedir, contextMenu.doneFile)
      }
      setContextMenu(null)
    }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--item-meta)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
    {t('setWorkspacePath')}
  </div>
)}

{/* Remove workspace path — only for non-default group */}
{!contextMenu.doneFile && contextMenu.path && (
  <div style={menuItemStyle} onMouseEnter={hi} onMouseLeave={ho}
    onClick={() => { onRemovePath(contextMenu.lineIndex, contextMenu.doneFile); setContextMenu(null) }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--item-meta)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      <line x1="9" y1="14" x2="15" y2="14"/>
    </svg>
    {t('removeWorkspacePath')}
  </div>
)}
```

Add `pickFolder` import at top:

```typescript
import { openBrainstormTerminal, listBrainstormKeys, pickFolder } from '../lib/tauri'
```

- [ ] **Step 7: Wire up props in parent component (App.tsx)**

Find where `<TodoSidebar>` is rendered in `App.tsx` and add the new props:

```tsx
onSetPath={setTodoPath}
onRemovePath={removeTodoPath}
```

And ensure `setTodoPath` and `removeTodoPath` are destructured from `useTodos()`.

- [ ] **Step 8: Verify app compiles and renders**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 9: Commit**

```bash
git add src/components/TodoSidebar.tsx src/locales/zh.ts src/locales/en.ts src/App.tsx src/hooks/useTodos.ts
git commit -m "feat(todos): collapsible workspace path groups in TodoSidebar"
```

---

### Task 6: Rust — brainstorm terminal uses todo's path as cwd + ideate symlink

**Files:**
- Modify: `src-tauri/src/brainstorm.rs` (read todo path, use as cwd, symlink ideate)
- Modify: `src-tauri/src/todos.rs` (expose getter for single todo)

- [ ] **Step 1: Add helper to get a single todo's path from workspace**

In `src-tauri/src/todos.rs`, add:

```rust
/// Get the path field of a specific todo item by line_index.
pub fn get_todo_path(workspace: &str, line_index: usize, done_file: bool) -> Option<String> {
    let content = if done_file { read_done_file(workspace) } else { read_todos_file(workspace) };
    let lines: Vec<&str> = content.lines().collect();
    if line_index >= lines.len() { return None }
    parse_todo_line(lines[line_index], line_index).and_then(|t| t.path)
}
```

- [ ] **Step 2: Update open_brainstorm_terminal to use todo path as cwd**

In `src-tauri/src/brainstorm.rs`, modify `open_brainstorm_terminal`:

After loading `cfg`, resolve the cwd:

```rust
// Determine cwd: if todo has a path, expand ~ and use it; otherwise use workspace
let todo_path = crate::todos::get_todo_path(workspace, line_index, done_file);
let cwd = if let Some(ref p) = todo_path {
    expand_tilde(p)
} else {
    workspace.to_string()
};
```

Add the `expand_tilde` helper at module level:

```rust
fn expand_tilde(path: &str) -> String {
    if path.starts_with("~/") {
        if let Ok(home) = std::env::var("HOME") {
            return format!("{}{}", home, &path[1..]);
        }
    }
    path.to_string()
}
```

Replace `workspace` with `&cwd` in the `spawn_tracked_terminal` calls (both the resume and new-session branches).

- [ ] **Step 3: Add ideate symlink setup before spawning terminal**

In `open_brainstorm_terminal`, after computing `cwd` and before the session lookup/spawn logic, add the symlink setup (only for non-workspace paths):

```rust
// Auto-symlink ideate skill if cwd is not the workspace
if cwd != workspace {
    ensure_ideate_symlink(workspace, &cwd);
}
```

Add the helper function:

```rust
fn ensure_ideate_symlink(workspace: &str, target_dir: &str) {
    let source = Path::new(workspace).join(".claude/skills/ideate");
    let dest = Path::new(target_dir).join(".claude/skills/ideate");

    if dest.exists() {
        // If it's already a correct symlink, skip; if it's a real dir, don't overwrite
        return;
    }

    if !source.exists() {
        return; // Nothing to symlink
    }

    // Create parent dirs
    if let Some(parent) = dest.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    #[cfg(unix)]
    {
        let _ = std::os::unix::fs::symlink(&source, &dest);
    }
}
```

- [ ] **Step 4: No extra deps needed**

The `expand_tilde` function uses `std::env::var("HOME")` which is stdlib — no external crate needed.

- [ ] **Step 5: Run Rust tests to ensure nothing is broken**

Run: `cd src-tauri && cargo test --lib`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/brainstorm.rs src-tauri/src/todos.rs
git commit -m "feat(brainstorm): use todo workspace path as cwd with ideate symlink"
```

---

### Task 7: Verify end-to-end and add Rust unit tests for path grouping edge cases

**Files:**
- Modify: `src-tauri/src/todos.rs` (additional edge case tests)

- [ ] **Step 1: Add test for toggle preserving path comment**

```rust
#[test]
fn toggle_preserves_path_comment() {
    let tmp = std::env::temp_dir().join("journal_todo_toggle_path_test");
    let _ = std::fs::remove_dir_all(&tmp);
    std::fs::create_dir_all(&tmp).unwrap();
    std::fs::write(tmp.join("todos.md"), "- [ ] 修复 bug <!-- path:~/Projects/app-x -->\n").unwrap();
    toggle_todo_in_workspace(tmp.to_str().unwrap(), 0, true, false).unwrap();
    let done = std::fs::read_to_string(tmp.join("todos.done.md")).unwrap();
    assert!(done.contains("path:~/Projects/app-x"), "path comment should be preserved when toggling done");
    std::fs::remove_dir_all(&tmp).ok();
}

#[test]
fn untoggle_preserves_path_comment() {
    let tmp = std::env::temp_dir().join("journal_todo_untoggle_path_test");
    let _ = std::fs::remove_dir_all(&tmp);
    std::fs::create_dir_all(&tmp).unwrap();
    std::fs::write(tmp.join("todos.md"), "# 待办\n\n").unwrap();
    std::fs::write(tmp.join("todos.done.md"), "- [x] 修复 bug <!-- path:~/Projects/app-x --> <!-- done:2026-04-01 -->\n").unwrap();
    toggle_todo_in_workspace(tmp.to_str().unwrap(), 0, false, true).unwrap();
    let content = std::fs::read_to_string(tmp.join("todos.md")).unwrap();
    assert!(content.contains("path:~/Projects/app-x"), "path comment should survive unchecking");
    assert!(!content.contains("done:"), "done comment should be removed");
    std::fs::remove_dir_all(&tmp).ok();
}
```

- [ ] **Step 2: Run all Rust todo tests**

Run: `cd src-tauri && cargo test --lib todos -- --nocapture`
Expected: All PASS (the toggle logic does string replacement on `- [ ]`/`- [x]` and removes `done:` comment — the `path:` comment should survive because `remove_comment` only targets `done:`)

- [ ] **Step 3: Run full build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/todos.rs
git commit -m "test(todos): add edge case tests for path preservation during toggle"
```
