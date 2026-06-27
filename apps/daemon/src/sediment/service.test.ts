import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SedimentationService } from './service.js'
import { isMemoryRecord } from '@journal/contracts'
import type { AgentRunEvent, Artifact, ChangeSet } from '@journal/contracts'
import { existsSync, readFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const ts = '2026-06-25T12:00:00Z'
function textDelta(runId: string, text: string): AgentRunEvent {
  return {
    type: 'text_delta',
    runId,
    sessionId: 's1',
    data: JSON.stringify({ text }),
    timestamp: ts,
  }
}
function toolCall(runId: string, name: string): AgentRunEvent {
  return {
    type: 'tool_call',
    runId,
    sessionId: 's1',
    spanId: name + Math.random(),
    data: JSON.stringify({ name, input: {} }),
    timestamp: ts,
  }
}
const art = (id: string, type = 'note'): Artifact => ({
  id,
  runId: 'r1',
  type,
  title: 'T',
  content: 'c',
  createdAt: ts,
})
const cs = (path: string): ChangeSet => ({
  id: 'cs',
  runId: 'r1',
  path,
  operation: 'edit',
  diffPreview: 'p',
  risk: 'low',
  authorizationMode: 'workspace_write',
  status: 'applied',
})

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
    const events = [
      toolCall('r1', 'Bash'),
      toolCall('r1', 'Bash'),
      toolCall('r1', 'Bash'),
      toolCall('r1', 'Read'),
    ]
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
    const res = svc.sediment(
      'r1',
      [textDelta('r1', 'done')],
      [art('art-1'), art('art-2')],
      [cs('a.md'), cs('b.md')],
    )
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

  describe('summary.md persistence', () => {
    let ws: string
    beforeEach(() => {
      ws = join(tmpdir(), 'sed-' + Math.random().toString(36).slice(2))
      mkdirSync(ws, { recursive: true })
    })
    afterEach(() => {
      try {
        rmSync(ws, { recursive: true, force: true })
      } catch {}
    })

    it('writes .journal/runs/<runId>/summary.md and sets the summary path', () => {
      const svc = new SedimentationService(ws)
      const res = svc.sediment('run-xyz', [textDelta('run-xyz', 'did things')], [], [])
      expect(res.summary.path).toBe('.journal/runs/run-xyz/summary.md')
      const file = join(ws, '.journal', 'runs', 'run-xyz', 'summary.md')
      expect(existsSync(file)).toBe(true)
      const content = readFileSync(file, 'utf8')
      expect(content).toContain('Run ')
      expect(content).toContain('run-xyz'.slice(0, 8))
    })

    it('skips the summary file when no workspaceRoot is provided', () => {
      const svc = new SedimentationService()
      const res = svc.sediment('r1', [textDelta('r1', 'x')], [], [])
      expect(res.summary.path).toBeUndefined()
    })

    it('does not write summary files for read_only runs', () => {
      const svc = new SedimentationService(ws)
      const res = svc.sediment(
        'read-only-run',
        [textDelta('read-only-run', 'observed only')],
        [],
        [],
        { authorizationMode: 'read_only' },
      )
      expect(res.summary.path).toBeUndefined()
      expect(existsSync(join(ws, '.journal', 'runs', 'read-only-run', 'summary.md'))).toBe(false)
    })
  })

  describe('record fields (status / changeSetIds / path)', () => {
    it('records carry status=auto_recorded by default', () => {
      const svc = new SedimentationService()
      const res = svc.sediment('r1', [textDelta('r1', 'I prefer X')], [], [])
      expect(res.all.every((r) => r.status === 'auto_recorded')).toBe(true)
    })

    it('summary + project_fact records carry changeSetIds from the run', () => {
      const svc = new SedimentationService()
      const changeSets = [
        { ...cs('a.md'), id: 'cs-1' },
        { ...cs('b.md'), id: 'cs-2' },
      ]
      const res = svc.sediment(
        'r1',
        [textDelta('r1', 'The project uses Rust')],
        [],
        changeSets as ChangeSet[],
      )
      const facts = res.records.filter((r) => r.kind === 'project_fact')
      expect(facts.length).toBeGreaterThan(0)
      expect(facts.every((f) => f.changeSetIds && f.changeSetIds.includes('cs-1'))).toBe(true)
      expect(res.summary.changeSetIds).toEqual(['cs-1', 'cs-2'])
    })

    it('records are MemoryRecord-shaped (isMemoryRecord)', () => {
      const svc = new SedimentationService()
      const res = svc.sediment('r1', [textDelta('r1', 'I prefer X')], [art('art-1')], [])
      expect(res.all.every(isMemoryRecord)).toBe(true)
    })
  })

  describe('review lifecycle (edit / reject / restore)', () => {
    it('editRecord revises summary/detail and sets status=edited', () => {
      const svc = new SedimentationService()
      const res = svc.sediment('r1', [textDelta('r1', 'I prefer concise')], [], [])
      const pref = res.records.find((r) => r.kind === 'preference')!
      const edited = svc.editRecord(pref.id, { summary: 'edited summary', detail: 'edited detail' })
      expect(edited?.status).toBe('edited')
      expect(edited?.summary).toBe('edited summary')
      expect(edited?.detail).toBe('edited detail')
      expect(edited?.updatedAt).toBeTruthy()
    })

    it('rejectRecord sets status=rejected and excludes from durable list', () => {
      const svc = new SedimentationService()
      const res = svc.sediment('r1', [textDelta('r1', 'I prefer concise')], [], [])
      const pref = res.records.find((r) => r.kind === 'preference')!
      const rejected = svc.rejectRecord(pref.id)
      expect(rejected?.status).toBe('rejected')
      // listDurable must NOT include the rejected record
      expect(svc.listDurable().some((r) => r.id === pref.id)).toBe(false)
      // listAll still includes it (audit view)
      expect(svc.listAll().some((r) => r.id === pref.id)).toBe(true)
    })

    it('restoreRecord brings a rejected record back into durable list', () => {
      const svc = new SedimentationService()
      const res = svc.sediment('r1', [textDelta('r1', 'I prefer concise')], [], [])
      const pref = res.records.find((r) => r.kind === 'preference')!
      svc.rejectRecord(pref.id)
      svc.restoreRecord(pref.id)
      expect(svc.listDurable().some((r) => r.id === pref.id)).toBe(true)
    })

    it('listDurable excludes run-summary notes regardless of status', () => {
      const svc = new SedimentationService()
      svc.sediment('r1', [textDelta('r1', 'I prefer X')], [], [])
      expect(svc.listDurable().every((r) => r.kind !== 'note')).toBe(true)
    })

    it('edit/reject on an unknown id returns undefined', () => {
      const svc = new SedimentationService()
      expect(svc.editRecord('nope', { summary: 'x' })).toBeUndefined()
      expect(svc.rejectRecord('nope')).toBeUndefined()
      expect(svc.restoreRecord('nope')).toBeUndefined()
      expect(svc.getRecord('nope')).toBeUndefined()
    })
  })
})
