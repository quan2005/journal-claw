/**
 * Journal runtime client abstraction.
 *
 * Decouples callers (hooks) from the concrete transport so that the rest of the
 * frontend never talks to Tauri or the daemon directly. Two implementations
 * exist behind the same JournalRuntimeClient interface:
 *
 *   - TauriRuntimeClient  — Tauri IPC (the legacy path; now the fallback)
 *   - HttpRuntimeClient   — the TS daemon over HTTP + SSE
 *
 * As of M7-b the *default* transport is the daemon. `JOURNAL_RUNTIME=tauri`
 * re-enables the Tauri IPC path (still needed while capabilities migrate, in
 * older builds, and in the test suite which pins the Tauri internals shim).
 *
 * subscribe() returns a *synchronous* unsubscribe (`() => void`) rather than
 * the `Promise<UnlistenFn>` shape that Tauri's listen yields — React effect
 * cleanups must release synchronously, so each wrapper defers the async
 * teardown internally.
 */
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { HttpRuntimeClient } from './httpRuntimeClient'

export type JournalRuntimeClient = {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>
  subscribe<T>(event: string, handler: (payload: T) => void): () => void
}

type UnlistenFn = () => void

export class TauriRuntimeClient implements JournalRuntimeClient {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    return args === undefined ? invoke<T>(command) : invoke<T>(command, args)
  }

  subscribe<T>(event: string, handler: (payload: T) => void): () => void {
    let released = false
    let unlistenFn: UnlistenFn | null = null

    listen<T>(event, (tauriEvent) => {
      handler(tauriEvent.payload)
    }).then((fn) => {
      unlistenFn = fn
      // If unsubscribe was called before listen resolved, release now.
      if (released) {
        unlistenFn()
      }
    })

    return () => {
      if (released) return
      released = true
      if (unlistenFn) {
        unlistenFn()
      }
      // else: listen not yet resolved — release deferred via flag above.
    }
  }
}

/**
 * Feature-flagged runtime selection. Default (M7-b) is the daemon-backed
 * HttpRuntimeClient; `JOURNAL_RUNTIME=tauri` selects the Tauri IPC fallback.
 */
export type JournalRuntimeKind = 'tauri' | 'http'

export function readRuntimeKind(): JournalRuntimeKind {
  // Resolution order: explicit global override (tests/dev) > localStorage
  // (persistence) > injected process.env > default 'http' (daemon).
  const g = (typeof globalThis !== 'undefined' ? globalThis : {}) as Record<string, unknown>
  let raw: string | undefined
  if (typeof g.__JOURNAL_RUNTIME === 'string') {
    raw = g.__JOURNAL_RUNTIME
  } else {
    try {
      if (typeof localStorage !== 'undefined') raw = localStorage.getItem('JOURNAL_RUNTIME') ?? undefined
    } catch {
      // ignore (private mode / no jsdom localStorage)
    }
    if (!raw) {
      const proc = g.process as Record<string, unknown> | undefined
      const env = proc && typeof proc === 'object' ? (proc.env as Record<string, unknown>) : undefined
      raw = typeof env?.JOURNAL_RUNTIME === 'string' ? env.JOURNAL_RUNTIME : undefined
    }
  }
  return (raw ?? 'http') === 'tauri' ? 'tauri' : 'http'
}

/**
 * The resolved runtime kind for the current process. Use at branch points
 * where a call site must know the transport (e.g. host capabilities the
 * daemon cannot serve). Equivalent to readRuntimeKind(), named for clarity.
 */
export function currentRuntimeKind(): JournalRuntimeKind {
  return readRuntimeKind()
}

/**
 * The currently active runtime client, chosen by the feature flag. Default
 * (M7-b) is the daemon (HttpRuntimeClient); set JOURNAL_RUNTIME=tauri to fall
 * back to the Tauri IPC client.
 */
export function selectRuntimeClient(): JournalRuntimeClient {
  return readRuntimeKind() === 'tauri' ? tauriRuntimeClient : httpRuntimeClient
}

// Singletons so subscribe()/unsubscribe() state is stable across re-invocations.
const httpRuntimeClient: JournalRuntimeClient = new HttpRuntimeClient()

// Re-export for callers that need the HTTP client directly (tests).
export { HttpRuntimeClient }

/**
 * Ready-to-use Tauri-backed runtime client. The explicit fallback used when
 * JOURNAL_RUNTIME=tauri, and by callers that must pin the Tauri path.
 */
export const defaultRuntimeClient: JournalRuntimeClient = new TauriRuntimeClient()
/** Alias for branch-point clarity: the Tauri fallback client. */
const tauriRuntimeClient = defaultRuntimeClient
