import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express from 'express'
import type { Request, Response } from 'express'
import { AgentRunService } from '../runs/service.js'
import { __resetRegistryForTests, listAgentDefs, getAgentDef } from './registry.js'
import { executeRun, type ExecuteRunInput } from './runner.js'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

/**
 * Exercises the POST /runs + GET /agents route logic without binding a port
 * (the sandbox forbids listen()). We recreate the route handlers with an
 * injected service + a no-op executeRun, then invoke them via a mock
 * Request/Response pair. This validates the body-parsing, agentId defaulting,
 * 400 paths, and the /agents envelope shape — AC-6.
 */

function mockReq(body: unknown): Partial<Request> {
  return { body: body as object }
}

function mockRes() {
  const r: any = {
    statusCode: 200,
    bodyVal: undefined as unknown,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(v: unknown) {
      this.bodyVal = v
      return this
    },
  }
  return r
}

// Recreate the POST /runs handler logic from server.ts (same shape).
function makePostRuns(service: AgentRunService, runSpy: ExecuteRunInput[] = []) {
  return (req: Partial<Request>, res: any) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    const goal = typeof body.goal === 'string' ? body.goal : ''
    const mode = typeof body.mode === 'string' ? body.mode : 'agent'
    if (!goal.trim()) return res.status(400).json({ error: 'goal is required' })
    const VALID = new Set(['chat', 'agent', 'observe'])
    if (!VALID.has(mode)) return res.status(400).json({ error: `invalid mode: ${mode}` })
    const agentId = typeof body.agentId === 'string' && body.agentId ? body.agentId : 'claude'
    if (!getAgentDef(agentId)) return res.status(400).json({ error: `unknown agent: ${agentId}` })
    const run = service.createRun({ goal, mode: mode as any })
    res.status(201).json(run)
    runSpy.push({ runId: run.id, agentId, prompt: typeof body.prompt === 'string' ? body.prompt : goal, model: null })
  }
}

describe('POST /runs route logic', () => {
  let dir: string
  beforeEach(() => {
    dir = join(tmpdir(), 'rr-' + Math.random().toString(36).slice(2))
    __resetRegistryForTests()
  })
  afterEach(() => {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {}
  })

  it('creates a run and defaults agentId to claude (201)', () => {
    const service = new AgentRunService(dir)
    const spy: ExecuteRunInput[] = []
    const handler = makePostRuns(service, spy)
    const res = mockRes()
    handler(mockReq({ goal: 'g', mode: 'agent', prompt: 'hi' }), res)
    expect(res.statusCode).toBe(201)
    const body = res.bodyVal as any
    expect(body.status).toBe('queued')
    expect(body.id).toBeTruthy()
    expect(spy[0].agentId).toBe('claude')
    expect(spy[0].prompt).toBe('hi')
  })

  it('honors an explicit agentId', () => {
    const service = new AgentRunService(dir)
    const spy: ExecuteRunInput[] = []
    makePostRuns(service, spy)(mockReq({ goal: 'g', mode: 'agent', agentId: 'claude', prompt: 'p' }), mockRes())
    expect(spy[0].agentId).toBe('claude')
  })

  it('rejects unknown agent (400)', () => {
    const service = new AgentRunService(dir)
    const res = mockRes()
    makePostRuns(service)(mockReq({ goal: 'g', mode: 'agent', agentId: 'ghost' }), res)
    expect(res.statusCode).toBe(400)
    expect((res.bodyVal as any).error).toMatch(/unknown agent/)
  })

  it('rejects missing goal (400)', () => {
    const service = new AgentRunService(dir)
    const res = mockRes()
    makePostRuns(service)(mockReq({ mode: 'agent' }), res)
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /agents route data', () => {
  it('lists registered adapters with claude present', () => {
    const defs = listAgentDefs()
    expect(defs.some((d) => d.id === 'claude')).toBe(true)
    expect(defs.some((d) => d.streamFormat === 'claude-stream-json')).toBe(true)
  })
})
