import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useJournal } from '../hooks/useJournal'

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
      result.current.addConvertingItem('__recording__', '录音处理中')
    })
    expect(result.current.queueItems).toHaveLength(1)
    expect(result.current.queueItems[0]).toMatchObject({
      path: '__recording__',
      filename: '录音处理中',
      status: 'converting',
    })
    expect(result.current.isProcessing).toBe(false)
  })

  it('addConvertingItem is idempotent', async () => {
    const { result } = renderHook(() => useJournal())
    await act(async () => {})
    act(() => {
      result.current.addConvertingItem('__recording__', '录音处理中')
      result.current.addConvertingItem('__recording__', '录音处理中')
    })
    expect(result.current.queueItems).toHaveLength(1)
  })

  it('recording-processed upgrades placeholder item to converting with real audio path', async () => {
    const { result } = renderHook(() => useJournal())
    await act(async () => {})

    act(() => {
      result.current.addConvertingItem('__recording__', '录音处理中')
    })
    expect(result.current.queueItems[0].status).toBe('converting')

    act(() => {
      fireEvent('recording-processed', {
        filename: '录音 2026-03-30 10:00.m4a',
        path: '/ws/2603/raw/录音 2026-03-30 10:00.m4a',
      })
    })

    expect(result.current.queueItems[0]).toMatchObject({
      path: '/ws/2603/raw/录音 2026-03-30 10:00.m4a',
      filename: '录音 2026-03-30 10:00.m4a',
      status: 'converting',
    })
    expect(result.current.queueItems.some((i) => i.path === '__recording__')).toBe(false)
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

  it('recording-processed is a no-op when no placeholder exists', async () => {
    const { result } = renderHook(() => useJournal())
    await act(async () => {})

    expect(result.current.queueItems).toHaveLength(0)

    act(() => {
      fireEvent('recording-processed', {
        filename: '录音 2026-03-30 10:00.m4a',
        path: '/ws/2603/raw/录音 2026-03-30 10:00.m4a',
      })
    })

    expect(result.current.queueItems).toHaveLength(0)
  })
})
