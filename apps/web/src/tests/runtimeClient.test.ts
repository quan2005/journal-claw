import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock tauri core invoke + event listen at module level so the wrapper (imported
// after the mocks below) wires up against our spies.
const mockInvoke = vi.fn()
const mockUnlistenFn = vi.fn()
const mockListen = vi.fn<(event: string, handler: (e: unknown) => void) => Promise<() => void>>()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: (event: string, handler: (e: unknown) => void) => mockListen(event, handler),
}))

describe('TauriRuntimeClient', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockResolvedValue(undefined)
    mockUnlistenFn.mockClear()
    // Default: listen resolves to a spy unlisten function.
    mockListen.mockResolvedValue(mockUnlistenFn)
  })

  const { TauriRuntimeClient, defaultRuntimeClient } = await import('../lib/runtimeClient')

  it('forwards invoke command and args to tauri invoke', async () => {
    const client = new TauriRuntimeClient()
    await client.invoke('get_workspace_path')
    expect(mockInvoke).toHaveBeenCalledWith('get_workspace_path')

    await client.invoke('set_workspace_path', { path: '/x' })
    expect(mockInvoke).toHaveBeenCalledWith('set_workspace_path', { path: '/x' })
  })

  it('returns invoke resolved value', async () => {
    mockInvoke.mockResolvedValue('ok')
    const client = new TauriRuntimeClient()
    await expect(client.invoke('x')).resolves.toBe('ok')
  })

  it('propagates invoke rejection', async () => {
    const boom = new Error('boom')
    mockInvoke.mockRejectedValue(boom)
    const client = new TauriRuntimeClient()
    await expect(client.invoke('x')).rejects.toBe(boom)
  })

  it('subscribe forwards event name and handler to tauri listen', async () => {
    const client = new TauriRuntimeClient()
    const handler = () => {}
    client.subscribe('conversation-stream', handler)
    await vi.waitFor(() => expect(mockListen).toHaveBeenCalled())
    expect(mockListen).toHaveBeenCalledWith('conversation-stream', expect.any(Function))
  })

  it('subscribe handler receives the payload emitted by tauri', async () => {
    const client = new TauriRuntimeClient()
    const received: unknown[] = []
    client.subscribe('conversation-stream', (payload) => {
      received.push(payload)
    })
    await vi.waitFor(() => expect(mockListen).toHaveBeenCalled())
    const capturedHandler = mockListen.mock.calls[0]![1]
    const synthPayload = { session_id: 's1', event: 'text_delta', data: 'hi' }
    // Tauri listen calls back with the full event object — wrapper must surface .payload.
    capturedHandler({ id: 1, event: 'conversation-stream', payload: synthPayload })
    expect(received[0]).toBe(synthPayload)
  })

  it('unsubscribe is synchronous and calls the tauri unlisten', async () => {
    const client = new TauriRuntimeClient()
    const off = client.subscribe('conversation-stream', () => {})
    // Wait for listen promise to resolve so unlistenFn is registered, then unsubscribe
    // synchronously (no await on off).
    await vi.waitFor(() => expect(mockListen).toHaveBeenCalled())
    // Microtask flush so the resolved unlistenFn is captured by the wrapper.
    await Promise.resolve()
    off()
    expect(mockUnlistenFn).toHaveBeenCalledTimes(1)
  })

  it('unsubscribe is idempotent', async () => {
    const client = new TauriRuntimeClient()
    const off = client.subscribe('conversation-stream', () => {})
    await vi.waitFor(() => expect(mockListen).toHaveBeenCalled())
    await Promise.resolve()
    off()
    off()
    off()
    expect(mockUnlistenFn).toHaveBeenCalledTimes(1)
  })

  it('unsubscribe before listen resolves still releases the listener', async () => {
    // listen that never resolves during the test window.
    mockListen.mockReturnValue(new Promise(() => {}))
    const client = new TauriRuntimeClient()
    const off = client.subscribe('conversation-stream', () => {})
    off() // synchronously, before listen resolves
    expect(mockUnlistenFn).not.toHaveBeenCalled()

    // Now resolve listen; the wrapper must invoke the deferred unlisten.
    let resolveListen!: (fn: () => void) => void
    const pendingListen = new Promise<() => void>((res) => {
      resolveListen = res
    })
    mockListen.mockReturnValueOnce(pendingListen)
    // Re-subscribe under a fresh wrapper to exercise the deferred-release path:
    const client2 = new TauriRuntimeClient()
    const off2 = client2.subscribe('conversation-stream', () => {})
    off2()
    resolveListen(mockUnlistenFn)
    await vi.waitFor(() => expect(mockUnlistenFn).toHaveBeenCalledTimes(1))
  })

  it('default export TauriRuntimeClient is constructible without args', () => {
    expect(() => new TauriRuntimeClient()).not.toThrow()
    expect(defaultRuntimeClient).toBeDefined()
    expect(typeof defaultRuntimeClient.invoke).toBe('function')
    expect(typeof defaultRuntimeClient.subscribe).toBe('function')
  })
})
