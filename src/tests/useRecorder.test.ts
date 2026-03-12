import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRecorder } from '../hooks/useRecorder'

vi.mock('../lib/tauri', () => ({
  startRecording: vi.fn().mockResolvedValue('/path/to/录音 2026-03-12 22:41.m4a'),
  stopRecording: vi.fn().mockResolvedValue({
    filename: '录音 2026-03-12 22:41.m4a',
    path: '/path/to/录音 2026-03-12 22:41.m4a',
    display_name: '录音 2026-03-12 22:41',
    duration_secs: 5.0,
    year_month: '202603',
  }),
}))

describe('useRecorder', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('starts in idle state', () => {
    const { result } = renderHook(() => useRecorder(vi.fn()))
    expect(result.current.status).toBe('idle')
    expect(result.current.elapsedSecs).toBe(0)
  })

  it('transitions to recording on start()', async () => {
    const { result } = renderHook(() => useRecorder(vi.fn()))
    await act(async () => { await result.current.start() })
    expect(result.current.status).toBe('recording')
  })

  it('increments elapsedSecs each second while recording', async () => {
    const { result } = renderHook(() => useRecorder(vi.fn()))
    await act(async () => { await result.current.start() })
    act(() => { vi.advanceTimersByTime(3000) })
    expect(result.current.elapsedSecs).toBe(3)
  })

  it('returns to idle and calls onStopped with RecordingItem on stop()', async () => {
    const onStopped = vi.fn()
    const { result } = renderHook(() => useRecorder(onStopped))
    await act(async () => { await result.current.start() })
    await act(async () => { await result.current.stop() })
    expect(result.current.status).toBe('idle')
    expect(result.current.elapsedSecs).toBe(0)
    expect(onStopped).toHaveBeenCalledWith(expect.objectContaining({ duration_secs: 5.0 }))
  })
})
