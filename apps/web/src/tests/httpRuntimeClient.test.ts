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

  it('invoke maps workspace path reads and writes to /config/workspace-path', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ path: '/home/me/journal' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => undefined,
      })
    const { HttpRuntimeClient } = await import('../lib/runtimeClient')
    const client = new HttpRuntimeClient({ baseUrl: 'http://127.0.0.1:1' })

    const path = await client.invoke<string>('get_workspace_path')
    expect(path).toBe('/home/me/journal')
    await client.invoke('set_workspace_path', { path: '/home/me/next' })

    expect(mockFetch).toHaveBeenNthCalledWith(1, 'http://127.0.0.1:1/config/workspace-path')
    expect(mockFetch).toHaveBeenNthCalledWith(2, 'http://127.0.0.1:1/config/workspace-path', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/home/me/next' }),
    })
  })

  it('invoke maps config commands to /config routes', async () => {
    const engine = { active_provider: 'deepseek', providers: [] }
    const capabilities = {
      os: 'macos',
      apple_stt: false,
      whisperkit: false,
      speaker_diarization: false,
      native_permissions: true,
    }
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ key: 'sk-test' }) })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => undefined })
      .mockResolvedValueOnce({ ok: true, json: async () => engine })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => undefined })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ version: '0.16.0' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => capabilities })
    const { HttpRuntimeClient } = await import('../lib/runtimeClient')
    const client = new HttpRuntimeClient({ baseUrl: 'http://127.0.0.1:1' })

    await expect(client.invoke('get_api_key')).resolves.toBe('sk-test')
    await client.invoke('set_api_key', { key: 'sk-next' })
    await expect(client.invoke('get_engine_config')).resolves.toEqual(engine)
    await client.invoke('set_engine_config', { config: engine })
    await expect(client.invoke('get_app_version')).resolves.toBe('0.16.0')
    await expect(client.invoke('get_platform_capabilities')).resolves.toEqual(capabilities)

    expect(mockFetch).toHaveBeenNthCalledWith(1, 'http://127.0.0.1:1/config/api-key')
    expect(mockFetch).toHaveBeenNthCalledWith(2, 'http://127.0.0.1:1/config/api-key', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'sk-next' }),
    })
    expect(mockFetch).toHaveBeenNthCalledWith(3, 'http://127.0.0.1:1/config/engine')
    expect(mockFetch).toHaveBeenNthCalledWith(4, 'http://127.0.0.1:1/config/engine', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: engine }),
    })
    expect(mockFetch).toHaveBeenNthCalledWith(5, 'http://127.0.0.1:1/config/app-version')
    expect(mockFetch).toHaveBeenNthCalledWith(6, 'http://127.0.0.1:1/config/platform-capabilities')
  })

  it('invoke maps workspace theme reads and writes to /settings', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ theme: 'dark', auto_lint: {}, global_skills_enabled: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ theme: 'light', auto_lint: {}, global_skills_enabled: false }),
      })
    const { HttpRuntimeClient } = await import('../lib/runtimeClient')
    const client = new HttpRuntimeClient({ baseUrl: 'http://127.0.0.1:1' })

    await expect(client.invoke('get_workspace_theme')).resolves.toBe('dark')
    await client.invoke('set_workspace_theme', { theme: 'light' })

    expect(mockFetch).toHaveBeenNthCalledWith(1, 'http://127.0.0.1:1/settings')
    expect(mockFetch).toHaveBeenNthCalledWith(2, 'http://127.0.0.1:1/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: 'light' }),
    })
  })

  it('invoke maps auto lint config to /settings auto_lint', async () => {
    const config = { enabled: true, frequency: 'weekly', time: '12:00', min_entries: 20 }
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ theme: 'system', auto_lint: config, global_skills_enabled: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ theme: 'system', auto_lint: config, global_skills_enabled: false }),
      })
    const { HttpRuntimeClient } = await import('../lib/runtimeClient')
    const client = new HttpRuntimeClient({ baseUrl: 'http://127.0.0.1:1' })

    await expect(client.invoke('get_auto_lint_config')).resolves.toEqual(config)
    await client.invoke('set_auto_lint_config', { config })

    expect(mockFetch).toHaveBeenNthCalledWith(2, 'http://127.0.0.1:1/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auto_lint: config }),
    })
  })

  it('invoke maps skill enabled updates to /skills/enabled', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: async () => undefined,
    })
    const { HttpRuntimeClient } = await import('../lib/runtimeClient')
    const client = new HttpRuntimeClient({ baseUrl: 'http://127.0.0.1:1' })

    await client.invoke('set_skill_enabled', { skillId: 'project:b', enabled: false })

    expect(mockFetch).toHaveBeenNthCalledWith(1, 'http://127.0.0.1:1/skills/enabled', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillId: 'project:b', enabled: false }),
    })
  })

  it('invoke maps workspace FS reads to /files routes', async () => {
    const entries = [{ name: 'notes', is_dir: true, path: 'notes', mtime_secs: 1 }]
    const candidates = [{ ...entries[0], kind: 'directory', tags: [] }]
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => entries })
      .mockResolvedValueOnce({ ok: true, json: async () => candidates })
    const { HttpRuntimeClient } = await import('../lib/runtimeClient')
    const client = new HttpRuntimeClient({ baseUrl: 'http://127.0.0.1:1' })

    await expect(client.invoke('list_workspace_dir', { relativePath: 'a b' })).resolves.toEqual(
      entries,
    )
    await expect(
      client.invoke('list_at_mention_candidates', { relativePath: '', query: 'ai' }),
    ).resolves.toEqual(candidates)

    expect(mockFetch).toHaveBeenNthCalledWith(1, 'http://127.0.0.1:1/files?relativePath=a%20b')
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:1/files/at-mention-candidates?relativePath=&query=ai',
    )
  })

  it('invoke maps workspace FS writes to /files routes', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ path: '2606/raw/p.txt' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => 'note copy.md' })
      .mockResolvedValueOnce({ ok: true, json: async () => 'renamed.md' })
      .mockResolvedValueOnce({ ok: true, json: async () => 'dest/renamed.md' })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => undefined })
    const { HttpRuntimeClient } = await import('../lib/runtimeClient')
    const client = new HttpRuntimeClient({ baseUrl: 'http://127.0.0.1:1' })

    await client.invoke('import_text', { text: 'hello' })
    await client.invoke('workspace_duplicate_file', { relativePath: 'note.md' })
    await client.invoke('workspace_rename_file', {
      relativePath: 'note copy.md',
      newName: 'renamed.md',
    })
    await client.invoke('workspace_move_file', { relativePath: 'renamed.md', destDir: 'dest' })
    await client.invoke('workspace_delete_file', { relativePath: 'dest/renamed.md' })

    expect(mockFetch).toHaveBeenNthCalledWith(1, 'http://127.0.0.1:1/materials/import-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hello' }),
    })
    expect(mockFetch).toHaveBeenNthCalledWith(2, 'http://127.0.0.1:1/files/duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relativePath: 'note.md' }),
    })
    expect(mockFetch).toHaveBeenNthCalledWith(3, 'http://127.0.0.1:1/files/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relativePath: 'note copy.md', newName: 'renamed.md' }),
    })
    expect(mockFetch).toHaveBeenNthCalledWith(4, 'http://127.0.0.1:1/files/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relativePath: 'renamed.md', destDir: 'dest' }),
    })
    expect(mockFetch).toHaveBeenNthCalledWith(
      5,
      'http://127.0.0.1:1/files?relativePath=dest%2Frenamed.md',
      { method: 'DELETE' },
    )
  })

  it('invoke maps local CRUD commands to daemon module routes', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ['2606'] })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ filename: '27-a.md' }] })
      .mockResolvedValueOnce({ ok: true, text: async () => 'body' })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => undefined })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ text: 'todo' }] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ text: 'todo' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ name: 'A' }] })
      .mockResolvedValueOnce({ ok: true, json: async () => 'A/a.md' })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ name: '关于我' }] })
      .mockResolvedValueOnce({ ok: true, text: async () => '# me' })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => undefined })
    const { HttpRuntimeClient } = await import('../lib/runtimeClient')
    const client = new HttpRuntimeClient({ baseUrl: 'http://127.0.0.1:1' })

    await client.invoke('list_available_months')
    await client.invoke('list_journal_entries_by_months', { months: ['2606'] })
    await expect(
      client.invoke('get_journal_entry_content', { path: '/ws/2606/27-a.md' }),
    ).resolves.toBe('body')
    await client.invoke('save_journal_entry_content', { path: '/ws/2606/27-a.md', content: 'next' })
    await client.invoke('list_todos')
    await client.invoke('add_todo', { text: 'todo' })
    await client.invoke('list_topics_dir', { relativePath: '' })
    await client.invoke('import_file_to_topic', { source: '/tmp/a.md', topicPath: 'A' })
    await client.invoke('list_identities')
    await expect(
      client.invoke('get_identity_content', { path: '/ws/identity/README.md' }),
    ).resolves.toBe('# me')
    await client.invoke('merge_identity', { sourcePath: 'a', targetPath: 'b', mode: 'voice_only' })

    expect(mockFetch).toHaveBeenNthCalledWith(1, 'http://127.0.0.1:1/journal/months')
    expect(mockFetch).toHaveBeenNthCalledWith(2, 'http://127.0.0.1:1/journal/entries?months=2606')
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      'http://127.0.0.1:1/journal/content?path=%2Fws%2F2606%2F27-a.md',
    )
    expect(mockFetch).toHaveBeenNthCalledWith(4, 'http://127.0.0.1:1/journal/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/ws/2606/27-a.md', content: 'next' }),
    })
    expect(mockFetch).toHaveBeenNthCalledWith(7, 'http://127.0.0.1:1/topics?relativePath=')
    expect(mockFetch).toHaveBeenNthCalledWith(8, 'http://127.0.0.1:1/topics/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: '/tmp/a.md', topicPath: 'A' }),
    })
    expect(mockFetch).toHaveBeenNthCalledWith(11, 'http://127.0.0.1:1/identity/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePath: 'a', targetPath: 'b', mode: 'voice_only' }),
    })
  })

  it('invoke maps global skill enabled updates to /skills/global-enabled', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: async () => undefined,
    })
    const { HttpRuntimeClient } = await import('../lib/runtimeClient')
    const client = new HttpRuntimeClient({ baseUrl: 'http://127.0.0.1:1' })

    await client.invoke('set_global_skill_enabled', { skillId: 'global:a', enabled: true })

    expect(mockFetch).toHaveBeenNthCalledWith(1, 'http://127.0.0.1:1/skills/global-enabled', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillId: 'global:a', enabled: true }),
    })
  })

  it('invoke rejects unsupported commands', async () => {
    const { HttpRuntimeClient } = await import('../lib/runtimeClient')
    const client = new HttpRuntimeClient({ baseUrl: 'http://127.0.0.1:1' })
    await expect(client.invoke('nope')).rejects.toThrow(/unsupported command/)
  })

  it('invoke maps conversation commands to daemon conversation routes', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => 's1' })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => undefined })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 's1' }] })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ role: 'user', content: 'hi' }] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ elapsed_secs: 1 }) })
    const { HttpRuntimeClient } = await import('../lib/runtimeClient')
    const client = new HttpRuntimeClient({ baseUrl: 'http://127.0.0.1:1' })

    await expect(client.invoke('conversation_create', { context: null })).resolves.toBe('s1')
    await client.invoke('conversation_send', { sessionId: 's1', message: 'hi', images: null })
    await expect(client.invoke('conversation_list')).resolves.toEqual([{ id: 's1' }])
    await expect(client.invoke('conversation_get_messages', { sessionId: 's1' })).resolves.toEqual([
      { role: 'user', content: 'hi' },
    ])
    await expect(client.invoke('conversation_get_stats', { sessionId: 's1' })).resolves.toEqual({
      elapsed_secs: 1,
    })

    expect(mockFetch).toHaveBeenNthCalledWith(1, 'http://127.0.0.1:1/conversation/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: null }),
    })
    expect(mockFetch).toHaveBeenNthCalledWith(2, 'http://127.0.0.1:1/conversation/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 's1', message: 'hi', images: null }),
    })
    expect(mockFetch).toHaveBeenNthCalledWith(3, 'http://127.0.0.1:1/conversation/list')
    expect(mockFetch).toHaveBeenNthCalledWith(
      4,
      'http://127.0.0.1:1/conversation/messages?sessionId=s1',
    )
    expect(mockFetch).toHaveBeenNthCalledWith(
      5,
      'http://127.0.0.1:1/conversation/stats?sessionId=s1',
    )
  })

  it('invoke rejects on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
    const { HttpRuntimeClient } = await import('../lib/runtimeClient')
    const client = new HttpRuntimeClient({ baseUrl: 'http://127.0.0.1:1' })
    await expect(client.invoke('get_workspace_path')).rejects.toThrow(/500/)
  })

  it('subscribe opens EventSource on named conversation stream and surfaces parsed payloads', async () => {
    const { HttpRuntimeClient } = await import('../lib/runtimeClient')
    const client = new HttpRuntimeClient({ baseUrl: 'http://127.0.0.1:1' })
    const received: unknown[] = []
    const off = client.subscribe('conversation-stream', (p) => received.push(p))
    expect(MockEventSource.last?.url).toBe('http://127.0.0.1:1/events/conversation-stream')
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
  it('selectRuntimeClient returns HttpRuntimeClient by default', async () => {
    vi.resetModules()
    const g = globalThis as Record<string, unknown>
    delete g.__JOURNAL_RUNTIME
    const { selectRuntimeClient, readRuntimeKind } = await import('../lib/runtimeClient')
    expect(readRuntimeKind()).toBe('http')
    const c = selectRuntimeClient()
    expect(c.constructor.name).toBe('HttpRuntimeClient')
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

  it('selectRuntimeClient returns HttpRuntimeClient when override cleared', async () => {
    vi.resetModules()
    const g = globalThis as Record<string, unknown>
    g.__JOURNAL_RUNTIME = 'http'
    delete g.__JOURNAL_RUNTIME
    const { readRuntimeKind } = await import('../lib/runtimeClient')
    expect(readRuntimeKind()).toBe('http')
  })

  it('selectRuntimeClient ignores retired JOURNAL_RUNTIME=tauri override', async () => {
    vi.resetModules()
    const g = globalThis as Record<string, unknown>
    const prev = g.__JOURNAL_RUNTIME
    g.__JOURNAL_RUNTIME = 'tauri'
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
})
