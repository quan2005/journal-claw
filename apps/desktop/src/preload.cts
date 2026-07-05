const { contextBridge, ipcRenderer, webUtils } = require('electron') as typeof import('electron')

const HOST_IPC_CHANNELS = {
  reveal: 'journal:host:reveal',
  openPath: 'journal:host:open-path',
  openExternal: 'journal:host:open-external',
  pickFolder: 'journal:host:pick-folder',
  setZoom: 'journal:host:set-zoom',
  setWindowTheme: 'journal:host:set-window-theme',
  ask: 'journal:host:ask',
  openDialog: 'journal:host:open-dialog',
} as const

type FileDropType = 'enter' | 'over' | 'drop' | 'leave'
type HostDialogKind = 'info' | 'warning' | 'error'
type HostWindowTheme = 'light' | 'dark'

interface FileDropEvent {
  type: FileDropType
  paths: string[]
}

interface HostAskOptions {
  title?: string
  kind?: HostDialogKind
  okLabel?: string
  cancelLabel?: string
}

interface HostDialogFilter {
  name: string
  extensions: string[]
}

interface HostOpenDialogOptions {
  title?: string
  defaultPath?: string
  directory?: boolean
  multiple?: boolean
  filters?: HostDialogFilter[]
}

type FileDropHandler = (event: FileDropEvent) => void

const fileDropHandlers = new Set<FileDropHandler>()

function encodePath(path: string): string {
  return path
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')
}

function convertFileSrc(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  if (/^[a-zA-Z]:\//.test(normalized)) {
    return `file:///${normalized[0]}:${encodePath(normalized.slice(2))}`
  }
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(path)) return path
  if (normalized.startsWith('/')) return `file://${encodePath(normalized)}`
  return path
}

function pathsFromDrop(event: DragEvent): string[] {
  const files = Array.from(event.dataTransfer?.files ?? [])
  return files.map((file) => webUtils.getPathForFile(file)).filter(Boolean)
}

function emitFileDrop(type: FileDropType, event: DragEvent): void {
  if (fileDropHandlers.size === 0) return
  if (type === 'over') event.preventDefault()
  const payload: FileDropEvent = {
    type,
    paths: type === 'drop' ? pathsFromDrop(event) : [],
  }
  for (const handler of fileDropHandlers) handler(payload)
}

window.addEventListener('dragenter', (event) => emitFileDrop('enter', event))
window.addEventListener('dragover', (event) => emitFileDrop('over', event))
window.addEventListener('dragleave', (event) => emitFileDrop('leave', event))
window.addEventListener('drop', (event) => {
  event.preventDefault()
  emitFileDrop('drop', event)
})

contextBridge.exposeInMainWorld('electronAPI', {
  reveal: (path: string) => ipcRenderer.invoke(HOST_IPC_CHANNELS.reveal, path),
  openPath: (path: string) => ipcRenderer.invoke(HOST_IPC_CHANNELS.openPath, path),
  openExternal: (url: string) => ipcRenderer.invoke(HOST_IPC_CHANNELS.openExternal, url),
  pickFolder: () => ipcRenderer.invoke(HOST_IPC_CHANNELS.pickFolder),
  setZoom: (zoom: number) => {
    void ipcRenderer.invoke(HOST_IPC_CHANNELS.setZoom, zoom)
  },
  setWindowTheme: (theme: HostWindowTheme) => {
    void ipcRenderer.invoke(HOST_IPC_CHANNELS.setWindowTheme, theme)
  },
  convertFileSrc,
  ask: (message: string, options?: HostAskOptions) =>
    ipcRenderer.invoke(HOST_IPC_CHANNELS.ask, message, options),
  openDialog: (options?: HostOpenDialogOptions) =>
    ipcRenderer.invoke(HOST_IPC_CHANNELS.openDialog, options),
  onFileDrop: (handler: FileDropHandler) => {
    fileDropHandlers.add(handler)
    return () => {
      fileDropHandlers.delete(handler)
    }
  },
})
