# Ideas Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the center Ideas view with a lightweight workbench that borrows the automation page rhythm while keeping the todos data model unchanged.

**Architecture:** Add a focused `IdeasWorkbench` component rendered by `DetailView(type="ideas")`. It reads existing `TodoContext`, derives processing stats and filters in the frontend, and calls existing todo handlers for edits, completion, due dates, source navigation, and discussion. Styling lives in a new `ideas-workbench-*` CSS namespace aligned with the existing automation tokens.

**Tech Stack:** React 19, TypeScript, CSS custom properties, Vitest, Testing Library, Tauri IPC through existing todo hooks.

---

## File Structure

- Create: `src/components/IdeasWorkbench.tsx`
  - Owns the center Ideas workbench UI, filter state, stats, draft creation, and row rendering.
  - Exports pure helpers `getIdeaStats`, `filterIdeas`, `ideaSourceLabel`, and `ideaDueLabel` for direct testing.
- Modify: `src/components/TodoSidebar.tsx`
  - Export the existing `DatePicker`, `dueBadgeStyle`, and `formatDueShort` helpers so `IdeasWorkbench` reuses them.
  - Keep current `TodoSidebar` behavior intact.
- Modify: `src/components/DetailView.tsx`
  - Replace the `type === 'ideas'` branch so it renders `IdeasWorkbench`.
  - Add optional callbacks for idea discussion and source navigation.
- Modify: `src/App.tsx`
  - Pass idea discussion and source navigation callbacks into `DetailView`.
- Modify: `src/styles/globals.css`
  - Add `ideas-workbench-*` classes near the automation CSS section.
- Create: `src/tests/IdeasWorkbench.test.tsx`
  - Tests stats, filtering, draft creation, inline edit, completion, source navigation, discussion, and `DetailView` routing.
- Modify: `src/tests/light-theme-unit.test.ts`
  - Adds a CSS contract test for the Ideas workbench class namespace and semantic token usage.

## Task 1: Tests For Ideas Workbench Shell

**Files:**
- Create: `src/tests/IdeasWorkbench.test.tsx`
- Test: `src/tests/IdeasWorkbench.test.tsx`

- [ ] **Step 1: Write the failing shell and filter tests**

Create `src/tests/IdeasWorkbench.test.tsx` with this content:

```tsx
import { act, fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from './setup'
import { IdeasWorkbench, filterIdeas, getIdeaStats } from '../components/IdeasWorkbench'
import type { TodoItem } from '../types'

const mockState = vi.hoisted(() => ({
  todoContext: {
    todos: [] as TodoItem[],
    loading: false,
    refresh: vi.fn(),
    addTodo: vi.fn(),
    toggleTodo: vi.fn(),
    deleteTodo: vi.fn(),
    setTodoDue: vi.fn(),
    updateTodoText: vi.fn(),
    setTodoPath: vi.fn(),
    removeTodoPath: vi.fn(),
    setTodoSessionId: vi.fn(),
  },
}))

vi.mock('../contexts/TodoContext', () => ({
  useTodoContext: () => mockState.todoContext,
}))

vi.mock('../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../lib/tauri')>('../lib/tauri')
  return {
    ...actual,
    getWorkspacePath: vi.fn().mockResolvedValue('/Users/yanwu/Documents/journal'),
    getJournalEntryContent: vi.fn().mockResolvedValue(''),
    getIdentityContent: vi.fn().mockResolvedValue(''),
    getWorkspacePrompt: vi.fn().mockResolvedValue(''),
    resetWorkspacePrompt: vi.fn().mockResolvedValue(''),
    openFile: vi.fn().mockResolvedValue(undefined),
    pickFolder: vi.fn().mockResolvedValue('/Users/yanwu/Documents/journal/projects'),
  }
})

const idea = (overrides: Partial<TodoItem>): TodoItem => ({
  text: '未命名想法',
  done: false,
  due: null,
  done_date: null,
  source: null,
  path: null,
  session_id: null,
  line_index: 1,
  done_file: false,
  ...overrides,
})

const ideas = [
  idea({
    text: '已有会话的想法',
    session_id: 'session_1',
    source: '2605/31-设计记录.md',
    line_index: 1,
  }),
  idea({
    text: '有截止日期的想法',
    due: '2026-05-31',
    path: '~/Documents/journal/projects',
    line_index: 2,
  }),
  idea({
    text: '普通未完成想法',
    line_index: 3,
  }),
  idea({
    text: '已完成想法',
    done: true,
    done_date: '2026-05-30',
    line_index: 4,
    done_file: true,
  }),
]

describe('IdeasWorkbench helpers', () => {
  it('derives processing stats from existing TodoItem fields', () => {
    expect(getIdeaStats(ideas)).toEqual({
      open: 3,
      discussed: 1,
      due: 1,
      done: 1,
      total: 4,
    })
  })

  it('filters ideas without changing the underlying todo data', () => {
    expect(filterIdeas(ideas, 'all').map((item) => item.text)).toEqual([
      '已有会话的想法',
      '有截止日期的想法',
      '普通未完成想法',
    ])
    expect(filterIdeas(ideas, 'discussed').map((item) => item.text)).toEqual(['已有会话的想法'])
    expect(filterIdeas(ideas, 'due').map((item) => item.text)).toEqual(['有截止日期的想法'])
    expect(filterIdeas(ideas, 'done').map((item) => item.text)).toEqual(['已完成想法'])
  })
})

describe('IdeasWorkbench shell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.todoContext.todos = ideas
    mockState.todoContext.loading = false
  })

  it('renders the lightweight workbench header, processing stats, and default unfinished list', () => {
    renderWithProviders(<IdeasWorkbench />)

    expect(screen.getByText('IDEAS')).toBeTruthy()
    expect(screen.getByRole('heading', { name: '想法' })).toBeTruthy()
    expect(screen.getByLabelText('3 未完成')).toBeTruthy()
    expect(screen.getByLabelText('1 已探讨')).toBeTruthy()
    expect(screen.getByLabelText('1 有截止日期')).toBeTruthy()
    expect(screen.getByRole('button', { name: '新建想法' })).toBeTruthy()

    expect(screen.getByText('已有会话的想法')).toBeTruthy()
    expect(screen.getByText('有截止日期的想法')).toBeTruthy()
    expect(screen.getByText('普通未完成想法')).toBeTruthy()
    expect(screen.queryByText('已完成想法')).toBeNull()
  })

  it('filters rows from the tab bar', async () => {
    renderWithProviders(<IdeasWorkbench />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '已探讨 1' }))
    })

    expect(screen.getByText('已有会话的想法')).toBeTruthy()
    expect(screen.queryByText('有截止日期的想法')).toBeNull()
    expect(screen.queryByText('普通未完成想法')).toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '已完成 1' }))
    })

    expect(screen.getByText('已完成想法')).toBeTruthy()
    expect(screen.queryByText('已有会话的想法')).toBeNull()
  })

  it('adds a new idea from the top draft row', async () => {
    renderWithProviders(<IdeasWorkbench />)

    fireEvent.click(screen.getByRole('button', { name: '新建想法' }))
    fireEvent.change(screen.getByLabelText('新想法内容'), {
      target: { value: '新的轻工作台想法' },
    })
    await act(async () => {
      fireEvent.keyDown(screen.getByLabelText('新想法内容'), { key: 'Enter' })
    })

    expect(mockState.todoContext.addTodo).toHaveBeenCalledWith('新的轻工作台想法')
  })
})
```

- [ ] **Step 2: Run the shell tests and verify they fail**

Run:

```bash
npm test -- src/tests/IdeasWorkbench.test.tsx
```

Expected: FAIL because `../components/IdeasWorkbench` does not exist.

- [ ] **Step 3: Commit the failing tests**

```bash
git add src/tests/IdeasWorkbench.test.tsx
git commit -m "test: cover ideas workbench shell"
```

## Task 2: Workbench Shell Implementation

**Files:**
- Create: `src/components/IdeasWorkbench.tsx`
- Modify: `src/components/TodoSidebar.tsx`
- Test: `src/tests/IdeasWorkbench.test.tsx`

- [ ] **Step 1: Export existing todo date helpers**

In `src/components/TodoSidebar.tsx`, change these declarations:

```tsx
function DatePicker({
```

to:

```tsx
export function DatePicker({
```

Change:

```tsx
function dueBadgeStyle(due: string): { color: string; background: string } {
```

to:

```tsx
export function dueBadgeStyle(due: string): { color: string; background: string } {
```

Change:

```tsx
function formatDueShort(due: string): string {
```

to:

```tsx
export function formatDueShort(due: string): string {
```

- [ ] **Step 2: Create the minimal workbench shell**

Create `src/components/IdeasWorkbench.tsx`:

```tsx
import { useMemo, useRef, useState, type MouseEvent } from 'react'
import { CalendarDays, Check, Link2, MessageSquare, MoreHorizontal, Plus } from 'lucide-react'
import { useTranslation } from '../contexts/I18nContext'
import { useTodoContext } from '../contexts/TodoContext'
import type { TodoItem } from '../types'
import { DatePicker, formatDueShort } from './TodoSidebar'

export type IdeasFilter = 'all' | 'discussed' | 'due' | 'done'

export interface IdeaConversationRequest {
  mode: 'chat'
  context: string
  sessionId: string | null
  lineIndex: number
  doneFile: boolean
}

export interface IdeasWorkbenchProps {
  onOpenConversation?: (opts: IdeaConversationRequest) => void
  onNavigateToSource?: (filename: string) => void
}

export function getIdeaStats(todos: TodoItem[]) {
  return {
    open: todos.filter((item) => !item.done).length,
    discussed: todos.filter((item) => !!item.session_id).length,
    due: todos.filter((item) => !item.done && !!item.due).length,
    done: todos.filter((item) => item.done).length,
    total: todos.length,
  }
}

export function filterIdeas(todos: TodoItem[], filter: IdeasFilter) {
  switch (filter) {
    case 'discussed':
      return todos.filter((item) => !!item.session_id)
    case 'due':
      return todos.filter((item) => !item.done && !!item.due)
    case 'done':
      return todos.filter((item) => item.done)
    case 'all':
      return todos.filter((item) => !item.done)
  }
}

export function ideaSourceLabel(item: TodoItem) {
  return item.source ?? item.path ?? '收件箱'
}

export function ideaDueLabel(item: TodoItem) {
  if (item.due) return formatDueShort(item.due)
  if (item.done && item.done_date) return item.done_date
  return '无截止'
}

export function IdeasWorkbench({ onOpenConversation, onNavigateToSource }: IdeasWorkbenchProps) {
  const { t } = useTranslation()
  const todoContext = useTodoContext()
  const [activeFilter, setActiveFilter] = useState<IdeasFilter>('all')
  const [drafting, setDrafting] = useState(false)
  const [draftText, setDraftText] = useState('')

  const stats = useMemo(() => getIdeaStats(todoContext.todos), [todoContext.todos])
  const visibleTodos = useMemo(
    () => filterIdeas(todoContext.todos, activeFilter),
    [activeFilter, todoContext.todos],
  )

  const submitDraft = async () => {
    const text = draftText.trim()
    if (!text) {
      setDrafting(false)
      setDraftText('')
      return
    }
    await todoContext.addTodo(text)
    setDrafting(false)
    setDraftText('')
  }

  const tabs: Array<{ id: IdeasFilter; label: string; count: number }> = [
    { id: 'all', label: '全部', count: stats.open },
    { id: 'discussed', label: '已探讨', count: stats.discussed },
    { id: 'due', label: '有截止日期', count: stats.due },
    { id: 'done', label: '已完成', count: stats.done },
  ]

  return (
    <div className="ideas-workbench">
      <header className="ideas-workbench-header">
        <div>
          <div className="ideas-workbench-eyebrow">IDEAS</div>
          <h2 className="ideas-workbench-title">{t('todo')}</h2>
          <div className="ideas-workbench-summary">
            捕捉阅读和会议中产生的下一步思考。按处理状态筛选，保持轻量扫描。
          </div>
        </div>
        <div className="ideas-workbench-actions">
          <div className="ideas-workbench-stats" aria-label="想法处理状态统计">
            <span aria-label={`${stats.open} 未完成`}>
              <strong>{stats.open}</strong> 未完成
            </span>
            <span aria-label={`${stats.discussed} 已探讨`}>
              <strong>{stats.discussed}</strong> 已探讨
            </span>
            <span aria-label={`${stats.due} 有截止日期`}>
              <strong>{stats.due}</strong> 有截止日期
            </span>
          </div>
          <button
            type="button"
            className="ideas-workbench-button ideas-workbench-button-primary"
            onClick={() => setDrafting(true)}
          >
            <Plus aria-hidden="true" size={17} strokeWidth={1.8} />
            <span>新建想法</span>
          </button>
        </div>
      </header>

      <nav className="ideas-workbench-tabs" aria-label="想法筛选">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`ideas-workbench-tab${activeFilter === tab.id ? ' is-active' : ''}`}
            onClick={() => setActiveFilter(tab.id)}
          >
            {tab.label} <span>{tab.count}</span>
          </button>
        ))}
      </nav>

      <main className="ideas-workbench-main">
        <div className="ideas-workbench-section-head">
          <h3 className="ideas-workbench-section-title">
            {activeFilter === 'done' ? '已完成' : '待处理'}
          </h3>
          <div className="ideas-workbench-count">
            {visibleTodos.length} of {activeFilter === 'done' ? stats.done : stats.open}
          </div>
        </div>

        <div className="ideas-workbench-list">
          {drafting && (
            <div className="ideas-workbench-draft">
              <input
                aria-label="新想法内容"
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void submitDraft()
                  if (event.key === 'Escape') {
                    setDrafting(false)
                    setDraftText('')
                  }
                }}
                onBlur={() => void submitDraft()}
                placeholder={t('addTodo')}
                autoFocus
              />
            </div>
          )}

          {todoContext.loading ? (
            <IdeasLoadingRows />
          ) : visibleTodos.length === 0 ? (
            <div className="ideas-workbench-empty">
              <span className="ideas-workbench-empty-icon">+</span>
              <span>
                <span className="ideas-workbench-row-title">还没有想法</span>
                <span className="ideas-workbench-row-meta">从阅读、会议或临时念头开始记录。</span>
              </span>
            </div>
          ) : (
            visibleTodos.map((item, index) => (
              <IdeasRow
                key={`${item.done_file ? 'done' : 'todo'}-${item.line_index}`}
                item={item}
                index={index + 1}
                onOpenConversation={onOpenConversation}
                onNavigateToSource={onNavigateToSource}
              />
            ))
          )}
        </div>
      </main>
    </div>
  )
}

function IdeasLoadingRows() {
  return (
    <>
      {[0, 1, 2].map((row) => (
        <div key={row} className="ideas-workbench-row ideas-workbench-row-skeleton">
          <span />
          <span />
          <span />
          <span />
        </div>
      ))}
    </>
  )
}

function IdeasRow({
  item,
  index,
  onOpenConversation,
  onNavigateToSource,
}: {
  item: TodoItem
  index: number
  onOpenConversation?: (opts: IdeaConversationRequest) => void
  onNavigateToSource?: (filename: string) => void
}) {
  const todoContext = useTodoContext()
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [editingText, setEditingText] = useState(item.text)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [datePickerPos, setDatePickerPos] = useState({ x: 0, y: 0 })
  const rowRef = useRef<HTMLDivElement>(null)

  const submitText = async () => {
    const text = editingText.trim()
    if (!text) {
      await todoContext.deleteTodo(item.line_index, item.done_file)
    } else if (text !== item.text) {
      await todoContext.updateTodoText(item.line_index, text, item.done_file)
    }
    setEditing(false)
  }

  const openDatePicker = (event: MouseEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    setDatePickerPos({ x: rect.right - 210, y: rect.bottom + 4 })
    setShowDatePicker(true)
  }

  const sourceLabel = ideaSourceLabel(item)

  return (
    <div
      ref={rowRef}
      className={`ideas-workbench-row${item.done ? ' is-done' : ''}`}
      role="row"
      aria-label={item.text}
    >
      <span className="ideas-workbench-index">{index}</span>
      <span className="ideas-workbench-complete-wrap">
        <button
          type="button"
          className="ideas-workbench-complete"
          aria-label={`${item.done ? '恢复' : '完成'}：${item.text}`}
          onClick={() => void todoContext.toggleTodo(item.line_index, !item.done, item.done_file)}
        >
          <Check aria-hidden="true" size={14} strokeWidth={2} />
        </button>
      </span>

      <span className="ideas-workbench-row-main">
        {editing ? (
          <input
            aria-label="编辑想法"
            className="ideas-workbench-edit-input"
            value={editingText}
            onChange={(event) => setEditingText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void submitText()
              if (event.key === 'Escape') {
                setEditingText(item.text)
                setEditing(false)
              }
            }}
            onBlur={() => void submitText()}
            autoFocus
          />
        ) : (
          <button
            type="button"
            className="ideas-workbench-text-button"
            aria-label={`编辑：${item.text}`}
            onDoubleClick={() => setEditing(true)}
            onClick={() => setEditing(true)}
          >
            <span className="ideas-workbench-row-title">{item.text}</span>
            <span className="ideas-workbench-row-meta">
              {item.session_id ? '已关联探讨' : '未探讨'} · {sourceLabel}
            </span>
          </button>
        )}
      </span>

      <span className={`ideas-workbench-pill${item.session_id ? ' is-accent' : ''}`}>
        {item.session_id ? '已探讨' : item.done ? '已完成' : '未探讨'}
      </span>

      <button
        type="button"
        className="ideas-workbench-source"
        aria-label={`打开来源：${sourceLabel}`}
        onClick={() => {
          if (item.source) onNavigateToSource?.(item.source)
        }}
        disabled={!item.source}
      >
        <Link2 aria-hidden="true" size={13} strokeWidth={1.8} />
        <span>{sourceLabel}</span>
      </button>

      <button
        type="button"
        className="ideas-workbench-due"
        aria-label={`${item.due ? '修改截止日期' : '设置截止日期'}：${item.text}`}
        onClick={openDatePicker}
      >
        <CalendarDays aria-hidden="true" size={13} strokeWidth={1.8} />
        <span>{ideaDueLabel(item)}</span>
      </button>

      <button
        type="button"
        className="ideas-workbench-icon-button"
        aria-label={item.session_id ? `继续探讨：${item.text}` : `开始探讨：${item.text}`}
        title={item.session_id ? t('hasDiscussion') : t('startDiscussion')}
        onClick={() =>
          onOpenConversation?.({
            mode: 'chat',
            context: item.text,
            sessionId: item.session_id,
            lineIndex: item.line_index,
            doneFile: item.done_file,
          })
        }
      >
        <MessageSquare aria-hidden="true" size={14} strokeWidth={1.8} />
      </button>

      <button
        type="button"
        className="ideas-workbench-icon-button"
        aria-label={`更多操作：${item.text}`}
      >
        <MoreHorizontal aria-hidden="true" size={15} strokeWidth={1.8} />
      </button>

      {showDatePicker && (
        <div
          className="ideas-workbench-date-popover"
          style={{ left: datePickerPos.x, top: datePickerPos.y }}
        >
          <DatePicker
            initialValue={item.due}
            onSelect={(date) => {
              void todoContext.setTodoDue(item.line_index, date, item.done_file)
              setShowDatePicker(false)
            }}
            onClose={() => setShowDatePicker(false)}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Run the shell tests and verify they pass**

Run:

```bash
npm test -- src/tests/IdeasWorkbench.test.tsx
```

Expected: PASS for helper, shell, filter, and draft creation tests.

- [ ] **Step 4: Commit the shell implementation**

```bash
git add src/components/IdeasWorkbench.tsx src/components/TodoSidebar.tsx src/tests/IdeasWorkbench.test.tsx
git commit -m "feat: add ideas workbench shell"
```

## Task 3: Row Actions And DetailView Routing Tests

**Files:**
- Modify: `src/tests/IdeasWorkbench.test.tsx`
- Test: `src/tests/IdeasWorkbench.test.tsx`

- [ ] **Step 1: Add row action tests**

Append these tests inside the `describe('IdeasWorkbench shell', ...)` block in `src/tests/IdeasWorkbench.test.tsx`:

```tsx
  it('edits idea text inline', async () => {
    renderWithProviders(<IdeasWorkbench />)

    fireEvent.click(screen.getByRole('button', { name: '编辑：普通未完成想法' }))
    fireEvent.change(screen.getByLabelText('编辑想法'), {
      target: { value: '普通未完成想法更新版' },
    })
    await act(async () => {
      fireEvent.keyDown(screen.getByLabelText('编辑想法'), { key: 'Enter' })
    })

    expect(mockState.todoContext.updateTodoText).toHaveBeenCalledWith(
      3,
      '普通未完成想法更新版',
      false,
    )
  })

  it('toggles completion from the row control', async () => {
    renderWithProviders(<IdeasWorkbench />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '完成：普通未完成想法' }))
    })

    expect(mockState.todoContext.toggleTodo).toHaveBeenCalledWith(3, true, false)
  })

  it('opens source and discussion callbacks from row actions', async () => {
    const onNavigateToSource = vi.fn()
    const onOpenConversation = vi.fn()
    renderWithProviders(
      <IdeasWorkbench
        onNavigateToSource={onNavigateToSource}
        onOpenConversation={onOpenConversation}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '打开来源：2605/31-设计记录.md' }))
    expect(onNavigateToSource).toHaveBeenCalledWith('2605/31-设计记录.md')

    fireEvent.click(screen.getByRole('button', { name: '继续探讨：已有会话的想法' }))
    expect(onOpenConversation).toHaveBeenCalledWith({
      mode: 'chat',
      context: '已有会话的想法',
      sessionId: 'session_1',
      lineIndex: 1,
      doneFile: false,
    })
  })
```

- [ ] **Step 2: Add DetailView routing test**

Append this new describe block to the same file:

```tsx
vi.mock('../lib/markdown', () => ({
  renderMarkdown: vi.fn(() => null),
}))

describe('DetailView ideas route', () => {
  it('renders IdeasWorkbench instead of the narrow sidebar list', async () => {
    const { DetailView } = await import('../components/DetailView')

    renderWithProviders(<DetailView type="ideas" />)

    expect(screen.getByText('IDEAS')).toBeTruthy()
    expect(screen.getByRole('heading', { name: '想法' })).toBeTruthy()
    expect(screen.getByLabelText('想法处理状态统计')).toBeTruthy()
  })
})
```

- [ ] **Step 3: Run the tests and verify the new routing test fails**

Run:

```bash
npm test -- src/tests/IdeasWorkbench.test.tsx
```

Expected: FAIL because `DetailView(type="ideas")` still renders `TodoSidebar` directly.

- [ ] **Step 4: Commit the failing row and routing tests**

```bash
git add src/tests/IdeasWorkbench.test.tsx
git commit -m "test: cover ideas workbench interactions"
```

## Task 4: App And DetailView Routing Implementation

**Files:**
- Modify: `src/components/DetailView.tsx`
- Modify: `src/App.tsx`
- Test: `src/tests/IdeasWorkbench.test.tsx`

- [ ] **Step 1: Update DetailView imports and props**

In `src/components/DetailView.tsx`, replace:

```tsx
import { TodoSidebar } from './TodoSidebar'
```

with:

```tsx
import { IdeasWorkbench, type IdeaConversationRequest } from './IdeasWorkbench'
```

Extend `DetailViewProps` with these optional callbacks:

```tsx
  onOpenIdeaConversation?: (opts: IdeaConversationRequest) => void
  onNavigateToIdeaSource?: (filename: string) => void
```

Add the new props to the component parameter list:

```tsx
  onOpenIdeaConversation,
  onNavigateToIdeaSource,
}: DetailViewProps) {
```

- [ ] **Step 2: Replace the ideas branch**

In `src/components/DetailView.tsx`, replace the whole `if (isIdeasMode) { ... }` branch with:

```tsx
  if (isIdeasMode) {
    return (
      <IdeasWorkbench
        onOpenConversation={onOpenIdeaConversation}
        onNavigateToSource={onNavigateToIdeaSource}
      />
    )
  }
```

- [ ] **Step 3: Add App callbacks**

In `src/App.tsx`, add this callback near the other `handle*` callbacks:

```tsx
  const handleOpenIdeaConversation = useCallback(
    (opts: { context: string; sessionId: string | null }) => {
      if (opts.sessionId) {
        openChatPanel(opts.sessionId)
      } else {
        openChatPanel(undefined, opts.context)
      }
    },
    [openChatPanel],
  )
```

Add this source navigation callback near `handleAddToTodo`:

```tsx
  const handleNavigateToIdeaSource = useCallback(
    (filename: string) => {
      window.dispatchEvent(
        new CustomEvent('journal-entry-navigate', {
          detail: { filename: filename.split('/').pop() ?? filename },
        }),
      )
    },
    [],
  )
```

Then pass both into `DetailView`:

```tsx
              onOpenIdeaConversation={handleOpenIdeaConversation}
              onNavigateToIdeaSource={handleNavigateToIdeaSource}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run:

```bash
npm test -- src/tests/IdeasWorkbench.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit routing implementation**

```bash
git add src/components/DetailView.tsx src/App.tsx src/tests/IdeasWorkbench.test.tsx
git commit -m "feat: route ideas detail to workbench"
```

## Task 5: Context Menu And Destructive Actions

**Files:**
- Modify: `src/components/IdeasWorkbench.tsx`
- Modify: `src/tests/IdeasWorkbench.test.tsx`
- Test: `src/tests/IdeasWorkbench.test.tsx`

- [ ] **Step 1: Add context menu tests**

Add this setup near the top of `src/tests/IdeasWorkbench.test.tsx`:

```tsx
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
  configurable: true,
})
```

Append this test to the workbench describe block:

```tsx
  it('preserves right-click menu actions for copy, path, due clearing, and delete', async () => {
    renderWithProviders(<IdeasWorkbench />)

    fireEvent.contextMenu(screen.getByRole('row', { name: '有截止日期的想法' }))

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: '复制文本' }))
    })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('有截止日期的想法')

    fireEvent.contextMenu(screen.getByRole('row', { name: '有截止日期的想法' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: '清除截止日期' }))
    })
    expect(mockState.todoContext.setTodoDue).toHaveBeenCalledWith(2, null, false)

    fireEvent.contextMenu(screen.getByRole('row', { name: '有截止日期的想法' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: '设置路径…' }))
    })
    expect(mockState.todoContext.setTodoPath).toHaveBeenCalledWith(
      2,
      '~/Documents/journal/projects',
      false,
    )

    fireEvent.contextMenu(screen.getByRole('row', { name: '有截止日期的想法' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: '删除' }))
    })
    expect(mockState.todoContext.deleteTodo).toHaveBeenCalledWith(2, false)
  })
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
npm test -- src/tests/IdeasWorkbench.test.tsx
```

Expected: FAIL because the workbench row has no right-click menu yet.

- [ ] **Step 3: Implement row context menu**

In `src/components/IdeasWorkbench.tsx`, import `pickFolder`:

```tsx
import { pickFolder } from '../lib/tauri'
```

Add this type near `IdeaConversationRequest`:

```tsx
interface IdeasContextMenuState {
  x: number
  y: number
  item: TodoItem
}
```

Add this state inside `IdeasWorkbench`:

```tsx
  const [contextMenu, setContextMenu] = useState<IdeasContextMenuState | null>(null)
```

Pass `setContextMenu` into each row:

```tsx
                onContextMenu={setContextMenu}
```

Add this menu after the list closing `</main>` in `IdeasWorkbench`:

```tsx
      {contextMenu && (
        <IdeasContextMenu
          state={contextMenu}
          onClose={() => setContextMenu(null)}
          onOpenConversation={onOpenConversation}
        />
      )}
```

Extend `IdeasRow` props:

```tsx
  onContextMenu: (state: IdeasContextMenuState) => void
```

Add it to the destructured props and row root:

```tsx
      onContextMenu={(event) => {
        event.preventDefault()
        onContextMenu({ x: event.clientX, y: event.clientY, item })
      }}
```

Add this component at the end of `IdeasWorkbench.tsx`:

```tsx
function IdeasContextMenu({
  state,
  onClose,
  onOpenConversation,
}: {
  state: IdeasContextMenuState
  onClose: () => void
  onOpenConversation?: (opts: IdeaConversationRequest) => void
}) {
  const todoContext = useTodoContext()
  const { t } = useTranslation()
  const { item } = state

  const menuItem = (label: string, onClick: () => void | Promise<void>, danger = false) => (
    <button
      type="button"
      role="menuitem"
      className={`ideas-workbench-menu-item${danger ? ' is-danger' : ''}`}
      onClick={() => {
        void Promise.resolve(onClick()).finally(onClose)
      }}
    >
      {label}
    </button>
  )

  return (
    <div
      className="ideas-workbench-menu"
      role="menu"
      style={{ left: state.x, top: state.y }}
      onMouseLeave={() => {}}
    >
      {!item.done_file &&
        menuItem(t('exploreInDepth'), () =>
          onOpenConversation?.({
            mode: 'chat',
            context: item.text,
            sessionId: item.session_id,
            lineIndex: item.line_index,
            doneFile: item.done_file,
          }),
        )}
      {menuItem(t('copyText'), () => navigator.clipboard.writeText(item.text))}
      {item.due &&
        menuItem(t('clearDueDate'), () =>
          todoContext.setTodoDue(item.line_index, null, item.done_file),
        )}
      {!item.done_file &&
        menuItem(t('setPath'), async () => {
          const picked = await pickFolder()
          if (picked) {
            const homePath = picked.replace(/^\/Users\/[^/]+/, '~')
            await todoContext.setTodoPath(item.line_index, homePath, item.done_file)
          }
        })}
      {!item.done_file &&
        item.path &&
        menuItem(t('removePath'), () =>
          todoContext.removeTodoPath(item.line_index, item.done_file),
        )}
      <div className="ideas-workbench-menu-divider" />
      {menuItem(t('deleteTodo'), () => todoContext.deleteTodo(item.line_index, item.done_file), true)}
    </div>
  )
}
```

- [ ] **Step 4: Add outside-click close behavior**

In `IdeasWorkbench`, add this import:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
```

Add this effect after `contextMenu` state:

```tsx
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('keydown', close)
    }
  }, [contextMenu])
```

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm test -- src/tests/IdeasWorkbench.test.tsx
```

Expected: PASS.

Commit:

```bash
git add src/components/IdeasWorkbench.tsx src/tests/IdeasWorkbench.test.tsx
git commit -m "feat: add ideas workbench row actions"
```

## Task 6: CSS And Theme Contract

**Files:**
- Modify: `src/styles/globals.css`
- Modify: `src/tests/light-theme-unit.test.ts`
- Test: `src/tests/light-theme-unit.test.ts`

- [ ] **Step 1: Add failing CSS contract test**

Append this test to `src/tests/light-theme-unit.test.ts`:

```ts
describe('Ideas workbench surface contract', () => {
  it('defines ideas workbench classes and semantic tokens', () => {
    expect(css).toContain('.ideas-workbench')
    expect(css).toContain('--ideas-surface:')
    expect(css).toContain('--ideas-text-muted:')
    expect(css).toContain('.ideas-workbench-row')
    expect(css).toContain('.ideas-workbench-stats')
  })

  it('keeps ideas workbench aligned with automation tokens instead of one-off palette colors', () => {
    const start = css.indexOf('/* ── Ideas workbench')
    const end = css.indexOf('/* ── Markdown body', start)
    const ideasCss = css.slice(start, end)
    expect(start).toBeGreaterThanOrEqual(0)
    expect(ideasCss).toContain('var(--record-btn)')
    expect(ideasCss).toContain('var(--detail-case-bg)')
    expect(ideasCss).not.toContain('linear-gradient')
    expect(ideasCss).not.toContain('box-shadow')
  })
})
```

- [ ] **Step 2: Run the CSS test and verify it fails**

Run:

```bash
npm test -- src/tests/light-theme-unit.test.ts
```

Expected: FAIL because `.ideas-workbench` CSS does not exist.

- [ ] **Step 3: Add Ideas workbench CSS**

In `src/styles/globals.css`, add this block after the automation workbench CSS and before the next major section:

```css
/* ── Ideas workbench ───────────────────────────── */
.ideas-workbench {
  --ideas-surface: var(--detail-case-bg);
  --ideas-surface-hover: color-mix(in srgb, var(--record-btn) 4%, var(--detail-case-bg));
  --ideas-surface-active: color-mix(in srgb, var(--record-btn) 8%, var(--detail-case-bg));
  --ideas-border: var(--divider);
  --ideas-text: var(--item-text);
  --ideas-text-muted: var(--item-meta);
  --ideas-text-faint: color-mix(in srgb, var(--item-meta) 62%, var(--bg));
  --ideas-accent-soft: color-mix(in srgb, var(--record-btn) 10%, transparent);
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg);
  color: var(--ideas-text);
}

.ideas-workbench-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding: 38px 30px 24px;
  flex-shrink: 0;
}

.ideas-workbench-eyebrow {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  min-height: 28px;
  margin-bottom: 18px;
  padding: 0 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--record-btn) 13%, var(--ideas-surface));
  color: var(--record-btn);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.ideas-workbench-title {
  margin: 0;
  font-size: 40px;
  font-weight: var(--font-semibold);
  letter-spacing: 0;
  line-height: 1.05;
}

.ideas-workbench-summary {
  max-width: 560px;
  margin-top: 18px;
  color: var(--ideas-text-muted);
  font-size: var(--text-md);
  line-height: 1.5;
}

.ideas-workbench-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.ideas-workbench-stats {
  min-height: 42px;
  display: inline-flex;
  overflow: hidden;
  border: 1px solid var(--ideas-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--ideas-surface) 78%, var(--bg));
}

.ideas-workbench-stats span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0 14px;
  border-right: 1px solid var(--ideas-border);
  color: var(--ideas-text-muted);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
}

.ideas-workbench-stats span:last-child {
  border-right: 0;
}

.ideas-workbench-stats strong {
  color: var(--ideas-text);
  font-size: var(--text-md);
}

.ideas-workbench-button {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 13px;
  border: 1px solid var(--ideas-border);
  border-radius: 6px;
  background: transparent;
  color: var(--ideas-text-muted);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
}

.ideas-workbench-button-primary {
  min-height: 42px;
  border-color: color-mix(in srgb, var(--record-btn) 52%, var(--ideas-border));
  background: color-mix(in srgb, var(--record-btn) 19%, var(--ideas-surface));
  color: var(--ideas-text);
  padding: 0 18px;
}

.ideas-workbench-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  margin: 0 30px 0;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--ideas-border);
}

.ideas-workbench-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ideas-text-muted);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
}

.ideas-workbench-tab.is-active {
  color: var(--ideas-text);
}

.ideas-workbench-tab span {
  min-width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ideas-text-muted) 12%, transparent);
  color: var(--ideas-text-muted);
  font-size: var(--text-xs);
}

.ideas-workbench-tab.is-active span {
  background: color-mix(in srgb, var(--record-btn) 22%, transparent);
  color: var(--record-btn);
}

.ideas-workbench-main {
  min-height: 0;
  overflow: auto;
  padding: 24px 30px 34px;
}

.ideas-workbench-section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 12px;
}

.ideas-workbench-section-title {
  margin: 0;
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
}

.ideas-workbench-count {
  color: var(--ideas-text-muted);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
}

.ideas-workbench-list {
  overflow: hidden;
  border: 1px solid var(--ideas-border);
  border-radius: 8px;
  background: var(--ideas-surface);
}

.ideas-workbench-row {
  position: relative;
  width: 100%;
  min-height: 64px;
  display: grid;
  grid-template-columns: 28px 28px minmax(180px, 1fr) minmax(78px, auto) minmax(120px, 0.45fr) minmax(86px, auto) 34px 34px;
  gap: 10px;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid var(--ideas-border);
  background: transparent;
}

.ideas-workbench-row:last-child {
  border-bottom: 0;
}

.ideas-workbench-row:hover {
  background: var(--ideas-surface-hover);
}

.ideas-workbench-row.is-done {
  opacity: 0.72;
}

.ideas-workbench-index {
  color: var(--ideas-text-faint);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-align: right;
}

.ideas-workbench-complete,
.ideas-workbench-icon-button {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--ideas-border);
  border-radius: 6px;
  background: transparent;
  color: var(--ideas-text-muted);
  cursor: pointer;
}

.ideas-workbench-complete:hover,
.ideas-workbench-icon-button:hover {
  border-color: color-mix(in srgb, var(--record-btn) 32%, var(--ideas-border));
  color: var(--record-btn);
  background: var(--ideas-surface-hover);
}

.ideas-workbench-row-main {
  min-width: 0;
}

.ideas-workbench-text-button {
  width: 100%;
  display: block;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: text;
}

.ideas-workbench-row-title {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
}

.ideas-workbench-row-meta {
  display: block;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ideas-text-muted);
  font-size: var(--text-xs);
}

.ideas-workbench-edit-input,
.ideas-workbench-draft input {
  width: 100%;
  min-height: 32px;
  border: 0;
  background: transparent;
  color: var(--ideas-text);
  font-family: var(--font-body);
  font-size: var(--text-base);
  outline: none;
}

.ideas-workbench-pill {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  min-height: 22px;
  padding: 0 8px;
  border: 1px solid var(--ideas-border);
  border-radius: 5px;
  color: var(--ideas-text-muted);
  background: transparent;
  font-size: var(--text-xs);
  white-space: nowrap;
}

.ideas-workbench-pill.is-accent {
  border-color: color-mix(in srgb, var(--record-btn) 36%, var(--ideas-border));
  color: var(--record-btn);
  background: var(--ideas-accent-soft);
}

.ideas-workbench-source,
.ideas-workbench-due {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 0;
  background: transparent;
  color: var(--ideas-text-muted);
  font-family: var(--font-body);
  font-size: var(--text-xs);
  cursor: pointer;
}

.ideas-workbench-source:disabled {
  cursor: default;
  opacity: 0.65;
}

.ideas-workbench-source span,
.ideas-workbench-due span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ideas-workbench-draft,
.ideas-workbench-empty {
  min-height: 64px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--ideas-border);
}

.ideas-workbench-empty {
  min-height: 108px;
  color: var(--ideas-text-muted);
}

.ideas-workbench-empty-icon {
  width: 46px;
  height: 46px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: color-mix(in srgb, var(--record-btn) 12%, var(--ideas-surface));
  color: var(--record-btn);
  font-size: 24px;
}

.ideas-workbench-row-skeleton span {
  height: 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ideas-text-muted) 12%, transparent);
}

.ideas-workbench-date-popover,
.ideas-workbench-menu {
  position: fixed;
  z-index: 1000;
}

.ideas-workbench-menu {
  min-width: 160px;
  overflow: hidden;
  padding: 4px 0;
  border: 1px solid var(--context-menu-border);
  border-radius: 8px;
  background: var(--context-menu-bg);
}

.ideas-workbench-menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border: 0;
  background: transparent;
  color: var(--ideas-text);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  text-align: left;
  cursor: pointer;
}

.ideas-workbench-menu-item:hover {
  background: var(--item-hover-bg);
}

.ideas-workbench-menu-item.is-danger {
  color: var(--status-danger);
}

.ideas-workbench-menu-divider {
  height: 1px;
  margin: 4px 0;
  background: var(--divider);
}

@media (max-width: 1040px) {
  .ideas-workbench-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .ideas-workbench-actions {
    justify-content: flex-start;
  }

  .ideas-workbench-row {
    grid-template-columns: 28px 28px minmax(160px, 1fr) minmax(78px, auto) 34px 34px;
  }

  .ideas-workbench-source,
  .ideas-workbench-due {
    display: none;
  }
}
```

- [ ] **Step 4: Run CSS and workbench tests**

Run:

```bash
npm test -- src/tests/light-theme-unit.test.ts src/tests/IdeasWorkbench.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit CSS implementation**

```bash
git add src/styles/globals.css src/tests/light-theme-unit.test.ts
git commit -m "style: add ideas workbench layout"
```

## Task 7: Build Verification And Visual Smoke

**Files:**
- No production file changes expected.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
npm test -- src/tests/IdeasWorkbench.test.tsx src/tests/light-theme-unit.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run build**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite build complete successfully.

- [ ] **Step 3: Start frontend dev server**

Run:

```bash
npm run dev
```

Expected: Vite starts and reports a localhost URL, normally `http://localhost:1420`.

- [ ] **Step 4: Browser smoke check**

Open the Vite URL in the in-app browser. Navigate to the Ideas entry in the left sidebar. Verify:

- The center view title is `想法`.
- The stats row shows `未完成`, `已探讨`, and `有截止日期`.
- The default list does not show completed ideas.
- Filter tabs change the visible rows.
- Row text, chips, and actions do not overlap at desktop width.
- At a narrow viewport, secondary source/due columns collapse before the idea text becomes unreadable.

- [ ] **Step 5: Stop the dev server**

Stop the `npm run dev` process with Ctrl+C in the terminal session that is running it.

- [ ] **Step 6: Final commit if verification required adjustments**

If verification required fixes, commit them:

```bash
git add src/components/IdeasWorkbench.tsx src/components/DetailView.tsx src/App.tsx src/styles/globals.css src/tests/IdeasWorkbench.test.tsx src/tests/light-theme-unit.test.ts
git commit -m "fix: polish ideas workbench verification issues"
```

Expected: no commit is needed if Task 1 through Task 6 already pass unchanged.
