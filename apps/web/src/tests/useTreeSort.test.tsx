import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useTreeSort } from '../hooks/useTreeSort'
import { selectRuntimeClient } from '../lib/runtimeClient'

vi.mock('../lib/runtimeClient', () => ({
  selectRuntimeClient: vi.fn(),
}))

describe('useTreeSort', () => {
  const invoke = vi.fn()

  beforeEach(() => {
    invoke.mockReset()
    invoke.mockResolvedValue({})
    vi.mocked(selectRuntimeClient).mockReturnValue({ invoke } as never)
  })

  it('loads the persisted strategy on mount', async () => {
    invoke.mockResolvedValueOnce('mtime-desc')
    const { result } = renderHook(() => useTreeSort())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.strategy).toBe('mtime-desc')
    expect(invoke).toHaveBeenCalledWith('get_workspace_tree_sort')
  })

  it('falls back to name-asc when load fails', async () => {
    invoke.mockRejectedValueOnce(new Error('offline'))
    const { result } = renderHook(() => useTreeSort())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.strategy).toBe('name-asc')
  })

  it('persists a new strategy immediately', async () => {
    invoke.mockResolvedValueOnce('name-asc') // initial load
    invoke.mockResolvedValueOnce(undefined) // set call
    const { result } = renderHook(() => useTreeSort())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setStrategy('type-first')
    })

    expect(result.current.strategy).toBe('type-first')
    expect(invoke).toHaveBeenCalledWith('set_workspace_tree_sort', { strategy: 'type-first' })
  })
})
