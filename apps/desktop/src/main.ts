/**
 * JournalClaw Electron host — main process.
 *
 * Responsibilities, and ONLY these (Gate A — zero business semantics):
 *   1. Create the BrowserWindow and load the renderer (apps/web).
 *   2. Build the standard application menu.
 *   3. Manage the @journal/daemon child process lifecycle.
 *
 * This module imports no journal business code — it is pure process plumbing.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  app,
  BrowserWindow,
  type BrowserWindowConstructorOptions,
} from 'electron'
import { buildApplicationMenu } from './menu.js'
import {
  type DaemonHandle,
  DEFAULT_DAEMON_PORT,
  spawnDaemon,
  waitForHealth,
} from './daemon.js'
import { registerHostIpc } from './hostIpc.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// Dev server (apps/web vite). Overridable for non-standard setups.
const DEV_SERVER_URL = process.env.JOURNAL_DEV_URL ?? 'http://localhost:1420'
// Daemon port; mirrors @journal/daemon unless overridden.
const DAEMON_PORT = Number(process.env.JOURNAL_DAEMON_PORT ?? DEFAULT_DAEMON_PORT)
// Packaged renderer index (wired by M7-b/c). Overridable for local prod tests.
const RENDERER_INDEX =
  process.env.JOURNAL_RENDERER_INDEX ??
  join(app.getAppPath(), 'dist-renderer', 'index.html')

/** Tracks the running daemon so it can be reclaimed on quit. */
let daemonHandle: DaemonHandle | null = null
/** Guards cleanup so we never preventDefault -> exit in a loop. */
let cleaningUp = false

function log(tag: string, message: string): void {
  // Single stdout/stderr channel; no logging framework for the skeleton.
  process.stdout.write(`[desktop:${tag}] ${message}\n`)
}

async function startDaemon(): Promise<DaemonHandle | null> {
  const handle = spawnDaemon({
    port: DAEMON_PORT,
    onStdout: (line) => log('daemon', line.replace(/\n$/, '')),
    onStderr: (line) => process.stderr.write(`[desktop:daemon] ${line}`),
  })

  log('daemon', `spawned pid=${handle.process.pid} on ${handle.url}`)

  try {
    await waitForHealth({ url: handle.url })
    log('daemon', `healthy at ${handle.url}`)
  } catch (err) {
    log('daemon', `health check failed: ${(err as Error).message}`)
    await handle.stop()
    return null
  }
  return handle
}

function windowOptions(): BrowserWindowConstructorOptions {
  return {
    width: 1280,
    height: 800,
    minWidth: 720,
    minHeight: 480,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#FFFFFF',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      // Keep the main world free of Node; the renderer talks to the daemon
      // over HTTP like any other client (apps/web is unchanged by M7-a).
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  }
}

function loadRenderer(window: BrowserWindow): void {
  if (app.isPackaged) {
    if (!existsSync(RENDERER_INDEX)) {
      log('window', `renderer not found at ${RENDERER_INDEX} (wired in M7-b/c)`)
    }
    void window.loadFile(RENDERER_INDEX)
  } else {
    void window.loadURL(DEV_SERVER_URL).then(
      () => log('window', `loaded dev server ${DEV_SERVER_URL}`),
      (err: Error) => log('window', `dev server load failed: ${err.message}`),
    )
    window.webContents.on('did-fail-load', (_e, code, desc) =>
      log('window', `did-fail-load ${code} ${desc}`),
    )
  }
}

function createWindow(): void {
  const window = new BrowserWindow(windowOptions())
  loadRenderer(window)
}

app.whenReady().then(async () => {
  registerHostIpc()
  buildApplicationMenu()

  // Daemon is best-effort: a failure to start must not block the window.
  daemonHandle = await startDaemon().catch((err: Error) => {
    log('daemon', `spawn failed: ${err.message}`)
    return null
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
 // macOS keeps the app alive with no windows; everywhere else we quit.
  if (process.platform !== 'darwin') app.quit()
})

async function cleanup(): Promise<void> {
  if (cleaningUp) return
  cleaningUp = true
  const handle = daemonHandle
  daemonHandle = null
  if (handle) {
    log('daemon', 'reclaiming on quit')
    await handle.stop()
  }
}

// Reclaim the daemon before the process exits. preventDefault keeps the app
// alive long enough for the async SIGTERM/SIGKILL cycle to complete.
app.on('before-quit', (event: { preventDefault(): void }) => {
  if (cleaningUp) return
  event.preventDefault()
  void cleanup().finally(() => app.exit(0))
})

// Belt-and-suspenders: if we are about to exit and the child somehow survived,
// make one last synchronous attempt so the OS never orphans it.
app.on('will-quit', () => {
  daemonHandle?.process.kill('SIGTERM')
})
