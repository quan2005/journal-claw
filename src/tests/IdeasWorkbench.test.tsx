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
