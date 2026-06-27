import { describe, it, expect } from 'vitest'
import { SourceBindingService } from './service.js'
import { isSourceBinding } from '@journal/contracts'
import type { AgentRunEvent } from '@journal/contracts'

const ts = '2026-06-25T12:00:00Z'
function toolCall(runId: string, name: string, input: unknown, spanId = 'tu1'): AgentRunEvent {
  return { type: 'tool_call', runId, sessionId: 's1', spanId, data: JSON.stringify({ name, input }), timestamp: ts }
}
function toolResult(runId: string, content: string, spanId = 'tu1'): AgentRunEvent {
  return { type: 'tool_result', runId, sessionId: 's1', spanId, data: JSON.stringify({ content }), timestamp: ts }
}

describe('SourceBindingService', () => {
  it('records and retrieves a binding', () => {
    const svc = new SourceBindingService()
    const b = svc.recordBinding({ runId: 'r1', path: 'notes/a.md', kind: 'read' })
    expect(isSourceBinding(b)).toBe(true)
    expect(svc.getBinding(b.id)?.path).toBe('notes/a.md')
  })

  it('lists by run and kind', () => {
    const svc = new SourceBindingService()
    svc.recordBinding({ runId: 'r1', path: 'a.md', kind: 'read' })
    svc.recordBinding({ runId: 'r1', path: 'b.md', kind: 'cite' })
    svc.recordBinding({ runId: 'r2', path: 'c.md', kind: 'read' })
    expect(svc.listByRun('r1')).toHaveLength(2)
    expect(svc.listByKind('read')).toHaveLength(2)
  })

  it('captureFromRun infers bindings from Read tool calls', () => {
    const svc = new SourceBindingService()
    const events = [
      toolCall('r1', 'Read', { file_path: 'meetings/standup.md' }),
      toolResult('r1', 'Decision: ship the adapter layer this week.'),
    ]
    const recorded = svc.captureFromRun('r1', events)
    expect(recorded.length).toBeGreaterThanOrEqual(1)
    expect(recorded[0].kind).toBe('read')
    expect(recorded[0].sourceSpanId).toBe('tu1')
    expect(recorded[0].excerpt).toContain('Decision')
    expect(svc.listByRun('r1')).toHaveLength(recorded.length)
  })

  it('captureFromRun extracts paths from Bash/grep input', () => {
    const svc = new SourceBindingService()
    const events = [toolCall('r1', 'Bash', { command: 'grep -r decision meetings/notes.md' })]
    const recorded = svc.captureFromRun('r1', events)
    expect(recorded.some((b) => b.path.includes('notes.md'))).toBe(true)
    expect(recorded[0].kind).toBe('search')
  })

  it('captureFromRun dedupes (path, kind) within a run', () => {
    const svc = new SourceBindingService()
    const events = [
      toolCall('r1', 'Read', { file_path: 'a.md' }, 'tu1'),
      toolCall('r1', 'Read', { file_path: 'a.md' }, 'tu2'),
    ]
    const recorded = svc.captureFromRun('r1', events)
    expect(recorded.filter((b) => b.path.includes('a.md'))).toHaveLength(1)
  })

  it('captureFromRun ignores non-file tools', () => {
    const svc = new SourceBindingService()
    const events = [toolCall('r1', 'Write', { file_path: 'out.md' })]
    expect(svc.captureFromRun('r1', events)).toHaveLength(0)
  })

  it('captureFromRun returns nothing for events without tool calls', () => {
    const svc = new SourceBindingService()
    const events: AgentRunEvent[] = [
      { type: 'text_delta', runId: 'r1', sessionId: 's1', data: '{"text":"hi"}', timestamp: ts },
    ]
    expect(svc.captureFromRun('r1', events)).toHaveLength(0)
  })
})
