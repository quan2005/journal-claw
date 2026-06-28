import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAgentEngine } from '../hooks/useAgentEngine'

const mockGetAgentEngine = vi.fn()
const mockSetAgentEngine = vi.fn()

vi.mock('../lib/tauri', () => ({
  getAgentEngine: (...args: unknown[]) => mockGetAgentEngine(...(args as [never])),
  setAgentEngine: (...args: unknown[]) => mockSetAgentEngine(...(args as [never])),
}))

describe('useAgentEngine', () => {
  beforeEach(() => {
    // resetAllMocks (not clearAllMocks) so a previous test's mockResolved/
    // mockRejected implementation cannot leak into the next — the suite is
    // robust when run in any order or as part of the full suite. Each default
    // implementation is re-installed explicitly below.
    vi.resetAllMocks()
    mockGetAgentEngine.mockResolvedValue({ engine: 'builtin', agentId: null })
    mockSetAgentEngine.mockResolvedValue(undefined)
  })

  it('loads the persisted engine selection from daemon settings on mount', async () => {
    mockGetAgentEngine.mockResolvedValue({ engine: 'cli', agentId: 'codex' })
    const { result } = renderHook(() => useAgentEngine())

    await vi.waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.engine).toBe('cli')
    expect(result.current.agentId).toBe('codex')
  })

  it('falls back to the built-in engine when the daemon is unreachable', async () => {
    mockGetAgentEngine.mockRejectedValue(new Error('daemon offline'))
    const { result } = renderHook(() => useAgentEngine())

    await vi.waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.engine).toBe('builtin')
    expect(result.current.agentId).toBeNull()
  })

  it('persists engine changes via the daemon (never localStorage)', async () => {
    const { result } = renderHook(() => useAgentEngine())
    await vi.waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.setEngine('cli'))
    expect(mockSetAgentEngine).toHaveBeenCalledWith({ engine: 'cli' })

    act(() => result.current.setAgentId('claude'))
    expect(mockSetAgentEngine).toHaveBeenCalledWith({ agentId: 'claude' })
  })

  it('ignores an invalid persisted engine value and keeps the default', async () => {
    mockGetAgentEngine.mockResolvedValue({ engine: 'magic', agentId: null })
    const { result } = renderHook(() => useAgentEngine())
    await vi.waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.engine).toBe('builtin')
  })
})
