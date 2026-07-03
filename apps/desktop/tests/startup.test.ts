import { describe, expect, it, vi } from 'vitest'
import { runStartup } from '../src/startup.js'

describe('runStartup', () => {
  it('creates the window synchronously — without waiting for the daemon', () => {
    const createWindow = vi.fn()
    // startDaemon returns a promise that never resolves during this test.
    const startDaemon = vi.fn(() => new Promise<null>(() => {}))

    runStartup({
      registerHostIpc: vi.fn(),
      buildApplicationMenu: vi.fn(),
      createWindow,
      startDaemon,
      registerActivateHandler: vi.fn(),
      onDaemonReady: vi.fn(),
      perf: vi.fn(),
    })

    // The window was created even though the daemon promise is still pending.
    expect(createWindow).toHaveBeenCalledTimes(1)
    expect(startDaemon).toHaveBeenCalledTimes(1)
  })

  it('reports the daemon handle once healthy (in parallel, after the window)', async () => {
    const onDaemonReady = vi.fn()
    const createWindow = vi.fn()
    const handle = { process: { pid: 1 }, port: 17510, url: 'http://x', stop: vi.fn() }

    runStartup({
      registerHostIpc: vi.fn(),
      buildApplicationMenu: vi.fn(),
      createWindow,
      startDaemon: () => Promise.resolve(handle),
      registerActivateHandler: vi.fn(),
      onDaemonReady,
      perf: vi.fn(),
    })

    // createWindow happened synchronously; daemon resolves on the next tick.
    expect(createWindow).toHaveBeenCalledTimes(1)
    expect(onDaemonReady).not.toHaveBeenCalled()

    await Promise.resolve()
    await Promise.resolve()

    expect(onDaemonReady).toHaveBeenCalledWith(handle)
  })

  it('reports null when the daemon fails to start', async () => {
    const onDaemonReady = vi.fn()

    runStartup({
      registerHostIpc: vi.fn(),
      buildApplicationMenu: vi.fn(),
      createWindow: vi.fn(),
      startDaemon: () => Promise.reject(new Error('boom')),
      registerActivateHandler: vi.fn(),
      onDaemonReady,
      perf: vi.fn(),
    })

    await Promise.resolve()
    await Promise.resolve()

    expect(onDaemonReady).toHaveBeenCalledWith(null)
  })

  it('re-creates the window when the activate handler fires', () => {
    const createWindow = vi.fn()
    let activateHandler: (() => void) | null = null

    runStartup({
      registerHostIpc: vi.fn(),
      buildApplicationMenu: vi.fn(),
      createWindow,
      startDaemon: () => new Promise<null>(() => {}),
      registerActivateHandler: (h) => {
        activateHandler = h
      },
      onDaemonReady: vi.fn(),
      perf: vi.fn(),
    })

    expect(createWindow).toHaveBeenCalledTimes(1)
    activateHandler!()
    expect(createWindow).toHaveBeenCalledTimes(2)
  })

  it('emits perf marks in startup order', () => {
    const marks: string[] = []
    runStartup({
      registerHostIpc: vi.fn(),
      buildApplicationMenu: vi.fn(),
      createWindow: vi.fn(),
      startDaemon: () => new Promise<null>(() => {}),
      registerActivateHandler: vi.fn(),
      onDaemonReady: vi.fn(),
      perf: (event) => marks.push(event),
    })

    expect(marks).toEqual(['whenReady', 'createWindow'])
  })
})
