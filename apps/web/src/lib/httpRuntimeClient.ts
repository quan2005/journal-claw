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
    ((globalThis as Record<string, unknown>).process as Record<string, unknown> | undefined)?.JOURNAL_DAEMON_URL as
      | string
      | undefined ?? DEFAULT_BASE_URL
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
        const res = await fetch(`${this.baseUrl}/workspace`)
        if (!res.ok) throw new Error(`daemon workspace: ${res.status}`)
        const body = (await res.json()) as { path?: string }
        return body.path as unknown as T
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
        const skillId = typeof args?.skillId === 'string' ? args.skillId : ''
        const enabled = args?.enabled === true
        const settings = await this.getSettings()
        const current = settings.disabled_skills ?? []
        const next = enabled
          ? current.filter((id) => id !== skillId)
          : Array.from(new Set([...current, skillId]))
        await this.updateSettings({ disabled_skills: next.length > 0 ? next : null })
        return undefined as T
      }
      case 'set_global_skill_enabled': {
        const skillId = typeof args?.skillId === 'string' ? args.skillId : ''
        const enabled = args?.enabled === true
        const settings = await this.getSettings()
        const current = settings.enabled_global_skills ?? []
        const next = enabled
          ? Array.from(new Set([...current, skillId]))
          : current.filter((id) => id !== skillId)
        await this.updateSettings({ enabled_global_skills: next.length > 0 ? next : null })
        return undefined as T
      }
      default:
        throw new Error(`HttpRuntimeClient: unsupported command "${command}"`)
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
    // The daemon exposes a global /events stream and per-run /runs/:id/events.
    // For the conversation-stream pilot we subscribe to the global stream; the
    // SSE data line carries a JSON payload we surface directly.
    const route =
      event === 'conversation-stream' || event === 'agent-run'
        ? '/events'
        : `/events/${encodeURIComponent(event)}`
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
