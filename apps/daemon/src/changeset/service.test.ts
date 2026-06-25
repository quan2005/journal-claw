import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ChangeSetService } from './service.js'
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('ChangeSetService', () => {
  let ws: string
  beforeEach(() => {
    ws = join(tmpdir(), 'cs-' + Math.random().toString(36).slice(2))
    mkdirSync(ws, { recursive: true })
  })
  afterEach(() => {
    try {
      rmSync(ws, { recursive: true, force: true })
    } catch {}
  })

  it('records an edit with before/after hash + diffPreview', () => {
    const note = join(ws, 'note.md')
    writeFileSync(note, 'before\n')
    const svc = new ChangeSetService(ws)
    const cs = svc.recordChangeSet({
      runId: 'r1',
      path: 'note.md',
      operation: 'edit',
      mode: 'workspace_write',
      afterContent: 'before\nafter\n',
    })
    expect(cs.beforeHash).toBeTruthy()
    expect(cs.afterHash).toBeTruthy()
    expect(cs.beforeHash).not.toBe(cs.afterHash)
    expect(cs.diffPreview).toContain('edit')
    expect(cs.status).toBe('applied')
    expect(svc.listChangeSets('r1')).toHaveLength(1)
  })

  it('blocks an edit under read_only', () => {
    const svc = new ChangeSetService(ws)
    const cs = svc.recordChangeSet({
      runId: 'r1',
      path: 'x.md',
      operation: 'create',
      mode: 'read_only',
      afterContent: 'x',
    })
    expect(cs.status).toBe('blocked')
  })

  it('remove stashes the file in .journal-trash and is reversible', () => {
    const note = join(ws, 'gone.md')
    writeFileSync(note, 'content')
    const svc = new ChangeSetService(ws)
    const cs = svc.recordChangeSet({
      runId: 'r1',
      path: 'gone.md',
      operation: 'remove',
      mode: 'workspace_write',
    })
    // file moved to trash, no longer at original
    expect(existsSync(note)).toBe(false)
    expect(cs.beforePath).toBeTruthy()
    expect(existsSync(cs.beforePath!)).toBe(true)
    // revert restores it
    const reverted = svc.revertChangeSet(cs.id)
    expect(reverted?.status).toBe('reverted')
    expect(existsSync(note)).toBe(true)
    expect(readFileSync(note, 'utf8')).toBe('content')
  })

  it('getChangeSet finds across runs', () => {
    const svc = new ChangeSetService(ws)
    const cs = svc.recordChangeSet({ runId: 'r1', path: 'a', operation: 'create', mode: 'workspace_write', afterContent: 'a' })
    svc.recordChangeSet({ runId: 'r2', path: 'b', operation: 'create', mode: 'workspace_write', afterContent: 'b' })
    expect(svc.getChangeSet(cs.id)?.runId).toBe('r1')
  })
})
