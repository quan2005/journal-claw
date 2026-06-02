import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from './setup'
import { TreeSidebar } from '../components/TreeSidebar'
import type { IdentityEntry, TreeSelection } from '../types'

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
    ideasCount: 0,
    ideasSelected: false,
    onSelectIdeas: vi.fn(),
    automationSelected: false,
    onSelectAutomation: vi.fn(),
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
  it('restores collapsed section state and persists later toggles', () => {
    window.localStorage.setItem('journal_tree_sidebar_collapsed_v1', JSON.stringify(['identities']))

    renderTreeSidebar()

    expect(screen.queryByText('张三')).toBeNull()

    fireEvent.click(screen.getByText('画像'))

    expect(screen.getByText('张三')).toBeTruthy()
    expect(window.localStorage.getItem('journal_tree_sidebar_collapsed_v1')).toBe('[]')
  })
})
