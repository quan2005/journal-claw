/**
 * Startup orchestration — extracted from main.ts so the window/daemon ordering
 * is unit-testable without importing Electron.
 *
 * Contract: `createWindow()` is invoked synchronously (never blocked by the
 * daemon). The daemon starts in parallel; its result is reported via callbacks
 * once settled. This eliminates the white-screen serial chain documented in
 * stories/20260703-startup-white-screen/perf-baseline.md (D1).
 */
import type { DaemonHandle } from './daemon.js'

export interface StartupDeps {
  registerHostIpc: () => void
  buildApplicationMenu: () => void
  /** Create and load the BrowserWindow. Called synchronously — first. */
  createWindow: () => void
  /** Start the daemon child process. Runs in parallel with window load. */
  startDaemon: () => Promise<DaemonHandle | null>
  /** Register the macOS re-activate handler (re-create window if none). */
  registerActivateHandler: (handler: () => void) => void
  /** Daemon became healthy (or null if it failed to start). */
  onDaemonReady: (handle: DaemonHandle | null) => void
  /** Emit a perf mark relative to process start (D0 instrumentation). */
  perf: (event: string) => void
}

/**
 * Run the startup sequence. `createWindow()` is called before `startDaemon()`
 * is awaited — the window appears immediately while the daemon boots in the
 * background. See design.md D1.
 */
export function runStartup(deps: StartupDeps): void {
  deps.perf('whenReady')
  deps.registerHostIpc()
  deps.buildApplicationMenu()

  // Window first — synchronous, never blocked by the daemon.
  deps.createWindow()
  deps.perf('createWindow')

  // Daemon in parallel; report the result once settled (not awaited here).
  deps
    .startDaemon()
    .then((handle) => {
      deps.onDaemonReady(handle)
      deps.perf('daemon-healthy')
    })
    .catch(() => {
      deps.onDaemonReady(null)
    })

  deps.registerActivateHandler(() => {
    deps.createWindow()
  })
}
