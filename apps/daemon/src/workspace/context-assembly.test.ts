import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WorkspaceService } from './service.js'
import { SedimentationService } from '../sediment/service.js'
import { assembleContext } from '../context/assemble.js'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('workspace metadata -> context assembly', () => {
  let ws: string
  beforeEach(() => {
    ws = join(tmpdir(), 'wsctx-' + Math.random().toString(36).slice(2))
    mkdirSync(ws, { recursive: true })
  })
  afterEach(() => {
    try {
      rmSync(ws, { recursive: true, force: true })
    } catch {}
  })

  it('context assembly uses updated workspace name, goals, and active sources', () => {
    const workspaceService = new WorkspaceService(ws)
    let assembled = assembleContext('my goal', workspaceService.getMeta(), [])
    expect(assembled).not.toContain('ship v2')

    workspaceService.updateMeta({ name: 'Journal R&D', type: 'project' })
    workspaceService.addGoal('ship v2')
    workspaceService.addGoal('add memory layer')
    workspaceService.addActiveSource('stories/')
    workspaceService.addActiveSource('docs/arch.md')

    assembled = assembleContext('do the work', workspaceService.getMeta(), [])
    expect(assembled).toContain('Journal R&D')
    expect(assembled).toContain('ship v2')
    expect(assembled).toContain('add memory layer')
    expect(assembled).toContain('stories/')
    expect(assembled).toContain('docs/arch.md')
    expect(assembled).toContain('User goal: do the work')
  })

  it('context assembly uses durable sedimented memory (rejected records excluded)', () => {
    const workspaceService = new WorkspaceService(ws)
    const sedimentService = new SedimentationService(ws)
    workspaceService.addGoal('research X')

    sedimentService.sediment('r1', [], [], [])
    const events = [
      {
        type: 'text_delta',
        runId: 'r2',
        sessionId: 's',
        data: JSON.stringify({ text: 'I prefer concise summaries' }),
        timestamp: new Date().toISOString(),
      },
    ] as never
    const res = sedimentService.sediment('r2', events, [], [])
    const pref = res.records.find((r) => r.kind === 'preference')
    expect(pref).toBeTruthy()
    sedimentService.rejectRecord(pref!.id)

    const events2 = [
      {
        type: 'text_delta',
        runId: 'r3',
        sessionId: 's',
        data: JSON.stringify({ text: 'I prefer dark mode' }),
        timestamp: new Date().toISOString(),
      },
    ] as never
    sedimentService.sediment('r3', events2, [], [])

    const assembled = assembleContext(
      'work',
      workspaceService.getMeta(),
      sedimentService.listDurable(),
    )
    expect(assembled).not.toContain('concise summaries')
    expect(assembled).toContain('dark mode')
    expect(assembled).toContain('research X')
  })

  it('updated metadata persists across a fresh service instance (portability)', () => {
    const workspaceService = new WorkspaceService(ws)
    workspaceService.updateMeta({ name: 'Persisted', type: 'research' })
    workspaceService.addActiveSource('papers/')

    const restarted = new WorkspaceService(ws)
    const assembled = assembleContext('query', restarted.getMeta(), [])
    expect(assembled).toContain('Persisted')
    expect(assembled).toContain('papers/')
    expect(assembled).toContain('research')
  })
})
