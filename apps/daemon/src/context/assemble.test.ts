import { describe, it, expect } from 'vitest'
import { assembleContext } from './assemble.js'
import type { WorkspaceMeta, MemoryRecord } from '@journal/contracts'

const ws: WorkspaceMeta = {
  path: '/ws',
  name: 'Journal R&D',
  type: 'project',
  goals: ['ship agent workspace', 'add multi-agent'],
  activeSources: ['docs/', 'stories/'],
  description: 'Personal knowledge workbench',
  updatedAt: '2026-06-25T12:00:00Z',
}

const mem: MemoryRecord[] = [
  {
    id: 'm1',
    sourceRunId: 'r1',
    kind: 'preference',
    summary: 'I prefer concise writing',
    detail: 'd',
    evidence: ['e'],
    createdAt: '2026-06-25T12:00:00Z',
  },
  {
    id: 'm2',
    sourceRunId: 'r1',
    kind: 'project_fact',
    summary: 'The project uses Rust',
    detail: 'd',
    evidence: ['e'],
    createdAt: '2026-06-25T12:00:00Z',
  },
  {
    id: 'm3',
    sourceRunId: 'r1',
    kind: 'writing_rule',
    summary: 'Write in a professional tone',
    detail: 'd',
    evidence: ['e'],
    createdAt: '2026-06-25T12:00:00Z',
  },
  {
    id: 'm4',
    sourceRunId: 'r1',
    kind: 'note',
    summary: 'run summary (should be excluded)',
    detail: 'd',
    evidence: ['e'],
    createdAt: '2026-06-25T12:00:00Z',
  },
]

describe('assembleContext', () => {
  it('includes workspace name, type, goals, and active sources', () => {
    const result = assembleContext('do something', ws, [])
    expect(result).toContain('Journal R&D')
    expect(result).toContain('project')
    expect(result).toContain('ship agent workspace')
    expect(result).toContain('docs/')
  })

  it('includes durable memory (preferences, facts, rules) but not run-summary notes', () => {
    const result = assembleContext('do something', ws, mem)
    expect(result).toContain('concise writing')
    expect(result).toContain('Rust')
    expect(result).toContain('professional tone')
    expect(result).not.toContain('run summary')
  })

  it('appends the user goal after a separator', () => {
    const result = assembleContext('my goal', ws, [])
    expect(result).toContain('User goal: my goal')
    expect(result).toContain('---')
  })

  it('works with null workspace and empty memory', () => {
    const result = assembleContext('just a prompt', null, [])
    expect(result).toContain('User goal: just a prompt')
    expect(result).not.toContain('# Workspace')
  })

  it('limits memory to 20 records', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      ...mem[0],
      id: `m${i}`,
      summary: `pref ${i}`,
    }))
    const result = assembleContext('g', ws, many)
    const count = (result.match(/^\- \[preference\]/gm) || []).length
    expect(count).toBeLessThanOrEqual(20)
  })

  it('excludes rejected memory records from durable context', () => {
    const rejected: MemoryRecord = {
      ...mem[0],
      id: 'm-rej',
      summary: 'rejected preference (must NOT appear)',
      status: 'rejected',
    }
    const result = assembleContext('do something', ws, [...mem, rejected])
    expect(result).not.toContain('must NOT appear')
    // a non-rejected preference still appears
    expect(result).toContain('concise writing')
  })
})
