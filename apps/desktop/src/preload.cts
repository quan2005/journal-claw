const { contextBridge, ipcRenderer, webUtils } = require('electron') as typeof import('electron')

const HOST_IPC_CHANNELS = {
  reveal: 'journal:host:reveal',
  openPath: 'journal:host:open-path',
  openExternal: 'journal:host:open-external',
  pickFolder: 'journal:host:pick-folder',
  setZoom: 'journal:host:set-zoom',
} as const

type FileDropType = 'enter' | 'over' | 'drop' | 'leave'

interface FileDropEvent {
  type: FileDropType
  paths: string[]
}

type FileDropHandler = (event: FileDropEvent) => void

const fileDropHandlers = new Set<FileDropHandler>()

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
  onFileDrop: (handler: FileDropHandler) => {
    fileDropHandlers.add(handler)
    return () => {
      fileDropHandlers.delete(handler)
    }
  },
})
