import { BrowserWindow, dialog, ipcMain, shell } from 'electron'

export const HOST_IPC_CHANNELS = {
  reveal: 'journal:host:reveal',
  openPath: 'journal:host:open-path',
  openExternal: 'journal:host:open-external',
  pickFolder: 'journal:host:pick-folder',
  setZoom: 'journal:host:set-zoom',
} as const

function assertString(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new Error(`${name} must be a string`)
  return value
}

function assertFiniteNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`)
  }
  return value
}

export function registerHostIpc(): void {
  ipcMain.handle(HOST_IPC_CHANNELS.reveal, (_event, path: unknown) => {
    shell.showItemInFolder(assertString(path, 'path'))
  })

  ipcMain.handle(HOST_IPC_CHANNELS.openPath, async (_event, path: unknown) => {
    const error = await shell.openPath(assertString(path, 'path'))
    if (error) throw new Error(error)
  })

  ipcMain.handle(HOST_IPC_CHANNELS.openExternal, async (_event, url: unknown) => {
    await shell.openExternal(assertString(url, 'url'))
  })

  ipcMain.handle(HOST_IPC_CHANNELS.pickFolder, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const options = { properties: ['openDirectory' as const] }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled) return null
    return result.filePaths[0] ?? null
  })

  ipcMain.handle(HOST_IPC_CHANNELS.setZoom, (event, zoom: unknown) => {
    event.sender.setZoomFactor(assertFiniteNumber(zoom, 'zoom'))
  })
}
