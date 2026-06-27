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
    const cs = svc.recordChangeSet({
      runId: 'r1',
      path: 'a',
      operation: 'create',
      mode: 'workspace_write',
      afterContent: 'a',
    })
    svc.recordChangeSet({
      runId: 'r2',
      path: 'b',
      operation: 'create',
      mode: 'workspace_write',
      afterContent: 'b',
    })
    expect(svc.getChangeSet(cs.id)?.runId).toBe('r1')
  })

  describe('authorization-before-mutation (read_only safety)', () => {
    it('read_only remove does NOT stash/mutate the file and returns a blocked record', () => {
      const note = join(ws, 'secret.md')
      writeFileSync(note, 'keep me')
      const svc = new ChangeSetService(ws)
      const cs = svc.recordChangeSet({
        runId: 'r1',
        path: 'secret.md',
        operation: 'remove',
        mode: 'read_only',
      })
      // status is blocked
      expect(cs.status).toBe('blocked')
      // the file must still be on disk — read_only must not have moved it
      expect(existsSync(note)).toBe(true)
      expect(readFileSync(note, 'utf8')).toBe('keep me')
      // no trash stash was created
      expect(cs.beforePath).toBeUndefined()
      // no .journal-trash directory was created for this op
      expect(existsSync(join(ws, '.journal-trash', cs.id))).toBe(false)
    })

    it('read_only create/edit do not touch the filesystem', () => {
      const svc = new ChangeSetService(ws)
      const create = svc.recordChangeSet({
        runId: 'r1',
        path: 'new.md',
        operation: 'create',
        mode: 'read_only',
        afterContent: 'x',
      })
      const edit = svc.recordChangeSet({
        runId: 'r1',
        path: 'new.md',
        operation: 'edit',
        mode: 'read_only',
        afterContent: 'y',
      })
      expect(create.status).toBe('blocked')
      expect(edit.status).toBe('blocked')
      // no file was created/edited on disk
      expect(existsSync(join(ws, 'new.md'))).toBe(false)
    })

    it('workspace_write remove still stashes (allowed path)', () => {
      const note = join(ws, 'gone2.md')
      writeFileSync(note, 'content')
      const svc = new ChangeSetService(ws)
      const cs = svc.recordChangeSet({
        runId: 'r1',
        path: 'gone2.md',
        operation: 'remove',
        mode: 'workspace_write',
      })
      expect(cs.status).toBe('applied')
      expect(existsSync(note)).toBe(false)
      expect(cs.beforePath).toBeTruthy()
      expect(existsSync(cs.beforePath!)).toBe(true)
    })
  })

  describe('workspace snapshot diff', () => {
    it('snapshotWorkspace hashes files, ignoring .journal / node_modules / .git', () => {
      writeFileSync(join(ws, 'a.md'), 'aaa')
      mkdirSync(join(ws, 'sub'), { recursive: true })
      writeFileSync(join(ws, 'sub', 'b.ts'), 'bbb')
      mkdirSync(join(ws, '.journal'), { recursive: true })
      writeFileSync(join(ws, '.journal', 'workspace.json'), '{}')
      const svc = new ChangeSetService(ws)
      const snap = svc.snapshotWorkspace()
      expect(snap.files.has('a.md')).toBe(true)
      expect(snap.files.has('sub/b.ts')).toBe(true)
      expect(snap.files.has('.journal/workspace.json')).toBe(false)
    })

    it('captureSnapshotDiff records create/edit/remove as ChangeSets', () => {
      writeFileSync(join(ws, 'keep.md'), 'old')
      writeFileSync(join(ws, 'edit.md'), 'v1')
      const svc = new ChangeSetService(ws)
      const before = svc.snapshotWorkspace()
      // mutate the workspace
      writeFileSync(join(ws, 'created.md'), 'new file') // create
      writeFileSync(join(ws, 'edit.md'), 'v2') // edit
      rmSync(join(ws, 'keep.md')) // remove
      const after = svc.snapshotWorkspace()
      const diff = svc.captureSnapshotDiff('r1', before, after, 'workspace_write')
      const ops = new Map(diff.map((c) => [c.operation, c]))
      expect(ops.has('create')).toBe(true)
      expect(ops.has('edit')).toBe(true)
      expect(ops.has('remove')).toBe(true)
      expect(diff.every((c) => c.status === 'applied')).toBe(true)
      expect(svc.listChangeSets('r1').length).toBe(diff.length)
    })

    it('captureSnapshotDiff under read_only records changes as blocked', () => {
      const svc = new ChangeSetService(ws)
      const before = svc.snapshotWorkspace()
      writeFileSync(join(ws, 'created.md'), 'new file')
      const after = svc.snapshotWorkspace()
      const diff = svc.captureSnapshotDiff('r1', before, after, 'read_only')
      expect(diff.length).toBeGreaterThan(0)
      expect(diff.every((c) => c.status === 'blocked')).toBe(true)
    })

    it('identical snapshots produce an empty diff', () => {
      writeFileSync(join(ws, 'same.md'), 'same')
      const svc = new ChangeSetService(ws)
      const before = svc.snapshotWorkspace()
      const after = svc.snapshotWorkspace()
      expect(svc.captureSnapshotDiff('r1', before, after, 'workspace_write')).toEqual([])
    })
  })
})
