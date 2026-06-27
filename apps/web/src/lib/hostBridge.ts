/**
 * hostBridge — host-level integration that the daemon *cannot* serve.
 *
 * The daemon owns business state (journals, todos, conversations, runs) and
 * emits those over SSE. But some capabilities live in the native shell only:
 * the app menu emitting `open-settings`, webview zoom, native file drag-drop,
 * the system file/folder pickers, and shell "reveal in finder / open with".
 *
 * - When the runtime is Tauri (`JOURNAL_RUNTIME=tauri`), these route through
 *   the Tauri APIs exactly as before.
 * - When the runtime is the daemon (default, M7-b), the host shell is Electron
 *   (apps/desktop, M7-a). Electron IPC wiring for menu/zoom/drag-drop lands in
 *   a later phase, so these become graceful no-ops here. Actions that already
 *   have keyboard parity (Cmd+, opens settings) keep working through the key
 *   handler; the menu event is simply a redundant trigger.
 *
 * Centralising this keeps call sites transport-agnostic: they ask the host
 * bridge for a capability and never import `@tauri-apps/*` directly.
 */
import { currentRuntimeKind } from './runtimeClient'
import type { OpenDialogOptions } from '@tauri-apps/plugin-dialog'

const isTauriHost = (): boolean => currentRuntimeKind() === 'tauri'

/** Dynamically import a Tauri API module; returns null when not on Tauri. */
async function loadTauri<T>(loader: () => Promise<T>): Promise<T | null> {
  if (!isTauriHost()) return null
  try {
    return await loader()
  } catch {
    // Tauri API unavailable (e.g. running outside the webview) — degrade.
    return null
  }
}

/**
 * Subscribe to a *host* event — one emitted by the native menu/shell, never by
 * the daemon. Returns a synchronous unsubscribe. On the daemon runtime this is
 * a no-op (returns `() => {}`); Electron menu IPC will populate this later.
 */
export function subscribeHostEvent(event: string, handler: (payload: unknown) => void): () => void {
  if (!isTauriHost()) return () => {}
  let unlisten: (() => void) | null = null
  loadTauri(() => import('@tauri-apps/api/event')).then((mod) => {
    if (!mod) return
    mod.listen(event, (tauriEvent) => handler(tauriEvent.payload)).then((fn) => {
      unlisten = fn
    })
  })
  return () => {
    unlisten?.()
    unlisten = null
  }
}

/** Apply webview zoom (1 = 100%). No-op on the daemon runtime. */
export function setHostZoom(zoom: number): void {
  loadTauri(() => import('@tauri-apps/api/webview')).then((mod) => {
    if (!mod) return
    void mod.getCurrentWebview().setZoom(zoom)
  })
}

export interface DragDropEvent {
  type: 'enter' | 'over' | 'drop' | 'leave'
  paths: string[]
}

/**
 * Subscribe to native OS file drag-drop. Returns a synchronous unsubscribe.
 * On the daemon runtime this is a no-op (HTML5 drag-drop can be wired later).
 */
export function onHostFileDrop(handler: (event: DragDropEvent) => void): () => void {
  if (!isTauriHost()) return () => {}
  let unlisten: (() => void) | null = null
  loadTauri(() => import('@tauri-apps/api/webview')).then((mod) => {
    if (!mod) return
    mod.getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === 'drop') {
          handler({
            type: 'drop',
            paths: (event.payload as { paths?: string[] }).paths ?? [],
          })
        } else if (event.payload.type === 'enter' || event.payload.type === 'over') {
          handler({ type: event.payload.type, paths: [] })
        } else if (event.payload.type === 'leave') {
          handler({ type: 'leave', paths: [] })
        }
      })
      .then((fn) => {
        unlisten = fn
      })
  })
  return () => {
    unlisten?.()
    unlisten = null
  }
}

/**
 * Open a native folder picker. Returns the chosen path or null if cancelled.
 * On the daemon runtime returns null (Electron dialog wiring is a later phase).
 */
export async function pickHostFolder(): Promise<string | null> {
  const mod = await loadTauri(() => import('@tauri-apps/plugin-dialog'))
  if (!mod) return null
  return (await mod.open({ directory: true, multiple: false })) as string | null
}

/** Reveal a path in the host file manager (Finder/Explorer). No-op on daemon. */
export async function hostRevealInFileManager(path: string): Promise<void> {
  const mod = await loadTauri(() => import('@tauri-apps/api/core'))
  if (!mod) return
  await mod.invoke('reveal_in_file_manager', { path })
}

/** Open a path/URL with the host system default handler. No-op on daemon. */
export async function hostOpenWithSystem(path: string): Promise<void> {
  const mod = await loadTauri(() => import('@tauri-apps/api/core'))
  if (!mod) return
  await mod.invoke('open_with_system', { path })
}

/** Show a native confirm dialog; returns true on confirm. false on daemon. */
export async function hostAsk(message: string, title?: string): Promise<boolean> {
  const mod = await loadTauri(() => import('@tauri-apps/plugin-dialog'))
  if (!mod) return false
  return await mod.ask(message, title)
}

/**
 * Open a native file picker. Returns the chosen path or null. null on daemon.
 */
export async function hostOpenFilePicker(
  opts?: OpenDialogOptions,
): Promise<string | string[] | null> {
  const mod = await loadTauri(() => import('@tauri-apps/plugin-dialog'))
  if (!mod) return null
  return (await mod.open(opts)) as string | string[] | null
}
