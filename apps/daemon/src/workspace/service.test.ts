import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WorkspaceService } from './service.js'
import { isWorkspaceMeta } from '@journal/contracts'
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('WorkspaceService', () => {
  let ws: string
  beforeEach(() => {
    ws = join(tmpdir(), 'ws-' + Math.random().toString(36).slice(2))
    mkdirSync(ws, { recursive: true })
  })
  afterEach(() => {
    try { rmSync(ws, { recursive: true, force: true }) } catch {}
  })

  it('getMeta returns sensible defaults when no metadata file exists', () => {
    const svc = new WorkspaceService(ws)
    const meta = svc.getMeta()
    expect(isWorkspaceMeta(meta)).toBe(true)
    expect(meta.path).toBe(ws)
    expect(meta.goals).toEqual([])
    expect(meta.activeSources).toEqual([])
  })

  it('updateMeta merges patch and persists to .journal/workspace.json', () => {
    const svc = new WorkspaceService(ws)
    const updated = svc.updateMeta({ name: 'My Project', type: 'project', goals: ['ship v1'] })
    expect(updated.name).toBe('My Project')
    expect(updated.type).toBe('project')
    expect(updated.goals).toEqual(['ship v1'])
    // persisted
    expect(existsSync(join(ws, '.journal', 'workspace.json'))).toBe(true)
    const raw = JSON.parse(readFileSync(join(ws, '.journal', 'workspace.json'), 'utf8'))
    expect(raw.name).toBe('My Project')
    // re-read returns persisted
    expect(new WorkspaceService(ws).getMeta().name).toBe('My Project')
  })

  it('addGoal appends without duplicating', () => {
    const svc = new WorkspaceService(ws)
    svc.addGoal('goal A')
    svc.addGoal('goal A')
    svc.addGoal('goal B')
    expect(svc.getMeta().goals).toEqual(['goal A', 'goal B'])
  })

  it('addActiveSource appends without duplicating', () => {
    const svc = new WorkspaceService(ws)
    svc.addActiveSource('notes/')
    svc.addActiveSource('notes/')
    svc.addActiveSource('meetings/')
    expect(svc.getMeta().activeSources).toEqual(['notes/', 'meetings/'])
  })
})
