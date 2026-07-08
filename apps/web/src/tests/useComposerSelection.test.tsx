import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useComposerSelection } from '../hooks/useComposerSelection'
import { selectRuntimeClient } from '../lib/runtimeClient'

vi.mock('../lib/runtimeClient', () => ({
  selectRuntimeClient: vi.fn(),
}))

describe('useComposerSelection', () => {
  const invoke = vi.fn()

  beforeEach(() => {
    invoke.mockReset()
    invoke.mockResolvedValue({})
    vi.mocked(selectRuntimeClient).mockReturnValue({ invoke } as never)
  })

  it('loads the persisted selection on mount', async () => {
    invoke.mockResolvedValueOnce({ providerId: 'p_abc', thinkingLevel: 'high' })
    const { result } = renderHook(() => useComposerSelection())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.providerId).toBe('p_abc')
    expect(result.current.thinkingLevel).toBe('high')
    expect(invoke).toHaveBeenCalledWith('get_composer_selection')
  })

  it('falls back to null/medium when load fails', async () => {
    invoke.mockRejectedValueOnce(new Error('offline'))
    const { result } = renderHook(() => useComposerSelection())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.providerId).toBeNull()
    expect(result.current.thinkingLevel).toBe('medium')
  })

  it('persists a new provider id immediately with the current thinking level', async () => {
    invoke.mockResolvedValueOnce({ providerId: null, thinkingLevel: 'medium' })
    invoke.mockResolvedValueOnce(undefined)
    const { result } = renderHook(() => useComposerSelection())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setProviderId('p_xyz')
    })

    expect(result.current.providerId).toBe('p_xyz')
    expect(invoke).toHaveBeenCalledWith('set_composer_selection', {
      providerId: 'p_xyz',
      thinkingLevel: 'medium',
    })
  })

  it('persists a new thinking level immediately with the current provider id', async () => {
    invoke.mockResolvedValueOnce({ providerId: 'p_abc', thinkingLevel: 'medium' })
    invoke.mockResolvedValueOnce(undefined)
    const { result } = renderHook(() => useComposerSelection())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setThinkingLevel('high')
    })

    expect(result.current.thinkingLevel).toBe('high')
    expect(invoke).toHaveBeenCalledWith('set_composer_selection', {
      providerId: 'p_abc',
      thinkingLevel: 'high',
    })
  })
})
