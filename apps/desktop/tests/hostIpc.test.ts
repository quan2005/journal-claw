import { beforeEach, describe, expect, it, vi } from 'vitest'

const electron = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  fromWebContents: vi.fn(),
  showOpenDialog: vi.fn(),
  showMessageBox: vi.fn(),
  handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
    electron.handlers.set(channel, handler)
  }),
  nativeTheme: {
    themeSource: 'system',
  },
  showItemInFolder: vi.fn(),
  openPath: vi.fn(),
  openExternal: vi.fn(),
}))

vi.mock('electron', () => ({
  BrowserWindow: {
    fromWebContents: electron.fromWebContents,
  },
  dialog: {
    showOpenDialog: electron.showOpenDialog,
    showMessageBox: electron.showMessageBox,
  },
  ipcMain: {
    handle: electron.handle,
  },
  nativeTheme: electron.nativeTheme,
  shell: {
    showItemInFolder: electron.showItemInFolder,
    openPath: electron.openPath,
    openExternal: electron.openExternal,
  },
}))

describe('registerHostIpc', () => {
  beforeEach(() => {
    electron.handlers.clear()
    vi.clearAllMocks()
    electron.openPath.mockResolvedValue('')
    electron.openExternal.mockResolvedValue(undefined)
    electron.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/picked'] })
    electron.showMessageBox.mockResolvedValue({ response: 1 })
    electron.fromWebContents.mockReturnValue(undefined)
    electron.nativeTheme.themeSource = 'system'
  })

  it('registers fixed host IPC handlers for shell, dialog, and zoom', async () => {
    const { HOST_IPC_CHANNELS, registerHostIpc } = await import('../src/hostIpc.js')

    registerHostIpc()

    expect(electron.handle).toHaveBeenCalledTimes(Object.keys(HOST_IPC_CHANNELS).length)
    expect(electron.handlers.has(HOST_IPC_CHANNELS.reveal)).toBe(true)
    expect(electron.handlers.has(HOST_IPC_CHANNELS.openPath)).toBe(true)
    expect(electron.handlers.has(HOST_IPC_CHANNELS.openExternal)).toBe(true)
    expect(electron.handlers.has(HOST_IPC_CHANNELS.pickFolder)).toBe(true)
    expect(electron.handlers.has(HOST_IPC_CHANNELS.setZoom)).toBe(true)
    expect(electron.handlers.has(HOST_IPC_CHANNELS.setWindowTheme)).toBe(true)
    expect(electron.handlers.has(HOST_IPC_CHANNELS.ask)).toBe(true)
    expect(electron.handlers.has(HOST_IPC_CHANNELS.openDialog)).toBe(true)

    await electron.handlers.get(HOST_IPC_CHANNELS.reveal)?.({}, '/tmp/a.md')
    expect(electron.showItemInFolder).toHaveBeenCalledWith('/tmp/a.md')

    await electron.handlers.get(HOST_IPC_CHANNELS.openPath)?.({}, '/tmp/a.md')
    expect(electron.openPath).toHaveBeenCalledWith('/tmp/a.md')

    await electron.handlers.get(HOST_IPC_CHANNELS.openExternal)?.({}, 'https://example.com')
    expect(electron.openExternal).toHaveBeenCalledWith('https://example.com')

    const sender = { setZoomFactor: vi.fn() }
    await electron.handlers.get(HOST_IPC_CHANNELS.setZoom)?.({ sender }, 1.2)
    expect(sender.setZoomFactor).toHaveBeenCalledWith(1.2)

    await electron.handlers.get(HOST_IPC_CHANNELS.setWindowTheme)?.({ sender }, 'dark')
    expect(electron.nativeTheme.themeSource).toBe('dark')

    const picked = await electron.handlers.get(HOST_IPC_CHANNELS.pickFolder)?.({ sender })
    expect(electron.showOpenDialog).toHaveBeenCalledWith({
      properties: ['openDirectory'],
    })
    expect(picked).toBe('/picked')

    const confirmed = await electron.handlers.get(HOST_IPC_CHANNELS.ask)?.({ sender }, 'Delete?', {
      title: 'Confirm',
      kind: 'warning',
      okLabel: 'Delete',
    })
    expect(electron.showMessageBox).toHaveBeenCalledWith({
      type: 'warning',
      title: 'Confirm',
      message: 'Delete?',
      buttons: ['取消', 'Delete'],
      cancelId: 0,
      defaultId: 1,
      noLink: true,
    })
    expect(confirmed).toBe(true)

    const files = await electron.handlers.get(HOST_IPC_CHANNELS.openDialog)?.(
      { sender },
      { multiple: true },
    )
    expect(electron.showOpenDialog).toHaveBeenLastCalledWith({
      properties: ['openFile', 'multiSelections'],
    })
    expect(files).toEqual(['/picked'])
  })
})
