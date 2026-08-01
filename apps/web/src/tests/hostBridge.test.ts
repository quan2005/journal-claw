import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  hostAsk,
  hostConfirm,
  hostConvertFileSrc,
  hostOpenDialog,
  hostOpenPrivacySettings,
  hostOpenSettings,
  hostOpenWithSystem,
  hostRevealInFileManager,
  onHostFileDrop,
  pickHostFolder,
  setHostZoom,
  setHostWindowTheme,
  subscribeHostEvent,
  type ElectronHostAPI,
} from '../lib/hostBridge'

function installElectronAPI(overrides: Partial<ElectronHostAPI> = {}): ElectronHostAPI {
  const api: ElectronHostAPI = {
    reveal: vi.fn().mockResolvedValue(undefined),
    openPath: vi.fn().mockResolvedValue(undefined),
    openExternal: vi.fn().mockResolvedValue(undefined),
    pickFolder: vi.fn().mockResolvedValue('/picked'),
    setZoom: vi.fn(),
    setWindowTheme: vi.fn(),
    convertFileSrc: vi.fn((path: string) => `file://${path}`),
    ask: vi.fn().mockResolvedValue(true),
    openDialog: vi.fn().mockResolvedValue(['/tmp/a.md']),
    onFileDrop: vi.fn(() => vi.fn()),
    ...overrides,
  }
  Object.defineProperty(window, 'electronAPI', {
    value: api,
    configurable: true,
  })
  return api
}

describe('hostBridge Electron routing', () => {
  beforeEach(() => {
    ;(globalThis as Record<string, unknown>).__JOURNAL_RUNTIME = 'http'
    Object.defineProperty(window, 'electronAPI', {
      value: undefined,
      configurable: true,
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('routes shell, dialog, zoom, and file-drop through window.electronAPI', async () => {
    const unlisten = vi.fn()
    const api = installElectronAPI({
      onFileDrop: vi.fn(() => unlisten),
    })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)

    await hostRevealInFileManager('/tmp/a.md')
    await hostOpenWithSystem('/tmp/a.md')
    await hostOpenWithSystem('https://example.com')
    const picked = await pickHostFolder()
    setHostZoom(1.25)
    setHostWindowTheme('dark')
    const src = hostConvertFileSrc('/tmp/a.png')
    const confirmed = await hostAsk('Delete?', { title: 'Confirm', kind: 'warning' })
    const selected = await hostOpenDialog({ multiple: true })

    expect(api.reveal).toHaveBeenCalledWith('/tmp/a.md')
    expect(api.openPath).toHaveBeenCalledWith('/tmp/a.md')
    expect(api.openExternal).toHaveBeenCalledWith('https://example.com')
    expect(picked).toBe('/picked')
    expect(api.pickFolder).toHaveBeenCalledOnce()
    expect(api.setZoom).toHaveBeenCalledWith(1.25)
    expect(api.setWindowTheme).toHaveBeenCalledWith('dark')
    expect(src).toBe('file:///tmp/a.png')
    expect(confirmed).toBe(true)
    expect(api.ask).toHaveBeenCalledWith('Delete?', { title: 'Confirm', kind: 'warning' })
    expect(confirm).not.toHaveBeenCalled()
    expect(selected).toEqual(['/tmp/a.md'])
    expect(api.openDialog).toHaveBeenCalledWith({ multiple: true })

    const handler = vi.fn()
    const off = onHostFileDrop(handler)
    expect(api.onFileDrop).toHaveBeenCalledWith(handler)
    off()
    expect(unlisten).toHaveBeenCalledOnce()
  })

  it('degrades to noop/default values when no native host exists', async () => {
    await expect(hostRevealInFileManager('/tmp/a.md')).resolves.toBeUndefined()
    await expect(hostOpenWithSystem('/tmp/a.md')).resolves.toBeUndefined()
    await expect(pickHostFolder()).resolves.toBeNull()
    await expect(hostOpenDialog({ multiple: true })).resolves.toBeNull()
    expect(hostConvertFileSrc('/tmp/a.png')).toBe('/tmp/a.png')
    expect(() => setHostZoom(1.1)).not.toThrow()
    expect(() => setHostWindowTheme('light')).not.toThrow()

    const handler = vi.fn()
    const off = onHostFileDrop(handler)
    off()
    expect(handler).not.toHaveBeenCalled()
  })

  it('keeps generic hostAsk false in plain web without opening a browser confirmation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

    await expect(hostAsk('Delete?')).resolves.toBe(false)

    expect(confirm).not.toHaveBeenCalled()
  })

  it.each([true, false])(
    'preserves window.confirm result %s through the explicit confirm bridge',
    async (confirmed) => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(confirmed)

      await expect(hostConfirm('Delete?')).resolves.toBe(confirmed)

      expect(confirm).toHaveBeenCalledOnce()
      expect(confirm).toHaveBeenCalledWith('Delete?')
    },
  )

  it('routes the explicit confirm bridge through Electron without opening Web confirm', async () => {
    const api = installElectronAPI({
      ask: vi.fn().mockResolvedValue(false),
    })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

    await expect(hostConfirm('Delete?', { title: 'Confirm', kind: 'warning' })).resolves.toBe(false)

    expect(api.ask).toHaveBeenCalledWith('Delete?', { title: 'Confirm', kind: 'warning' })
    expect(confirm).not.toHaveBeenCalled()
  })

  it('returns false from both confirmation bridges during SSR and restores the browser global', async () => {
    const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const browserWindow = globalThis.window
    expect(windowDescriptor).toBeDefined()

    try {
      expect(Reflect.deleteProperty(globalThis, 'window')).toBe(true)

      await expect(hostAsk('Delete?')).resolves.toBe(false)
      await expect(hostConfirm('Delete?')).resolves.toBe(false)
    } finally {
      Object.defineProperty(globalThis, 'window', windowDescriptor!)
    }

    expect(globalThis.window).toBe(browserWindow)
  })

  it('routes settings commands through local host events outside Tauri', async () => {
    const handler = vi.fn()
    const off = subscribeHostEvent('open-settings', handler)

    await hostOpenSettings()
    await hostOpenPrivacySettings('speech_recognition')

    expect(handler).toHaveBeenNthCalledWith(1, null)
    expect(handler).toHaveBeenNthCalledWith(2, { pane: 'speech_recognition' })
    off()
  })
})
