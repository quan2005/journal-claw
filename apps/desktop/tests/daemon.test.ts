import { afterEach, describe, expect, it, vi } from 'vitest'
import * as childProcess from 'node:child_process'
import { resolve as resolvePath } from 'node:path'
import {
  DEFAULT_DAEMON_PORT,
  resolveDaemonPath,
  spawnDaemon,
  stopChild,
  waitForHealth,
  type Killable,
} from '../src/daemon.js'

// Wrap `spawn` in a spy that delegates to the real implementation by default,
// so the existing spawnDaemon test still spawns a real child. Individual tests
// can intercept a single call via mockImplementationOnce to inspect arguments.
vi.mock('node:child_process', async (importActual) => {
  const actual = await importActual<typeof import('node:child_process')>()
  return {
    ...actual,
    spawn: vi.fn(actual.spawn),
  }
})

/** Minimal in-memory Killable that drives stopChild without a real process. */
function makeFakeChild(
  behavior: {
    exitsOnTerm?: boolean
    exitsAfterMs?: number
  } = {},
): Killable & { signals: Array<NodeJS.Signals | number>; killed: boolean } {
  const signals: Array<NodeJS.Signals | number> = []
  const exitListeners = new Set<() => void>()
  let killed = false
  return {
    signals,
    get killed() {
      return killed
    },
    kill(signal: NodeJS.Signals | number = 'SIGTERM') {
      signals.push(signal)
      if (signal === 'SIGKILL') killed = true
      if (behavior.exitsOnTerm && signal === 'SIGTERM') {
        killed = true
        for (const fn of exitListeners) fn()
      }
      if (behavior.exitsAfterMs !== undefined) {
        setTimeout(() => {
          killed = true
          for (const fn of exitListeners) fn()
        }, behavior.exitsAfterMs)
      }
      return true
    },
    once(_event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void) {
      // Wrap so the stored zero-arg fn matches how stopChild invokes it.
      exitListeners.add(() => listener(null, null))
    },
  }
}

describe('stopChild', () => {
  it('resolves once the child exits on SIGTERM', async () => {
    const child = makeFakeChild({ exitsOnTerm: true })
    await stopChild(child, 50)
    expect(child.signals).toContain('SIGTERM')
    expect(child.killed).toBe(true)
    expect(child.signals).not.toContain('SIGKILL')
  })

  it('escalates to SIGKILL after the timeout if the child ignores SIGTERM', async () => {
    const child = makeFakeChild({})
    await stopChild(child, 30)
    expect(child.signals).toContain('SIGTERM')
    expect(child.signals).toContain('SIGKILL')
    expect(child.killed).toBe(true)
  })

  it('is a no-op for an already-killed child', async () => {
    const child = makeFakeChild({ exitsOnTerm: true })
    child.kill('SIGTERM') // pre-kill
    expect(child.signals).toHaveLength(1)
    await stopChild(child, 50)
    expect(child.signals).toHaveLength(1) // no further signals
  })
})

describe('waitForHealth', () => {
  it('returns as soon as the probe reports healthy', async () => {
    const probe = vi.fn().mockResolvedValue(true)
    await waitForHealth({ url: 'http://127.0.0.1:17510', isHealthy: probe })
    expect(probe).toHaveBeenCalledTimes(1)
  })

  it('retries until the probe succeeds', async () => {
    // fail twice, then succeed
    const probe = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true)
    await waitForHealth({
      url: 'http://127.0.0.1:17510',
      maxAttempts: 10,
      intervalMs: 1,
      isHealthy: probe,
    })
    expect(probe).toHaveBeenCalledTimes(3)
  })

  it('throws once attempts are exhausted', async () => {
    const probe = vi.fn().mockResolvedValue(false)
    await expect(
      waitForHealth({
        url: 'http://127.0.0.1:17510',
        maxAttempts: 3,
        intervalMs: 1,
        isHealthy: probe,
      }),
    ).rejects.toThrow(/did not become healthy/)
    expect(probe).toHaveBeenCalledTimes(3)
  })

  it('aborts early when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const probe = vi.fn()
    await expect(
      waitForHealth({
        url: 'http://127.0.0.1:17510',
        isHealthy: probe,
        signal: controller.signal,
      }),
    ).rejects.toThrow(/aborted/)
    expect(probe).not.toHaveBeenCalled()
  })
})

describe('spawnDaemon', () => {
  afterEach(() => {
    // Restore the default (real) spawn implementation; clears call history too.
    vi.restoreAllMocks()
  })

  it('builds the handle with the loopback url and default port', () => {
    const handle = spawnDaemon({ daemonPath: '/nonexistent/cli.js' })
    expect(handle.port).toBe(DEFAULT_DAEMON_PORT)
    expect(handle.url).toBe(`http://127.0.0.1:${DEFAULT_DAEMON_PORT}`)
    // tidy up the (immediately errored) child
    handle.process.kill('SIGKILL')
  })

  it('sets ELECTRON_RUN_AS_NODE=1 so the Electron binary runs cli.js as node', () => {
    const spawnSpy = vi.mocked(childProcess.spawn)
    // Fake child with the chained stdio/kill surface spawnDaemon touches.
    const fakeChild = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      kill: vi.fn().mockReturnValue(true),
      killed: false,
      once: vi.fn(),
    }
    spawnSpy.mockImplementationOnce((() => fakeChild) as unknown as typeof childProcess.spawn)

    spawnDaemon({ daemonPath: '/nonexistent/cli.js' })

    const options = spawnSpy.mock.lastCall?.[2] as { env?: NodeJS.ProcessEnv } | undefined
    expect(options?.env?.ELECTRON_RUN_AS_NODE).toBe('1')
  })

  it('keeps ELECTRON_RUN_AS_NODE=1 even when opts.env tries to override it', () => {
    const spawnSpy = vi.mocked(childProcess.spawn)
    const fakeChild = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      kill: vi.fn().mockReturnValue(true),
      killed: false,
      once: vi.fn(),
    }
    spawnSpy.mockImplementationOnce((() => fakeChild) as unknown as typeof childProcess.spawn)

    // A caller (or inherited env) attempting to force node-as-electron must not
    // win — that path is a guaranteed fork bomb.
    spawnDaemon({
      daemonPath: '/nonexistent/cli.js',
      env: { ELECTRON_RUN_AS_NODE: '0' },
    })

    const options = spawnSpy.mock.lastCall?.[2] as { env?: NodeJS.ProcessEnv } | undefined
    expect(options?.env?.ELECTRON_RUN_AS_NODE).toBe('1')
  })
})

describe('resolveDaemonPath', () => {
  it('falls back to the sibling monorepo layout when nothing is found', () => {
    const previous = process.env.JOURNAL_DAEMON_BIN
    delete process.env.JOURNAL_DAEMON_BIN
    const path = resolveDaemonPath('/some/abs/apps/desktop/dist')
    expect(path).toBe(resolvePath('/some/abs/apps/desktop/dist', '../../daemon/dist/cli.js'))
    if (previous !== undefined) process.env.JOURNAL_DAEMON_BIN = previous
  })
})
