import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RunStore } from './store.js'
import { isAgentRunEvent, type AgentRunEvent } from '@journal/contracts'

function makeEvent(partial: Partial<AgentRunEvent> & { runId: string }): AgentRunEvent {
  return {
    type: 'text_delta',
    sessionId: 'sess-1',
    data: 'hello',
    timestamp: new Date().toISOString(),
    ...partial,
  } as AgentRunEvent
}

describe('RunStore (JSONL persistence)', () => {
  let dataDir: string

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'journal-runs-'))
  })

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true })
  })

  it('appends events to <dataDir>/runs/<runId>.jsonl, one JSON per line', () => {
    const store = new RunStore(dataDir)
    const runId = 'run-abc'

    const e1 = makeEvent({ runId, type: 'run_started', data: 'start' })
    const e2 = makeEvent({ runId, type: 'text_delta', data: 'hello' })
    const e3 = makeEvent({ runId, type: 'run_finished', data: 'done' })

    store.appendEvent(runId, e1)
    store.appendEvent(runId, e2)
    store.appendEvent(runId, e3)

    const file = join(dataDir, 'runs', `${runId}.jsonl`)
    expect(existsSync(file)).toBe(true)

    const lines = readFileSync(file, 'utf8').split('\n').filter((l) => l.trim().length > 0)
    expect(lines.length).toBe(3)
    for (const line of lines) {
      const parsed = JSON.parse(line)
      expect(isAgentRunEvent(parsed)).toBe(true)
    }
  })

  it('readEvents replays events in append order', () => {
    const store = new RunStore(dataDir)
    const runId = 'run-replay'

    const events = [
      makeEvent({ runId, type: 'run_started', data: 'a' }),
      makeEvent({ runId, type: 'text_delta', data: 'b' }),
      makeEvent({ runId, type: 'tool_call', data: 'c' }),
      makeEvent({ runId, type: 'run_finished', data: 'd' }),
    ]
    for (const e of events) store.appendEvent(runId, e)

    const replayed = store.readEvents(runId)
    expect(replayed.length).toBe(4)
    expect(replayed.map((e) => e.data)).toEqual(['a', 'b', 'c', 'd'])
    expect(replayed.map((e) => e.type)).toEqual([
      'run_started',
      'text_delta',
      'tool_call',
      'run_finished',
    ])
  })

  it('readEvents returns [] for a run with no persisted events', () => {
    const store = new RunStore(dataDir)
    expect(store.readEvents('run-none')).toEqual([])
  })

  it('isolates events across different run ids', () => {
    const store = new RunStore(dataDir)
    store.appendEvent('run-a', makeEvent({ runId: 'run-a', data: 'A1' }))
    store.appendEvent('run-b', makeEvent({ runId: 'run-b', data: 'B1' }))
    store.appendEvent('run-a', makeEvent({ runId: 'run-a', data: 'A2' }))

    expect(store.readEvents('run-a').map((e) => e.data)).toEqual(['A1', 'A2'])
    expect(store.readEvents('run-b').map((e) => e.data)).toEqual(['B1'])
  })
})
