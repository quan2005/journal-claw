import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAgentEngine } from '../hooks/useAgentEngine'

const invokeMock = vi.fn()

vi.mock('../lib/runtimeClient', () => ({
  selectRuntimeClient: () => ({ invoke: invokeMock }),
}))

describe('useAgentEngine', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'get_agent_engine') return Promise.resolve({ engine: 'builtin', agentId: null })
      if (cmd === 'set_agent_engine') return Promise.resolve(undefined)
      return Promise.resolve(undefined)
    })
  })

  it('loads the persisted engine selection from daemon settings on mount', async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'get_agent_engine') return Promise.resolve({ engine: 'cli', agentId: 'codex' })
      return Promise.resolve(undefined)
    })
    const { result } = renderHook(() => useAgentEngine())

    await vi.waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.engine).toBe('cli')
    expect(result.current.agentId).toBe('codex')
  })

  it('falls back to the built-in engine when the daemon is unreachable', async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'get_agent_engine') return Promise.reject(new Error('daemon offline'))
      return Promise.resolve(undefined)
    })
    const { result } = renderHook(() => useAgentEngine())

    await vi.waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.engine).toBe('builtin')
    expect(result.current.agentId).toBeNull()
  })

  it('persists engine changes via the daemon (never localStorage)', async () => {
    const { result } = renderHook(() => useAgentEngine())
    await vi.waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.setEngine('cli'))
    expect(invokeMock).toHaveBeenCalledWith('set_agent_engine', { engine: 'cli' })

    act(() => result.current.setAgentId('claude'))
    expect(invokeMock).toHaveBeenCalledWith('set_agent_engine', { agentId: 'claude' })
  })

  it('ignores an invalid persisted engine value and keeps the default', async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'get_agent_engine') return Promise.resolve({ engine: 'magic', agentId: null })
      return Promise.resolve(undefined)
    })
    const { result } = renderHook(() => useAgentEngine())
    await vi.waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.engine).toBe('builtin')
  })
})
