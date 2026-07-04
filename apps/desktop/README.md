# @journal/desktop

Electron host for JournalClaw. The main process is **process plumbing only**
(Gate A): it creates the window, builds the menu, and keeps the
`@journal/daemon` child process alive. It imports no journal business modules.

## Scripts

| Script               | What it does                                                         |
| -------------------- | -------------------------------------------------------------------- |
| `bun run dev`        | Build main, then run apps/web vite (`:1420`) + Electron together     |
| `bun run start`      | Build main and launch Electron against the running/expected services |
| `bun run build:main` | `tsc` the main process to `dist/`                                    |
| `bun run build`      | Build main + `electron-builder` (packaging wired fully in M7-b/c)    |
| `bun run test`       | Vitest unit tests (daemon lifecycle / healthcheck)                   |
| `bun run typecheck`  | `tsc --noEmit`                                                       |

## Configuration (env)

| Var                      | Default                              | Purpose                              |
| ------------------------ | ------------------------------------ | ------------------------------------ |
| `JOURNAL_DEV_URL`        | `http://localhost:1420`              | Dev renderer URL                     |
| `JOURNAL_DAEMON_PORT`    | `17510`                              | Daemon port (mirrors daemon default) |
| `JOURNAL_DAEMON_BIN`     | _monorepo layout_                    | Override daemon entry path           |
| `JOURNAL_RENDERER_INDEX` | `<appPath>/dist-renderer/index.html` | Packaged renderer (M7-b/c)           |

## Daemon lifecycle

On `app.whenReady()` the host spawns `node <daemon>/dist/cli.js --no-open --port
<port>` in the same process group, polls `GET /health` until `{ status: "ok" }`,
and on `before-quit` sends `SIGTERM` (escalating to `SIGKILL`) so the child is
always reclaimed — it is never orphaned when Electron exits.
