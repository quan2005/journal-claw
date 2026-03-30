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
}))

type EventCallback = (event: { payload: unknown }) => void
const listenerMap = new Map<string, EventCallback>()

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((eventName: string, cb: EventCallback) => {
    listenerMap.set(eventName, cb)
    return Promise.resolve(() => { listenerMap.delete(eventName) })
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

  it('addQueuedItem inserts a queued item with real path', async () => {
    const { result } = renderHook(() => useJournal())
    await act(async () => {})
    act(() => {
      result.current.addQueuedItem('/ws/2603/raw/meeting.m4a', 'meeting.m4a')
    })
    expect(result.current.queueItems[0]).toMatchObject({
      path: '/ws/2603/raw/meeting.m4a',
      filename: 'meeting.m4a',
      status: 'queued',
    })
  })

  it('addQueuedItem is idempotent (deduplicates by path)', async () => {
    const { result } = renderHook(() => useJournal())
    await act(async () => {})
    act(() => {
      result.current.addQueuedItem('/ws/2603/raw/meeting.m4a', 'meeting.m4a')
      result.current.addQueuedItem('/ws/2603/raw/meeting.m4a', 'meeting.m4a')
    })
    expect(result.current.queueItems).toHaveLength(1)
  })

  it('recording-processed upgrades placeholder item to queued with real path', async () => {
    const { result } = renderHook(() => useJournal())
    await act(async () => {})

    // Insert converting placeholder
    act(() => {
      result.current.addConvertingItem('__recording__', '录音处理中')
    })
    expect(result.current.queueItems[0].status).toBe('converting')

    // Fire recording-processed with real data
    act(() => {
      fireEvent('recording-processed', {
        filename: '录音 2026-03-30 10:00.m4a',
        path: '/ws/2603/raw/录音 2026-03-30 10:00.m4a',
      })
    })

    expect(result.current.queueItems[0]).toMatchObject({
      path: '/ws/2603/raw/录音 2026-03-30 10:00.m4a',
      filename: '录音 2026-03-30 10:00.m4a',
      status: 'queued',
    })
    // placeholder must be gone
    expect(result.current.queueItems.some(i => i.path === '__recording__')).toBe(false)
  })
})
