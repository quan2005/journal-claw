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

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}))

describe('useJournal', () => {
  it('loads entries on mount', async () => {
    const { result } = renderHook(() => useJournal())
    await act(async () => {})
    expect(result.current.entries).toHaveLength(1)
    expect(result.current.entries[0].title).toBe('AI平台产品会议纪要')
  })

  it('starts with no processing items', () => {
    const { result } = renderHook(() => useJournal())
    expect(result.current.processingPaths).toEqual([])
  })
})
