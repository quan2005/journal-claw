import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from './setup'
import { TreeSidebar } from '../components/TreeSidebar'
import type { IdentityEntry, JournalEntry, TreeSelection } from '../types'
import type { Category } from '../contexts/UIContext'

vi.mock('../hooks/usePinned', () => ({
  usePinned: () => ({
    items: [],
    pin: vi.fn(),
    unpin: vi.fn(),
    refresh: vi.fn(),
  }),
}))

vi.mock('../hooks/useTopics', () => ({
  useTopics: () => ({
    dirs: new Map([['', { entries: [], expanded: true, loading: false }]]),
    loading: false,
    load: vi.fn(),
    toggleDir: vi.fn(),
  }),
}))

vi.mock('../lib/tauri', () => ({
  deleteJournalEntry: vi.fn(),
  deleteIdentity: vi.fn(),
  deleteTopic: vi.fn(),
  getWorkspacePath: vi.fn().mockResolvedValue('/ws'),
}))

const identity: IdentityEntry = {
  filename: 'zhangsan.md',
  path: '/ws/identities/zhangsan.md',
  name: '张三',
  region: '',
  summary: '测试画像',
  tags: [],
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
})

describe('TreeSidebar', () => {
  it('renders identities in identity category', () => {
    renderTreeSidebar({ category: 'identity' })

    expect(screen.getByText('张三')).toBeTruthy()
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
})
