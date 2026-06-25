/**
 * journal daemon HTTP server
 *
 * 参照 open-design apps/daemon/src/server.ts 的 Express 形态。
 * 最小骨架：GET /health + GET /workspace + GET /events (SSE)。
 * 不依赖平台专属二进制；跨平台 Node 能力。
 */

import express from 'express'
import type { Server } from 'node:http'

export interface DaemonOptions {
  port: number
}

export interface DaemonHandle {
  url: string
  close: () => Promise<void>
}

export function startDaemon(opts: DaemonOptions): Promise<DaemonHandle> {
  return new Promise((resolve, reject) => {
    const app = express()

    app.get('/health', (_req, res) => {
      res.json({ status: 'ok', service: '@journal/daemon' })
    })

    app.get('/workspace', (_req, res) => {
      res.json({
        path: process.cwd(),
        available: true,
      })
    })

    // SSE event stream — 推送 mock 心跳事件，验证通道可用
    app.get('/events', (req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
      res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`)

      const interval = setInterval(() => {
        res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`)
      }, 5000)

      req.on('close', () => {
        clearInterval(interval)
      })
    })

    const server: Server = app.listen(opts.port, () => {
      const url = `http://127.0.0.1:${opts.port}`
      resolve({
        url,
        close: () =>
          new Promise<void>((res, rej) => {
            server.close((err) => (err ? rej(err) : res()))
          }),
      })
    })

    server.on('error', reject)
  })
}
