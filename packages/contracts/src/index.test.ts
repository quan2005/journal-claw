import { describe, it, expect } from 'vitest'
import { isAgentRunEvent, AGENT_RUN_EVENT_TYPES, type AgentRunEvent } from './index.js'

describe('contracts', () => {
  it('isAgentRunEvent validates a well-formed event', () => {
    const event: AgentRunEvent = {
      type: 'run_started',
      runId: 'run-1',
      sessionId: 'sess-1',
      data: '',
      timestamp: new Date().toISOString(),
    }
    expect(isAgentRunEvent(event)).toBe(true)
  })

  it('isAgentRunEvent rejects malformed input', () => {
    expect(isAgentRunEvent(null)).toBe(false)
    expect(isAgentRunEvent({})).toBe(false)
    expect(isAgentRunEvent({ type: 'run_started' })).toBe(false)
  })

  it('isAgentRunEvent strictly rejects unknown event types', () => {
    // Shape-correct but type is not in the allow-list. The previous loose
    // guard accepted any string; the strict guard must reject this so
    // adapter-internal labels cannot leak onto the event wire.
    const unknown = {
      type: 'session_finish',
      runId: 'r1',
      sessionId: 's1',
      data: '',
      timestamp: new Date().toISOString(),
    }
    expect(isAgentRunEvent(unknown)).toBe(false)
    // Sanity: same shape with a known type is accepted.
    expect(isAgentRunEvent({ ...unknown, type: 'run_finished' })).toBe(true)
  })

  it('AGENT_RUN_EVENT_TYPES lists every minimum event incl. step_finished', () => {
    // ADR §AgentRunEvent minimum event set — step_finished was missing before
    // this change and is required to align with the documented lifecycle.
    expect(AGENT_RUN_EVENT_TYPES).toContain('step_finished')
    expect(AGENT_RUN_EVENT_TYPES).toContain('step_started')
    for (const t of [
      'run_started',
      'run_finished',
      'run_failed',
      'tool_call',
      'tool_result',
      'text_delta',
    ]) {
      expect(AGENT_RUN_EVENT_TYPES).toContain(t)
    }
  })

  it('exports all core domain types', async () => {
    const mod = await import('./index.js')
    expect(typeof mod.isAgentRunEvent).toBe('function')
    // 类型存在性（编译期保证，运行期只查导出）
    expect(mod).toBeDefined()
  })
})
