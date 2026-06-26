import { describe, it, expect } from 'vitest'
import { isAgentRunEvent } from '@journal/contracts'
import { createCodexStreamParser } from './codexStream.js'

const meta = { runId: 'r1', sessionId: 's1' }

const THREAD_STARTED =
  '{"type":"thread.started","thread_id":"019f03d7-e4dc-7593-ad10-bba488067b49"}'
const TURN_STARTED = '{"type":"turn.started"}'
const ITEM_ERROR =
  '{"type":"item.completed","item":{"id":"item_0","type":"error","message":"Skill descriptions were shortened to fit the 2% skills context budget. Codex can still see every skill, but some descriptions are shorter. Disable unused skills or plugins to leave more room for the rest."}}'
const COMMAND =
  '/bin/zsh -lc "node -e \\"const p=require(\'./package.json\'); console.log(p.name)\\""'
const COMMAND_STARTED = JSON.stringify({
  type: 'item.started',
  item: {
    id: 'item_1',
    type: 'command_execution',
    command: COMMAND,
    aggregated_output: '',
    exit_code: null,
    status: 'in_progress',
  },
})
const COMMAND_COMPLETED = JSON.stringify({
  type: 'item.completed',
  item: {
    id: 'item_1',
    type: 'command_execution',
    command: COMMAND,
    aggregated_output: 'journal\n',
    exit_code: 0,
    status: 'completed',
  },
})
const AGENT_MESSAGE =
  '{"type":"item.completed","item":{"id":"item_2","type":"agent_message","text":"`package.json` 的 `name` 字段是 `journal`。"}}'
const TURN_COMPLETED =
  '{"type":"turn.completed","usage":{"input_tokens":40281,"cached_input_tokens":30464,"output_tokens":81,"reasoning_output_tokens":0}}'
const TOP_LEVEL_ERROR = '{"type":"error","message":"boom"}'

const REAL_FIXTURE = [
  THREAD_STARTED,
  TURN_STARTED,
  ITEM_ERROR,
  COMMAND_STARTED,
  COMMAND_COMPLETED,
  AGENT_MESSAGE,
  TURN_COMPLETED,
]

const parseAll = (lines: string[]) => {
  const p = createCodexStreamParser(meta)
  const out: ReturnType<ReturnType<typeof createCodexStreamParser>['parseLine']> = []
  for (const l of lines) out.push(...p.parseLine(l))
  return out
}

describe('codexStream parser', () => {
  it('maps thread.started -> run_started once', () => {
    const e = parseAll([THREAD_STARTED, THREAD_STARTED])
    expect(e.map((x) => x.type)).toEqual(['run_started'])
    expect(JSON.parse(e[0].data).threadId).toBe('019f03d7-e4dc-7593-ad10-bba488067b49')
    expect(isAgentRunEvent(e[0])).toBe(true)
  })

  it('maps turn.started -> step_started without starting the run', () => {
    const p = createCodexStreamParser(meta)
    expect(p.hasStarted()).toBe(false)
    const e = p.parseLine(TURN_STARTED)
    expect(e.map((x) => x.type)).toEqual(['step_started'])
    expect(p.hasStarted()).toBe(false)
  })

  it('maps command_execution item.started -> tool_call with spanId', () => {
    const e = parseAll([THREAD_STARTED, COMMAND_STARTED, COMMAND_STARTED])
    const calls = e.filter((x) => x.type === 'tool_call')
    expect(calls).toHaveLength(1)
    expect(calls[0].spanId).toBe('item_1')
    expect(JSON.parse(calls[0].data).command).toContain('package.json')
  })

  it('maps command_execution item.completed -> tool_result with paired spanId', () => {
    const e = parseAll([THREAD_STARTED, COMMAND_STARTED, COMMAND_COMPLETED, COMMAND_COMPLETED])
    const calls = e.filter((x) => x.type === 'tool_call')
    const results = e.filter((x) => x.type === 'tool_result')
    expect(calls).toHaveLength(1)
    expect(results).toHaveLength(1)
    expect(results[0].spanId).toBe(calls[0].spanId)
    expect(JSON.parse(results[0].data).content).toBe('journal\n')
    expect(JSON.parse(results[0].data).exitCode).toBe(0)
  })

  it('maps agent_message item.completed -> text_delta', () => {
    const e = parseAll([THREAD_STARTED, AGENT_MESSAGE])
    const td = e.find((x) => x.type === 'text_delta')!
    expect(JSON.parse(td.data).text).toContain('journal')
  })

  it('swallows non-fatal item error without run_failed', () => {
    const e = parseAll([THREAD_STARTED, ITEM_ERROR])
    expect(e.map((x) => x.type)).toEqual(['run_started'])
    expect(e.some((x) => x.type === 'run_failed')).toBe(false)
  })

  it('maps turn.completed -> run_finished with usage', () => {
    const e = parseAll([THREAD_STARTED, TURN_COMPLETED])
    const finished = e.find((x) => x.type === 'run_finished')!
    expect(JSON.parse(finished.data).usage.input_tokens).toBe(40281)
  })

  it('maps top-level error -> run_failed', () => {
    const e = parseAll([TOP_LEVEL_ERROR])
    expect(e[0].type).toBe('run_failed')
    expect(JSON.parse(e[0].data).error).toBe('boom')
    expect(isAgentRunEvent(e[0])).toBe(true)
  })

  it('full ordered lifecycle emits the required event set from the real fixture', () => {
    const e = parseAll(REAL_FIXTURE)
    expect(e.map((x) => x.type)).toEqual([
      'run_started',
      'step_started',
      'tool_call',
      'tool_result',
      'text_delta',
      'run_finished',
    ])
    expect(e.every(isAgentRunEvent)).toBe(true)
  })

  it('swallows empty / non-JSON / unknown frames', () => {
    expect(parseAll(['', 'not json', '{"type":"whatever"}'])).toHaveLength(0)
  })
})
