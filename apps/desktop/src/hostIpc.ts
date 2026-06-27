import {
  BrowserWindow,
  dialog,
  ipcMain,
  nativeTheme,
  shell,
  type OpenDialogOptions,
  type MessageBoxOptions,
  type MessageBoxReturnValue,
  type OpenDialogReturnValue,
  type WebContents,
} from 'electron'

export const HOST_IPC_CHANNELS = {
  reveal: 'journal:host:reveal',
  openPath: 'journal:host:open-path',
  openExternal: 'journal:host:open-external',
  pickFolder: 'journal:host:pick-folder',
  setZoom: 'journal:host:set-zoom',
  setWindowTheme: 'journal:host:set-window-theme',
  ask: 'journal:host:ask',
  openDialog: 'journal:host:open-dialog',
} as const

type HostDialogKind = 'info' | 'warning' | 'error'
type HostWindowTheme = 'light' | 'dark'

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  return typeof record[key] === 'string' ? record[key] : undefined
}

function assertWindowTheme(value: unknown): HostWindowTheme {
  if (value === 'light' || value === 'dark') return value
  throw new Error('theme must be light or dark')
}

function normalizeDialogKind(value: unknown): HostDialogKind {
  return value === 'warning' || value === 'error' ? value : 'info'
}

function normalizeAskOptions(message: string, value: unknown): MessageBoxOptions {
  const raw = isRecord(value) ? value : {}
  const cancelLabel = optionalString(raw, 'cancelLabel') ?? '取消'
  const okLabel = optionalString(raw, 'okLabel') ?? '确认'
  return {
    type: normalizeDialogKind(raw.kind),
    title: optionalString(raw, 'title') ?? '',
    message,
    buttons: [cancelLabel, okLabel],
    cancelId: 0,
    defaultId: 1,
    noLink: true,
  }
}

function normalizeFilters(value: unknown): NonNullable<OpenDialogOptions['filters']> | undefined {
  if (!Array.isArray(value)) return undefined
  const filters = value
    .filter(isRecord)
    .map((filter) => ({
      name: optionalString(filter, 'name') ?? '',
      extensions: Array.isArray(filter.extensions)
        ? filter.extensions.filter((item): item is string => typeof item === 'string')
        : [],
    }))
    .filter((filter) => filter.name.length > 0 && filter.extensions.length > 0)
  return filters.length > 0 ? filters : undefined
}

function normalizeOpenDialogOptions(value: unknown): {
  options: OpenDialogOptions
  multiple: boolean
} {
  const raw = isRecord(value) ? value : {}
  const directory = raw.directory === true
  const multiple = raw.multiple === true
  const properties: NonNullable<OpenDialogOptions['properties']> = [
    directory ? 'openDirectory' : 'openFile',
  ]
  if (multiple) properties.push('multiSelections')

  const options: OpenDialogOptions = { properties }
  const title = optionalString(raw, 'title')
  const defaultPath = optionalString(raw, 'defaultPath')
  const filters = normalizeFilters(raw.filters)
  if (title) options.title = title
  if (defaultPath) options.defaultPath = defaultPath
  if (filters) options.filters = filters
  return { options, multiple }
}

async function showOpenDialogForSender(
  sender: WebContents,
  options: OpenDialogOptions,
): Promise<OpenDialogReturnValue> {
  const window = BrowserWindow.fromWebContents(sender) ?? undefined
  return window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options)
}

async function showMessageBoxForSender(
  sender: WebContents,
  options: MessageBoxOptions,
): Promise<MessageBoxReturnValue> {
  const window = BrowserWindow.fromWebContents(sender) ?? undefined
  return window
    ? await dialog.showMessageBox(window, options)
    : await dialog.showMessageBox(options)
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
    const options = { properties: ['openDirectory' as const] }
    const result = await showOpenDialogForSender(event.sender, options)
    if (result.canceled) return null
    return result.filePaths[0] ?? null
  })

  ipcMain.handle(HOST_IPC_CHANNELS.setZoom, (event, zoom: unknown) => {
    event.sender.setZoomFactor(assertFiniteNumber(zoom, 'zoom'))
  })

  ipcMain.handle(HOST_IPC_CHANNELS.setWindowTheme, (_event, theme: unknown) => {
    nativeTheme.themeSource = assertWindowTheme(theme)
  })

  ipcMain.handle(HOST_IPC_CHANNELS.ask, async (event, message: unknown, options: unknown) => {
    const result = await showMessageBoxForSender(
      event.sender,
      normalizeAskOptions(assertString(message, 'message'), options),
    )
    return result.response === 1
  })

  ipcMain.handle(HOST_IPC_CHANNELS.openDialog, async (event, rawOptions: unknown) => {
    const { options, multiple } = normalizeOpenDialogOptions(rawOptions)
    const result = await showOpenDialogForSender(event.sender, options)
    if (result.canceled) return null
    return multiple ? result.filePaths : (result.filePaths[0] ?? null)
  })
}
