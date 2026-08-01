import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEvent, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import * as path from 'node:path'
import { renderWithProviders } from './setup'
import { TreeSidebar } from '../components/TreeSidebar'
import type { IdentityEntry, JournalEntry, TreeSelection } from '../types'
import type { TopicEntry } from '../lib/apiTypes'
import type { Category } from '../contexts/UIContext'

declare const __dirname: string

const workspaceTreeCss = readFileSync(
  (path as unknown as { resolve: (...segments: string[]) => string }).resolve(
    __dirname,
    '../styles/workspace-tree.css',
  ),
  'utf-8',
)

let workspaceTreeCssInstalled = false

function installWorkspaceTreeCss() {
  if (workspaceTreeCssInstalled) return
  const style = document.createElement('style')
  style.textContent = workspaceTreeCss
  document.head.appendChild(style)
  workspaceTreeCssInstalled = true
}

vi.mock('../hooks/usePinned', () => ({
  usePinned: () => ({
    items: pinnedItems.current,
    pin: vi.fn(),
    unpin: vi.fn(),
    refresh: mockRefreshPinned,
  }),
}))

// hoisted mutable holders so individual tests can inject workspace fixtures
const { rootEntries, pinnedItems } = vi.hoisted(() => ({
  rootEntries: { current: [] as TopicEntry[] },
  pinnedItems: {
    current: [] as Array<{ type: 'journal' | 'identity' | 'topic'; path: string; order: number }>,
  },
}))

const mockRefreshPinned = vi.hoisted(() => vi.fn())
const mockLoadTopics = vi.hoisted(() => vi.fn())
const mockHostAsk = vi.hoisted(() => vi.fn())
const mockHostConfirm = vi.hoisted(() => vi.fn())

vi.mock('../hooks/useTopics', () => ({
  useTopics: () => ({
    dirs: new Map([['', { entries: rootEntries.current, expanded: true, loading: false }]]),
    loading: false,
    load: mockLoadTopics,
    toggleDir: vi.fn(),
  }),
}))

const mockInvoke = vi.hoisted(() => vi.fn())

vi.mock('../lib/runtimeClient', () => ({
  selectRuntimeClient: () => ({ invoke: mockInvoke }),
}))

vi.mock('../lib/hostBridge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/hostBridge')>()),
  hostAsk: mockHostAsk,
  hostConfirm: mockHostConfirm,
}))

const workspaceDeleteCases = [
  {
    itemType: 'topic-file' as const,
    name: 'AGENTS.md',
    path: '帮助文档/AGENTS.md',
    expectedRelativePath: '帮助文档/AGENTS.md',
    isDirectory: false,
    rowName: /AGENTS/i,
    deleteLabel: '删除条目',
  },
  {
    itemType: 'topic-folder' as const,
    name: 'System',
    path: 'System',
    expectedRelativePath: 'System',
    isDirectory: true,
    rowName: /System/i,
    deleteLabel: '删除文件夹',
  },
]

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
  pinnedItems.current = []
  mockHostAsk.mockResolvedValue(true)
  mockHostConfirm.mockResolvedValue(true)
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'get_workspace_path') return Promise.resolve('/ws')
    if (cmd === 'get_workspace_tree_sort') return Promise.resolve('name-asc')
    if (cmd === 'list_workspace_dir') return Promise.resolve([])
    return Promise.resolve(undefined)
  })
})

describe('TreeSidebar', () => {
  it('renders the personal workspace header with a persistent sorting control', () => {
    const topics = renderTreeSidebar({ category: 'topics' })
    expect(screen.getByText('个人空间')).toBeTruthy()
    expect(screen.getByRole('button', { name: '排序' })).toBeTruthy()
    expect(screen.queryByText('Workspace')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Search' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'View layout' })).toBeNull()
    expect(screen.queryByRole('button', { name: '折叠工作空间' })).toBeNull()
    expect(screen.getByRole('tree', { name: '个人空间' })).toBeTruthy()
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

  it.each(workspaceDeleteCases)(
    'deletes a confirmed $itemType through the workspace runtime command and refreshes',
    async ({ name, path, expectedRelativePath, isDirectory, rowName, deleteLabel }) => {
      rootEntries.current = [{ name, path, is_dir: isDirectory, created_secs: 0, mtime_secs: 0 }]
      mockHostConfirm.mockResolvedValue(true)
      mockHostAsk.mockResolvedValue(false)
      const onDeselect = vi.fn()

      renderTreeSidebar({ category: 'topics', onDeselect })
      await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('get_workspace_path'))
      mockInvoke.mockClear()
      mockRefreshPinned.mockClear()
      mockLoadTopics.mockClear()

      fireEvent.contextMenu(screen.getByRole('treeitem', { name: rowName }))
      fireEvent.click(screen.getByText(deleteLabel))

      await waitFor(() =>
        expect(mockInvoke).toHaveBeenCalledWith('workspace_delete_file', {
          relativePath: expectedRelativePath,
        }),
      )
      expect(onDeselect).toHaveBeenCalledOnce()
      expect(mockRefreshPinned).toHaveBeenCalledOnce()
      expect(mockLoadTopics).toHaveBeenCalledOnce()
    },
  )

  it.each(workspaceDeleteCases)(
    'does not delete or refresh a $itemType when confirmation is cancelled',
    async ({ name, path, expectedRelativePath, isDirectory, rowName, deleteLabel }) => {
      rootEntries.current = [{ name, path, is_dir: isDirectory, created_secs: 0, mtime_secs: 0 }]
      mockHostConfirm.mockResolvedValue(false)
      mockHostAsk.mockResolvedValue(true)
      const onDeselect = vi.fn()

      renderTreeSidebar({ category: 'topics', onDeselect })
      await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('get_workspace_path'))
      mockInvoke.mockClear()
      mockRefreshPinned.mockClear()
      mockLoadTopics.mockClear()

      fireEvent.contextMenu(screen.getByRole('treeitem', { name: rowName }))
      fireEvent.click(screen.getByText(deleteLabel))

      await waitFor(() => expect(mockHostConfirm).toHaveBeenCalledOnce())
      expect(mockInvoke).not.toHaveBeenCalledWith('workspace_delete_file', {
        relativePath: expectedRelativePath,
      })
      expect(onDeselect).not.toHaveBeenCalled()
      expect(mockRefreshPinned).not.toHaveBeenCalled()
      expect(mockLoadTopics).not.toHaveBeenCalled()
    },
  )

  // AC-10 · 键盘导航：ArrowDown 移动焦点到首个可见行，data-path 暴露焦点位置
  it('moves focus down via ArrowDown and exposes it via data-path', () => {
    rootEntries.current = [
      { name: 'note.md', path: 'note.md', is_dir: false, created_secs: 0, mtime_secs: 0 },
    ]

    renderTreeSidebar({ category: 'topics' })

    const tree = screen.getByRole('tree', { name: '个人空间' })
    tree.focus()
    fireEvent.keyDown(tree, { key: 'ArrowDown' })

    expect(document.activeElement?.getAttribute('data-path')).toBeTruthy()
  })

  it('leaves main-tree action and rename input keys to their own controls', async () => {
    rootEntries.current = [
      { name: 'note.md', path: 'note.md', is_dir: false, created_secs: 0, mtime_secs: 0 },
    ]
    const onSelect = vi.fn()

    renderTreeSidebar({ category: 'topics', onSelect })

    const tree = screen.getByRole('tree', { name: '个人空间' })
    tree.focus()
    fireEvent.keyDown(tree, { key: 'ArrowDown' })

    const row = within(tree).getByRole('treeitem', { name: /note/i })
    const more = within(row).getByRole('button', { name: '更多' })
    const at = within(row).getByRole('button', { name: '引用' })

    for (const action of [more, at]) {
      action.focus()
      const keyEvent = createEvent.keyDown(action, { key: 'Enter' })
      fireEvent(action, keyEvent)
      expect(keyEvent.defaultPrevented).toBe(false)
    }
    expect(onSelect).not.toHaveBeenCalled()

    fireEvent.click(more)
    fireEvent.click(screen.getByText('重命名'))
    const rename = await screen.findByRole('textbox', { name: '重命名' })
    rename.focus()
    const renameEvent = createEvent.keyDown(rename, { key: 'Enter' })
    fireEvent(rename, renameEvent)

    expect(renameEvent.defaultPrevented).toBe(false)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('opens sort menu and updates active sort strategy', () => {
    renderTreeSidebar({ category: 'topics' })

    const sortButton = screen.getByRole('button', { name: '排序' })
    expect(sortButton.getAttribute('data-active-sort')).toBe('name-asc')

    fireEvent.click(sortButton)

    const menu = screen.getByRole('menu')
    const menuItems = within(menu).getAllByRole('menuitem')
    expect(menuItems.map((item) => item.textContent)).toEqual([
      '名称 A-Z',
      '名称 Z-A',
      '最近修改',
      '类型优先',
      '手动排序',
    ])
    expect(
      within(menu).getByRole('menuitem', { name: '名称 A-Z' }).classList.contains('is-active'),
    ).toBe(true)

    fireEvent.click(within(menu).getByRole('menuitem', { name: '名称 Z-A' }))
    expect(sortButton.getAttribute('data-active-sort')).toBe('name-desc')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('declares concrete token-based focus outlines for the sort control and tree root', () => {
    installWorkspaceTreeCss()
    const workspaceStyle = [...document.head.querySelectorAll('style')].find((style) =>
      style.textContent?.includes('.workspace-tree-sort-button'),
    )
    const rules = [...(workspaceStyle?.sheet?.cssRules ?? [])]
    const focusRule = rules.find((rule) =>
      rule.cssText.includes('.workspace-tree-sort-button:focus-visible'),
    )

    expect(focusRule?.cssText).toContain('.workspace-tree:focus-visible')
    expect(focusRule?.cssText).toContain('outline: 2px solid var(--focus-ring)')
  })

  it('updates a pinned folder chevron when its independent expansion changes', async () => {
    rootEntries.current = [
      { name: 'projects', path: 'projects', is_dir: true, created_secs: 0, mtime_secs: 0 },
    ]
    pinnedItems.current = [{ type: 'topic', path: 'projects', order: 0 }]

    renderTreeSidebar({ category: 'topics' })

    const row = screen
      .getAllByRole('treeitem')
      .filter((item) => item.getAttribute('data-path') === 'projects')[0]
    const chevron = row.querySelector('[data-workspace-chevron]')
    expect(chevron?.getAttribute('data-expanded')).toBe('false')

    fireEvent.click(row)
    await waitFor(() => expect(chevron?.getAttribute('data-expanded')).toBe('true'))

    fireEvent.click(row)
    await waitFor(() => expect(chevron?.getAttribute('data-expanded')).toBe('false'))
  })

  it('navigates and toggles the visible pinned directory rows from the pinned tree root', async () => {
    rootEntries.current = [
      { name: 'projects', path: 'projects', is_dir: true, created_secs: 0, mtime_secs: 0 },
    ]
    pinnedItems.current = [{ type: 'topic', path: 'projects', order: 0 }]
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_workspace_path') return Promise.resolve('/ws')
      if (cmd === 'get_workspace_tree_sort') return Promise.resolve('name-asc')
      if (cmd === 'list_workspace_dir') {
        return Promise.resolve([
          {
            name: 'plan.md',
            path: 'projects/plan.md',
            is_dir: false,
            created_secs: 0,
            mtime_secs: 0,
          },
        ])
      }
      return Promise.resolve(undefined)
    })

    renderTreeSidebar({ category: 'topics' })

    const pinnedTree = screen.getByRole('tree', { name: '置顶' })
    expect(pinnedTree.getAttribute('tabindex')).toBe('0')
    pinnedTree.focus()
    expect(document.activeElement).toBe(pinnedTree)

    fireEvent.keyDown(pinnedTree, { key: 'ArrowDown' })
    const pinnedRow = within(pinnedTree).getByRole('treeitem', { name: /projects/i })
    const mainRow = within(screen.getByRole('tree', { name: '个人空间' })).getByRole('treeitem', {
      name: /projects/i,
    })
    expect(document.activeElement).toBe(pinnedRow)
    expect(pinnedRow.getAttribute('tabindex')).toBe('0')
    expect(mainRow.getAttribute('tabindex')).toBe('-1')

    const chevron = pinnedRow.querySelector('[data-workspace-chevron]')
    fireEvent.keyDown(pinnedRow, { key: 'ArrowRight' })
    await waitFor(() => expect(chevron?.getAttribute('data-expanded')).toBe('true'))

    fireEvent.keyDown(pinnedRow, { key: 'ArrowRight' })
    const child = await screen.findByRole('treeitem', { name: /plan/i })
    expect(document.activeElement).toBe(child)
    expect(child.getAttribute('tabindex')).toBe('0')
    expect(pinnedRow.getAttribute('tabindex')).toBe('-1')

    fireEvent.click(screen.getByRole('button', { name: '排序' }))
    expect(child.getAttribute('tabindex')).toBe('0')
    expect(pinnedRow.getAttribute('tabindex')).toBe('-1')

    fireEvent.keyDown(child, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(pinnedRow)
    expect(pinnedRow.getAttribute('tabindex')).toBe('0')

    fireEvent.keyDown(pinnedRow, { key: 'ArrowLeft' })
    await waitFor(() => expect(chevron?.getAttribute('data-expanded')).toBe('false'))
  })

  it('keeps main-tree focus scoped when the same workspace path is pinned', async () => {
    rootEntries.current = [
      { name: 'projects', path: 'projects', is_dir: true, created_secs: 0, mtime_secs: 0 },
    ]
    pinnedItems.current = [{ type: 'topic', path: 'projects', order: 0 }]

    renderTreeSidebar({ category: 'topics' })

    const pinnedTree = screen.getByRole('tree', { name: '置顶' })
    const mainTree = screen.getByRole('tree', { name: '个人空间' })
    const pinnedRow = within(pinnedTree).getByRole('treeitem', { name: /projects/i })
    const mainRow = within(mainTree).getByRole('treeitem', { name: /projects/i })

    mainTree.focus()
    fireEvent.keyDown(mainTree, { key: 'ArrowDown' })

    await waitFor(() => expect(document.activeElement).toBe(mainRow))
    expect(mainRow.getAttribute('tabindex')).toBe('0')
    expect(pinnedRow.getAttribute('tabindex')).toBe('-1')
  })

  it('leaves pinned row action keys alone and activates a pinned file only from its row', () => {
    rootEntries.current = [
      {
        name: 'pinned-note.md',
        path: 'pinned-note.md',
        is_dir: false,
        created_secs: 3,
        mtime_secs: 4,
      },
    ]
    pinnedItems.current = [{ type: 'topic', path: 'pinned-note.md', order: 0 }]
    const onAtRef = vi.fn()
    const onSelect = vi.fn()

    renderTreeSidebar({ category: 'topics', onAtRef, onSelect })

    const pinnedTree = screen.getByRole('tree', { name: '置顶' })
    const pinnedRow = within(pinnedTree).getByRole('treeitem', { name: /pinned note/i })
    const more = within(pinnedRow).getByRole('button', { name: '更多' })
    const at = within(pinnedRow).getByRole('button', { name: '引用' })

    for (const action of [more, at]) {
      action.focus()
      const keyEvent = createEvent.keyDown(action, { key: 'Enter' })
      fireEvent(action, keyEvent)
      expect(keyEvent.defaultPrevented).toBe(false)
    }

    fireEvent.click(at)
    expect(onAtRef).toHaveBeenCalledWith('pinned-note.md')
    expect(onSelect).not.toHaveBeenCalled()

    fireEvent.click(more)
    expect(screen.getByText('重命名')).toBeTruthy()
    expect(onSelect).not.toHaveBeenCalled()

    pinnedRow.focus()
    fireEvent.keyDown(pinnedRow, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith({
      type: 'topic-file',
      path: 'pinned-note.md',
      name: 'pinned-note.md',
      created_secs: 3,
      mtime_secs: 4,
    })
  })

  it('keeps expanded pinned children inside the shared workspace tree scope', async () => {
    rootEntries.current = [
      { name: 'projects', path: 'projects', is_dir: true, created_secs: 0, mtime_secs: 0 },
    ]
    pinnedItems.current = [{ type: 'topic', path: 'projects', order: 0 }]
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_workspace_path') return Promise.resolve('/ws')
      if (cmd === 'get_workspace_tree_sort') return Promise.resolve('name-asc')
      if (cmd === 'list_workspace_dir') {
        return Promise.resolve([
          {
            name: 'plan.md',
            path: 'projects/plan.md',
            is_dir: false,
            created_secs: 0,
            mtime_secs: 0,
          },
        ])
      }
      return Promise.resolve(undefined)
    })

    installWorkspaceTreeCss()
    renderTreeSidebar({ category: 'topics' })

    const pinnedRow = screen
      .getAllByRole('treeitem')
      .filter((item) => item.getAttribute('data-path') === 'projects')[0]
    fireEvent.click(pinnedRow)

    const child = await screen.findByRole('treeitem', { name: /plan/i })
    const pinnedTree = screen.getByRole('tree', { name: '置顶' })
    expect(pinnedRow.closest('[role="tree"]')).toBe(pinnedTree)
    expect(child.closest('[role="tree"]')).toBe(pinnedTree)
    expect(child.closest('.workspace-tree')).toBe(pinnedTree)
    expect(getComputedStyle(child).height).toBe('var(--workspace-tree-row-height)')
  })
})
