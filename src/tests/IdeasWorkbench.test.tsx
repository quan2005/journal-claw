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

  it('opens source and discussion callbacks from row actions', () => {
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
    expect(screen.getByLabelText('想法处理状态统计')).toBeTruthy()
  })
})
