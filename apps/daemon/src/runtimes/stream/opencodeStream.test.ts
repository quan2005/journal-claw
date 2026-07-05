import { describe, it, expect } from 'vitest'
import { createOpenCodeStreamParser, makeEvent } from './opencodeStream.js'
import { isAgentRunEvent } from '@journal/contracts'

const meta = { runId: 'r1', sessionId: 's1' }

const STEP_START = '{"type":"step_start","sessionID":"s1"}'
const TEXT = '{"type":"text","part":{"text":"pong"}}'
const TOOL_USE_RUNNING =
  '{"type":"tool_use","sessionID":"s1","part":{"tool":"Bash","callID":"tu1","state":{"status":"running","input":{"command":"echo hi"}}}}'
const TOOL_USE_COMPLETED =
  '{"type":"tool_use","sessionID":"s1","part":{"tool":"Bash","callID":"tu1","state":{"status":"completed","input":{"command":"echo hi"},"output":"hi\\n"}}}'
const STEP_FINISH = '{"type":"step_finish","part":{"tokens":{"input":10,"output":1},"cost":0.001}}'
const FINISH = '{"type":"finish"}'
const ERROR = '{"type":"error","error":{"message":"boom"}}'

const parseAll = (lines: string[]) => {
  const p = createOpenCodeStreamParser(meta)
  const out: ReturnType<ReturnType<typeof createOpenCodeStreamParser>['parseLine']> = []
  for (const l of lines) out.push(...p.parseLine(l))
  return out
}

describe('opencodeStream parser', () => {
  it('maps step_start -> run_started (first) + step_started', () => {
    const e = parseAll([STEP_START])
    expect(e.map((x) => x.type)).toEqual(['run_started', 'step_started'])
    expect(isAgentRunEvent(e[0])).toBe(true)
  })

  it('does not emit a second run_started on subsequent step_start', () => {
    const e = parseAll([STEP_START, STEP_START])
    expect(e.filter((x) => x.type === 'run_started')).toHaveLength(1)
    expect(e.filter((x) => x.type === 'step_started')).toHaveLength(2)
  })

  it('maps text -> text_delta', () => {
    const e = parseAll([STEP_START, TEXT])
    const td = e.find((x) => x.type === 'text_delta')!
    expect(JSON.parse(td.data).text).toBe('pong')
  })

  it('maps tool_use running+completed -> tool_call + tool_result (no dup)', () => {
    const e = parseAll([STEP_START, TOOL_USE_RUNNING, TOOL_USE_COMPLETED])
    const calls = e.filter((x) => x.type === 'tool_call')
    const results = e.filter((x) => x.type === 'tool_result')
    expect(calls).toHaveLength(1)
    expect(results).toHaveLength(1)
    expect(JSON.parse(calls[0].data).name).toBe('Bash')
    expect(JSON.parse(calls[0].data).id).toBe('tu1')
    expect(JSON.parse(results[0].data).content).toContain('hi')
  })

  it('maps step_finish -> step_finished (per-step, not terminal)', () => {
    const e = parseAll([STEP_START, STEP_FINISH, STEP_FINISH])
    const sf = e.filter((x) => x.type === 'step_finished')
    expect(sf).toHaveLength(2)
    expect(JSON.parse(sf[0].data).cost).toBe(0.001)
  })

  it('maps finish -> run_finished', () => {
    const e = parseAll([STEP_START, FINISH])
    expect(e.at(-1)!.type).toBe('run_finished')
  })

  it('maps error -> run_failed', () => {
    const e = parseAll([ERROR])
    expect(e[0].type).toBe('run_failed')
    expect(JSON.parse(e[0].data).error).toBe('boom')
    expect(isAgentRunEvent(e[0])).toBe(true)
  })

  it('full ordered lifecycle emits the required event set', () => {
    const e = parseAll([
      STEP_START,
      TEXT,
      TOOL_USE_RUNNING,
      TOOL_USE_COMPLETED,
      STEP_FINISH,
      FINISH,
    ])
    const types = e.map((x) => x.type)
    expect(types).toEqual([
      'run_started',
      'step_started',
      'text_delta',
      'tool_call',
      'tool_result',
      'step_finished',
      'run_finished',
    ])
    expect(e.every(isAgentRunEvent)).toBe(true)
  })

  it('swallows empty / non-JSON / unknown frames', () => {
    expect(parseAll(['', 'not json', '{"type":"whatever"}'])).toHaveLength(0)
  })

  it('no run_started before first step_start (hasStarted tracks state)', () => {
    const p = createOpenCodeStreamParser(meta)
    expect(p.hasStarted()).toBe(false)
    p.parseLine(STEP_START)
    expect(p.hasStarted()).toBe(true)
  })

  it('makeEvent valid and shared with claude/codex style', () => {
    const ev = makeEvent('run_started', meta, '{}')
    expect(isAgentRunEvent(ev)).toBe(true)
    expect(ev.runId).toBe('r1')
  })
})
