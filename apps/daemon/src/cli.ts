#!/usr/bin/env node
/**
 * @journal/daemon — journal TS daemon 入口
 *
 * 参照 open-design apps/daemon/src/cli.ts 的子命令路由形态。
 * 当前是最小骨架：启动 HTTP server，暴露 health/workspace/events。
 * 不接管默认 Tauri 生产路径（旁路 daemon）。
 */

import { startDaemon } from './server.js'

const argv = process.argv.slice(2)
const port = (() => {
  const i = argv.indexOf('--port')
  if (i !== -1 && argv[i + 1]) return parseInt(argv[i + 1], 10)
  const env = process.env.JOURNAL_DAEMON_PORT
  return env ? parseInt(env, 10) : 17510
})()

startDaemon({ port }).then(
  ({ url }) => {
    if (!argv.includes('--no-open')) {
      process.stdout.write(`journal daemon listening on ${url}\n`)
    }
  },
  (err) => {
    console.error('[daemon] failed to start:', err)
    process.exit(1)
  },
)
