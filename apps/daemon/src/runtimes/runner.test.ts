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
      {
        spawnChild: () => {
          throw new Error('should not spawn')
        },
      },
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

describe('executeRun run_started dedup (regression)', () => {
  let dir: string
  beforeEach(() => {
    dir = join(tmpdir(), 'rd-' + Math.random().toString(36).slice(2))
    __resetRegistryForTests()
  })
  afterEach(() => {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {}
  })

  it('emits exactly one run_started when the CLI emits a system/init line', async () => {
    const service = new AgentRunService(dir)
    const run = service.createRun({ goal: 'g', mode: 'agent' })
    const lines = [
      '{"type":"system","subtype":"init","session_id":"' + run.sessionId + '","model":"sonnet"}',
      '{"type":"result","subtype":"result","result":"ok"}',
    ]
    await executeRun(
      service,
      { runId: run.id, agentId: 'claude', prompt: 'x' },
      {
        spawnChild: () => mockChild(lines, 0) as any,
      },
    )
    const starts = service.readEvents(run.id).filter((e) => e.type === 'run_started')
    expect(starts).toHaveLength(1)
  })

  it('synthesizes a fallback run_started when the CLI emits no init line', async () => {
    const service = new AgentRunService(dir)
    const run = service.createRun({ goal: 'g', mode: 'agent' })
    // No init line — only a result. The close handler must emit run_started.
    await executeRun(
      service,
      { runId: run.id, agentId: 'claude', prompt: 'x' },
      {
        spawnChild: () =>
          mockChild(['{"type":"result","subtype":"result","result":"ok"}'], 0) as any,
      },
    )
    const starts = service.readEvents(run.id).filter((e) => e.type === 'run_started')
    expect(starts).toHaveLength(1)
  })
})

describe('executeRun opencode adapter (registry + parser + run_finished synthesis)', () => {
  let dir: string
  beforeEach(() => {
    dir = join(tmpdir(), 'oc-' + Math.random().toString(36).slice(2))
    __resetRegistryForTests()
  })
  afterEach(() => {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {}
  })

  it('routes opencode-json through the opencode parser and emits the full event set', async () => {
    const service = new AgentRunService(dir)
    const run = service.createRun({ goal: 'g', mode: 'agent' })
    const lines = [
      '{"type":"step_start","sessionID":"' + run.sessionId + '"}',
      '{"type":"text","part":{"text":"pong"}}',
      '{"type":"tool_use","sessionID":"' +
        run.sessionId +
        '","part":{"tool":"Bash","callID":"tu1","state":{"status":"completed","input":{"command":"echo hi"},"output":"hi\\n"}}}',
      '{"type":"step_finish","part":{"tokens":{"input":1,"output":1}}}',
      '{"type":"finish"}',
    ]
    const res = await executeRun(
      service,
      { runId: run.id, agentId: 'opencode', prompt: 'say pong' },
      { spawnChild: () => mockChild(lines, 0) as any },
    )
    expect(res.ok).toBe(true)
    const types = service.readEvents(run.id).map((e) => e.type)
    // Must see each required event type from the parser.
    for (const t of ['run_started', 'text_delta', 'tool_call', 'tool_result', 'run_finished']) {
      expect(types).toContain(t)
    }
    expect(service.getRun(run.id)?.status).toBe('succeeded')
    // run_finished must appear exactly once (parser emits finish; synthesis
    // must NOT double-emit because run.status has already flipped).
    expect(types.filter((t) => t === 'run_finished')).toHaveLength(1)
  })

  it('synthesizes run_finished on clean exit when the adapter emits no terminal frame', async () => {
    const service = new AgentRunService(dir)
    const run = service.createRun({ goal: 'g', mode: 'agent' })
    // step_start + text only — no `finish`. Runner close handler must
    // synthesize run_finished so the run reaches 'succeeded'.
    const lines = [
      '{"type":"step_start","sessionID":"' + run.sessionId + '"}',
      '{"type":"text","part":{"text":"partial"}}',
    ]
    await executeRun(
      service,
      { runId: run.id, agentId: 'opencode', prompt: 'x' },
      { spawnChild: () => mockChild(lines, 0) as any },
    )
    const types = service.readEvents(run.id).map((e) => e.type)
    expect(types).toContain('run_finished')
    expect(service.getRun(run.id)?.status).toBe('succeeded')
  })

  it('emits run_failed on opencode error event', async () => {
    const service = new AgentRunService(dir)
    const run = service.createRun({ goal: 'g', mode: 'agent' })
    const lines = [
      '{"type":"step_start","sessionID":"' + run.sessionId + '"}',
      '{"type":"error","error":{"message":"provider auth"}}',
    ]
    await executeRun(
      service,
      { runId: run.id, agentId: 'opencode', prompt: 'x' },
      { spawnChild: () => mockChild(lines, 0) as any },
    )
    const events = service.readEvents(run.id)
    const failed = events.find((e) => e.type === 'run_failed')
    expect(failed).toBeTruthy()
    expect(JSON.parse(failed!.data).error).toBe('provider auth')
    expect(service.getRun(run.id)?.status).toBe('failed')
  })
})

describe('executeRun cancellation (AbortSignal)', () => {
  let dir: string
  beforeEach(() => {
    dir = join(tmpdir(), 'cx-' + Math.random().toString(36).slice(2))
    __resetRegistryForTests()
  })
  afterEach(() => {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {}
  })

  it('an aborted AbortSignal SIGTERMs the spawned child', async () => {
    const service = new AgentRunService(dir)
    const run = service.createRun({ goal: 'g', mode: 'agent' })
    const controller = new AbortController()
    const kills: string[] = []
    const hangingChild = () => {
      const ee = new EventEmitter() as any
      ee.stdin = { write: () => true, end: () => {} }
      ee.stdout = new EventEmitter()
      ee.stdout.setEncoding = () => {}
      ee.stderr = new EventEmitter()
      ee.stderr.setEncoding = () => {}
      ee.kill = (sig: string) => {
        kills.push(sig)
        process.nextTick(() => ee.emit('close', 143))
      }
      return ee
    }
    const runPromise = executeRun(
      service,
      { runId: run.id, agentId: 'claude', prompt: 'x' },
      { spawnChild: hangingChild as any, signal: controller.signal },
    )
    await new Promise((r) => setTimeout(r, 10))
    controller.abort()
    const res = await runPromise
    expect(kills).toContain('SIGTERM')
    expect(res).toBeTruthy()
  })

  it('cancel without a signal does not kill (status-only cancel still works in service)', async () => {
    const service = new AgentRunService(dir)
    const run = service.createRun({ goal: 'g', mode: 'agent' })
    const canceled = service.cancelRun(run.id)
    expect(canceled?.status).toBe('canceled')
  })
})
