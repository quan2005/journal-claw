import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

/**
 * Journal runtime client abstraction.
 *
 * Decouples callers (hooks) from the concrete Tauri bridge so that future phases
 * can swap in an alternate transport (e.g. an HTTP daemon) without touching call
 * sites. Phase 1 ships only the Tauri-backed default implementation; this is the
 * boundary the rest of the frontend talks to.
 *
 * subscribe() returns a *synchronous* unsubscribe (`() => void`) rather than the
 * `Promise<UnlistenFn>` shape that Tauri's listen yields — React effect cleanups
 * must release synchronously, so the wrapper defers the async unlisten internally.
 */
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
 * Feature-flagged runtime selection. `JOURNAL_RUNTIME=http` switches the active
 * client to the daemon-backed HttpRuntimeClient; otherwise (default) the
 * Tauri-backed client is used. Keeping the default on Tauri protects the
 * production path — the daemon is an opt-in pilot (G5).
 */
export type JournalRuntimeKind = 'tauri' | 'http'

export function readRuntimeKind(): JournalRuntimeKind {
  // Resolution order: explicit global override (tests/dev) > localStorage
  // (persistence) > injected process.env > default 'tauri'.
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
  return (raw ?? 'tauri') === 'http' ? 'http' : 'tauri'
}

import { HttpRuntimeClient } from './httpRuntimeClient'

/**
 * The currently active runtime client, chosen by the feature flag. Callers
 * that want transport-agnostic access use this; callers that must pin Tauri
 * (e.g. workspace settings persistence) keep using defaultRuntimeClient.
 */
export function selectRuntimeClient(): JournalRuntimeClient {
  return readRuntimeKind() === 'http' ? new HttpRuntimeClient() : defaultRuntimeClient
}

// Re-export for callers that need the HTTP client directly (tests).
export { HttpRuntimeClient }

/** Ready-to-use default runtime client (Tauri-backed). */
export const defaultRuntimeClient: JournalRuntimeClient = new TauriRuntimeClient()
