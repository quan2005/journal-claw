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
    return invoke<T>(command, args)
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

/** Ready-to-use default runtime client (Tauri-backed). */
export const defaultRuntimeClient: JournalRuntimeClient = new TauriRuntimeClient()
