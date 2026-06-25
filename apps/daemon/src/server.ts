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
import { listAgentDefs, getAgentDef } from './runtimes/registry.js'
import { executeRun } from './runtimes/runner.js'
import { assembleContext } from './context/assemble.js'
import { ChangeSetService } from './changeset/service.js'
import { ArtifactIndexService } from './artifacts/index.js'
import { SedimentationService } from './sediment/service.js'
import { SourceBindingService } from './sources/service.js'
import { WorkspaceService } from './workspace/service.js'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { AgentRunEvent, AgentRunMode } from '@journal/contracts'

const execFileAsync = promisify(execFile)

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

function detectAgent(
  bin: string,
  versionArgs: string[],
  timeoutMs = 5000,
): Promise<{ installed: boolean; version: string | null }> {
  return new Promise((resolve) => {
    execFile(bin, versionArgs, { timeout: timeoutMs }, (err, stdout) => {
      if (err) return resolve({ installed: false, version: null })
      resolve({ installed: true, version: stdout.trim().split('\n')[0] || null })
    })
  })
}

async function detectAuth(
  bin: string,
  args: string[],
  timeoutMs = 5000,
): Promise<{ authed: boolean; authMethod?: string; apiProvider?: string }> {
  try {
    const { stdout } = await execFileAsync(bin, args, { timeout: timeoutMs })
    const parsed = JSON.parse(stdout) as Record<string, unknown>
    return {
      authed: parsed.loggedIn === true,
      authMethod: typeof parsed.authMethod === 'string' ? parsed.authMethod : undefined,
      apiProvider: typeof parsed.apiProvider === 'string' ? parsed.apiProvider : undefined,
    }
  } catch {
    return { authed: false }
  }
}

function resolveDataDir(): string {
  return process.env.JOURNAL_DAEMON_DATA_DIR ?? '.journal-daemon-data'
}

export function startDaemon(opts: DaemonOptions): Promise<DaemonHandle> {
  return new Promise((resolve, reject) => {
    const app = express()
    app.use(express.json({ limit: '1mb' }))

   const service = opts.runService ?? new AgentRunService(resolveDataDir())
    const changeSetService = new ChangeSetService(process.cwd())
    const artifactIndex = new ArtifactIndexService()
    const sedimentService = new SedimentationService()
    const sourceBindingService = new SourceBindingService()
    const workspaceService = new WorkspaceService(process.cwd())

    app.get('/health', (_req, res) => {
      res.json({ status: 'ok', service: '@journal/daemon' })
    })

   app.get('/workspace', (_req, res) => {
     res.json({
       path: process.cwd(),
       available: true,
     })
   })

    // GET /workspace/meta — workspace context boundary metadata (G15)
    app.get('/workspace/meta', (_req, res) => {
      res.json(workspaceService.getMeta())
    })

    // PUT /workspace/meta — update workspace metadata (partial merge)
    app.put('/workspace/meta', (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>
      const patch: Record<string, unknown> = {}
      if (typeof body.name === 'string') patch.name = body.name
      if (typeof body.type === 'string') patch.type = body.type
      if (typeof body.description === 'string') patch.description = body.description
      if (Array.isArray(body.goals)) patch.goals = body.goals.filter((g) => typeof g === 'string')
      if (Array.isArray(body.activeSources)) patch.activeSources = body.activeSources.filter((s) => typeof s === 'string')
      res.json(workspaceService.updateMeta(patch))
    })

    // POST /workspace/goals — add a goal
    app.post('/workspace/goals', (req, res) => {
      const goal = (req.body ?? {}) as { goal?: unknown }
      if (typeof goal.goal !== 'string' || !goal.goal.trim()) {
        res.status(400).json({ error: 'goal is required' })
        return
      }
      res.json(workspaceService.addGoal(goal.goal))
    })

    // POST /workspace/sources — mark a file as an active source
    app.post('/workspace/sources', (req, res) => {
      const body = (req.body ?? {}) as { source?: unknown }
      if (typeof body.source !== 'string' || !body.source.trim()) {
        res.status(400).json({ error: 'source is required' })
        return
      }
      res.json(workspaceService.addActiveSource(body.source))
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
      const body = (req.body ?? {}) as { goal?: unknown; mode?: unknown; agentId?: unknown; prompt?: unknown; model?: unknown; authorizationMode?: unknown }
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
      const agentId = typeof body.agentId === 'string' && body.agentId ? body.agentId : 'claude'
     const def = getAgentDef(agentId)
     if (!def) {
       res.status(400).json({ error: `unknown agent: ${agentId}` })
       return
     }
      const VALID_AUTH_MODES = new Set(['wide_with_audit', 'read_only', 'workspace_write', 'full_access'])
      const authorizationMode = VALID_AUTH_MODES.has(body.authorizationMode as string)
        ? (body.authorizationMode as 'wide_with_audit' | 'read_only' | 'workspace_write' | 'full_access')
        : 'workspace_write'
     const run = service.createRun({ goal, mode, authorizationMode })
     res.status(201).json(run)
      // Fire-and-forget: spawn the agent and stream its events into the run.
      // The promise must never reject — an unhandled rejection would crash the
      // daemon. executeRun already records run_failed on its known failure
      // paths; this catch is a belt-and-suspenders guard for anything thrown
      // synchronously before the inner Promise is constructed.
   const prompt = typeof body.prompt === 'string' ? body.prompt : goal
   const model = typeof body.model === 'string' && body.model ? body.model : null
      // G15+G14: assemble context before execution — the core loop's
      // "Agent 组装上下文" step. Wraps the user's goal with workspace
      // metadata (goals, active sources) and sedimented memory (preferences,
      // facts, rules) so the Agent starts with the workspace's accumulated
      // state.
      const assembledPrompt = assembleContext(
        prompt,
        workspaceService.getMeta(),
        sedimentService.listAll(),
      )
      executeRun(service, { runId: run.id, agentId, prompt: assembledPrompt, model, authorizationMode })
        .then((result) => {
          // G14 auto-sedimentation: when a run succeeds, capture its artifacts
          // and derive durable memory (summary + preferences/facts/rules),
          // completing the core loop's final step. Each record is traceable
          // to this run.
          if (!result.ok) return
          const events = service.readEvents(run.id)
          const assistantText = events
            .filter((e) => e.type === 'text_delta')
            .map((e) => { try { return (JSON.parse(e.data) as { text?: string }).text ?? '' } catch { return '' } })
            .join('')
          service.appendEvent(run.id, { type: 'sedimentation_started', runId: run.id, sessionId: run.sessionId, data: JSON.stringify({ message: 'sedimenting run' }), timestamp: new Date().toISOString() })
         const artifacts = artifactIndex.captureFromRun(run.id, assistantText)
          // G6: capture which local files the Run used as evidence (Sources),
          // inferred from its file-touching tool calls.
          const sourceBindings = sourceBindingService.captureFromRun(run.id, events)
         const changeSets = changeSetService.listChangeSets(run.id)
         const sed = sedimentService.sediment(run.id, events, artifacts, changeSets)
          service.appendEvent(run.id, { type: 'sedimentation_recorded', runId: run.id, sessionId: run.sessionId, data: JSON.stringify({ memoryCount: sed.all.length, artifactCount: artifacts.length, sourceCount: sourceBindings.length }), timestamp: new Date().toISOString() })
        })
        .catch((err) => {
        service.appendEvent(
          run.id,
          { type: 'run_failed', runId: run.id, sessionId: run.sessionId, data: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), timestamp: new Date().toISOString() },
        )
      })
    })

    // GET /agents — list registered adapters with installed/authed status.
    app.get('/agents', async (_req, res) => {
      const defs = listAgentDefs()
      const out = await Promise.all(
        defs.map(async (d) => {
          const det = await detectAgent(d.bin, d.version.args, d.version.timeoutMs)
          const auth =
            det.installed && d.authProbe
              ? await detectAuth(d.bin, d.authProbe.args, d.authProbe.timeoutMs)
              : { authed: false }
          return {
            id: d.id,
            name: d.name,
            bin: d.bin,
            streamFormat: d.streamFormat,
            installed: det.installed,
            version: det.version,
            authed: auth.authed,
            authMethod: auth.authMethod ?? null,
            apiProvider: auth.apiProvider ?? null,
          }
        }),
      )
      res.json({ agents: out })
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

    // GET /runs/:id/changesets — list the recorded file changes for a run
    app.get('/runs/:id/changesets', (req, res) => {
     res.json({ changeSets: changeSetService.listChangeSets(req.params.id) })
   })

    // GET /runs/:id/artifacts — list the artifacts produced by a run
    app.get('/runs/:id/artifacts', (req, res) => {
      res.json({ artifacts: artifactIndex.listByRun(req.params.id) })
    })

   // GET /artifacts — list all indexed artifacts (optionally ?type=)
   app.get('/artifacts', (req, res) => {
     const type = typeof req.query.type === 'string' ? req.query.type : null
     res.json({ artifacts: type ? artifactIndex.listByType(type) : artifactIndex.listAll() })
   })

    // GET /runs/:id/memory — sedimented memory records for a run
    app.get('/runs/:id/memory', (req, res) => {
      res.json({ memory: sedimentService.listByRun(req.params.id) })
    })

   // GET /memory — all sedimented memory (optionally ?kind=)
   app.get('/memory', (req, res) => {
     const kind = typeof req.query.kind === 'string' ? req.query.kind : null
     res.json({ memory: kind ? sedimentService.listByKind(kind as never) : sedimentService.listAll() })
   })

    // GET /runs/:id/sources — source bindings (which files the run used)
    app.get('/runs/:id/sources', (req, res) => {
      res.json({ sources: sourceBindingService.listByRun(req.params.id) })
    })

    // Bind to loopback only: the daemon is a local runtime, not a network
    // service. Binding 0.0.0.0 would be both a sandbox EPERM and a needless
    // exposure of the workspace API.
    const server: Server = app.listen(opts.port, '127.0.0.1', () => {
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
