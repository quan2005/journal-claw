/**
 * HttpRuntimeClient — the daemon-backed JournalRuntimeClient implementation.
 *
 * Phase 1 shipped TauriRuntimeClient as the only transport. This is the
 * second implementation: when JOURNAL_RUNTIME=http (or workspace_settings
 * selects it), the frontend talks to the TS daemon over HTTP + SSE instead
 * of Tauri IPC. Both satisfy the same JournalRuntimeClient interface, so
 * callers (hooks) stay transport-agnostic.
 *
 * invoke()  -> fetch(<baseUrl>/...). The command name is mapped to an HTTP
 *   route. Unknown commands reject — only the daemon surface is supported.
 * subscribe() -> EventSource(<baseUrl>/events-style SSE). It opens an SSE
 *   connection and calls the handler for each parsed `data:` payload, just
 *   like the Tauri wrapper surfaces `.payload`.
 *
 * The daemon base URL defaults to http://127.0.0.1:17510 (matches cli.ts
 * default port) and can be overridden via JOURNAL_DAEMON_URL.
 */
import type { JournalRuntimeClient } from './runtimeClient'

export interface HttpRuntimeClientOptions {
  baseUrl?: string
}

const DEFAULT_BASE_URL = 'http://127.0.0.1:17510'

interface AutoLintConfig {
  enabled: boolean
  frequency: 'daily' | 'weekly' | 'monthly'
  time: '03:00' | '12:00' | '22:00'
  min_entries: 10 | 20 | 30
}

interface WorkspaceSettings {
  theme: 'light' | 'dark' | 'system'
  auto_lint: AutoLintConfig
  global_skills_enabled: boolean
  disabled_skills?: string[]
  enabled_global_skills?: string[]
}

function resolveBaseUrl(opts?: HttpRuntimeClientOptions): string {
  // Browser-safe: opts > localStorage > injected env > default.
  if (opts?.baseUrl) return opts.baseUrl
  try {
    if (typeof localStorage !== 'undefined') {
      const ls = localStorage.getItem('JOURNAL_DAEMON_URL')
      if (ls) return ls
    }
  } catch {
    // ignore
  }
  return (
    (((globalThis as Record<string, unknown>).process as Record<string, unknown> | undefined)
      ?.JOURNAL_DAEMON_URL as string | undefined) ?? DEFAULT_BASE_URL
  )
}

export class HttpRuntimeClient implements JournalRuntimeClient {
  readonly baseUrl: string

  constructor(opts: HttpRuntimeClientOptions = {}) {
    this.baseUrl = resolveBaseUrl(opts)
  }

  async invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    // Map the high-level command to a daemon route. Only the minimal surface
    // the pilot needs is wired; unknown commands reject so callers fall back.
    switch (command) {
      case 'get_workspace_path': {
        const body = (await this.getJson('/config/workspace-path', 'daemon workspace path')) as {
          path?: string
        }
        return body.path as unknown as T
      }
      case 'set_workspace_path': {
        await this.putJson('/config/workspace-path', { path: args?.path }, 'daemon workspace path')
        return undefined as T
      }
      case 'get_api_key': {
        const body = (await this.getJson('/config/api-key', 'daemon api key')) as {
          key?: string | null
        }
        return (body.key ?? null) as unknown as T
      }
      case 'set_api_key': {
        await this.putJson('/config/api-key', { key: args?.key }, 'daemon api key')
        return undefined as T
      }
      case 'get_engine_config': {
        return (await this.getJson('/config/engine', 'daemon engine config')) as T
      }
      case 'set_engine_config': {
        await this.putJson('/config/engine', { config: args?.config }, 'daemon engine config')
        return undefined as T
      }
      case 'get_app_version': {
        const body = (await this.getJson('/config/app-version', 'daemon app version')) as {
          version?: string
        }
        return body.version as unknown as T
      }
      case 'get_platform_capabilities': {
        return (await this.getJson(
          '/config/platform-capabilities',
          'daemon platform capabilities',
        )) as T
      }
      case 'get_workspace_theme': {
        const settings = await this.getSettings()
        return settings.theme as unknown as T
      }
      case 'set_workspace_theme': {
        await this.updateSettings({ theme: args?.theme })
        return undefined as T
      }
      case 'get_auto_lint_config': {
        const settings = await this.getSettings()
        return settings.auto_lint as unknown as T
      }
      case 'set_auto_lint_config': {
        await this.updateSettings({ auto_lint: args?.config })
        return undefined as T
      }
      case 'get_global_skills_enabled': {
        const settings = await this.getSettings()
        return settings.global_skills_enabled as unknown as T
      }
      case 'set_global_skills_enabled': {
        await this.updateSettings({ global_skills_enabled: args?.enabled })
        return undefined as T
      }
      case 'set_skill_enabled': {
        await this.putJson(
          '/skills/enabled',
          { skillId: args?.skillId, enabled: args?.enabled },
          'daemon skill enabled',
        )
        return undefined as T
      }
      case 'set_global_skill_enabled': {
        await this.putJson(
          '/skills/global-enabled',
          { skillId: args?.skillId, enabled: args?.enabled },
          'daemon global skill enabled',
        )
        return undefined as T
      }
      case 'list_skills': {
        return (await this.getJson('/skills', 'daemon skills')) as T
      }
      case 'get_skill_content': {
        return (await this.getText(
          `/skills/content?skillId=${encodeURIComponent(typeof args?.skillId === 'string' ? args.skillId : '')}`,
          'daemon skill content',
        )) as T
      }
      case 'open_skills_dir': {
        await this.postJson('/skills/open-dir', { scope: args?.scope }, 'daemon open skills dir')
        return undefined as T
      }
      case 'open_skill_dir': {
        await this.postJson(
          '/skills/open-skill-dir',
          { scope: args?.scope, dirName: args?.dirName },
          'daemon open skill dir',
        )
        return undefined as T
      }
      case 'compile_mdx': {
        return (await this.postText(
          '/mdx/compile',
          { source: args?.source, filepath: args?.filepath },
          'daemon compile mdx',
        )) as T
      }
      case 'get_onboarding_status': {
        return (await this.getJson('/onboarding/status', 'daemon onboarding status')) as T
      }
      case 'complete_onboarding': {
        await this.postJson('/onboarding/complete', {}, 'daemon complete onboarding')
        return undefined as T
      }
      case 'set_onboarding_step': {
        await this.putJson('/onboarding/step', { step: args?.step }, 'daemon onboarding step')
        return undefined as T
      }
      case 'reset_onboarding': {
        await this.postJson('/onboarding/reset', {}, 'daemon reset onboarding')
        return undefined as T
      }
      case 'check_app_permissions': {
        return (await this.getJson('/permissions', 'daemon permissions')) as T
      }
      case 'request_permission': {
        const body = (await this.postJson(
          '/permissions/request',
          { perm: args?.perm },
          'daemon request permission',
        )) as { status?: string }
        return body.status as T
      }
      case 'open_privacy_settings': {
        await this.postJson(
          '/permissions/open-privacy-settings',
          { pane: args?.pane },
          'daemon open privacy settings',
        )
        return undefined as T
      }
      case 'get_auto_lint_status': {
        return (await this.getJson('/auto-lint/status', 'daemon auto lint status')) as T
      }
      case 'trigger_lint_now': {
        await this.postJson('/auto-lint/trigger', {}, 'daemon trigger lint')
        return undefined as T
      }
      case 'get_events_since': {
        return (await this.getJson(
          `/event-log/events?sinceSeq=${encodeURIComponent(String(args?.sinceSeq ?? 0))}`,
          'daemon event log',
        )) as T
      }
      case 'scan_legacy_directive_files': {
        return (await this.getJson(
          '/directive-migration/legacy-files',
          'daemon legacy directives',
        )) as T
      }
      case 'apply_directive_migration': {
        const request = args?.request as Record<string, unknown> | undefined
        return (await this.postJson(
          '/directive-migration/apply',
          request ?? {},
          'daemon apply directive migration',
        )) as T
      }
      case 'list_workspace_dir': {
        const relativePath = typeof args?.relativePath === 'string' ? args.relativePath : ''
        return (await this.getJson(
          `/files?relativePath=${encodeURIComponent(relativePath)}`,
          'daemon files',
        )) as T
      }
      case 'list_at_mention_candidates': {
        const relativePath = typeof args?.relativePath === 'string' ? args.relativePath : ''
        const query = typeof args?.query === 'string' ? args.query : ''
        return (await this.getJson(
          `/files/at-mention-candidates?relativePath=${encodeURIComponent(relativePath)}&query=${encodeURIComponent(query)}`,
          'daemon at-mention candidates',
        )) as T
      }
      case 'import_file': {
        return (await this.postJson(
          '/materials/import-file',
          { srcPath: args?.srcPath },
          'daemon import file',
        )) as T
      }
      case 'import_text': {
        return (await this.postJson(
          '/materials/import-text',
          { text: args?.text },
          'daemon import text',
        )) as T
      }
      case 'import_text_temp': {
        return (await this.postJson(
          '/materials/import-text-temp',
          { text: args?.text },
          'daemon import text temp',
        )) as T
      }
      case 'import_image_temp': {
        return (await this.postJson(
          '/materials/import-image-temp',
          { data: args?.data, mediaType: args?.mediaType },
          'daemon import image temp',
        )) as T
      }
      case 'trigger_ai_processing': {
        await this.postJson(
          '/ai-processing/trigger',
          { materialPath: args?.materialPath, yearMonth: args?.yearMonth, note: args?.note },
          'daemon trigger ai processing',
        )
        return undefined as T
      }
      case 'trigger_ai_prompt': {
        await this.postJson(
          '/ai-processing/prompt',
          { prompt: args?.prompt },
          'daemon trigger ai prompt',
        )
        return undefined as T
      }
      case 'cancel_ai_processing': {
        await this.postJson('/ai-processing/cancel', {}, 'daemon cancel ai processing')
        return undefined as T
      }
      case 'cancel_queued_item': {
        await this.postJson(
          '/ai-processing/cancel-queued',
          { materialPath: args?.materialPath },
          'daemon cancel queued ai item',
        )
        return undefined as T
      }
      case 'get_workspace_prompt': {
        return (await this.getText(
          '/ai-processing/workspace-prompt',
          'daemon workspace prompt',
        )) as T
      }
      case 'set_workspace_prompt': {
        await this.putJson(
          '/ai-processing/workspace-prompt',
          { content: args?.content },
          'daemon set workspace prompt',
        )
        return undefined as T
      }
      case 'reset_workspace_prompt': {
        return (await this.postText(
          '/ai-processing/workspace-prompt/reset',
          {},
          'daemon reset workspace prompt',
        )) as T
      }
      case 'list_available_months': {
        return (await this.getJson('/journal/months', 'daemon journal months')) as T
      }
      case 'list_journal_entries': {
        const yearMonth = typeof args?.yearMonth === 'string' ? args.yearMonth : ''
        return (await this.getJson(
          `/journal/entries?yearMonth=${encodeURIComponent(yearMonth)}`,
          'daemon journal entries',
        )) as T
      }
      case 'list_journal_entries_by_months': {
        const months = Array.isArray(args?.months)
          ? args.months.filter((m): m is string => typeof m === 'string')
          : []
        return (await this.getJson(
          `/journal/entries?months=${encodeURIComponent(months.join(','))}`,
          'daemon journal entries by months',
        )) as T
      }
      case 'list_all_journal_entries': {
        return (await this.getJson('/journal/entries', 'daemon all journal entries')) as T
      }
      case 'list_journal_entries_paginated': {
        return (await this.getJson(
          `/journal/entries/paginated?offset=${encodeURIComponent(String(args?.offset ?? 0))}&limit=${encodeURIComponent(String(args?.limit ?? 50))}`,
          'daemon paginated journal entries',
        )) as T
      }
      case 'get_journal_entry_content': {
        return (await this.getText(
          `/journal/content?path=${encodeURIComponent(typeof args?.path === 'string' ? args.path : '')}`,
          'daemon journal content',
        )) as T
      }
      case 'save_journal_entry_content': {
        await this.putJson(
          '/journal/content',
          { path: args?.path, content: args?.content },
          'daemon save journal content',
        )
        return undefined as T
      }
      case 'delete_journal_entry': {
        await this.deleteJson(
          `/journal/entry?path=${encodeURIComponent(typeof args?.path === 'string' ? args.path : '')}`,
          'daemon delete journal entry',
        )
        return undefined as T
      }
      case 'create_sample_entry': {
        await this.postJson('/journal/sample', {}, 'daemon create sample entry')
        return undefined as T
      }
      case 'create_sample_entry_if_needed': {
        return (await this.postJson(
          '/journal/sample-if-needed',
          {},
          'daemon create sample entry if needed',
        )) as T
      }
      case 'list_todos': {
        return (await this.getJson('/todos', 'daemon todos')) as T
      }
      case 'add_todo': {
        return (await this.postJson(
          '/todos',
          { text: args?.text, due: args?.due, source: args?.source, path: args?.path },
          'daemon add todo',
        )) as T
      }
      case 'toggle_todo': {
        await this.postJson(
          '/todos/toggle',
          { lineIndex: args?.lineIndex, checked: args?.checked, doneFile: args?.doneFile },
          'daemon toggle todo',
        )
        return undefined as T
      }
      case 'delete_todo': {
        await this.deleteJson(
          `/todos?lineIndex=${encodeURIComponent(String(args?.lineIndex ?? 0))}&doneFile=${encodeURIComponent(String(args?.doneFile === true))}`,
          'daemon delete todo',
        )
        return undefined as T
      }
      case 'set_todo_due': {
        await this.putJson(
          '/todos/due',
          { lineIndex: args?.lineIndex, due: args?.due, doneFile: args?.doneFile },
          'daemon set todo due',
        )
        return undefined as T
      }
      case 'set_todo_path': {
        await this.putJson(
          '/todos/path',
          { lineIndex: args?.lineIndex, path: args?.path, doneFile: args?.doneFile },
          'daemon set todo path',
        )
        return undefined as T
      }
      case 'remove_todo_path': {
        await this.deleteJson(
          `/todos/path?lineIndex=${encodeURIComponent(String(args?.lineIndex ?? 0))}&doneFile=${encodeURIComponent(String(args?.doneFile === true))}`,
          'daemon remove todo path',
        )
        return undefined as T
      }
      case 'set_todo_session_id': {
        await this.putJson(
          '/todos/session',
          { lineIndex: args?.lineIndex, sessionId: args?.sessionId, doneFile: args?.doneFile },
          'daemon set todo session',
        )
        return undefined as T
      }
      case 'update_todo_text': {
        await this.putJson(
          '/todos/text',
          { lineIndex: args?.lineIndex, text: args?.text, doneFile: args?.doneFile },
          'daemon update todo text',
        )
        return undefined as T
      }
      case 'list_topics_dir': {
        const relativePath = typeof args?.relativePath === 'string' ? args.relativePath : ''
        return (await this.getJson(
          `/topics?relativePath=${encodeURIComponent(relativePath)}`,
          'daemon topics',
        )) as T
      }
      case 'create_topic': {
        await this.postJson(
          '/topics',
          { name: args?.name, parentPath: args?.parentPath },
          'daemon create topic',
        )
        return undefined as T
      }
      case 'delete_topic': {
        await this.deleteJson(
          `/topics?relativePath=${encodeURIComponent(typeof args?.relativePath === 'string' ? args.relativePath : '')}`,
          'daemon delete topic',
        )
        return undefined as T
      }
      case 'import_file_to_topic': {
        return (await this.postJson(
          '/topics/import',
          { source: args?.source, topicPath: args?.topicPath },
          'daemon import file to topic',
        )) as T
      }
      case 'list_identities': {
        return (await this.getJson('/identity', 'daemon identities')) as T
      }
      case 'get_identity_content': {
        return (await this.getText(
          `/identity/content?path=${encodeURIComponent(typeof args?.path === 'string' ? args.path : '')}`,
          'daemon identity content',
        )) as T
      }
      case 'save_identity_content': {
        await this.putJson(
          '/identity/content',
          { path: args?.path, content: args?.content },
          'daemon save identity content',
        )
        return undefined as T
      }
      case 'delete_identity': {
        await this.deleteJson(
          `/identity?path=${encodeURIComponent(typeof args?.path === 'string' ? args.path : '')}`,
          'daemon delete identity',
        )
        return undefined as T
      }
      case 'archive_identity': {
        await this.postJson('/identity/archive', { path: args?.path }, 'daemon archive identity')
        return undefined as T
      }
      case 'unarchive_identity': {
        await this.postJson(
          '/identity/unarchive',
          { path: args?.path },
          'daemon unarchive identity',
        )
        return undefined as T
      }
      case 'create_identity': {
        return (await this.postJson(
          '/identity',
          {
            region: args?.region,
            name: args?.name,
            summary: args?.summary,
            tags: args?.tags,
            speakerId: args?.speakerId,
          },
          'daemon create identity',
        )) as T
      }
      case 'merge_identity': {
        await this.postJson(
          '/identity/merge',
          { sourcePath: args?.sourcePath, targetPath: args?.targetPath, mode: args?.mode },
          'daemon merge identity',
        )
        return undefined as T
      }
      case 'workspace_duplicate_file': {
        return (await this.postJson(
          '/files/duplicate',
          { relativePath: args?.relativePath },
          'daemon duplicate file',
        )) as T
      }
      case 'workspace_rename_file': {
        return (await this.postJson(
          '/files/rename',
          { relativePath: args?.relativePath, newName: args?.newName },
          'daemon rename file',
        )) as T
      }
      case 'workspace_move_file': {
        return (await this.postJson(
          '/files/move',
          { relativePath: args?.relativePath, destDir: args?.destDir },
          'daemon move file',
        )) as T
      }
      case 'workspace_delete_file': {
        await this.deleteJson(
          `/files?relativePath=${encodeURIComponent(typeof args?.relativePath === 'string' ? args.relativePath : '')}`,
          'daemon delete file',
        )
        return undefined as T
      }
      case 'enqueue_work': {
        return (await this.postJson(
          '/work-queue',
          {
            text: args?.text,
            files: args?.files,
            prompt: args?.prompt,
            displayName: args?.displayName,
          },
          'daemon enqueue work',
        )) as T
      }
      case 'list_work_queue': {
        return (await this.getJson('/work-queue', 'daemon work queue')) as T
      }
      case 'cancel_work_item': {
        await this.postJson(
          `/work-queue/${encodeURIComponent(typeof args?.id === 'string' ? args.id : '')}/cancel`,
          {},
          'daemon cancel work item',
        )
        return undefined as T
      }
      case 'retry_work_item': {
        await this.postJson(
          `/work-queue/${encodeURIComponent(typeof args?.id === 'string' ? args.id : '')}/retry`,
          {},
          'daemon retry work item',
        )
        return undefined as T
      }
      case 'dismiss_work_item': {
        await this.deleteJson(
          `/work-queue/${encodeURIComponent(typeof args?.id === 'string' ? args.id : '')}`,
          'daemon dismiss work item',
        )
        return undefined as T
      }
      case 'conversation_create': {
        return (await this.postJson(
          '/conversation/create',
          { context: args?.context, contextFiles: args?.contextFiles },
          'daemon conversation create',
        )) as T
      }
      case 'conversation_send': {
        await this.postJson(
          '/conversation/send',
          { sessionId: args?.sessionId, message: args?.message, images: args?.images },
          'daemon conversation send',
        )
        return undefined as T
      }
      case 'conversation_cancel': {
        await this.postJson(
          '/conversation/cancel',
          { sessionId: args?.sessionId },
          'daemon conversation cancel',
        )
        return undefined as T
      }
      case 'conversation_close': {
        await this.postJson(
          '/conversation/close',
          { sessionId: args?.sessionId },
          'daemon conversation close',
        )
        return undefined as T
      }
      case 'conversation_inject': {
        await this.postJson(
          '/conversation/inject',
          { sessionId: args?.sessionId, message: args?.message },
          'daemon conversation inject',
        )
        return undefined as T
      }
      case 'conversation_truncate': {
        await this.postJson(
          '/conversation/truncate',
          { sessionId: args?.sessionId, keepCount: args?.keepCount },
          'daemon conversation truncate',
        )
        return undefined as T
      }
      case 'conversation_retry': {
        await this.postJson(
          '/conversation/retry',
          { sessionId: args?.sessionId },
          'daemon conversation retry',
        )
        return undefined as T
      }
      case 'conversation_list': {
        return (await this.getJson('/conversation/list', 'daemon conversation list')) as T
      }
      case 'conversation_rename': {
        await this.postJson(
          '/conversation/rename',
          { sessionId: args?.sessionId, title: args?.title },
          'daemon conversation rename',
        )
        return undefined as T
      }
      case 'conversation_delete': {
        await this.postJson(
          '/conversation/delete',
          { sessionId: args?.sessionId },
          'daemon conversation delete',
        )
        return undefined as T
      }
      case 'conversation_load': {
        return (await this.getJson(
          `/conversation/load?sessionId=${encodeURIComponent(typeof args?.sessionId === 'string' ? args.sessionId : '')}`,
          'daemon conversation load',
        )) as T
      }
      case 'conversation_get_messages': {
        return (await this.getJson(
          `/conversation/messages?sessionId=${encodeURIComponent(typeof args?.sessionId === 'string' ? args.sessionId : '')}`,
          'daemon conversation messages',
        )) as T
      }
      case 'conversation_get_stats': {
        return (await this.getJson(
          `/conversation/stats?sessionId=${encodeURIComponent(typeof args?.sessionId === 'string' ? args.sessionId : '')}`,
          'daemon conversation stats',
        )) as T
      }
      default:
        throw new Error(`HttpRuntimeClient: unsupported command "${command}"`)
    }
  }

  private async getJson(path: string, label: string): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}${path}`)
    if (!res.ok) throw new Error(`${label}: ${res.status}`)
    return res.json()
  }

  private async getText(path: string, label: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}${path}`)
    if (!res.ok) throw new Error(`${label}: ${res.status}`)
    return res.text()
  }

  private async postJson(
    path: string,
    body: Record<string, unknown>,
    label: string,
  ): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      let detail = ''
      try {
        detail = ` ${JSON.stringify(await res.json())}`
      } catch {
        // ignore
      }
      throw new Error(`${label}: ${res.status}${detail}`)
    }
    if (res.status === 204) return undefined
    return res.json()
  }

  private async postText(
    path: string,
    body: Record<string, unknown>,
    label: string,
  ): Promise<string> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      let detail = ''
      try {
        detail = ` ${JSON.stringify(await res.json())}`
      } catch {
        // ignore
      }
      throw new Error(`${label}: ${res.status}${detail}`)
    }
    return res.text()
  }

  private async putJson(
    path: string,
    body: Record<string, unknown>,
    label: string,
  ): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      let detail = ''
      try {
        detail = ` ${JSON.stringify(await res.json())}`
      } catch {
        // ignore
      }
      throw new Error(`${label}: ${res.status}${detail}`)
    }
    if (res.status === 204) return undefined
    return res.json()
  }

  private async deleteJson(path: string, label: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}${path}`, { method: 'DELETE' })
    if (!res.ok) {
      let detail = ''
      try {
        detail = ` ${JSON.stringify(await res.json())}`
      } catch {
        // ignore
      }
      throw new Error(`${label}: ${res.status}${detail}`)
    }
  }

  private async getSettings(): Promise<WorkspaceSettings> {
    const res = await fetch(`${this.baseUrl}/settings`)
    if (!res.ok) throw new Error(`daemon settings: ${res.status}`)
    return (await res.json()) as WorkspaceSettings
  }

  private async updateSettings(patch: Record<string, unknown>): Promise<WorkspaceSettings> {
    const res = await fetch(`${this.baseUrl}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      let detail = ''
      try {
        detail = ` ${JSON.stringify(await res.json())}`
      } catch {
        // ignore
      }
      throw new Error(`daemon settings: ${res.status}${detail}`)
    }
    return (await res.json()) as WorkspaceSettings
  }

  subscribe<T>(event: string, handler: (payload: T) => void): () => void {
    // The daemon exposes a global /events heartbeat stream and named event
    // streams under /events/:event. Conversation streaming is a named stream.
    const route = event === 'agent-run' ? '/events' : `/events/${encodeURIComponent(event)}`
    const es = new EventSource(`${this.baseUrl}${route}`)
    es.onmessage = (msg) => {
      try {
        const payload = JSON.parse(msg.data) as T
        handler(payload)
      } catch {
        // Ignore malformed frames rather than killing the stream.
      }
    }
    return () => es.close()
  }
}
