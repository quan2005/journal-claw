import { act, fireEvent, screen, within } from '@testing-library/react'
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

vi.mock('../lib/markdown', () => ({
  renderMarkdown: vi.fn(() => null),
}))

Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
  configurable: true,
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
    session_id: 'done_session',
    line_index: 4,
    done_file: true,
  }),
]

describe('IdeasWorkbench helpers', () => {
  it('derives processing stats from existing TodoItem fields', () => {
    expect(getIdeaStats(ideas)).toEqual({
      open: 3,
      pendingDiscussion: 2,
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
    expect(filterIdeas(ideas, 'pendingDiscussion').map((item) => item.text)).toEqual([
      '有截止日期的想法',
      '普通未完成想法',
    ])
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

  it('renders the lightweight workbench header, filter tabs, create action, and default unfinished list', () => {
    const { container } = renderWithProviders(<IdeasWorkbench />)

    expect(screen.getByText('IDEAS')).toBeTruthy()
    expect(screen.getByRole('heading', { name: '想法' })).toBeTruthy()
    expect(container.querySelector('.ideas-workbench-stats')).toBeNull()
    expect(screen.queryByLabelText('3 未完成')).toBeNull()
    expect(screen.queryByLabelText('2 待探讨')).toBeNull()
    expect(screen.queryByLabelText('1 有截止日期')).toBeNull()
    expect(screen.getByRole('button', { name: '全部（未完成） 3' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '待探讨（未完成且未探讨） 2' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '有截止日期（未完成） 1' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '已完成 1' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '新建想法' })).toBeTruthy()

    expect(screen.getByText('已有会话的想法')).toBeTruthy()
    expect(screen.getByText('有截止日期的想法')).toBeTruthy()
    expect(screen.getByText('普通未完成想法')).toBeTruthy()
    expect(screen.queryByText('已完成想法')).toBeNull()
  })

  it('filters rows from the tab bar', async () => {
    renderWithProviders(<IdeasWorkbench />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '待探讨（未完成且未探讨） 2' }))
    })

    expect(screen.queryByText('已有会话的想法')).toBeNull()
    expect(screen.getByText('有截止日期的想法')).toBeTruthy()
    expect(screen.getByText('普通未完成想法')).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '已完成 1' }))
    })

    expect(screen.getByText('已完成想法')).toBeTruthy()
    expect(screen.queryByText('已有会话的想法')).toBeNull()
  })

  it('does not render a repeated section status bar above open or completed lists', async () => {
    const { container } = renderWithProviders(<IdeasWorkbench />)

    expect(container.querySelector('.ideas-workbench-section-head')).toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '已完成 1' }))
    })

    expect(container.querySelector('.ideas-workbench-section-head')).toBeNull()
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
    expect(mockState.todoContext.addTodo).not.toHaveBeenCalled()

    await act(async () => {
      fireEvent.keyDown(screen.getByLabelText('新想法内容'), { key: 'Enter', metaKey: true })
    })

    expect(mockState.todoContext.addTodo).toHaveBeenCalledWith('新的轻工作台想法')
  })

  it('edits idea text inline', async () => {
    renderWithProviders(<IdeasWorkbench />)

    fireEvent.click(screen.getByRole('button', { name: '编辑：普通未完成想法' }))
    const row = screen.getByRole('row', { name: '普通未完成想法' })

    const editor = within(row).getByLabelText('编辑想法')
    expect(editor.tagName).toBe('TEXTAREA')
    expect(within(row).getByRole('button', { name: '完成：普通未完成想法' })).toBeTruthy()
    expect(within(row).getByRole('button', { name: '开始探讨：普通未完成想法' })).toBeTruthy()
    expect(within(row).queryByRole('button', { name: '更多操作：普通未完成想法' })).toBeNull()

    fireEvent.change(screen.getByLabelText('编辑想法'), {
      target: { value: '普通未完成想法更新版' },
    })
    await act(async () => {
      fireEvent.keyDown(screen.getByLabelText('编辑想法'), { key: 'Enter', metaKey: true })
    })

    expect(mockState.todoContext.updateTodoText).toHaveBeenCalledWith(
      3,
      '普通未完成想法更新版',
      false,
    )
  })

  it('keeps Enter for line breaks and saves multiline edits with command enter', async () => {
    renderWithProviders(<IdeasWorkbench />)

    fireEvent.click(screen.getByRole('button', { name: '编辑：普通未完成想法' }))
    const editor = screen.getByLabelText('编辑想法')

    fireEvent.change(editor, {
      target: { value: '第一行\n第二行' },
    })
    await act(async () => {
      fireEvent.keyDown(editor, { key: 'Enter' })
    })
    expect(mockState.todoContext.updateTodoText).not.toHaveBeenCalled()

    await act(async () => {
      fireEvent.keyDown(editor, { key: 'Enter', metaKey: true })
    })
    expect(mockState.todoContext.updateTodoText).toHaveBeenCalledWith(3, '第一行\n第二行', false)
  })

  it('renders multiline idea text in the same row surface', () => {
    mockState.todoContext.todos = [
      idea({
        text: '第一行\n第二行',
        line_index: 1,
      }),
    ]

    renderWithProviders(<IdeasWorkbench />)

    const row = screen.getByRole('row', { name: '第一行\n第二行' })
    expect(row.querySelector('.ideas-workbench-row-title')?.textContent).toBe('第一行\n第二行')
  })

  it('includes transparent borders when autosizing multiline edits', () => {
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'scrollHeight',
    )
    const originalGetComputedStyle = window.getComputedStyle.bind(window)
    const getComputedStyleSpy = vi.spyOn(window, 'getComputedStyle')

    Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', {
      configurable: true,
      get: () => 56,
    })
    getComputedStyleSpy.mockImplementation((element, pseudoElt) => {
      const style = originalGetComputedStyle(element, pseudoElt)
      if (!(element instanceof HTMLTextAreaElement)) return style

      return new Proxy(style, {
        get(target, prop, receiver) {
          if (prop === 'borderTopWidth' || prop === 'borderBottomWidth') return '1px'
          return Reflect.get(target, prop, receiver)
        },
      })
    })

    try {
      renderWithProviders(<IdeasWorkbench />)

      fireEvent.click(screen.getByRole('button', { name: '编辑：普通未完成想法' }))

      expect((screen.getByLabelText('编辑想法') as HTMLTextAreaElement).style.height).toBe('58px')
    } finally {
      getComputedStyleSpy.mockRestore()
      if (scrollHeightDescriptor) {
        Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', scrollHeightDescriptor)
      } else {
        delete (HTMLTextAreaElement.prototype as unknown as Record<string, unknown>).scrollHeight
      }
    }
  })

  it('keeps original row controls visible without the more button', () => {
    renderWithProviders(<IdeasWorkbench />)

    const row = screen.getByRole('row', { name: '已有会话的想法' })

    expect(within(row).getByRole('button', { name: '编辑：已有会话的想法' })).toBeTruthy()
    expect(within(row).getByRole('button', { name: '完成：已有会话的想法' })).toBeTruthy()
    expect(within(row).getByRole('button', { name: '打开来源：2605/31-设计记录.md' })).toBeTruthy()
    expect(within(row).getByRole('button', { name: '设置截止日期：已有会话的想法' })).toBeTruthy()
    expect(within(row).getByRole('button', { name: '继续探讨：已有会话的想法' })).toBeTruthy()
    expect(within(row).queryByRole('button', { name: '更多操作：已有会话的想法' })).toBeNull()
  })

  it('does not show linked document metadata under idea titles', () => {
    renderWithProviders(<IdeasWorkbench />)

    const row = screen.getByRole('row', { name: '已有会话的想法' })

    expect(within(row).queryByText('2605/31-设计记录.md')).toBeNull()
  })

  it('does not render visible ordinal numbers in idea rows', () => {
    renderWithProviders(<IdeasWorkbench />)

    const row = screen.getByRole('row', { name: '普通未完成想法' })

    expect(row.querySelector('.ideas-workbench-index')).toBeNull()
  })

  it('shows discussion state through the discussion icon style only', () => {
    renderWithProviders(<IdeasWorkbench />)

    const discussedRow = screen.getByRole('row', { name: '已有会话的想法' })
    const plainRow = screen.getByRole('row', { name: '普通未完成想法' })

    expect(discussedRow.querySelector('.ideas-workbench-pill')).toBeNull()
    expect(within(discussedRow).queryByText('已探讨')).toBeNull()
    expect(within(discussedRow).queryByText('已关联探讨', { exact: false })).toBeNull()
    expect(
      within(discussedRow)
        .getByRole('button', { name: '继续探讨：已有会话的想法' })
        .classList.contains('is-discussed'),
    ).toBe(true)
    expect(within(plainRow).queryByText('未探讨')).toBeNull()
    expect(
      within(plainRow)
        .getByRole('button', { name: '开始探讨：普通未完成想法' })
        .classList.contains('is-discussed'),
    ).toBe(false)
  })

  it('renders row operation buttons as icons without visible text labels', () => {
    renderWithProviders(<IdeasWorkbench />)

    const row = screen.getByRole('row', { name: '已有会话的想法' })
    const sourceButton = within(row).getByRole('button', {
      name: '打开来源：2605/31-设计记录.md',
    })
    const dueButton = within(row).getByRole('button', {
      name: '设置截止日期：已有会话的想法',
    })

    expect(within(sourceButton).queryByText('2605/31-设计记录.md')).toBeNull()
    expect(within(dueButton).queryByText('无截止')).toBeNull()
  })

  it('renders the completion control as a check-square line icon', () => {
    renderWithProviders(<IdeasWorkbench />)

    const row = screen.getByRole('row', { name: '普通未完成想法' })
    const completeButton = within(row).getByRole('button', { name: '完成：普通未完成想法' })

    expect(completeButton.querySelector('.ideas-workbench-complete-box')).toBeTruthy()
    expect(completeButton.querySelector('.ideas-workbench-complete-check')).toBeTruthy()
  })

  it('toggles completion from the visible row checkbox', async () => {
    renderWithProviders(<IdeasWorkbench />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '完成：普通未完成想法' }))
    })

    expect(mockState.todoContext.toggleTodo).toHaveBeenCalledWith(3, true, false)
  })

  it('opens source and discussion callbacks from visible row actions', () => {
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
})

describe('DetailView ideas route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.todoContext.todos = ideas
    mockState.todoContext.loading = false
  })

  it('renders IdeasWorkbench instead of the narrow sidebar list', async () => {
    const { DetailView } = await import('../components/DetailView')

    renderWithProviders(<DetailView type="ideas" />)

    expect(screen.getByText('IDEAS')).toBeTruthy()
    expect(screen.getByRole('heading', { name: '想法' })).toBeTruthy()
    expect(screen.queryByLabelText('想法处理状态统计')).toBeNull()
    expect(screen.getByRole('button', { name: '全部（未完成） 3' })).toBeTruthy()
  })
})
