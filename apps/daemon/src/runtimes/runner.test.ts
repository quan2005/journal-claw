import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'
import { AgentRunService } from '../runs/service.js'
import { __resetRegistryForTests } from './registry.js'
import { executeRun } from './runner.js'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

function mockChild(lines: string[], exitCode = 0) {
  const ee = new EventEmitter() as any
  ee.stdin = { write: () => true, end: () => {} }
  ee.stdout = new EventEmitter()
  ee.stdout.setEncoding = () => {}
  ee.stderr = new EventEmitter()
  ee.stderr.setEncoding = () => {}
  ee.kill = () => {}
  process.nextTick(() => {
    for (const line of lines) ee.stdout.emit('data', line + '\n')
    ee.stderr.emit('data', '')
    ee.emit('close', exitCode)
  })
  return ee
}

describe('executeRun', () => {
  let dir: string
  beforeEach(() => {
    dir = join(tmpdir(), 'jr-' + Math.random().toString(36).slice(2))
    __resetRegistryForTests()
  })
  afterEach(() => {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {}
  })

  it('produces a full event sequence from a mocked claude stream', async () => {
    const service = new AgentRunService(dir)
    const run = service.createRun({ goal: 'g', mode: 'agent' })
    const lines = [
      '{"type":"system","subtype":"init","session_id":"' + run.sessionId + '","model":"sonnet"}',
      '{"type":"assistant","message":{"id":"m1","role":"assistant","content":[{"type":"text","text":"pong"}]}}',
      '{"type":"result","subtype":"result","result":"pong","costUSD":0.001}',
    ]
    const res = await executeRun(
      service,
      { runId: run.id, agentId: 'claude', prompt: 'say pong' },
      { spawnChild: () => mockChild(lines, 0) as any },
    )
    expect(res.ok).toBe(true)
    const events = service.readEvents(run.id)
    const types = events.map((e) => e.type)
    expect(types).toContain('run_started')
    expect(types).toContain('text_delta')
    expect(types).toContain('run_finished')
    expect(service.getRun(run.id)?.status).toBe('succeeded')
  })

  it('appends run_failed on non-zero exit', async () => {
    const service = new AgentRunService(dir)
    const run = service.createRun({ goal: 'g', mode: 'agent' })
    const res = await executeRun(
      service,
      { runId: run.id, agentId: 'claude', prompt: 'x' },
      { spawnChild: () => mockChild([], 1) as any },
    )
    expect(res.ok).toBe(false)
    const events = service.readEvents(run.id)
    expect(events.some((e) => e.type === 'run_failed')).toBe(true)
    expect(service.getRun(run.id)?.status).toBe('failed')
  })

  it('fails fast for an unknown agent id', async () => {
    const service = new AgentRunService(dir)
    const run = service.createRun({ goal: 'g', mode: 'agent' })
    const res = await executeRun(
      service,
      { runId: run.id, agentId: 'ghost', prompt: 'x' },
      { spawnChild: () => { throw new Error('should not spawn') } },
    )
    expect(res.ok).toBe(false)
    expect(service.readEvents(run.id).some((e) => e.type === 'run_failed')).toBe(true)
  })

  it('builds claude args with -p and stream-json', async () => {
    const service = new AgentRunService(dir)
    const run = service.createRun({ goal: 'g', mode: 'agent' })
    let captured: string[] = []
    await executeRun(
      service,
      { runId: run.id, agentId: 'claude', prompt: 'hi', model: 'sonnet' },
      {
        spawnChild: (_bin, args) => {
          captured = args
          return mockChild(['{"type":"result","subtype":"result","result":"ok"}'], 0) as any
        },
      },
    )
    expect(captured).toContain('-p')
    expect(captured).toContain('--output-format')
    expect(captured[captured.indexOf('--output-format') + 1]).toBe('stream-json')
    expect(captured).toContain('--verbose')
    expect(captured).toContain('--model')
  })
})
