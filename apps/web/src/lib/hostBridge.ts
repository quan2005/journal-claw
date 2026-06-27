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
 * - When the runtime is Electron, these route through the preload whitelist
 *   (`window.electronAPI`) without exposing raw IPC primitives to the app.
 * - When no native host is present, these degrade to no-op/default values.
 *
 * Centralising this keeps call sites transport-agnostic: they ask the host
 * bridge for a capability and never import `@tauri-apps/*` directly.
 */
import { currentRuntimeKind } from './runtimeClient'
import type { OpenDialogOptions } from '@tauri-apps/plugin-dialog'

const isTauriHost = (): boolean => currentRuntimeKind() === 'tauri'
const localHostEventName = (event: string): string => `journal-host:${event}`

export interface DragDropEvent {
  type: 'enter' | 'over' | 'drop' | 'leave'
  paths: string[]
}

export interface ElectronHostAPI {
  reveal(path: string): Promise<void>
  openPath(path: string): Promise<void>
  openExternal(url: string): Promise<void>
  pickFolder(): Promise<string | null>
  setZoom(zoom: number): void
  onFileDrop(handler: (event: DragDropEvent) => void): () => void
}

declare global {
  interface Window {
    electronAPI?: ElectronHostAPI
  }
}

function getElectronHost(): ElectronHostAPI | null {
  if (typeof window === 'undefined') return null
  return window.electronAPI ?? null
}

function shouldOpenExternally(value: string): boolean {
  try {
    const url = new URL(value)
    return ['http:', 'https:', 'mailto:'].includes(url.protocol)
  } catch {
    return false
  }
}

function emitLocalHostEvent(event: string, payload?: unknown): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(localHostEventName(event), { detail: payload }))
}

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
 * the daemon. Returns a synchronous unsubscribe. Tauri events use native
 * listen(); Electron/web-local settings routes use DOM events.
 */
export function subscribeHostEvent(event: string, handler: (payload: unknown) => void): () => void {
  if (!isTauriHost()) {
    if (typeof window === 'undefined') return () => {}
    const listener = (domEvent: Event) => {
      handler((domEvent as CustomEvent<unknown>).detail)
    }
    window.addEventListener(localHostEventName(event), listener)
    return () => window.removeEventListener(localHostEventName(event), listener)
  }

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

/** Open the app settings UI. Tauri uses the legacy command; Electron/web route locally. */
export async function hostOpenSettings(): Promise<void> {
  const mod = await loadTauri(() => import('@tauri-apps/api/core'))
  if (mod) {
    await mod.invoke('open_settings')
    return
  }
  emitLocalHostEvent('open-settings')
}

/** Open the settings UI for privacy-related affordances. */
export async function hostOpenPrivacySettings(pane: 'speech_recognition'): Promise<void> {
  const mod = await loadTauri(() => import('@tauri-apps/api/core'))
  if (mod) {
    await mod.invoke('open_privacy_settings', { pane })
    return
  }
  emitLocalHostEvent('open-settings', { pane })
}

/** Apply webview zoom (1 = 100%). No-op when no native host exists. */
export function setHostZoom(zoom: number): void {
  const electron = getElectronHost()
  if (electron) {
    electron.setZoom(zoom)
    return
  }

  loadTauri(() => import('@tauri-apps/api/webview')).then((mod) => {
    if (!mod) return
    void mod.getCurrentWebview().setZoom(zoom)
  })
}

/**
 * Subscribe to native OS file drag-drop. Returns a synchronous unsubscribe.
 * Returns a no-op unsubscribe when no native host exists.
 */
export function onHostFileDrop(handler: (event: DragDropEvent) => void): () => void {
  const electron = getElectronHost()
  if (electron) return electron.onFileDrop(handler)

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
 * Returns null when no native host exists.
 */
export async function pickHostFolder(): Promise<string | null> {
  const electron = getElectronHost()
  if (electron) return await electron.pickFolder()

  const mod = await loadTauri(() => import('@tauri-apps/plugin-dialog'))
  if (!mod) return null
  return (await mod.open({ directory: true, multiple: false })) as string | null
}

/** Reveal a path in the host file manager (Finder/Explorer). No-op without a native host. */
export async function hostRevealInFileManager(path: string): Promise<void> {
  const electron = getElectronHost()
  if (electron) {
    await electron.reveal(path)
    return
  }

  const mod = await loadTauri(() => import('@tauri-apps/api/core'))
  if (!mod) return
  await mod.invoke('reveal_in_file_manager', { path })
}

/** Open a path/URL with the host system default handler. No-op without a native host. */
export async function hostOpenWithSystem(path: string): Promise<void> {
  const electron = getElectronHost()
  if (electron) {
    if (shouldOpenExternally(path)) {
      await electron.openExternal(path)
    } else {
      await electron.openPath(path)
    }
    return
  }

  const mod = await loadTauri(() => import('@tauri-apps/api/core'))
  if (!mod) return
  await mod.invoke('open_with_system', { path })
}

/** Show a native confirm dialog; returns true on confirm. false without a native host. */
export async function hostAsk(message: string, title?: string): Promise<boolean> {
  const mod = await loadTauri(() => import('@tauri-apps/plugin-dialog'))
  if (!mod) return false
  return await mod.ask(message, title)
}

/**
 * Open a native file picker. Returns the chosen path or null. null without a native host.
 */
export async function hostOpenFilePicker(
  opts?: OpenDialogOptions,
): Promise<string | string[] | null> {
  const mod = await loadTauri(() => import('@tauri-apps/plugin-dialog'))
  if (!mod) return null
  return (await mod.open(opts)) as string | string[] | null
}
