/**
 * Journal runtime client abstraction.
 *
 * Decouples callers (hooks) from the concrete transport so that the rest of the
 * frontend never talks to the daemon directly. M8-a removes the Tauri IPC
 * fallback: runtime calls now always use the TS daemon over HTTP + SSE.
 *
 * subscribe() returns a *synchronous* unsubscribe (`() => void`) rather than
 * the async listener shape older native APIs exposed. React effect cleanups
 * must release synchronously.
 */
import { HttpRuntimeClient } from './httpRuntimeClient'

export type JournalRuntimeClient = {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>
  subscribe<T>(event: string, handler: (payload: T) => void): () => void
}

/** Runtime selection is retained as a compatibility shim for older call sites. */
export type JournalRuntimeKind = 'http'

export function readRuntimeKind(): JournalRuntimeKind {
  return 'http'
}

/**
 * The resolved runtime kind for the current process. Use at branch points
 * where a call site must know the transport. Equivalent to readRuntimeKind(),
 * named for clarity.
 */
export function currentRuntimeKind(): JournalRuntimeKind {
  return readRuntimeKind()
}

/** The currently active runtime client. */
export function selectRuntimeClient(): JournalRuntimeClient {
  return httpRuntimeClient
}

// Singletons so subscribe()/unsubscribe() state is stable across re-invocations.
const httpRuntimeClient: JournalRuntimeClient = new HttpRuntimeClient()

// Re-export for callers that need the HTTP client directly (tests).
export { HttpRuntimeClient }

/** Ready-to-use daemon-backed runtime client. */
export const defaultRuntimeClient: JournalRuntimeClient = httpRuntimeClient
