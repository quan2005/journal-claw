import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  hostAsk,
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

  it('routes shell, dialog, zoom, and file-drop through window.electronAPI', async () => {
    const unlisten = vi.fn()
    const api = installElectronAPI({
      onFileDrop: vi.fn(() => unlisten),
    })

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
    await expect(hostAsk('Delete?')).resolves.toBe(false)
    await expect(hostOpenDialog({ multiple: true })).resolves.toBeNull()
    expect(hostConvertFileSrc('/tmp/a.png')).toBe('/tmp/a.png')
    expect(() => setHostZoom(1.1)).not.toThrow()
    expect(() => setHostWindowTheme('light')).not.toThrow()

    const handler = vi.fn()
    const off = onHostFileDrop(handler)
    off()
    expect(handler).not.toHaveBeenCalled()
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
