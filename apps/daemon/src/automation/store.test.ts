import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AutomationStore } from './store.js'
import type { AutomationRoutine, AutomationRun, AutomationSchedule, RunManifest } from './types.js'

const HK = 'Asia/Hong_Kong'

function routine(id: string): AutomationRoutine {
  return {
    id,
    title: '每日总结',
    template_id: 'daily-summary',
    prompt: '总结昨天',
    schedule: { kind: 'daily', time: '08:00', timezone: HK } as AutomationSchedule,
    scope: { kind: 'relative', range: 'yesterday' },
    enabled: true,
    full_agent_access: true,
    created_at: '2026-05-30T08:00:00+08:00',
    updated_at: '2026-05-30T08:00:00+08:00',
    last_run: null,
  }
}

function manifest(summary: string): RunManifest {
  return {
    summary,
    files_read: [],
    files_changed: [],
    entries_created: [],
    todos_changed: [],
    identities_changed: [],
    warnings: [],
    conversation_id: 's_1',
  }
}

describe('AutomationStore', () => {
  let dir: string
  let store: AutomationStore

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'journal-automation-store-'))
    store = new AutomationStore(dir)
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('upserts and gets a routine', () => {
    store.upsertRoutine(routine('r_1'))
    expect(store.listRoutines()).toHaveLength(1)
    expect(store.getRoutine('r_1').title).toBe('每日总结')
  })

  it('upsert replaces an existing routine in place', () => {
    store.upsertRoutine(routine('r_1'))
    const updated = routine('r_1')
    updated.title = '新的标题'
    store.upsertRoutine(updated)

    const routines = store.listRoutines()
    expect(routines).toHaveLength(1)
    expect(routines[0].title).toBe('新的标题')
  })

  it('deletes a routine but keeps its runs', () => {
    store.upsertRoutine(routine('r_1'))
    store.upsertRun({
      id: 'run_1',
      routine_id: 'r_1',
      trigger: 'manual',
      status: 'succeeded',
      started_at: '2026-05-30T08:00:00+08:00',
      completed_at: '2026-05-30T08:01:00+08:00',
      error: null,
      conversation_id: 's_1',
      manifest: manifest('完成'),
    })

    store.deleteRoutine('r_1')

    expect(store.listRoutines()).toHaveLength(0)
    expect(store.listRunsForRoutine('r_1')).toHaveLength(1)
    expect(existsSync(join(store.root, 'manifests', 'run_1.json'))).toBe(true)
  })

  it('lists runs newest-first', () => {
    store.upsertRoutine(routine('r_1'))
    const run = (id: string, startedAt: string): AutomationRun => ({
      id,
      routine_id: 'r_1',
      trigger: 'scheduled',
      status: 'succeeded',
      started_at: startedAt,
      completed_at: startedAt,
      error: null,
      conversation_id: null,
      manifest: null,
    })
    store.upsertRun(run('run_old', '2026-05-29T08:00:00+08:00'))
    store.upsertRun(run('run_new', '2026-05-30T08:00:00+08:00'))

    expect(store.listRunsForRoutine('r_1').map((r) => r.id)).toEqual(['run_new', 'run_old'])
  })

  it('persists across store instances (shares the Rust on-disk format)', () => {
    store.upsertRoutine(routine('r_1'))
    store.upsertRun({
      id: 'run_1',
      routine_id: 'r_1',
      trigger: 'manual',
      status: 'succeeded',
      started_at: '2026-05-30T08:00:00+08:00',
      completed_at: '2026-05-30T08:01:00+08:00',
      error: null,
      conversation_id: 's_1',
      manifest: manifest('完成'),
    })

    const reopened = new AutomationStore(dir)
    expect(reopened.listRoutines().map((r) => r.id)).toEqual(['r_1'])
    expect(reopened.getRun('run_1').manifest?.summary).toBe('完成')
  })

  it('rejects a path-traversal run id for the manifest file', () => {
    expect(() =>
      store.upsertRun({
        id: '../escape',
        routine_id: 'r_1',
        trigger: 'manual',
        status: 'succeeded',
        started_at: '2026-05-30T08:00:00+08:00',
        completed_at: '2026-05-30T08:01:00+08:00',
        error: null,
        conversation_id: 's_1',
        manifest: manifest('完成'),
      }),
    ).toThrow()
    expect(existsSync(join(dir, 'escape.json'))).toBe(false)
  })
})
