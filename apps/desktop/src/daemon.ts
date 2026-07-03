/**
 * Daemon lifecycle for the Electron host.
 *
 * This module owns exactly one concern: keeping a @journal/daemon child process
 * alive and knowing when it is ready. It deliberately imports NO journal
 * business modules — the host is process plumbing only (Gate A).
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Default daemon port — matches @journal/daemon/src/server.ts. */
export const DEFAULT_DAEMON_PORT = 17510

const MODULE_DIR = dirname(fileURLToPath(import.meta.url))

export interface DaemonOptions {
  /** Port the daemon should listen on. Defaults to DEFAULT_DAEMON_PORT. */
  port?: number
  /** Absolute path to the daemon entry (dist/cli.js). Defaults to monorepo layout. */
  daemonPath?: string
  /** Node executable used to run the daemon. Defaults to the Electron-bundled node. */
  nodePath?: string
  /** Extra / override env for the child process. */
  env?: NodeJS.ProcessEnv
  /** Forwarded stdout lines. */
  onStdout?: (data: string) => void
  /** Forwarded stderr lines. */
  onStderr?: (data: string) => void
}

export interface DaemonHandle {
  /** The spawned child process. */
  process: ChildProcess
  /** Port the daemon is bound to. */
  port: number
  /** Base URL of the daemon (http://127.0.0.1:<port>). */
  url: string
  /** Stop the child: SIGTERM, then SIGKILL after `timeoutMs`. Resolves once exited. */
  stop: (timeoutMs?: number) => Promise<void>
}

/** Minimal killable surface used by {@link stopChild} (mockable in tests). */
export interface Killable {
  killed: boolean
  kill(signal?: NodeJS.Signals | number): boolean
  once(
    event: 'exit',
    listener: (code: number | null, signal: NodeJS.Signals | null) => void,
  ): unknown
}

/**
 * Resolve the daemon entry path. Prefers $JOURNAL_DAEMON_BIN, then the sibling
 * monorepo package layout (apps/desktop/dist -> apps/daemon/dist/cli.js).
 */
export function resolveDaemonPath(baseDir: string = MODULE_DIR): string {
  const candidates = [
    process.env.JOURNAL_DAEMON_BIN,
    resolve(baseDir, '../../daemon/dist/cli.js'),
  ].filter((p): p is string => Boolean(p))
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  // Fall back to the monorepo layout even if absent (spawn will surface the error).
  return candidates.at(-1) ?? resolve(baseDir, '../../daemon/dist/cli.js')
}

/** Spawn the daemon child. Never throws; callers inspect `handle.process`. */
export function spawnDaemon(opts: DaemonOptions = {}): DaemonHandle {
  const port = opts.port ?? DEFAULT_DAEMON_PORT
  const daemonPath = opts.daemonPath ?? resolveDaemonPath()
  const nodePath = opts.nodePath ?? process.execPath

  const child = spawn(nodePath, [daemonPath, '--no-open', '--port', String(port)], {
    // ELECTRON_RUN_AS_NODE forces the Electron binary to run cli.js as plain
    // node. Placed LAST so process.env / opts.env can never clobber it back
    // into a fork bomb (child re-boots a full Electron app → spawn loop).
    env: {
      ...process.env,
      ...opts.env,
      JOURNAL_DAEMON_PORT: String(port),
      ELECTRON_RUN_AS_NODE: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    // Same process group as the host so it is reclaimed when Electron exits.
    windowsHide: true,
  })

  child.stdout?.on('data', (chunk: Buffer) => opts.onStdout?.(chunk.toString()))
  child.stderr?.on('data', (chunk: Buffer) => opts.onStderr?.(chunk.toString()))

  return {
    process: child,
    port,
    url: `http://127.0.0.1:${port}`,
    stop: (timeoutMs = 5000) => stopChild(child, timeoutMs),
  }
}

/**
 * Stop a child process gracefully: SIGTERM, escalate to SIGKILL after
 * `timeoutMs`, resolve when the process has exited. Idempotent.
 */
export function stopChild(child: Killable, timeoutMs = 5000): Promise<void> {
  return new Promise((resolvePromise) => {
    if (child.killed) return resolvePromise()

    let settled = false
    const done = (): void => {
      if (!settled) {
        settled = true
        resolvePromise()
      }
    }

    child.once('exit', () => done())
    child.kill('SIGTERM')

    const escalate = setTimeout(() => {
      if (!child.killed) child.kill('SIGKILL')
      // SIGKILL should produce an 'exit'; resolve defensively either way.
      done()
    }, timeoutMs)
    escalate.unref?.()
  })
}

export interface HealthCheckOptions {
  /** Daemon base URL (http://127.0.0.1:<port>). */
  url: string
  /** Max probe attempts. */
  maxAttempts?: number
  /** Delay between attempts in ms. */
  intervalMs?: number
  /** Injectable probe; returns true once the daemon reports healthy. */
  isHealthy?: (url: string) => Promise<boolean>
  /** Optional abort signal. */
  signal?: AbortSignal
}

/** Default probe: GET <url>/health and check for `{ status: 'ok' }`. */
export async function defaultIsHealthy(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/health`)
    if (!res.ok) return false
    const body = (await res.json().catch(() => null)) as { status?: string } | null
    return body?.status === 'ok'
  } catch {
    return false
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolveSleep) => {
    const timer = setTimeout(resolveSleep, ms)
    timer.unref?.()
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        resolveSleep()
      },
      { once: true },
    )
  })
}

/**
 * Poll the daemon until it is healthy, or throw once attempts are exhausted.
 * Retries handle the cold-start window between spawn() and the HTTP listener.
 */
export async function waitForHealth(opts: HealthCheckOptions): Promise<void> {
  const { url, maxAttempts = 30, intervalMs = 500, isHealthy = defaultIsHealthy, signal } = opts

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) throw new Error('health check aborted')
    if (await isHealthy(url)) return
    await sleep(intervalMs, signal)
  }
  throw new Error(`daemon did not become healthy at ${url} after ${maxAttempts} attempts`)
}
