import { describe, expect, it } from 'vitest'
import type { AgentEvent } from '@earendil-works/pi-agent-core'
import { mapPiAgentEvent } from './events.js'

const meta = { runId: 'run-1', sessionId: 'session-1' }
const now = new Date('2026-06-27T00:00:00.000Z')

describe('mapPiAgentEvent', () => {
  it('maps pi lifecycle and delta events to AgentRunEvent types', () => {
    const events: AgentEvent[] = [
      { type: 'agent_start' },
      { type: 'turn_start' },
      messageUpdate('text_delta', 'hello'),
      messageUpdate('thinking_delta', 'hmm'),
      { type: 'agent_end', messages: [] },
    ]

    const mapped = events.flatMap((event) => mapPiAgentEvent(event, meta, now))

    expect(mapped.map((event) => event.type)).toEqual([
      'run_started',
      'step_started',
      'text_delta',
      'thinking_delta',
      'run_finished',
    ])
    expect(JSON.parse(mapped[2].data)).toEqual({ text: 'hello' })
    expect(JSON.parse(mapped[3].data)).toEqual({ text: 'hmm' })
  })

  it('maps tool execution start/end and emits change_proposed when tool details include a ChangeSet', () => {
    const mapped = [
      ...mapPiAgentEvent(
        {
          type: 'tool_execution_start',
          toolCallId: 'tc-1',
          toolName: 'write_file',
          args: { path: 'a.md' },
        },
        meta,
        now,
      ),
      ...mapPiAgentEvent(
        {
          type: 'tool_execution_end',
          toolCallId: 'tc-1',
          toolName: 'write_file',
          isError: false,
          result: { details: { changeSet: { id: 'cs-1', path: 'a.md' } } },
        },
        meta,
        now,
      ),
    ]

    expect(mapped.map((event) => event.type)).toEqual([
      'tool_call',
      'tool_result',
      'change_proposed',
    ])
    expect(mapped[0].spanId).toBe('tc-1')
    expect(mapped[2].parentSpanId).toBe('tc-1')
    expect(JSON.parse(mapped[2].data)).toEqual({ changeSet: { id: 'cs-1', path: 'a.md' } })
  })
})

function messageUpdate(type: 'text_delta' | 'thinking_delta', delta: string): AgentEvent {
  return {
    type: 'message_update',
    message: { role: 'assistant', content: [] } as never,
    assistantMessageEvent: { type, contentIndex: 0, delta, partial: {} } as never,
  }
}
