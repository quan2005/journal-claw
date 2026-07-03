import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpRuntimeClient } from '../lib/httpRuntimeClient'
import {
  hostOpenSettings,
  hostOpenPrivacySettings,
  hostRevealInFileManager,
  hostOpenWithSystem,
  pickHostFolder,
} from '../lib/hostBridge'

/**
 * IPC contract — verifies the runtime/host boundary that replaced the deleted
 * `lib/tauri.ts` shim.
 *
 * The frontend no longer goes through per-command wrapper functions; call sites
 * invoke `selectRuntimeClient().invoke(command, args)` directly. The CONTRACT
 * therefore lives in two places, both exercised here:
 *
 *   1. HttpRuntimeClient.invoke() — maps a command name + args to a daemon
 *      HTTP method + route + body. This is the daemon wire contract.
 *   2. hostBridge — maps host affordances to the Electron preload whitelist
 *      (`window.electronAPI`) or local host events.
 *
 * These tests guard against silent regressions in command/route/arg mapping.
 */

const BASE = 'http://127.0.0.1:17510'

function jsonResponse(body: unknown, status = 200) {
  return { ok: true, status, json: async () => body, text: async () => String(body) }
}

function textResponse(body: string, status = 200) {
  return { ok: true, status, json: async () => body, text: async () => body }
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function client() {
  return new HttpRuntimeClient({ baseUrl: BASE })
}

/** Assert the most recent fetch call used `method` + path (relative to BASE). */
function expectFetch(method: string, path: string) {
  expect(fetchMock).toHaveBeenCalled()
  const calls = fetchMock.mock.calls
  const [url, init] = calls[calls.length - 1]
  expect(url).toBe(`${BASE}${path}`)
  expect((init as RequestInit | undefined)?.method ?? 'GET').toBe(method)
  return init as RequestInit | undefined
}

/** Assert the request body (for non-GET) serialises to the expected object. */
function expectBody(init: RequestInit | undefined, expected: unknown) {
  expect(init?.body).toBe(JSON.stringify(expected))
}

// ---------------------------------------------------------------------------
// Config (GET / PUT routes)
// ---------------------------------------------------------------------------
describe('Config', () => {
  it('get_workspace_path → GET /config/workspace-path, returns body.path', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ path: '/ws' }))
    await expect(client().invoke('get_workspace_path')).resolves.toBe('/ws')
    expectFetch('GET', '/config/workspace-path')
  })

  it('set_workspace_path → PUT /config/workspace-path { path }', async () => {
    await client().invoke('set_workspace_path', { path: '/ws' })
    expectBody(expectFetch('PUT', '/config/workspace-path'), { path: '/ws' })
  })

  it('get_api_key → GET /config/api-key, falls back to null', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    await expect(client().invoke('get_api_key')).resolves.toBe(null)
    expectFetch('GET', '/config/api-key')
  })

  it('get_engine_config → GET /config/engine', async () => {
    await client().invoke('get_engine_config')
    expectFetch('GET', '/config/engine')
  })

  it('set_engine_config → PUT /config/engine { config }', async () => {
    const cfg = { active_provider: 'a', providers: [] }
    await client().invoke('set_engine_config', { config: cfg })
    expectBody(expectFetch('PUT', '/config/engine'), { config: cfg })
  })

  it('get_app_version → GET /config/app-version, returns body.version', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ version: '1.2.3' }))
    await expect(client().invoke('get_app_version')).resolves.toBe('1.2.3')
    expectFetch('GET', '/config/app-version')
  })

  it('get_platform_capabilities → GET /config/platform-capabilities', async () => {
    await client().invoke('get_platform_capabilities')
    expectFetch('GET', '/config/platform-capabilities')
  })
})

// ---------------------------------------------------------------------------
// Workspace settings slice (all multiplexed over GET/PUT /settings)
// ---------------------------------------------------------------------------
describe('Workspace settings', () => {
  it('get_workspace_theme reads from GET /settings', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ theme: 'dark' }))
    await expect(client().invoke('get_workspace_theme')).resolves.toBe('dark')
    expectFetch('GET', '/settings')
  })

  it('set_workspace_theme → PUT /settings { theme }', async () => {
    await client().invoke('set_workspace_theme', { theme: 'dark' })
    expectBody(expectFetch('PUT', '/settings'), { theme: 'dark' })
  })

  it('get/set agent_engine is a partial settings patch', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ agent_engine: 'cli', agent_id: 'codex' }))
    await expect(client().invoke('get_agent_engine')).resolves.toEqual({
      engine: 'cli',
      agentId: 'codex',
    })
    await client().invoke('set_agent_engine', { engine: 'builtin' })
    expectBody(expectFetch('PUT', '/settings'), { agent_engine: 'builtin' })
    await client().invoke('set_agent_engine', { agentId: 'claude' })
    expectBody(expectFetch('PUT', '/settings'), { agent_id: 'claude' })
  })

  it('get/set_global_skills_enabled operate on /settings', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ global_skills_enabled: true }))
    await expect(client().invoke('get_global_skills_enabled')).resolves.toBe(true)
    await client().invoke('set_global_skills_enabled', { enabled: false })
    expectBody(expectFetch('PUT', '/settings'), { global_skills_enabled: false })
  })

  it('get/set_auto_lint_config operate on /settings', async () => {
    const cfg = { enabled: true, frequency: 'weekly', time: '03:00', min_entries: 20 }
    fetchMock.mockResolvedValue(jsonResponse({ auto_lint: cfg }))
    await expect(client().invoke('get_auto_lint_config')).resolves.toEqual(cfg)
    await client().invoke('set_auto_lint_config', { config: cfg })
    expectBody(expectFetch('PUT', '/settings'), { auto_lint: cfg })
  })

  it('set_pinned_items normalises then writes to /settings', async () => {
    await client().invoke('set_pinned_items', {
      items: [
        { type: 'journal', path: 'a.md', order: 0 },
        { type: 'identity', path: 'b.md', order: 1 },
      ],
    })
    expectBody(expectFetch('PUT', '/settings'), {
      pinned: [
        { type: 'journal', path: 'a.md', order: 0 },
        { type: 'identity', path: 'b.md', order: 1 },
      ],
    })
  })
})

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------
describe('Skills', () => {
  it('list_skills → GET /skills', async () => {
    await client().invoke('list_skills')
    expectFetch('GET', '/skills')
  })

  it('get_skill_content → GET /skills/content?skillId=', async () => {
    fetchMock.mockResolvedValue(textResponse('# skill'))
    await expect(client().invoke('get_skill_content', { skillId: 'p:x' })).resolves.toBe('# skill')
    expectFetch('GET', '/skills/content?skillId=p%3Ax')
  })

  it('set_skill_enabled → PUT /skills/enabled { skillId, enabled }', async () => {
    await client().invoke('set_skill_enabled', { skillId: 'p:x', enabled: false })
    expectBody(expectFetch('PUT', '/skills/enabled'), { skillId: 'p:x', enabled: false })
  })

  it('set_global_skill_enabled → PUT /skills/global-enabled', async () => {
    await client().invoke('set_global_skill_enabled', { skillId: 'g:y', enabled: true })
    expectBody(expectFetch('PUT', '/skills/global-enabled'), { skillId: 'g:y', enabled: true })
  })

  it('open_skills_dir → POST /skills/open-dir { scope }', async () => {
    await client().invoke('open_skills_dir', { scope: 'project' })
    expectBody(expectFetch('POST', '/skills/open-dir'), { scope: 'project' })
  })

  it('open_skill_dir → POST /skills/open-skill-dir { scope, dirName }', async () => {
    await client().invoke('open_skill_dir', { scope: 'project', dirName: 'journal' })
    expectBody(expectFetch('POST', '/skills/open-skill-dir'), {
      scope: 'project',
      dirName: 'journal',
    })
  })
})

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------
describe('Journal', () => {
  it('list_available_months → GET /journal/months', async () => {
    await client().invoke('list_available_months')
    expectFetch('GET', '/journal/months')
  })

  it('list_journal_entries_by_months → GET /journal/entries?months=', async () => {
    await client().invoke('list_journal_entries_by_months', { months: ['2603', '2604'] })
    expectFetch('GET', '/journal/entries?months=2603%2C2604')
  })

  it('get_journal_entry_content → GET /journal/content?path=', async () => {
    fetchMock.mockResolvedValue(textResponse('# hi'))
    await client().invoke('get_journal_entry_content', { path: '/ws/2603/01-x.md' })
    expectFetch('GET', '/journal/content?path=%2Fws%2F2603%2F01-x.md')
  })

  it('save_journal_entry_content → PUT /journal/content { path, content }', async () => {
    await client().invoke('save_journal_entry_content', { path: '/ws/x.md', content: '# x' })
    expectBody(expectFetch('PUT', '/journal/content'), { path: '/ws/x.md', content: '# x' })
  })

  it('delete_journal_entry → DELETE /journal/entry?path=', async () => {
    await client().invoke('delete_journal_entry', { path: '/ws/x.md' })
    expectFetch('DELETE', '/journal/entry?path=%2Fws%2Fx.md')
  })
})

// ---------------------------------------------------------------------------
// Materials / AI processing
// ---------------------------------------------------------------------------
describe('Materials & AI processing', () => {
  it('import_file → POST /materials/import-file { srcPath }', async () => {
    await client().invoke('import_file', { srcPath: '/tmp/a.pdf' })
    expectBody(expectFetch('POST', '/materials/import-file'), { srcPath: '/tmp/a.pdf' })
  })

  it('import_text → POST /materials/import-text { text }', async () => {
    await client().invoke('import_text', { text: 'hi' })
    expectBody(expectFetch('POST', '/materials/import-text'), { text: 'hi' })
  })

  it('import_text_temp → POST /materials/import-text-temp { text }', async () => {
    await client().invoke('import_text_temp', { text: 'hi' })
    expectBody(expectFetch('POST', '/materials/import-text-temp'), { text: 'hi' })
  })

  it('import_image_temp → POST /materials/import-image-temp { data, mediaType }', async () => {
    await client().invoke('import_image_temp', { data: 'b64', mediaType: 'image/png' })
    expectBody(expectFetch('POST', '/materials/import-image-temp'), {
      data: 'b64',
      mediaType: 'image/png',
    })
  })

  it('trigger_ai_processing → POST /ai-processing/trigger { materialPath, yearMonth, note }', async () => {
    await client().invoke('trigger_ai_processing', {
      materialPath: '/raw/f.txt',
      yearMonth: '2604',
      note: 'n',
    })
    expectBody(expectFetch('POST', '/ai-processing/trigger'), {
      materialPath: '/raw/f.txt',
      yearMonth: '2604',
      note: 'n',
    })
  })

  it('trigger_ai_prompt → POST /ai-processing/prompt { prompt }', async () => {
    await client().invoke('trigger_ai_prompt', { prompt: 'summarize' })
    expectBody(expectFetch('POST', '/ai-processing/prompt'), { prompt: 'summarize' })
  })

  it('cancel_ai_processing → POST /ai-processing/cancel', async () => {
    await client().invoke('cancel_ai_processing')
    expectBody(expectFetch('POST', '/ai-processing/cancel'), {})
  })

  it('cancel_queued_item → POST /ai-processing/cancel-queued { materialPath }', async () => {
    await client().invoke('cancel_queued_item', { materialPath: '/raw/f.txt' })
    expectBody(expectFetch('POST', '/ai-processing/cancel-queued'), { materialPath: '/raw/f.txt' })
  })

  it('get_workspace_prompt → GET /ai-processing/workspace-prompt (text)', async () => {
    fetchMock.mockResolvedValue(textResponse('prompt'))
    await client().invoke('get_workspace_prompt')
    expectFetch('GET', '/ai-processing/workspace-prompt')
  })

  it('set_workspace_prompt → PUT /ai-processing/workspace-prompt { content }', async () => {
    await client().invoke('set_workspace_prompt', { content: 'p' })
    expectBody(expectFetch('PUT', '/ai-processing/workspace-prompt'), { content: 'p' })
  })
})

// ---------------------------------------------------------------------------
// Workspace files
// ---------------------------------------------------------------------------
describe('Workspace files', () => {
  it('list_workspace_dir → GET /files?relativePath=', async () => {
    await client().invoke('list_workspace_dir', { relativePath: 'notes' })
    expectFetch('GET', '/files?relativePath=notes')
  })

  it('list_at_mention_candidates → GET /files/at-mention-candidates?…', async () => {
    await client().invoke('list_at_mention_candidates', { relativePath: '', query: 'ai' })
    expectFetch('GET', '/files/at-mention-candidates?relativePath=&query=ai')
  })

  it('workspace_duplicate_file → POST /files/duplicate { relativePath }', async () => {
    await client().invoke('workspace_duplicate_file', { relativePath: 'n.md' })
    expectBody(expectFetch('POST', '/files/duplicate'), { relativePath: 'n.md' })
  })

  it('workspace_rename_file → POST /files/rename { relativePath, newName }', async () => {
    await client().invoke('workspace_rename_file', { relativePath: 'n.md', newName: 'r.md' })
    expectBody(expectFetch('POST', '/files/rename'), { relativePath: 'n.md', newName: 'r.md' })
  })

  it('workspace_move_file → POST /files/move { relativePath, destDir }', async () => {
    await client().invoke('workspace_move_file', { relativePath: 'n.md', destDir: 'd' })
    expectBody(expectFetch('POST', '/files/move'), { relativePath: 'n.md', destDir: 'd' })
  })

  it('workspace_delete_file → DELETE /files?relativePath=', async () => {
    await client().invoke('workspace_delete_file', { relativePath: 'n.md' })
    expectFetch('DELETE', '/files?relativePath=n.md')
  })
})

// ---------------------------------------------------------------------------
// Topics
// ---------------------------------------------------------------------------
describe('Topics', () => {
  it('list_topics_dir → GET /topics?relativePath=', async () => {
    await client().invoke('list_topics_dir', { relativePath: '' })
    expectFetch('GET', '/topics?relativePath=')
  })

  it('create_topic → POST /topics { name, parentPath }', async () => {
    await client().invoke('create_topic', { name: 'x', parentPath: null })
    expectBody(expectFetch('POST', '/topics'), { name: 'x', parentPath: null })
  })

  it('delete_topic → DELETE /topics?relativePath=', async () => {
    await client().invoke('delete_topic', { relativePath: 't' })
    expectFetch('DELETE', '/topics?relativePath=t')
  })

  it('import_file_to_topic → POST /topics/import { source, topicPath }', async () => {
    await client().invoke('import_file_to_topic', { source: '/s', topicPath: 't' })
    expectBody(expectFetch('POST', '/topics/import'), { source: '/s', topicPath: 't' })
  })
})

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------
describe('Identity', () => {
  it('list_identities → GET /identity', async () => {
    await client().invoke('list_identities')
    expectFetch('GET', '/identity')
  })

  it('get_identity_content → GET /identity/content?path=', async () => {
    fetchMock.mockResolvedValue(textResponse('# Alice'))
    await client().invoke('get_identity_content', { path: '/id/a.md' })
    expectFetch('GET', '/identity/content?path=%2Fid%2Fa.md')
  })

  it('save_identity_content → PUT /identity/content { path, content }', async () => {
    await client().invoke('save_identity_content', { path: '/id/a.md', content: '# A' })
    expectBody(expectFetch('PUT', '/identity/content'), { path: '/id/a.md', content: '# A' })
  })

  it('delete_identity → DELETE /identity?path=', async () => {
    await client().invoke('delete_identity', { path: '/id/a.md' })
    expectFetch('DELETE', '/identity?path=%2Fid%2Fa.md')
  })

  it('create_identity → POST /identity { region, name, … }', async () => {
    await client().invoke('create_identity', {
      region: 'cn',
      name: 'Alice',
      summary: 's',
      tags: ['dev'],
      speakerId: 'spk-1',
    })
    expectBody(expectFetch('POST', '/identity'), {
      region: 'cn',
      name: 'Alice',
      summary: 's',
      tags: ['dev'],
      speakerId: 'spk-1',
    })
  })

  it('merge_identity → POST /identity/merge { sourcePath, targetPath, mode }', async () => {
    await client().invoke('merge_identity', {
      sourcePath: '/a.md',
      targetPath: '/b.md',
      mode: 'full',
    })
    expectBody(expectFetch('POST', '/identity/merge'), {
      sourcePath: '/a.md',
      targetPath: '/b.md',
      mode: 'full',
    })
  })
})

// ---------------------------------------------------------------------------
// Todos
// ---------------------------------------------------------------------------
describe('Todos', () => {
  it('list_todos → GET /todos', async () => {
    await client().invoke('list_todos')
    expectFetch('GET', '/todos')
  })

  it('add_todo → POST /todos { text, due, source, path }', async () => {
    await client().invoke('add_todo', { text: 'milk', due: null, source: null, path: null })
    expectBody(expectFetch('POST', '/todos'), { text: 'milk', due: null, source: null, path: null })
  })

  it('toggle_todo → POST /todos/toggle { lineIndex, checked, doneFile }', async () => {
    await client().invoke('toggle_todo', { lineIndex: 3, checked: true, doneFile: false })
    expectBody(expectFetch('POST', '/todos/toggle'), {
      lineIndex: 3,
      checked: true,
      doneFile: false,
    })
  })

  it('delete_todo → DELETE /todos?lineIndex=&doneFile=', async () => {
    await client().invoke('delete_todo', { lineIndex: 5, doneFile: true })
    expectFetch('DELETE', '/todos?lineIndex=5&doneFile=true')
  })

  it('update_todo_text → PUT /todos/text { lineIndex, text, doneFile }', async () => {
    await client().invoke('update_todo_text', { lineIndex: 2, text: 'x', doneFile: false })
    expectBody(expectFetch('PUT', '/todos/text'), { lineIndex: 2, text: 'x', doneFile: false })
  })
})

// ---------------------------------------------------------------------------
// Conversation
// ---------------------------------------------------------------------------
describe('Conversation', () => {
  it('conversation_create → POST /conversation/create { context, contextFiles }', async () => {
    fetchMock.mockResolvedValue(jsonResponse('s1'))
    await expect(
      client().invoke('conversation_create', { context: 'ctx', contextFiles: ['a.md'] }),
    ).resolves.toBe('s1')
    expectBody(expectFetch('POST', '/conversation/create'), {
      context: 'ctx',
      contextFiles: ['a.md'],
    })
  })

  it('conversation_send → POST /conversation/send { sessionId, message, images }', async () => {
    await client().invoke('conversation_send', {
      sessionId: 's1',
      message: 'hi',
      images: [{ media_type: 'image/png', data: 'b64' }],
    })
    expectBody(expectFetch('POST', '/conversation/send'), {
      sessionId: 's1',
      message: 'hi',
      images: [{ media_type: 'image/png', data: 'b64' }],
    })
  })

  it('conversation_list → GET /conversation/list', async () => {
    await client().invoke('conversation_list')
    expectFetch('GET', '/conversation/list')
  })

  it('conversation_rename → POST /conversation/rename { sessionId, title }', async () => {
    await client().invoke('conversation_rename', { sessionId: 's1', title: 'T' })
    expectBody(expectFetch('POST', '/conversation/rename'), { sessionId: 's1', title: 'T' })
  })

  it('conversation_get_stats → GET /conversation/stats?sessionId=', async () => {
    await client().invoke('conversation_get_stats', { sessionId: 's1' })
    expectFetch('GET', '/conversation/stats?sessionId=s1')
  })
})

// ---------------------------------------------------------------------------
// Work queue
// ---------------------------------------------------------------------------
describe('Work queue', () => {
  it('enqueue_work → POST /work-queue { text, files, prompt, displayName }', async () => {
    await client().invoke('enqueue_work', {
      text: null,
      files: ['a.md'],
      prompt: null,
      displayName: 'n',
    })
    expectBody(expectFetch('POST', '/work-queue'), {
      text: null,
      files: ['a.md'],
      prompt: null,
      displayName: 'n',
    })
  })

  it('cancel_work_item → POST /work-queue/:id/cancel', async () => {
    await client().invoke('cancel_work_item', { id: 'w1' })
    expectBody(expectFetch('POST', '/work-queue/w1/cancel'), {})
  })

  it('dismiss_work_item → DELETE /work-queue/:id', async () => {
    await client().invoke('dismiss_work_item', { id: 'w1' })
    expectFetch('DELETE', '/work-queue/w1')
  })
})

// ---------------------------------------------------------------------------
// Automation
// ---------------------------------------------------------------------------
describe('Automation', () => {
  const request = {
    title: '每日总结',
    template_id: 'daily-summary',
    prompt: '总结昨天',
    schedule: { kind: 'daily', time: '08:00', timezone: 'Asia/Hong_Kong' },
    scope: { kind: 'relative', range: 'yesterday' },
    enabled: true,
  }

  it('list_routines → GET /automation/routines', async () => {
    await client().invoke('list_routines')
    expectFetch('GET', '/automation/routines')
  })

  it('create_routine → POST /automation/routines with request body', async () => {
    await client().invoke('create_routine', { request })
    expectBody(expectFetch('POST', '/automation/routines'), request)
  })

  it('update_routine → PATCH /automation/routines/:id with patch', async () => {
    await client().invoke('update_routine', { id: 'r1', patch: { enabled: false } })
    expectFetch('PATCH', '/automation/routines/r1')
  })

  it('delete_routine → DELETE /automation/routines/:id', async () => {
    await client().invoke('delete_routine', { id: 'r1' })
    expectFetch('DELETE', '/automation/routines/r1')
  })

  it('run_routine_now → POST /automation/routines/:id/run', async () => {
    await client().invoke('run_routine_now', { id: 'r1' })
    expectBody(expectFetch('POST', '/automation/routines/r1/run'), {})
  })
})

// ---------------------------------------------------------------------------
// Onboarding / Permissions / Auto-lint / Event log
// ---------------------------------------------------------------------------
describe('Misc daemon routes', () => {
  it('get_onboarding_status → GET /onboarding/status', async () => {
    await client().invoke('get_onboarding_status')
    expectFetch('GET', '/onboarding/status')
  })

  it('complete_onboarding → POST /onboarding/complete', async () => {
    await client().invoke('complete_onboarding')
    expectBody(expectFetch('POST', '/onboarding/complete'), {})
  })

  it('set_onboarding_step → PUT /onboarding/step { step }', async () => {
    await client().invoke('set_onboarding_step', { step: 1 })
    expectBody(expectFetch('PUT', '/onboarding/step'), { step: 1 })
  })

  it('check_app_permissions → GET /permissions', async () => {
    await client().invoke('check_app_permissions')
    expectFetch('GET', '/permissions')
  })

  it('request_permission → POST /permissions/request { perm }', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'granted' }))
    await expect(
      client().invoke('request_permission', { perm: 'speech_recognition' }),
    ).resolves.toBe('granted')
    expectBody(expectFetch('POST', '/permissions/request'), { perm: 'speech_recognition' })
  })

  it('get_auto_lint_status → GET /auto-lint/status', async () => {
    await client().invoke('get_auto_lint_status')
    expectFetch('GET', '/auto-lint/status')
  })

  it('trigger_lint_now → POST /auto-lint/trigger', async () => {
    await client().invoke('trigger_lint_now')
    expectBody(expectFetch('POST', '/auto-lint/trigger'), {})
  })

  it('get_events_since → GET /event-log/events?sinceSeq=', async () => {
    await client().invoke('get_events_since', { sinceSeq: 42 })
    expectFetch('GET', '/event-log/events?sinceSeq=42')
  })

  it('unknown command rejects (only daemon surface supported)', async () => {
    await expect(client().invoke('not_a_real_command')).rejects.toThrow(/unsupported command/)
  })
})

// ---------------------------------------------------------------------------
// hostBridge — host affordances route through window.electronAPI
// ---------------------------------------------------------------------------
describe('hostBridge', () => {
  function mockElectron() {
    const api = {
      reveal: vi.fn().mockResolvedValue(undefined),
      openPath: vi.fn().mockResolvedValue(undefined),
      openExternal: vi.fn().mockResolvedValue(undefined),
      pickFolder: vi.fn().mockResolvedValue('/picked'),
      setZoom: vi.fn(),
      setWindowTheme: vi.fn(),
      convertFileSrc: vi.fn((p: string) => `src://${p}`),
      ask: vi.fn().mockResolvedValue(true),
      openDialog: vi.fn().mockResolvedValue(null),
      onFileDrop: vi.fn(() => () => {}),
    }
    window.electronAPI = api as unknown as typeof window.electronAPI
    return api
  }

  afterEach(() => {
    delete window.electronAPI
  })

  it('hostRevealInFileManager calls electronAPI.reveal', async () => {
    const api = mockElectron()
    await hostRevealInFileManager('/tmp/a.m4a')
    expect(api.reveal).toHaveBeenCalledWith('/tmp/a.m4a')
  })

  it('hostOpenWithSystem opens http URL via openExternal', async () => {
    const api = mockElectron()
    await hostOpenWithSystem('https://example.com')
    expect(api.openExternal).toHaveBeenCalledWith('https://example.com')
    expect(api.openPath).not.toHaveBeenCalled()
  })

  it('hostOpenWithSystem opens local path via openPath', async () => {
    const api = mockElectron()
    await hostOpenWithSystem('/tmp/f.md')
    expect(api.openPath).toHaveBeenCalledWith('/tmp/f.md')
    expect(api.openExternal).not.toHaveBeenCalled()
  })

  it('pickHostFolder calls electronAPI.pickFolder', async () => {
    const api = mockElectron()
    await expect(pickHostFolder()).resolves.toBe('/picked')
    expect(api.pickFolder).toHaveBeenCalledOnce()
  })

  it('hostOpenSettings emits a local host event (no electronAPI)', async () => {
    const seen: unknown[] = []
    const handler = (e: Event) => seen.push((e as CustomEvent).detail)
    window.addEventListener('journal-host:open-settings', handler)
    await hostOpenSettings()
    // No payload carried (jsdom renders an absent detail as null).
    expect(seen).toHaveLength(1)
    expect(seen[0]).toBeFalsy()
    window.removeEventListener('journal-host:open-settings', handler)
  })

  it('hostOpenPrivacySettings emits the pane in the event detail', async () => {
    const seen: unknown[] = []
    const handler = (e: Event) => seen.push((e as CustomEvent).detail)
    window.addEventListener('journal-host:open-settings', handler)
    await hostOpenPrivacySettings('speech_recognition')
    expect(seen).toEqual([{ pane: 'speech_recognition' }])
    window.removeEventListener('journal-host:open-settings', handler)
  })
})
