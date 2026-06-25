/**
 * journal daemon HTTP server
 *
 * 参照 open-design apps/daemon/src/server.ts 的 Express 形态。
 * 最小骨架：GET /health + GET /workspace + GET /events (SSE)。
 * 不依赖平台专属二进制；跨平台 Node 能力。
 */

import express from 'express'
import type { Server } from 'node:http'
import { AgentRunService } from './runs/service.js'
import type { AgentRunEvent, AgentRunMode } from '@journal/contracts'

export interface DaemonOptions {
  port: number
  /**
   * 可选：注入自定义 AgentRunService（测试 / 集成场景）。
   * 默认用 JOURNAL_DAEMON_DATA_DIR 或 .journal-daemon-data（daemon cwd 下）。
   */
  runService?: AgentRunService
}

export interface DaemonHandle {
  url: string
  close: () => Promise<void>
}

const VALID_MODES: ReadonlySet<AgentRunMode> = new Set(['chat', 'agent', 'observe'])

function resolveDataDir(): string {
  return process.env.JOURNAL_DAEMON_DATA_DIR ?? '.journal-daemon-data'
}

export function startDaemon(opts: DaemonOptions): Promise<DaemonHandle> {
  return new Promise((resolve, reject) => {
    const app = express()
    app.use(express.json({ limit: '1mb' }))

    const service = opts.runService ?? new AgentRunService(resolveDataDir())

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

    // ── AgentRun routes ──────────────────────────────────────────────────────
    // POST /runs — 创建一个 run，返回 { id, status: 'queued', ... }
    app.post('/runs', (req, res) => {
      const body = (req.body ?? {}) as { goal?: unknown; mode?: unknown }
      const goal = typeof body.goal === 'string' ? body.goal : ''
      const mode = typeof body.mode === 'string' ? (body.mode as AgentRunMode) : 'agent'
      if (!goal.trim()) {
        res.status(400).json({ error: 'goal is required' })
        return
      }
      if (!VALID_MODES.has(mode)) {
        res.status(400).json({ error: `invalid mode: ${String(body.mode)}` })
        return
      }
      const run = service.createRun({ goal, mode })
      res.status(201).json(run)
    })

    // GET /runs/:id/events — SSE：先回放已有事件，再推送后续新增事件
    app.get('/runs/:id/events', (req, res) => {
      const runId = req.params.id
      if (!service.hasRun(runId)) {
        res.status(404).json({ error: 'run not found' })
        return
      }
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })

      const writeEvent = (event: AgentRunEvent): void => {
        res.write(`data: ${JSON.stringify(event)}\n\n`)
      }

      // 先发送一个 sentinel，让客户端确认连接已建立
      res.write(`data: ${JSON.stringify({ type: 'subscribed', runId })}\n\n`)

      const unsubscribe = service.subscribe(runId, writeEvent)
      req.on('close', () => {
        unsubscribe()
      })
    })

    // POST /runs/:id/cancel — 取消 run，状态 → canceled
    app.post('/runs/:id/cancel', (req, res) => {
      const runId = req.params.id
      const run = service.cancelRun(runId)
      if (!run) {
        res.status(404).json({ error: 'run not found' })
        return
      }
      res.json(run)
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
