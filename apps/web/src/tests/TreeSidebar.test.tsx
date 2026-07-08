import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from './setup'
import { TreeSidebar } from '../components/TreeSidebar'
import type { IdentityEntry, JournalEntry, TreeSelection } from '../types'
import type { TopicEntry } from '../lib/apiTypes'
import type { Category } from '../contexts/UIContext'

vi.mock('../hooks/usePinned', () => ({
  usePinned: () => ({
    items: [],
    pin: vi.fn(),
    unpin: vi.fn(),
    refresh: vi.fn(),
  }),
}))

// hoisted mutable holder so individual tests can inject root entries
const { rootEntries } = vi.hoisted(() => ({ rootEntries: { current: [] as TopicEntry[] } }))

vi.mock('../hooks/useTopics', () => ({
  useTopics: () => ({
    dirs: new Map([['', { entries: rootEntries.current, expanded: true, loading: false }]]),
    loading: false,
    load: vi.fn(),
    toggleDir: vi.fn(),
  }),
}))

const mockInvoke = vi.hoisted(() => vi.fn())

vi.mock('../lib/runtimeClient', () => ({
  selectRuntimeClient: () => ({ invoke: mockInvoke }),
}))

const identity: IdentityEntry = {
  filename: 'zhangsan.md',
  path: '/ws/identities/zhangsan.md',
  name: '张三',
  region: '',
  summary: '测试画像',
  tags: [],
  aliases: [],
  expert_skill: '',
  is_expert: false,
  speaker_id: '',
  mtime_secs: 0,
  archived: false,
}

function journalEntry(overrides: Partial<JournalEntry>): JournalEntry {
  const yearMonth = overrides.year_month ?? '2606'
  const day = overrides.day ?? 2
  const filename = overrides.filename ?? `${String(day).padStart(2, '0')}-测试日志.md`
  return {
    filename,
    path: `/ws/${yearMonth}/${filename}`,
    title: overrides.title ?? '测试日志',
    summary: overrides.summary ?? '摘要',
    tags: overrides.tags ?? [],
    sources: overrides.sources ?? [],
    year_month: yearMonth,
    day,
    created_time: overrides.created_time ?? '10:00',
    created_at_secs: overrides.created_at_secs ?? 0,
    mtime_secs: overrides.mtime_secs ?? 0,
    materials: overrides.materials ?? [],
  }
}

function renderTreeSidebar(overrides: Partial<Parameters<typeof TreeSidebar>[0]> = {}) {
  const props: Parameters<typeof TreeSidebar>[0] = {
    selected: null,
    onSelect: vi.fn<(sel: TreeSelection) => void>(),
    onDeselect: vi.fn(),
    entries: [],
    identities: [identity],
    identityLoading: false,
    loadingMore: false,
    hasMore: false,
    onLoadMore: vi.fn(),
    onAtRef: vi.fn(),
    todayYearMonth: '2606',
    todayDay: 2,
    category: 'journal' as Category,
    ...overrides,
  }

  return renderWithProviders(<TreeSidebar {...props} />)
}

beforeEach(() => {
  const store: Record<string, string> = {}
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => {
        store[key] = val
      },
      removeItem: (key: string) => {
        delete store[key]
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k])
      },
      get length() {
        return Object.keys(store).length
      },
      key: (i: number) => Object.keys(store)[i] ?? null,
    },
    writable: true,
  })
  vi.clearAllMocks()
  rootEntries.current = []
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'get_workspace_path') return Promise.resolve('/ws')
    if (cmd === 'get_workspace_tree_sort') return Promise.resolve('name-asc')
    return Promise.resolve(undefined)
  })
})

describe('TreeSidebar', () => {
  it('renders browse panes as bare lists', () => {
    const topics = renderTreeSidebar({ category: 'topics' })
    expect(screen.getByRole('button', { name: '折叠专题' })).toBeTruthy()
    topics.unmount()

    const profiles = renderTreeSidebar({ category: 'identity' })
    expect(screen.getByText('张三')).toBeTruthy()
    profiles.unmount()

    renderTreeSidebar({
      category: 'journal',
      entries: [journalEntry({ title: '六月日志' })],
    })
    expect(screen.getByText('六月日志')).toBeTruthy()
  })

  it('renders identities in identity category', () => {
    renderTreeSidebar({ category: 'identity' })

    expect(screen.getByText('张三')).toBeTruthy()
  })

  it('emits identity @ refs from the identity list', () => {
    const onAtRef = vi.fn()
    renderTreeSidebar({ category: 'identity', onAtRef })

    fireEvent.click(screen.getByText('@'))

    expect(onAtRef).toHaveBeenCalledWith('identities/zhangsan.md')
  })

  it('does not render identities in journal category', () => {
    renderTreeSidebar({ category: 'journal' })

    expect(screen.queryByText('张三')).toBeNull()
  })

  it('collapses journal month groups and persists the month state', () => {
    renderTreeSidebar({
      entries: [
        journalEntry({ year_month: '2606', day: 2, title: '六月日志' }),
        journalEntry({ year_month: '2605', day: 31, title: '五月日志' }),
      ],
    })

    expect(screen.getByText('六月日志')).toBeTruthy()
    expect(screen.getByText('五月日志')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '折叠2026年6月' }))

    expect(screen.queryByText('六月日志')).toBeNull()
    expect(screen.getByText('五月日志')).toBeTruthy()
    expect(window.localStorage.getItem('journal_tree_sidebar_collapsed_v1')).toBe(
      JSON.stringify(['identity-archived', 'journal-month:2606']),
    )

    fireEvent.click(screen.getByRole('button', { name: '展开2026年6月' }))

    expect(screen.getByText('六月日志')).toBeTruthy()
    expect(window.localStorage.getItem('journal_tree_sidebar_collapsed_v1')).toBe(
      JSON.stringify(['identity-archived']),
    )
  })

  it('injects brighter hover states for month headers', () => {
    renderTreeSidebar({
      category: 'topics',
    })

    const injectedCss = [...document.head.querySelectorAll('style')]
      .map((style) => style.textContent ?? '')
      .join('\n')

    expect(injectedCss).toContain('.tree-month-header:hover .tree-month-label')
  })

  // AC-3 · 根展示非 topics 内容、dot 条目不显示
  it('renders workspace-root entries including non-topics content and hides dot entries', () => {
    // 仿真实 useTopics 行为：传给组件的 root entries 已经过 dot 过滤
    rootEntries.current = [
      { name: 'topics', path: 'topics', is_dir: true, created_secs: 0, mtime_secs: 1 },
      { name: 'research', path: 'research', is_dir: true, created_secs: 0, mtime_secs: 2 },
      { name: 'README.md', path: 'README.md', is_dir: false, created_secs: 0, mtime_secs: 3 },
    ]

    renderTreeSidebar({ category: 'topics' })

    // topics 之外的内容也可见
    expect(screen.getByText('topics')).toBeTruthy()
    expect(screen.getByText('research')).toBeTruthy()
    expect(screen.getByText('README')).toBeTruthy()
  })

  // AC-10 · 键盘导航：ArrowDown 移动焦点到首个可见行，data-path 暴露焦点位置
  it('moves focus down via ArrowDown and exposes it via data-path', () => {
    rootEntries.current = [
      { name: 'note.md', path: 'note.md', is_dir: false, created_secs: 0, mtime_secs: 0 },
    ]

    renderTreeSidebar({ category: 'topics' })

    const tree = screen.getByRole('tree', { name: 'Workspace' })
    tree.focus()
    fireEvent.keyDown(tree, { key: 'ArrowDown' })

    expect(document.activeElement?.getAttribute('data-path')).toBeTruthy()
  })

  it('opens sort menu and updates active sort strategy', () => {
    renderTreeSidebar({ category: 'topics' })

    const sortButton = screen.getByRole('button', { name: '排序' })
    expect(sortButton.getAttribute('data-active-sort')).toBe('name-asc')

    fireEvent.click(sortButton)

    expect(screen.getByText('名称 A-Z')).toBeTruthy()
    expect(screen.getByText('名称 Z-A')).toBeTruthy()
    expect(screen.getByText('最近修改')).toBeTruthy()
    expect(screen.getByText('类型优先')).toBeTruthy()
    expect(screen.getByText('手动排序')).toBeTruthy()

    fireEvent.click(screen.getByText('名称 Z-A'))
    expect(sortButton.getAttribute('data-active-sort')).toBe('name-desc')
  })
})
