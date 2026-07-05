import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useJournal } from '../hooks/useJournal'

type EventCallback = (payload: unknown) => void
const listenerMap = new Map<string, Set<EventCallback>>()

const defaultEntries = [
  {
    filename: '28-AI平台产品会议纪要.md',
    path: '/nb/2603/28-AI平台产品会议纪要.md',
    title: 'AI平台产品会议纪要',
    summary: '探索可继续',
    tags: ['meeting'],
    sources: [],
    year_month: '2603',
    day: 28,
    created_time: '10:15',
    created_at_secs: 0,
    mtime_secs: 1,
    mtime_ms: 1000,
    materials: [],
  },
]

const invokeMock = vi.fn(async (cmd: string, _args?: Record<string, unknown>): Promise<unknown> => {
  switch (cmd) {
    case 'list_available_months':
      return ['2603']
    case 'list_journal_entries_by_months':
      return defaultEntries
    case 'list_work_queue':
      return []
    case 'get_events_since':
      return []
    case 'enqueue_work':
      return { id: 'wq-test', status: 'queued', display_name: 'test', created_at: 0 }
    default:
      return undefined
  }
})

vi.mock('../lib/runtimeClient', () => ({
  selectRuntimeClient: () => ({
    invoke: invokeMock,
    subscribe: (eventName: string, cb: EventCallback) => {
      const listeners = listenerMap.get(eventName) ?? new Set<EventCallback>()
      listeners.add(cb)
      listenerMap.set(eventName, listeners)
      return () => {
        listeners.delete(cb)
        if (listeners.size === 0) listenerMap.delete(eventName)
      }
    },
  }),
}))

function fireEvent(name: string, payload: unknown) {
  listenerMap.get(name)?.forEach((listener) => listener(payload))
}

describe('useJournal', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    listenerMap.clear()
    invokeMock.mockImplementation(async (cmd: string) => {
      switch (cmd) {
        case 'list_available_months':
          return ['2603']
        case 'list_journal_entries_by_months':
          return defaultEntries
        case 'list_work_queue':
          return []
        case 'get_events_since':
          return []
        case 'enqueue_work':
          return { id: 'wq-test', status: 'queued', display_name: 'test', created_at: 0 }
        default:
          return undefined
      }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads entries on mount', async () => {
    const { result } = renderHook(() => useJournal())
    await act(async () => {})
    expect(result.current.entries).toHaveLength(1)
    expect(result.current.entries[0].title).toBe('AI平台产品会议纪要')
  })

  it('starts with empty queue', () => {
    const { result } = renderHook(() => useJournal())
    expect(result.current.queueItems).toEqual([])
    expect(result.current.isProcessing).toBe(false)
  })

  it('addConvertingItem inserts a converting item at head', async () => {
    const { result } = renderHook(() => useJournal())
    await act(async () => {})
    act(() => {
      result.current.addConvertingItem('/ws/2603/raw/meeting.m4a', 'meeting.m4a')
    })
    expect(result.current.queueItems).toHaveLength(1)
    expect(result.current.queueItems[0]).toMatchObject({
      path: '/ws/2603/raw/meeting.m4a',
      filename: 'meeting.m4a',
      status: 'converting',
    })
    expect(result.current.isProcessing).toBe(false)
  })

  it('addConvertingItem is idempotent', async () => {
    const { result } = renderHook(() => useJournal())
    await act(async () => {})
    act(() => {
      result.current.addConvertingItem('/ws/2603/raw/meeting.m4a', 'meeting.m4a')
      result.current.addConvertingItem('/ws/2603/raw/meeting.m4a', 'meeting.m4a')
    })
    expect(result.current.queueItems).toHaveLength(1)
  })

  it('audio-ai-material-ready removes local item and enqueues in Rust', async () => {
    const { result } = renderHook(() => useJournal())
    await act(async () => {})

    act(() => {
      result.current.addConvertingItem('/ws/2603/raw/meeting.m4a', 'meeting.m4a')
    })

    await act(async () => {
      fireEvent('audio-ai-material-ready', {
        source_path: '/ws/2603/raw/meeting.m4a',
        material_path: '/ws/2603/raw/meeting.audio-ai.md',
        filename: 'meeting.m4a',
      })
    })

    // Local converting item should be removed
    expect(result.current.queueItems.some((i) => i.path === '/ws/2603/raw/meeting.m4a')).toBe(false)
    // Work queue enqueue should have been called via runtime client
    expect(invokeMock).toHaveBeenCalledWith('enqueue_work', {
      text: null,
      files: ['/ws/2603/raw/meeting.audio-ai.md'],
      prompt: '请根据这份素材，生成日志条目。',
      displayName: 'meeting.m4a',
    })
  })

  it('audio-ai-material-failed upgrades converting item to failed', async () => {
    const { result } = renderHook(() => useJournal())
    await act(async () => {})

    act(() => {
      result.current.addConvertingItem('/ws/2603/raw/meeting.m4a', 'meeting.m4a')
    })

    act(() => {
      fireEvent('audio-ai-material-failed', {
        source_path: '/ws/2603/raw/meeting.m4a',
        filename: 'meeting.m4a',
        error: '转写失败',
      })
    })

    expect(result.current.queueItems[0]).toMatchObject({
      path: '/ws/2603/raw/meeting.m4a',
      filename: 'meeting.m4a',
      status: 'failed',
      error: '转写失败',
    })
  })

  it('refreshes the workspace and loads newly available months after a journal update event', async () => {
    let poll = 0
    invokeMock.mockImplementation(async (cmd: string, args?: Record<string, unknown>) => {
      switch (cmd) {
        case 'list_available_months':
          return poll === 0 ? ['2603'] : ['2604', '2603']
        case 'list_journal_entries_by_months': {
          const months = (args as { months: string[] }).months
          const rows: unknown[] = []
          if (months.includes('2604')) {
            rows.push({
              filename: '01-new.md',
              path: '/nb/2604/01-new.md',
              title: '新增条目',
              summary: '',
              tags: [],
              sources: [],
              year_month: '2604',
              day: 1,
              created_time: '09:00',
              created_at_secs: 2,
              mtime_secs: 2,
              mtime_ms: 2000,
              materials: [],
            })
          }
          if (months.includes('2603')) {
            rows.push({
              filename: '28-AI平台产品会议纪要.md',
              path: '/nb/2603/28-AI平台产品会议纪要.md',
              title: 'AI平台产品会议纪要',
              summary: '探索可继续',
              tags: ['meeting'],
              sources: [],
              year_month: '2603',
              day: 28,
              created_time: '10:15',
              created_at_secs: 1,
              mtime_secs: 1,
              mtime_ms: 1000,
              materials: [],
            })
          }
          return rows
        }
        case 'list_work_queue':
          return []
        case 'get_events_since':
          return []
        default:
          return undefined
      }
    })

    const { result } = renderHook(() => useJournal())
    await waitFor(() =>
      expect(result.current.entries.map((entry) => entry.filename)).toEqual([
        '28-AI平台产品会议纪要.md',
      ]),
    )

    poll = 1
    act(() => {
      fireEvent('journal-updated', '2604')
    })

    await waitFor(() =>
      expect(result.current.entries.map((entry) => entry.filename)).toEqual([
        '01-new.md',
        '28-AI平台产品会议纪要.md',
      ]),
    )
  })

  it('updates an existing entry when only sub-second mtime changes', async () => {
    let revised = false
    invokeMock.mockImplementation(async (cmd: string) => {
      switch (cmd) {
        case 'list_available_months':
          return ['2603']
        case 'list_journal_entries_by_months':
          return [
            {
              filename: '28-AI平台产品会议纪要.md',
              path: '/nb/2603/28-AI平台产品会议纪要.md',
              title: 'AI平台产品会议纪要',
              summary: revised ? '已修改' : '探索可继续',
              tags: ['meeting'],
              sources: [],
              year_month: '2603',
              day: 28,
              created_time: '10:15',
              created_at_secs: 1,
              mtime_secs: 1,
              mtime_ms: revised ? 1500 : 1000,
              materials: [],
            },
          ]
        case 'list_work_queue':
          return []
        case 'get_events_since':
          return []
        default:
          return undefined
      }
    })

    const { result } = renderHook(() => useJournal())
    await act(async () => {})
    const firstEntry = result.current.entries[0]

    revised = true
    await act(async () => {
      fireEvent('journal-updated', '2603')
    })

    expect(result.current.entries[0]).not.toBe(firstEntry)
    expect(result.current.entries[0].summary).toBe('已修改')
  })
})
