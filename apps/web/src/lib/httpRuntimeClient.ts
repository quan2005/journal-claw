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
      default:
        throw new Error(`HttpRuntimeClient: unsupported command "${command}"`)
    }
    // args intentionally unused for the pilot surface; future commands pass
    // them as POST bodies.
    void args
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
