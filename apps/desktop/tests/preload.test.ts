import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as ts from 'typescript'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const electron = {
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(),
  getPathForFile: vi.fn(),
  addEventListener: vi.fn(),
}

async function loadExposedApi(): Promise<Record<string, (...args: unknown[]) => unknown>> {
  const source = readFileSync(fileURLToPath(new URL('../src/preload.cts', import.meta.url)), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  })
  const mockWindow = {
    addEventListener: electron.addEventListener,
  }
  const requireElectron = (moduleName: string) => {
    if (moduleName !== 'electron') throw new Error(`unexpected require: ${moduleName}`)
    return {
      contextBridge: {
        exposeInMainWorld: electron.exposeInMainWorld,
      },
      ipcRenderer: {
        invoke: electron.invoke,
      },
      webUtils: {
        getPathForFile: electron.getPathForFile,
      },
    }
  }
  const module = { exports: {} }
  const exports = module.exports
  const runPreload = new Function('require', 'exports', 'module', 'window', outputText)
  runPreload(requireElectron, exports, module, mockWindow)
  Object.defineProperty(globalThis, 'window', {
    value: mockWindow,
    configurable: true,
  })
  return electron.exposeInMainWorld.mock.calls[0]![1] as Record<
    string,
    (...args: unknown[]) => unknown
  >
}

describe('preload electronAPI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exposes only the whitelisted renderer API', async () => {
    const api = await loadExposedApi()

    expect(electron.exposeInMainWorld).toHaveBeenCalledWith('electronAPI', expect.any(Object))
    expect(Object.keys(api).sort()).toEqual([
      'ask',
      'convertFileSrc',
      'onFileDrop',
      'openDialog',
      'openExternal',
      'openPath',
      'pickFolder',
      'reveal',
      'setWindowTheme',
      'setZoom',
    ])
    expect(api.ipcRenderer).toBeUndefined()
    expect((globalThis.window as Record<string, unknown>).ipcRenderer).toBeUndefined()
  })

  it('maps whitelist methods to fixed IPC channels', async () => {
    const api = await loadExposedApi()

    await api.reveal('/tmp/a.md')
    await api.openPath('/tmp/a.md')
    await api.openExternal('https://example.com')
    await api.pickFolder()
    api.setZoom(1.25)
    api.setWindowTheme('dark')
    expect(api.convertFileSrc('/tmp/a b.png')).toBe('file:///tmp/a%20b.png')
    await api.ask('Delete?', { kind: 'warning' })
    await api.openDialog({ multiple: true })

    expect(electron.invoke).toHaveBeenNthCalledWith(1, 'journal:host:reveal', '/tmp/a.md')
    expect(electron.invoke).toHaveBeenNthCalledWith(2, 'journal:host:open-path', '/tmp/a.md')
    expect(electron.invoke).toHaveBeenNthCalledWith(
      3,
      'journal:host:open-external',
      'https://example.com',
    )
    expect(electron.invoke).toHaveBeenNthCalledWith(4, 'journal:host:pick-folder')
    expect(electron.invoke).toHaveBeenNthCalledWith(5, 'journal:host:set-zoom', 1.25)
    expect(electron.invoke).toHaveBeenNthCalledWith(6, 'journal:host:set-window-theme', 'dark')
    expect(electron.invoke).toHaveBeenNthCalledWith(7, 'journal:host:ask', 'Delete?', {
      kind: 'warning',
    })
    expect(electron.invoke).toHaveBeenNthCalledWith(8, 'journal:host:open-dialog', {
      multiple: true,
    })
  })

  it('forwards file drop paths without exposing ipcRenderer', async () => {
    const api = await loadExposedApi()
    const handler = vi.fn()
    const unlisten = api.onFileDrop(handler) as () => void
    const dropListener = electron.addEventListener.mock.calls.find(([type]) => type === 'drop')?.[1]
    const preventDefault = vi.fn()
    const file = { name: 'a.md' }
    electron.getPathForFile.mockReturnValue('/tmp/a.md')

    expect(typeof dropListener).toBe('function')
    ;(dropListener as (event: unknown) => void)({
      preventDefault,
      dataTransfer: { files: [file] },
    })

    expect(preventDefault).toHaveBeenCalled()
    expect(electron.getPathForFile).toHaveBeenCalledWith(file)
    expect(handler).toHaveBeenCalledWith({ type: 'drop', paths: ['/tmp/a.md'] })

    unlisten()
    ;(dropListener as (event: unknown) => void)({
      preventDefault,
      dataTransfer: { files: [file] },
    })
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
