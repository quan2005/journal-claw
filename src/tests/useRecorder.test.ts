import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRecorder } from '../hooks/useRecorder'

vi.mock('../lib/tauri', () => ({
  startRecording: vi.fn().mockResolvedValue('/path/to/录音 2026-03-12 22:41.m4a'),
  stopRecording: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}))

describe('useRecorder', () => {
  afterEach(() => { vi.useRealTimers() })

  it('starts in idle state', () => {
    const { result } = renderHook(() => useRecorder())
    expect(result.current.status).toBe('idle')
  })

  it('transitions to recording on start()', async () => {
    const { result } = renderHook(() => useRecorder())
    await act(async () => { await result.current.start() })
    expect(result.current.status).toBe('recording')
  })

  it('returns to idle on stop()', async () => {
    const { result } = renderHook(() => useRecorder())
    await act(async () => { await result.current.start() })
    await act(async () => { await result.current.stop() })
    expect(result.current.status).toBe('idle')
  })
})
