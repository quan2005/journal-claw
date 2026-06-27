import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useJournal } from '../hooks/useJournal'
import { listAvailableMonths, listJournalEntriesByMonths } from '../lib/tauri'

vi.mock('../lib/tauri', () => ({
  listAllJournalEntries: vi.fn().mockResolvedValue([
    {
      filename: '28-AI平台产品会议纪要.md',
      path: '/nb/2603/28-AI平台产品会议纪要.md',
      title: 'AI平台产品会议纪要',
      summary: '探索可继续',
      tags: ['meeting'],
      year_month: '2603',
      day: 28,
      created_time: '10:15',
      materials: [],
    },
  ]),
  listAvailableMonths: vi.fn().mockResolvedValue(['2603']),
  listJournalEntriesByMonths: vi.fn().mockResolvedValue([
    {
      filename: '28-AI平台产品会议纪要.md',
      path: '/nb/2603/28-AI平台产品会议纪要.md',
      title: 'AI平台产品会议纪要',
      summary: '探索可继续',
      tags: ['meeting'],
      year_month: '2603',
      day: 28,
      created_time: '10:15',
      materials: [],
    },
  ]),
  listWorkQueue: vi.fn().mockResolvedValue([]),
  getEventsSince: vi.fn().mockResolvedValue([]),
  enqueueWork: vi
    .fn()
    .mockResolvedValue({ id: 'wq-test', status: 'queued', display_name: 'test', created_at: 0 }),
  dismissWorkItem: vi.fn().mockResolvedValue(undefined),
}))

type EventCallback = (event: { payload: unknown }) => void
const listenerMap = new Map<string, EventCallback>()

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((eventName: string, cb: EventCallback) => {
    listenerMap.set(eventName, cb)
    return Promise.resolve(() => {
      listenerMap.delete(eventName)
    })
  }),
}))

function fireEvent(name: string, payload: unknown) {
  listenerMap.get(name)?.({ payload })
}

describe('useJournal', () => {
  beforeEach(() => {
    ;(globalThis as Record<string, unknown>).__JOURNAL_RUNTIME = 'tauri'
    vi.useRealTimers()
    vi.clearAllMocks()
    listenerMap.clear()
    vi.mocked(listAvailableMonths).mockResolvedValue(['2603'])
    vi.mocked(listJournalEntriesByMonths).mockResolvedValue([
      {
        filename: '28-AI平台产品会议纪要.md',
        path: '/nb/2603/28-AI平台产品会议纪要.md',
        title: 'AI平台产品会议纪要',
        summary: '探索可继续',
        tags: ['meeting'],
        year_month: '2603',
        day: 28,
        created_time: '10:15',
        created_at_secs: 0,
        mtime_secs: 1,
        mtime_ms: 1000,
        materials: [],
        sources: [],
      },
    ])
  })

  afterEach(() => {
    vi.useRealTimers()
    delete (globalThis as Record<string, unknown>).__JOURNAL_RUNTIME
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
    const { enqueueWork } = (await import('../lib/tauri')) as unknown as {
      enqueueWork: ReturnType<typeof vi.fn>
    }
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
    // Rust enqueueWork should have been called
    expect(enqueueWork).toHaveBeenCalledWith({
      files: ['/ws/2603/raw/meeting.audio-ai.md'],
      prompt: '请根据这份音频转写材料，生成日志条目。',
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
    vi.mocked(listAvailableMonths).mockImplementation(async () =>
      poll === 0 ? ['2603'] : ['2604', '2603'],
    )
    vi.mocked(listJournalEntriesByMonths).mockImplementation(async (months: string[]) => {
      const rows = []
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
    vi.mocked(listJournalEntriesByMonths).mockImplementation(async () => [
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
    ])

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
