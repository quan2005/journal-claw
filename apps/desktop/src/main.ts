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
  nativeTheme,
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
import { runStartup } from './startup.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// ── D0: perf instrumentation ─────────────────────────────────────────────
// Captured at module load (≈ process start) so every mark is a relative ms.
const bootStart = Date.now()
function perf(event: string): void {
  process.stdout.write(`[desktop:perf] ${event} +${Date.now() - bootStart}ms\n`)
}

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

// ── D2: theme-aware background tokens (docs/DESIGN.md --bg) ──────────────
// Pick by the OS/native theme so the window never flashes the wrong color
// before the renderer applies its own data-theme. Desktop has zero business
// semantics — this reads nativeTheme (host concern), not daemon settings.
const BG_DARK = '#0f0f0f'
const BG_LIGHT = '#ffffff'

function resolveBackgroundColor(): string {
  return nativeTheme.shouldUseDarkColors ? BG_DARK : BG_LIGHT
}

function windowOptions(): BrowserWindowConstructorOptions {
  return {
    width: 1280,
    height: 800,
    minWidth: 720,
    minHeight: 480,
    titleBarStyle: 'hiddenInset',
    // D2: paint the native window with the app background immediately so the
    // first frame is never pure white. Matches renderer --bg tokens.
    backgroundColor: resolveBackgroundColor(),
    // D2: hidden until the renderer signals ready-to-show (or the 3s fallback
    // fires), avoiding the empty-skeleton → content flash.
    show: false,
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

// D2: fallback timeout — dev Vite cold-start may delay ready-to-show beyond
// 1s. We force-show so AC-1's ≤1s window-appearance target holds even when the
// dev server is slow (the fallback only triggers in the abnormal case).
const SHOW_FALLBACK_MS = 3000

function createWindow(): void {
  const window = new BrowserWindow(windowOptions())
  let shown = false
  const showOnce = (): void => {
    if (shown) return
    shown = true
    window.show()
    perf('ready-to-show')
  }
  // Show as soon as the renderer has painted its first frame.
  window.once('ready-to-show', showOnce)
  // Fallback: never let a slow dev server keep the window hidden indefinitely.
  const fallback = setTimeout(showOnce, SHOW_FALLBACK_MS)
  fallback.unref()
  loadRenderer(window)
}

app.whenReady().then(() => {
  // D1: createWindow runs synchronously inside runStartup; startDaemon runs
  // in parallel (never awaited before the window). The window appears within
  // ~1s while the daemon boots in the background.
  runStartup({
    registerHostIpc,
    buildApplicationMenu,
    createWindow,
    startDaemon: () =>
      startDaemon().catch((err: Error) => {
        log('daemon', `spawn failed: ${err.message}`)
        return null
      }),
    registerActivateHandler: (handler) => {
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) handler()
      })
    },
    onDaemonReady: (handle) => {
      daemonHandle = handle
    },
    perf,
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
