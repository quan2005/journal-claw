/**
 * hostBridge — host-level integration that the daemon cannot serve.
 *
 * The daemon owns business state (journals, todos, conversations, runs) and
 * emits those over SSE. Native shell capabilities live behind this bridge:
 * local host events, file URL conversion, webview zoom/theme, native dialogs,
 * native file drag-drop, and shell "reveal in finder / open with".
 *
 * Electron routes through the preload whitelist (`window.electronAPI`) without
 * exposing raw IPC primitives. Plain web degrades to no-op/default values.
 */

const localHostEventName = (event: string): string => `journal-host:${event}`

export interface DragDropEvent {
  type: 'enter' | 'over' | 'drop' | 'leave'
  paths: string[]
}

export type HostDialogKind = 'info' | 'warning' | 'error'

export interface HostAskOptions {
  title?: string
  kind?: HostDialogKind
  okLabel?: string
  cancelLabel?: string
}

export interface HostDialogFilter {
  name: string
  extensions: string[]
}

export interface HostOpenDialogOptions {
  title?: string
  defaultPath?: string
  directory?: boolean
  multiple?: boolean
  filters?: HostDialogFilter[]
}

export type HostWindowTheme = 'light' | 'dark'

export interface ElectronHostAPI {
  reveal(path: string): Promise<void>
  openPath(path: string): Promise<void>
  openExternal(url: string): Promise<void>
  pickFolder(): Promise<string | null>
  setZoom(zoom: number): void
  setWindowTheme(theme: HostWindowTheme): void
  convertFileSrc(path: string): string
  ask(message: string, options?: HostAskOptions): Promise<boolean>
  openDialog(options?: HostOpenDialogOptions): Promise<string | string[] | null>
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

/**
 * Subscribe to a host event emitted by the native shell or bridge-local code.
 * Returns a synchronous unsubscribe.
 */
export function subscribeHostEvent(event: string, handler: (payload: unknown) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const listener = (domEvent: Event) => {
    handler((domEvent as CustomEvent<unknown>).detail)
  }
  window.addEventListener(localHostEventName(event), listener)
  return () => window.removeEventListener(localHostEventName(event), listener)
}

/** Open the app settings UI. */
export async function hostOpenSettings(): Promise<void> {
  emitLocalHostEvent('open-settings')
}

/** Open the settings UI for privacy-related affordances. */
export async function hostOpenPrivacySettings(pane: 'speech_recognition'): Promise<void> {
  emitLocalHostEvent('open-settings', { pane })
}

/** Apply webview zoom (1 = 100%). No-op when no native host exists. */
export function setHostZoom(zoom: number): void {
  getElectronHost()?.setZoom(zoom)
}

/** Sync the native window theme when the host supports it. */
export function setHostWindowTheme(theme: HostWindowTheme): void {
  getElectronHost()?.setWindowTheme(theme)
}

/** Convert an absolute local path to a host-loadable URL. Web fallback is no-op. */
export function hostConvertFileSrc(path: string): string {
  return getElectronHost()?.convertFileSrc(path) ?? path
}

/**
 * Subscribe to native OS file drag-drop. Returns a synchronous unsubscribe.
 * Returns a no-op unsubscribe when no native host exists.
 */
export function onHostFileDrop(handler: (event: DragDropEvent) => void): () => void {
  return getElectronHost()?.onFileDrop(handler) ?? (() => {})
}

/**
 * Open a native folder picker. Returns the chosen path or null if cancelled.
 * Returns null when no native host exists.
 */
export async function pickHostFolder(): Promise<string | null> {
  return (await getElectronHost()?.pickFolder()) ?? null
}

/** Reveal a path in the host file manager (Finder/Explorer). No-op without a native host. */
export async function hostRevealInFileManager(path: string): Promise<void> {
  await getElectronHost()?.reveal(path)
}

/** Open a path/URL with the host system default handler. No-op without a native host. */
export async function hostOpenWithSystem(path: string): Promise<void> {
  const electron = getElectronHost()
  if (!electron) return
  if (shouldOpenExternally(path)) {
    await electron.openExternal(path)
  } else {
    await electron.openPath(path)
  }
}

/** Show a native confirm dialog; returns true on confirm. false without a native host. */
export async function hostAsk(message: string, options?: HostAskOptions): Promise<boolean> {
  return (await getElectronHost()?.ask(message, options)) ?? false
}

/**
 * Open a native file picker. Returns the chosen path(s), or null when cancelled
 * or when no native host exists.
 */
export async function hostOpenDialog(
  options?: HostOpenDialogOptions,
): Promise<string | string[] | null> {
  return (await getElectronHost()?.openDialog(options)) ?? null
}
