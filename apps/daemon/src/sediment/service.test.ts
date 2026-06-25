import { describe, it, expect } from 'vitest'
import { SedimentationService } from './service.js'
import { isMemoryRecord } from '@journal/contracts'
import type { AgentRunEvent, Artifact, ChangeSet } from '@journal/contracts'

const ts = '2026-06-25T12:00:00Z'
function textDelta(runId: string, text: string): AgentRunEvent {
  return { type: 'text_delta', runId, sessionId: 's1', data: JSON.stringify({ text }), timestamp: ts }
}
function toolCall(runId: string, name: string): AgentRunEvent {
  return { type: 'tool_call', runId, sessionId: 's1', spanId: name + Math.random(), data: JSON.stringify({ name, input: {} }), timestamp: ts }
}
const art = (id: string, type = 'note'): Artifact => ({ id, runId: 'r1', type, title: 'T', content: 'c', createdAt: ts })
const cs = (path: string): ChangeSet => ({ id: 'cs', runId: 'r1', path, operation: 'edit', diffPreview: 'p', risk: 'low', authorizationMode: 'workspace_write', status: 'applied' })

describe('SedimentationService', () => {
  it('always produces a run summary note', () => {
    const svc = new SedimentationService()
    const res = svc.sediment('r1', [textDelta('r1', 'hello')], [], [])
    expect(res.summary.kind).toBe('note')
    expect(isMemoryRecord(res.summary)).toBe(true)
    expect(res.summary.detail).toContain('Run ')
  })

  it('extracts preferences from preference phrasing', () => {
    const svc = new SedimentationService()
    const text = 'I prefer concise summaries. You should always use bullet points.'
    const res = svc.sediment('r1', [textDelta('r1', text)], [], [])
    const prefs = res.records.filter((r) => r.kind === 'preference')
    expect(prefs.length).toBeGreaterThanOrEqual(1)
    expect(prefs.every((p) => p.evidence.length > 0)).toBe(true)
  })

  it('extracts project facts from factual phrasing', () => {
    const svc = new SedimentationService()
    const text = 'The project uses Rust and TypeScript. Our codebase is located at /journal.'
    const res = svc.sediment('r1', [textDelta('r1', text)], [], [])
    expect(res.records.some((r) => r.kind === 'project_fact')).toBe(true)
  })

  it('extracts writing rules from style phrasing', () => {
    const svc = new SedimentationService()
    const text = 'Write in a professional tone. Avoid jargon. Keep it concise.'
    const res = svc.sediment('r1', [textDelta('r1', text)], [], [])
    expect(res.records.some((r) => r.kind === 'writing_rule')).toBe(true)
  })

  it('infers tool rules from repeated tool use (3+)', () => {
    const svc = new SedimentationService()
    const events = [toolCall('r1', 'Bash'), toolCall('r1', 'Bash'), toolCall('r1', 'Bash'), toolCall('r1', 'Read')]
    const res = svc.sediment('r1', events, [], [])
    const toolRules = res.records.filter((r) => r.kind === 'tool_rule')
    expect(toolRules.some((r) => r.summary.includes('Bash'))).toBe(true)
  })

  it('links artifact ids as evidence on preferences', () => {
    const svc = new SedimentationService()
    const res = svc.sediment('r1', [textDelta('r1', 'I prefer dark mode')], [art('art-1')], [])
    const pref = res.records.find((r) => r.kind === 'preference')
    expect(pref?.sourceArtifactIds).toContain('art-1')
  })

  it('summary includes artifact + change counts', () => {
    const svc = new SedimentationService()
    const res = svc.sediment('r1', [textDelta('r1', 'done')], [art('art-1'), art('art-2')], [cs('a.md'), cs('b.md')])
    expect(res.summary.detail).toContain('Artifacts produced:** 2')
    expect(res.summary.detail).toContain('Files changed:** 2')
  })

  it('is idempotent per run (re-sediment replaces, not duplicates)', () => {
    const svc = new SedimentationService()
    svc.sediment('r1', [textDelta('r1', 'I prefer X')], [], [])
    svc.sediment('r1', [textDelta('r1', 'I prefer X')], [], [])
    expect(svc.listByRun('r1').filter((r) => r.sourceRunId === 'r1').length).toBeLessThanOrEqual(2)
    expect(svc.listAll().filter((r) => r.sourceRunId === 'r1').length).toBeLessThanOrEqual(2)
  })

  it('listByKind filters across runs', () => {
    const svc = new SedimentationService()
    svc.sediment('r1', [textDelta('r1', 'I prefer X')], [], [])
    svc.sediment('r2', [textDelta('r2', 'I prefer Y')], [], [])
    expect(svc.listByKind('preference').length).toBeGreaterThanOrEqual(2)
  })
})
