import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fauxAssistantMessage, fauxProvider, fauxText } from '@earendil-works/pi-ai'
import { ConfigService, type EngineConfig } from '../config/service.js'
import { AgentRunService } from '../runs/service.js'
import { ConversationService } from '../conversation/service.js'
import { AutomationService } from './service.js'
import type { AutomationRoutine } from './types.js'

const HK = 'Asia/Hong_Kong'

function engineConfig(provider: string, model: string): EngineConfig {
  return {
    active_provider: provider,
    providers: [
      {
        protocol: 'openai',
        id: provider,
        label: provider,
        models: [model],
        api_key: '',
        base_url: 'http://localhost:0',
      },
    ],
  }
}

describe('AutomationService', () => {
  let dir: string
  let workspace: string
  let config: ConfigService
  let runService: AgentRunService
  let fixedNow: Date

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'journal-automation-service-'))
    workspace = join(dir, 'workspace')
    mkdirSync(workspace, { recursive: true })
    config = new ConfigService({ configDir: join(dir, 'config') })
    config.setEngineConfig(engineConfig('faux', 'faux-model'))
    runService = new AgentRunService(join(dir, 'runs'))
    fixedNow = new Date('2026-05-30T10:00:00+08:00')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  function makeService(providers: ReturnType<typeof fauxProvider>[]) {
    const conversation = new ConversationService({
      workspaceRoot: workspace,
      configService: config,
      runService,
      providers: providers.map((p) => p.provider),
      now: () => fixedNow,
    })
    return new AutomationService(workspace, {
      conversationService: () => conversation,
      providers: providers.map((p) => p.provider),
      now: () => fixedNow,
    })
  }

  function dailyRequest(title: string) {
    return {
      title,
      template_id: null,
      prompt: `prompt for ${title}`,
      schedule: { kind: 'daily' as const, time: '08:00', timezone: HK },
      scope: { kind: 'workspace' as const },
      enabled: true,
    }
  }

  describe('CRUD lifecycle', () => {
    it('create -> list -> update -> pause/resume -> delete', () => {
      const service = makeService([])

      const created = service.createRoutine(dailyRequest('每日总结'))
      expect(created.id).toMatch(/^routine_/)
      expect(created.full_agent_access).toBe(true)
      expect(service.listRoutines()).toHaveLength(1)

      const updated = service.updateRoutine(created.id, { title: '改标题' })
      expect(updated.title).toBe('改标题')
      expect(updated.updated_at).toBe(fixedNow.toISOString())

      const paused = service.pauseRoutine(created.id)
      expect(paused.enabled).toBe(false)
      const resumed = service.resumeRoutine(created.id)
      expect(resumed.enabled).toBe(true)

      service.deleteRoutine(created.id)
      expect(service.listRoutines()).toHaveLength(0)
    })

    it('rejects an invalid schedule on create', () => {
      const service = makeService([])
      expect(() =>
        service.createRoutine({
          ...dailyRequest('bad'),
          schedule: { kind: 'monthly', day: 0, time: '09:00', timezone: HK },
        }),
      ).toThrow()
    })

    it('update merges fields and keeps untouched ones', () => {
      const service = makeService([])
      const created = service.createRoutine(dailyRequest('每日总结'))
      const patched = service.updateRoutine(created.id, { prompt: '新 prompt' })
      expect(patched.prompt).toBe('新 prompt')
      expect(patched.title).toBe('每日总结')
    })
  })

  describe('run-now through the pi engine', () => {
    it('executes a routine, records a succeeded run, and updates last_run', async () => {
      const faux = fauxProvider({
        provider: 'faux',
        models: [{ id: 'faux-model', reasoning: false }],
      })
      faux.setResponses([fauxAssistantMessage([fauxText('创建了今日总结。')])])
      const service = makeService([faux])

      const created = service.createRoutine(dailyRequest('每日总结'))
      const run = await service.runNow(created.id)

      expect(run.status).toBe('succeeded')
      expect(run.conversation_id).toBeTruthy()
      expect(run.manifest?.summary).toContain('每日总结')
      expect(run.manifest?.conversation_id).toBe(run.conversation_id)

      const persisted = service.listRuns(created.id)
      expect(persisted).toHaveLength(1)
      expect(persisted[0].id).toBe(run.id)

      const routine = service.listRoutines().find((r) => r.id === created.id) as AutomationRoutine
      expect(routine.last_run?.id).toBe(run.id)
      expect(routine.last_run?.status).toBe('succeeded')
    })

    it('classifies newly-created journal entries in the manifest', async () => {
      const faux = fauxProvider({
        provider: 'faux',
        models: [{ id: 'faux-model', reasoning: false }],
      })
      faux.setResponses([fauxAssistantMessage([fauxText('done')])])
      const service = makeService([faux])

      mkdirSync(join(workspace, '2605'), { recursive: true })
      const created = service.createRoutine(dailyRequest('每日总结'))

      // The runner snapshots the workspace before and after. Create an entry
      // mid-run by intercepting the faux response to write the file first.
      faux.setResponses([
        () => {
          writeFileSync(join(workspace, '2605', '30-总结.md'), '# 总结')
          return fauxAssistantMessage([fauxText('done')])
        },
      ])

      const run = await service.runNow(created.id)
      expect(run.status).toBe('succeeded')
      expect(run.manifest?.entries_created).toContain('2605/30-总结.md')
      expect(run.manifest?.files_changed).toContain('2605/30-总结.md')
    })

    it('records a failed run that still preserves the conversation id and manifest', async () => {
      const faux = fauxProvider({
        provider: 'faux',
        models: [{ id: 'faux-model', reasoning: false }],
      })
      faux.setResponses([fauxAssistantMessage([fauxText('partial output')])])
      // Drive a runner-level failure by injecting a snapshot that throws on the
      // second call (the post-run diff). The runner catches, builds a manifest
      // from whatever it has, and the service records a failed run that keeps
      // both the conversation id and the manifest.
      let calls = 0
      const service = new AutomationService(workspace, {
        conversationService: () =>
          new ConversationService({
            workspaceRoot: workspace,
            configService: config,
            runService,
            providers: [faux.provider],
            now: () => fixedNow,
          }),
        providers: [faux.provider],
        now: () => fixedNow,
        snapshot: () => {
          calls += 1
          if (calls > 1) throw new Error('diff blew up')
          return new Map()
        },
      })

      const created = service.createRoutine(dailyRequest('每日总结'))
      const run = await service.runNow(created.id)

      expect(run.status).toBe('failed')
      expect(run.error).toContain('diff blew up')
      expect(run.conversation_id).toBeTruthy()
      expect(run.manifest).not.toBeNull()

      const routine = service.listRoutines().find((r) => r.id === created.id) as AutomationRoutine
      expect(routine.last_run?.status).toBe('failed')
    })
  })

  describe('scheduling', () => {
    it('runs due routines via runDue with controllable time', async () => {
      const faux = fauxProvider({
        provider: 'faux',
        models: [{ id: 'faux-model', reasoning: false }],
      })
      faux.setResponses([fauxAssistantMessage([fauxText('ok')])])
      const service = makeService([faux])

      // Create the routine, then backdate created_at through the store so its
      // 08:00 due time predates creation (fixedNow = 10:00 today).
      const created = service.createRoutine(dailyRequest('due'))
      const store = service.getStore()
      const routine = store.getRoutine(created.id)
      routine.created_at = '2026-05-29T08:00:00+08:00'
      store.upsertRoutine(routine)

      const runs = await service.runDue()

      expect(runs).toHaveLength(1)
      expect(runs[0].status).toBe('succeeded')
    })

    it('does not re-run a routine whose last run covers the due time', async () => {
      const faux = fauxProvider({
        provider: 'faux',
        models: [{ id: 'faux-model', reasoning: false }],
      })
      faux.setResponses([fauxAssistantMessage([fauxText('ok')])])
      const service = makeService([faux])

      const created = service.createRoutine(dailyRequest('once'))
      await service.runNow(created.id)

      const runs = await service.runDue()
      expect(runs).toHaveLength(0)
    })

    it('skips a routine that is already running', async () => {
      const faux = fauxProvider({
        provider: 'faux',
        models: [{ id: 'faux-model', reasoning: false }],
      })
      let resolveFirst!: () => void
      const gate = new Promise<void>((resolve) => {
        resolveFirst = resolve
      })
      faux.setResponses([
        async () => {
          await gate
          return fauxAssistantMessage([fauxText('done')])
        },
      ])
      const service = makeService([faux])
      const created = service.createRoutine(dailyRequest('busy'))

      const first = service.runNow(created.id)
      const second = await service.runNow(created.id)
      expect(second.status).toBe('skipped')
      expect(second.error).toContain('already running')

      resolveFirst()
      await first
    })
  })
})
