import { beforeEach, describe, expect, it, vi } from 'vitest'

const electron = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  fromWebContents: vi.fn(),
  showOpenDialog: vi.fn(),
  handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
    electron.handlers.set(channel, handler)
  }),
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
  },
  ipcMain: {
    handle: electron.handle,
  },
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
    electron.fromWebContents.mockReturnValue(undefined)
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

    await electron.handlers.get(HOST_IPC_CHANNELS.reveal)?.({}, '/tmp/a.md')
    expect(electron.showItemInFolder).toHaveBeenCalledWith('/tmp/a.md')

    await electron.handlers.get(HOST_IPC_CHANNELS.openPath)?.({}, '/tmp/a.md')
    expect(electron.openPath).toHaveBeenCalledWith('/tmp/a.md')

    await electron.handlers.get(HOST_IPC_CHANNELS.openExternal)?.({}, 'https://example.com')
    expect(electron.openExternal).toHaveBeenCalledWith('https://example.com')

    const sender = { setZoomFactor: vi.fn() }
    await electron.handlers.get(HOST_IPC_CHANNELS.setZoom)?.({ sender }, 1.2)
    expect(sender.setZoomFactor).toHaveBeenCalledWith(1.2)

    const picked = await electron.handlers.get(HOST_IPC_CHANNELS.pickFolder)?.({ sender })
    expect(electron.showOpenDialog).toHaveBeenCalledWith({
      properties: ['openDirectory'],
    })
    expect(picked).toBe('/picked')
  })
})
