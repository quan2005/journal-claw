import { describe, it, expect } from 'vitest'
import { createClaudeStreamParser, makeEvent } from './claudeStream.js'
import { isAgentRunEvent } from '@journal/contracts'

const meta = { runId: 'r1', sessionId: 's1' }
const INIT = '{"type":"system","subtype":"init","cwd":"/tmp","session_id":"s1","model":"sonnet","permissionMode":"default"}'
const TEXT = '{"type":"assistant","message":{"id":"m1","role":"assistant","content":[{"type":"text","text":"pong"}]}}'
const TOOL = '{"type":"assistant","message":{"id":"m2","role":"assistant","content":[{"type":"tool_use","id":"tu1","name":"Bash","input":{"command":"echo hi"}}]}}'
const RESULT = '{"type":"result","subtype":"result","result":"pong","costUSD":0.001,"usage":{"input_tokens":10,"output_tokens":1}}'
const RETRY = '{"type":"system","subtype":"api_retry","attempt":1,"max_retries":10,"retry_delay_ms":600,"error":"unknown"}'
const parseAll = (lines: string[]) => { const p = createClaudeStreamParser(meta); const o: any[] = []; for (const l of lines) o.push(...p.parseLine(l)); return o }

describe('claudeStream parser', () => {
  it('run_started on init', () => { const e = parseAll([INIT]); expect(e).toHaveLength(1); expect(e[0].type).toBe('run_started'); expect(isAgentRunEvent(e[0])).toBe(true) })
  it('text_delta for assistant text', () => { expect(parseAll([TEXT]).some((e: any) => e.type === 'text_delta')).toBe(true) })
  it('tool_call for tool_use', () => { const e = parseAll([TOOL]); const tc = e.find((x: any) => x.type === 'tool_call')!; const d = JSON.parse(tc.data); expect(d.name).toBe('Bash'); expect(d.id).toBe('tu1') })
  it('run_finished on result', () => { const e = parseAll([RESULT]); expect(e[0].type).toBe('run_finished'); expect(JSON.parse(e[0].data).costUSD).toBe(0.001) })
  it('ordered lifecycle', () => { const e = parseAll([INIT, TEXT, TOOL, RESULT]); expect(e.map((x: any) => x.type)).toEqual(['run_started','text_delta','tool_call','run_finished']); expect(e.every(isAgentRunEvent)).toBe(true) })
  it('swallows retry/empty/invalid', () => { expect(parseAll(['', 'not json', RETRY])).toHaveLength(0) })
  it('no double run_started', () => { expect(parseAll([INIT, INIT]).filter((e: any) => e.type === 'run_started')).toHaveLength(1) })
  it('makeEvent valid', () => { const ev = makeEvent('run_started', meta, '{}'); expect(isAgentRunEvent(ev)).toBe(true); expect(ev.runId).toBe('r1') })
})
