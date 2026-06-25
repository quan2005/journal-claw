import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock global fetch + EventSource so the HTTP client is unit-testable in jsdom.
const mockFetch = vi.fn()
globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch

class MockEventSource {
  static last: MockEventSource | null = null
  url: string
  onmessage: ((msg: { data: string }) => void) | null = null
  closed = false
  constructor(url: string) {
    this.url = url
    MockEventSource.last = this
  }
  close() {
    this.closed = true
  }
  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) })
  }
}
globalThis.EventSource = MockEventSource as unknown as typeof EventSource

describe('HttpRuntimeClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    MockEventSource.last = null
    vi.resetModules()
  })

  it('invoke maps get_workspace_path to GET /workspace', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ path: '/home/me/journal', available: true }),
    })
    const { HttpRuntimeClient } = await import('../lib/runtimeClient')
    const client = new HttpRuntimeClient({ baseUrl: 'http://127.0.0.1:1' })
    const path = await client.invoke<string>('get_workspace_path')
    expect(path).toBe('/home/me/journal')
    expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:1/workspace')
  })

  it('invoke rejects unsupported commands', async () => {
    const { HttpRuntimeClient } = await import('../lib/runtimeClient')
    const client = new HttpRuntimeClient({ baseUrl: 'http://127.0.0.1:1' })
    await expect(client.invoke('nope')).rejects.toThrow(/unsupported command/)
  })

  it('invoke rejects on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
    const { HttpRuntimeClient } = await import('../lib/runtimeClient')
    const client = new HttpRuntimeClient({ baseUrl: 'http://127.0.0.1:1' })
    await expect(client.invoke('get_workspace_path')).rejects.toThrow(/500/)
  })

  it('subscribe opens EventSource on /events and surfaces parsed payloads', async () => {
    const { HttpRuntimeClient } = await import('../lib/runtimeClient')
    const client = new HttpRuntimeClient({ baseUrl: 'http://127.0.0.1:1' })
    const received: unknown[] = []
    const off = client.subscribe('conversation-stream', (p) => received.push(p))
    expect(MockEventSource.last?.url).toBe('http://127.0.0.1:1/events')
    MockEventSource.last!.emit({ session_id: 's1', event: 'text_delta', data: 'hi' })
    expect(received[0]).toEqual({ session_id: 's1', event: 'text_delta', data: 'hi' })
    off()
    expect(MockEventSource.last?.closed).toBe(true)
  })

  it('subscribe ignores malformed frames', async () => {
    const { HttpRuntimeClient } = await import('../lib/runtimeClient')
    const client = new HttpRuntimeClient({ baseUrl: 'http://127.0.0.1:1' })
    const received: unknown[] = []
    client.subscribe('conversation-stream', (p) => received.push(p))
    MockEventSource.last!.onmessage?.({ data: 'not json' })
    expect(received).toHaveLength(0)
  })
})

describe('runtime flag selection', () => {
  it('selectRuntimeClient returns Tauri by default', async () => {
    vi.resetModules()
    const { selectRuntimeClient, readRuntimeKind } = await import('../lib/runtimeClient')
    expect(readRuntimeKind()).toBe('tauri')
    const c = selectRuntimeClient()
    expect(typeof c.subscribe).toBe('function')
  })

  it('selectRuntimeClient returns HttpRuntimeClient when JOURNAL_RUNTIME=http', async () => {
    vi.resetModules()
    const g = globalThis as Record<string, unknown>
    const prev = g.__JOURNAL_RUNTIME
    g.__JOURNAL_RUNTIME = 'http'
    try {
      const { selectRuntimeClient, readRuntimeKind } = await import('../lib/runtimeClient')
      expect(readRuntimeKind()).toBe('http')
      const c = selectRuntimeClient()
      expect(c.constructor.name).toBe('HttpRuntimeClient')
    } finally {
      if (prev === undefined) delete g.__JOURNAL_RUNTIME
      else g.__JOURNAL_RUNTIME = prev
    }
  })

  it('selectRuntimeClient returns Tauri when override cleared', async () => {
    vi.resetModules()
    const g = globalThis as Record<string, unknown>
    g.__JOURNAL_RUNTIME = 'http'
    delete g.__JOURNAL_RUNTIME
    const { readRuntimeKind } = await import('../lib/runtimeClient')
    expect(readRuntimeKind()).toBe('tauri')
  })
})
