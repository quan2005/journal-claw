/**
 * journal daemon HTTP server
 *
 * 参照 open-design apps/daemon/src/server.ts 的 Express 形态。
 * 最小骨架：GET /health + GET /workspace + GET /events (SSE)。
 * 不依赖平台专属二进制；跨平台 Node 能力。
 */

import express from 'express'
import type { Server } from 'node:http'
import type { Provider } from '@earendil-works/pi-ai'
import { AgentRunService } from './runs/service.js'
import { listAgentDefs, getAgentDef } from './runtimes/registry.js'
import { executeRun } from './runtimes/runner.js'
import { executeBuiltinRun } from './engine/run.js'
import { assembleContext } from './context/assemble.js'
import { ChangeSetService } from './changeset/service.js'
import { ArtifactIndexService } from './artifacts/index.js'
import { SedimentationService } from './sediment/service.js'
import { SourceBindingService } from './sources/service.js'
import { WorkspaceService } from './workspace/service.js'
import { SettingsService, SettingsValidationError } from './settings/service.js'
import { ConfigService, ConfigValidationError } from './config/service.js'
import { FilesService, WorkspaceFsError } from './files/service.js'
import { JournalService } from './journal/service.js'
import { TodosService } from './todos/service.js'
import { TopicsService } from './topics/service.js'
import { IdentityService } from './identity/service.js'
import { MaterialsService } from './materials/service.js'
import { SkillsService } from './skills/service.js'
import { OnboardingService } from './onboarding/service.js'
import { PermissionsService } from './permissions/service.js'
import { AutoLintService } from './auto_lint/service.js'
import { EventLogService } from './event_log/service.js'
import { AiProcessorService } from './ai_processor/service.js'
import { WorkQueueService, buildWorkItemPrompt } from './work_queue/service.js'
import { ConversationService } from './conversation/service.js'
import { AutomationService } from './automation/service.js'
import { builtInTemplates } from './automation/templates.js'
import { LocalCrudError } from './local/service.js'
import { execFile } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { promisify } from 'node:util'
import type { AgentRunEvent, AgentRunMode } from '@journal/contracts'

const execFileAsync = promisify(execFile)

export interface DaemonOptions {
  port: number
  /**
   * 可选：注入自定义 AgentRunService（测试 / 集成场景）。
   * 默认用 JOURNAL_DAEMON_DATA_DIR 或 .journal-daemon-data（daemon cwd 下）。
   */
  runService?: AgentRunService
  configService?: ConfigService
  builtinProviders?: Provider[]
}

export interface DaemonHandle {
  url: string
  close: () => Promise<void>
}

const VALID_MODES: ReadonlySet<AgentRunMode> = new Set(['chat', 'agent', 'observe'])

function detectAgent(
  bin: string,
  versionArgs: string[],
  timeoutMs = 5000,
): Promise<{ installed: boolean; version: string | null }> {
  return new Promise((resolve) => {
    execFile(bin, versionArgs, { timeout: timeoutMs }, (err, stdout) => {
      if (err) return resolve({ installed: false, version: null })
      resolve({ installed: true, version: stdout.trim().split('\n')[0] || null })
    })
  })
}

async function detectAuth(
  bin: string,
  args: string[],
  timeoutMs = 5000,
): Promise<{ authed: boolean; authMethod?: string; apiProvider?: string }> {
  try {
    const { stdout } = await execFileAsync(bin, args, { timeout: timeoutMs })
    const parsed = JSON.parse(stdout) as Record<string, unknown>
    return {
      authed: parsed.loggedIn === true,
      authMethod: typeof parsed.authMethod === 'string' ? parsed.authMethod : undefined,
      apiProvider: typeof parsed.apiProvider === 'string' ? parsed.apiProvider : undefined,
    }
  } catch {
    return { authed: false }
  }
}

function resolveDataDir(): string {
  return process.env.JOURNAL_DAEMON_DATA_DIR ?? '.journal-daemon-data'
}

function defaultWorkspacePrompt(): string {
  return 'You are JournalClaw. Help maintain this knowledge workspace and write journal entries in Markdown/MDX.\n'
}

type AutomationScheduleLike =
  | { kind: 'daily'; time: string; timezone: string }
  | { kind: 'weekdays'; time: string; timezone: string }
  | { kind: 'weekly'; weekday: number; time: string; timezone: string }
  | { kind: 'monthly'; day: number; time: string; timezone: string }

type AutomationScopeLike =
  | { kind: 'relative'; range: string }
  | { kind: 'recent_days'; days: number }
  | { kind: 'month'; year_month: string }
  | { kind: 'tags'; tags: string[]; range?: AutomationScopeLike }
  | { kind: 'identities'; identity_ids: string[]; range?: AutomationScopeLike }
  | { kind: 'keyword'; query: string; range?: AutomationScopeLike }
  | { kind: 'workspace' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseSchedule(body: unknown): AutomationScheduleLike {
  if (!isRecord(body)) throw new Error('schedule must be an object')
  const kind = body.kind
  switch (kind) {
    case 'daily':
    case 'weekdays':
      return {
        kind,
        time: String(body.time ?? ''),
        timezone: String(body.timezone ?? ''),
      }
    case 'weekly':
      return {
        kind,
        weekday: Number(body.weekday ?? 0),
        time: String(body.time ?? ''),
        timezone: String(body.timezone ?? ''),
      }
    case 'monthly':
      return {
        kind,
        day: Number(body.day ?? 1),
        time: String(body.time ?? ''),
        timezone: String(body.timezone ?? ''),
      }
    default:
      throw new Error(`invalid schedule kind: ${String(kind)}`)
  }
}

function parseScope(body: unknown): AutomationScopeLike {
  if (!isRecord(body)) throw new Error('scope must be an object')
  const kind = body.kind
  switch (kind) {
    case 'relative':
      return { kind, range: String(body.range ?? '') }
    case 'recent_days':
      return { kind, days: Number(body.days ?? 0) }
    case 'month':
      return { kind, year_month: String(body.year_month ?? '') }
    case 'workspace':
      return { kind }
    case 'tags':
    case 'identities':
    case 'keyword': {
      if (kind === 'tags') return { kind, tags: parseStringList(body.tags), range: parseOptionalScope(body.range) }
      if (kind === 'identities')
        return {
          kind,
          identity_ids: parseStringList(body.identity_ids),
          range: parseOptionalScope(body.range),
        }
      return { kind, query: String(body.query ?? ''), range: parseOptionalScope(body.range) }
    }
    default:
      throw new Error(`invalid scope kind: ${String(kind)}`)
  }
}

function parseOptionalScope(body: unknown): AutomationScopeLike | undefined {
  return body === undefined || body === null ? undefined : parseScope(body)
}

function parseStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function parseCreateRoutineRequest(body: unknown): {
  title: string
  template_id: string | null
  prompt: string
  schedule: AutomationScheduleLike
  scope: AutomationScopeLike
  enabled: boolean
} {
  const record = isRecord(body) ? body : {}
  return {
    title: String(record.title ?? ''),
    template_id: typeof record.template_id === 'string' ? record.template_id : null,
    prompt: String(record.prompt ?? ''),
    schedule: parseSchedule(record.schedule),
    scope: parseScope(record.scope),
    enabled: record.enabled !== false,
  }
}

function parseUpdateRoutineRequest(body: unknown): {
  title?: string
  prompt?: string
  schedule?: AutomationScheduleLike
  scope?: AutomationScopeLike
  enabled?: boolean
} {
  const record = isRecord(body) ? body : {}
  const patch: {
    title?: string
    prompt?: string
    schedule?: AutomationScheduleLike
    scope?: AutomationScopeLike
    enabled?: boolean
  } = {}
  if (typeof record.title === 'string') patch.title = record.title
  if (typeof record.prompt === 'string') patch.prompt = record.prompt
  if (record.schedule !== undefined) patch.schedule = parseSchedule(record.schedule)
  if (record.scope !== undefined) patch.scope = parseScope(record.scope)
  if (typeof record.enabled === 'boolean') patch.enabled = record.enabled
  return patch
}

export function startDaemon(opts: DaemonOptions): Promise<DaemonHandle> {
  return new Promise((resolve, reject) => {
    const app = express()
    app.use(express.json({ limit: '25mb' }))

    const service = opts.runService ?? new AgentRunService(resolveDataDir())
    const changeSetService = new ChangeSetService(process.cwd())
    const artifactIndex = new ArtifactIndexService()
    const sedimentService = new SedimentationService(process.cwd())
    const sourceBindingService = new SourceBindingService()
    const workspaceService = new WorkspaceService(process.cwd())
    const configService = opts.configService ?? new ConfigService()
    const filesService = new FilesService(process.cwd(), changeSetService)
    const workspaceRoot = (): string => configService.getWorkspacePath()
    const settingsService = (): SettingsService => new SettingsService(workspaceRoot())
    const workspaceChangeSets = (): ChangeSetService => new ChangeSetService(workspaceRoot())
    const journalService = (): JournalService =>
      new JournalService(workspaceRoot(), workspaceChangeSets(), () => new Date(), {
        sampleEntryCreated: () => configService.getSampleEntryCreated(),
        setSampleEntryCreated: (created) => configService.setSampleEntryCreated(created),
      })
    const todosService = (): TodosService =>
      new TodosService(workspaceRoot(), workspaceChangeSets())
    const topicsService = (): TopicsService =>
      new TopicsService(workspaceRoot(), workspaceChangeSets())
    const identityService = (): IdentityService =>
      new IdentityService(workspaceRoot(), workspaceChangeSets())
    const materialsService = (): MaterialsService =>
      new MaterialsService(workspaceRoot(), workspaceChangeSets())
    const skillsService = (): SkillsService => new SkillsService(workspaceRoot(), settingsService())
    const onboardingService = new OnboardingService(configService)
    const permissionsService = new PermissionsService()
    const autoLintService = (): AutoLintService =>
      new AutoLintService(workspaceRoot(), settingsService())
    const eventLogService = new EventLogService()
    const namedEventSubscribers = new Map<string, Set<(payload: unknown) => void>>()
    const publishEvent = (event: string, payload: unknown): void => {
      for (const subscriber of namedEventSubscribers.get(event) ?? []) {
        try {
          subscriber(payload)
        } catch {
          // Ignore one broken SSE client.
        }
      }
    }
    const aiProcessorServices = new Map<string, AiProcessorService>()
    const workQueueServices = new Map<string, WorkQueueService>()
    const conversationServices = new Map<string, ConversationService>()
    const automationServices = new Map<string, AutomationService>()
    const aiProcessorService = (): AiProcessorService => {
      const root = workspaceRoot()
      const existing = aiProcessorServices.get(root)
      if (existing) return existing
      const created = new AiProcessorService(root, service, configService, {
        providers: opts.builtinProviders,
        changeSetService: () => workspaceChangeSets(),
        skillsService: () => skillsService(),
        events: {
          processing: (event) => publishEvent('ai-processing', event),
          log: (event) => publishEvent('ai-log', event),
          journalUpdated: (yearMonth) => {
            publishEvent('journal-updated', yearMonth)
            eventLogService.record('journal-updated', yearMonth)
          },
          todosUpdated: () => {
            publishEvent('todos-updated', null)
            eventLogService.record('todos-updated', null)
          },
        },
      })
      aiProcessorServices.set(root, created)
      return created
    }
    const workQueueService = (): WorkQueueService => {
      const root = workspaceRoot()
      const existing = workQueueServices.get(root)
      if (existing) return existing
      const created = new WorkQueueService(root, {
        async run(item, signal) {
          const prompt = buildWorkItemPrompt(root, item)
          const run = service.createRun({
            goal: prompt,
            mode: 'agent',
            agentId: 'builtin',
            authorizationMode: 'workspace_write',
          })
          const result = await executeBuiltinRun(
            service,
            configService,
            {
              runId: run.id,
              prompt,
              systemPrompt: `Workspace: ${root}`,
              workspaceRoot: root,
              authorizationMode: 'workspace_write',
            },
            {
              providers: opts.builtinProviders,
              signal,
              changeSetService: workspaceChangeSets(),
              skillsService: skillsService(),
            },
          )
          if (!result.ok) throw new Error(signal.aborted ? 'cancelled' : 'work item failed')
          return run.id
        },
      })
      created.subscribe(() => publishEvent('work-queue-updated', null))
      workQueueServices.set(root, created)
      return created
    }
    const conversationService = (): ConversationService => {
      const root = workspaceRoot()
      const existing = conversationServices.get(root)
      if (existing) return existing
      const created = new ConversationService({
        workspaceRoot: root,
        configService,
        runService: service,
        providers: opts.builtinProviders,
        changeSetService: workspaceChangeSets(),
        skillsService: skillsService(),
        publishEvent,
      })
      conversationServices.set(root, created)
      return created
    }

    const automationService = (): AutomationService => {
      const root = workspaceRoot()
      const existing = automationServices.get(root)
      if (existing) return existing
      const created = new AutomationService(root, {
        conversationService: () => conversationService(),
        providers: opts.builtinProviders,
        now: () => new Date(),
      })
      automationServices.set(root, created)
      created.start()
      return created
    }

    // Per-run AbortControllers so POST /runs/:id/cancel can actually abort the
    // running executeRun child (SIGTERM the spawned CLI), not just flip status.
    const runAbortControllers = new Map<string, { abort: () => void }>()

    app.get('/health', (_req, res) => {
      res.json({ status: 'ok', service: '@journal/daemon' })
    })

    app.get('/workspace', (_req, res) => {
      res.json({
        path: process.cwd(),
        available: true,
      })
    })

    app.get('/config/api-key', (_req, res) => {
      res.json({ key: configService.getApiKey() })
    })

    app.put('/config/api-key', (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>
      if (typeof body.key !== 'string') {
        res
          .status(400)
          .json({ error: { code: 'invalid_api_key', message: 'key must be a string' } })
        return
      }
      configService.setApiKey(body.key)
      res.status(204).end()
    })

    app.get('/config/engine', (_req, res) => {
      res.json(configService.getEngineConfig())
    })

    app.put('/config/engine', (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>
      const config = body.config ?? body
      try {
        configService.setEngineConfig(config as never)
        res.status(204).end()
      } catch (err) {
        if (err instanceof ConfigValidationError) {
          res.status(400).json({
            error: {
              code: 'invalid_engine_config',
              field: err.field,
              value: err.value,
              message: err.message,
            },
          })
          return
        }
        throw err
      }
    })

    app.get('/config/workspace-path', (_req, res) => {
      res.json({ path: configService.getWorkspacePath() })
    })

    app.put('/config/workspace-path', (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>
      if (typeof body.path !== 'string') {
        res
          .status(400)
          .json({ error: { code: 'invalid_workspace_path', message: 'path must be a string' } })
        return
      }
      configService.setWorkspacePath(body.path)
      res.status(204).end()
    })

    app.get('/config/app-version', (_req, res) => {
      res.json({ version: configService.getAppVersion() })
    })

    app.get('/config/platform-capabilities', (_req, res) => {
      res.json(configService.getPlatformCapabilities())
    })

    // GET /workspace/meta — workspace context boundary metadata (G15)
    app.get('/workspace/meta', (_req, res) => {
      res.json(workspaceService.getMeta())
    })

    // PUT /workspace/meta — update workspace metadata (partial merge)
    app.put('/workspace/meta', (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>
      const patch: Record<string, unknown> = {}
      if (typeof body.name === 'string') patch.name = body.name
      if (typeof body.type === 'string') patch.type = body.type
      if (typeof body.description === 'string') patch.description = body.description
      if (Array.isArray(body.goals)) patch.goals = body.goals.filter((g) => typeof g === 'string')
      if (Array.isArray(body.activeSources))
        patch.activeSources = body.activeSources.filter((s) => typeof s === 'string')
      res.json(workspaceService.updateMeta(patch))
    })

    // GET /settings — Rust-compatible workspace settings from <workspace>/.setting.json
    app.get('/settings', (_req, res) => {
      res.json(settingsService().load())
    })

    // PUT /settings — partial update; validates known fields and preserves unknown fields.
    app.put('/settings', (req, res) => {
      const body = (req.body ?? {}) as unknown
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        res.status(400).json({
          error: { code: 'invalid_settings_patch', message: 'settings patch must be an object' },
        })
        return
      }
      try {
        res.json(settingsService().update(body as Record<string, unknown>))
      } catch (err) {
        if (err instanceof SettingsValidationError) {
          res.status(400).json({
            error: {
              code: 'invalid_settings_value',
              field: err.field,
              value: err.value,
              message: err.message,
            },
          })
          return
        }
        throw err
      }
    })

    // ── M3: skills / onboarding / permissions / misc ───────────────
    app.get('/skills', (_req, res) => {
      try {
        res.json(skillsService().listSkills())
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.get('/skills/content', (req, res) => {
      try {
        const skillId = typeof req.query.skillId === 'string' ? req.query.skillId : ''
        res.type('text/plain').send(skillsService().getSkillContent(skillId))
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.post('/skills/open-dir', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        skillsService().openSkillsDir(String(body.scope ?? 'project'))
        res.status(204).end()
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.post('/skills/open-skill-dir', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        skillsService().openSkillDir(String(body.scope ?? 'project'), String(body.dirName ?? ''))
        res.status(204).end()
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.put('/skills/enabled', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        skillsService().setSkillEnabled(String(body.skillId ?? ''), body.enabled === true)
        res.status(204).end()
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.put('/skills/global-enabled', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        skillsService().setGlobalSkillEnabled(String(body.skillId ?? ''), body.enabled === true)
        res.status(204).end()
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.get('/onboarding/status', (_req, res) => {
      res.json(onboardingService.getStatus())
    })

    app.post('/onboarding/complete', (_req, res) => {
      onboardingService.complete()
      res.status(204).end()
    })

    app.put('/onboarding/step', (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>
      onboardingService.setStep(Number(body.step))
      res.status(204).end()
    })

    app.post('/onboarding/reset', (_req, res) => {
      onboardingService.reset()
      res.status(204).end()
    })

    app.get('/permissions', (_req, res) => {
      res.json(permissionsService.checkAppPermissions())
    })

    app.post('/permissions/request', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        res.json({ status: permissionsService.requestPermission(String(body.perm ?? '')) })
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.post('/permissions/open-privacy-settings', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        permissionsService.openPrivacySettings(String(body.pane ?? ''))
        res.status(204).end()
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.get('/auto-lint/status', (_req, res) => {
      try {
        res.json(autoLintService().getStatus())
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.post('/auto-lint/trigger', (_req, res) => {
      try {
        autoLintService().triggerLintNow()
        res.status(204).end()
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.get('/event-log/events', (req, res) => {
      const sinceSeq = Number.parseInt(String(req.query.sinceSeq ?? '0'), 10)
      res.json(eventLogService.eventsSince(Number.isFinite(sinceSeq) ? sinceSeq : 0))
    })

    const handleFsError = (res: express.Response, err: unknown): void => {
      if (err instanceof WorkspaceFsError) {
        res.status(err.status).json({
          error: { code: err.code, message: err.message, ...(err.detail ?? {}) },
        })
        return
      }
      if (err instanceof LocalCrudError) {
        res.status(err.status).json({
          error: { code: err.code, message: err.message, ...(err.detail ?? {}) },
        })
        return
      }
      res.status(500).json({
        error: {
          code: 'workspace_fs_error',
          message: err instanceof Error ? err.message : String(err),
        },
      })
    }

    // ── Journal local CRUD ────────────────────────────────────────────────
    app.get('/journal/months', (_req, res) => {
      try {
        res.json(journalService().listMonths())
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.get('/journal/entries', (req, res) => {
      try {
        const yearMonth = typeof req.query.yearMonth === 'string' ? req.query.yearMonth : ''
        const months = typeof req.query.months === 'string' ? req.query.months : ''
        if (months) {
          res.json(journalService().listByMonths(months.split(',').filter(Boolean)))
        } else if (yearMonth) {
          res.json(journalService().list(yearMonth))
        } else {
          res.json(journalService().listAll())
        }
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.get('/journal/entries/paginated', (req, res) => {
      try {
        const offset = Number.parseInt(String(req.query.offset ?? '0'), 10)
        const limit = Number.parseInt(String(req.query.limit ?? '50'), 10)
        res.json(journalService().listPaginated(offset, limit))
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.get('/journal/content', (req, res) => {
      try {
        const path = typeof req.query.path === 'string' ? req.query.path : ''
        res.type('text/plain').send(journalService().getContent(path))
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.put('/journal/content', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        if (typeof body.path !== 'string' || typeof body.content !== 'string') {
          res.status(400).json({ error: { code: 'invalid_journal_content_request' } })
          return
        }
        journalService().saveContent(body.path, body.content)
        res.status(204).end()
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.delete('/journal/entry', (req, res) => {
      try {
        const path = typeof req.query.path === 'string' ? req.query.path : ''
        journalService().delete(path)
        res.status(204).end()
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.post('/journal/sample', (_req, res) => {
      try {
        journalService().createSampleEntry()
        res.status(204).end()
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.post('/journal/sample-if-needed', (_req, res) => {
      try {
        res.json(journalService().createSampleEntryIfNeeded())
      } catch (err) {
        handleFsError(res, err)
      }
    })

    // ── Todos local CRUD ──────────────────────────────────────────────────
    app.get('/todos', (_req, res) => {
      try {
        res.json(todosService().list())
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.post('/todos', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        if (typeof body.text !== 'string') {
          res.status(400).json({ error: { code: 'invalid_todo_request' } })
          return
        }
        res.json(
          todosService().add(
            body.text,
            typeof body.due === 'string' ? body.due : null,
            typeof body.source === 'string' ? body.source : null,
            typeof body.path === 'string' ? body.path : null,
          ),
        )
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.post('/todos/toggle', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        todosService().toggle(Number(body.lineIndex), body.checked === true, body.doneFile === true)
        res.status(204).end()
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.delete('/todos', (req, res) => {
      try {
        todosService().delete(Number(req.query.lineIndex), req.query.doneFile === 'true')
        res.status(204).end()
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.put('/todos/due', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        todosService().setDue(
          Number(body.lineIndex),
          typeof body.due === 'string' ? body.due : null,
          body.doneFile === true,
        )
        res.status(204).end()
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.put('/todos/path', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        todosService().setPath(
          Number(body.lineIndex),
          typeof body.path === 'string' ? body.path : null,
          body.doneFile === true,
        )
        res.status(204).end()
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.delete('/todos/path', (req, res) => {
      try {
        todosService().removePath(Number(req.query.lineIndex), req.query.doneFile === 'true')
        res.status(204).end()
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.put('/todos/session', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        todosService().setSessionId(
          Number(body.lineIndex),
          typeof body.sessionId === 'string' ? body.sessionId : null,
          body.doneFile === true,
        )
        res.status(204).end()
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.put('/todos/text', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        if (typeof body.text !== 'string') {
          res.status(400).json({ error: { code: 'invalid_todo_text_request' } })
          return
        }
        todosService().updateText(Number(body.lineIndex), body.text, body.doneFile === true)
        res.status(204).end()
      } catch (err) {
        handleFsError(res, err)
      }
    })

    // ── Topics local CRUD ─────────────────────────────────────────────────
    app.get('/topics', (req, res) => {
      try {
        res.json(
          topicsService().listDir(
            typeof req.query.relativePath === 'string' ? req.query.relativePath : '',
          ),
        )
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.post('/topics', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        if (typeof body.name !== 'string') {
          res.status(400).json({ error: { code: 'invalid_topic_request' } })
          return
        }
        topicsService().create(
          body.name,
          typeof body.parentPath === 'string' ? body.parentPath : null,
        )
        res.status(204).end()
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.delete('/topics', (req, res) => {
      try {
        topicsService().delete(
          typeof req.query.relativePath === 'string' ? req.query.relativePath : '',
        )
        res.status(204).end()
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.post('/topics/import', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        if (typeof body.source !== 'string' || typeof body.topicPath !== 'string') {
          res.status(400).json({ error: { code: 'invalid_topic_import_request' } })
          return
        }
        res.json(topicsService().importFile(body.source, body.topicPath))
      } catch (err) {
        handleFsError(res, err)
      }
    })

    // ── Identity local CRUD ───────────────────────────────────────────────
    app.get('/identity', (_req, res) => {
      try {
        res.json(identityService().list())
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.get('/identity/content', (req, res) => {
      try {
        res
          .type('text/plain')
          .send(
            identityService().getContent(typeof req.query.path === 'string' ? req.query.path : ''),
          )
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.put('/identity/content', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        if (typeof body.path !== 'string' || typeof body.content !== 'string') {
          res.status(400).json({ error: { code: 'invalid_identity_content_request' } })
          return
        }
        identityService().saveContent(body.path, body.content)
        res.status(204).end()
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.delete('/identity', (req, res) => {
      try {
        identityService().delete(typeof req.query.path === 'string' ? req.query.path : '')
        res.status(204).end()
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.post('/identity/archive', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        identityService().archive(typeof body.path === 'string' ? body.path : '')
        res.status(204).end()
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.post('/identity/unarchive', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        identityService().unarchive(typeof body.path === 'string' ? body.path : '')
        res.status(204).end()
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.post('/identity', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        res.json(
          identityService().create(
            String(body.region ?? ''),
            String(body.name ?? ''),
            String(body.summary ?? ''),
            Array.isArray(body.tags)
              ? body.tags.filter((tag): tag is string => typeof tag === 'string')
              : [],
            String(body.speakerId ?? ''),
          ),
        )
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.post('/identity/merge', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        identityService().merge(
          String(body.sourcePath ?? ''),
          String(body.targetPath ?? ''),
          body.mode === 'full' ? 'full' : 'voice_only',
        )
        res.status(204).end()
      } catch (err) {
        handleFsError(res, err)
      }
    })

    // ── Materials local CRUD ──────────────────────────────────────────────
    app.post('/materials/import-file', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        if (typeof body.srcPath !== 'string') {
          res.status(400).json({ error: { code: 'invalid_material_import_request' } })
          return
        }
        res.json(materialsService().importFile(body.srcPath))
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.post('/materials/import-text', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        res.json(materialsService().importText(String(body.text ?? '')))
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.post('/materials/import-text-temp', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        res.json(materialsService().importTextTemp(String(body.text ?? '')))
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.post('/materials/import-image-temp', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        res.json(
          materialsService().importImageTemp(
            String(body.data ?? ''),
            String(body.mediaType ?? 'image/png'),
          ),
        )
      } catch (err) {
        handleFsError(res, err)
      }
    })

    // GET /files — Rust-compatible workspace directory listing.
    app.get('/files', (req, res) => {
      try {
        const relativePath =
          typeof req.query.relativePath === 'string' ? req.query.relativePath : ''
        res.json(filesService.listWorkspaceDir(relativePath))
      } catch (err) {
        handleFsError(res, err)
      }
    })

    // GET /files/at-mention-candidates — file/expert mention candidates.
    app.get('/files/at-mention-candidates', (req, res) => {
      try {
        const relativePath =
          typeof req.query.relativePath === 'string' ? req.query.relativePath : ''
        const query = typeof req.query.query === 'string' ? req.query.query : ''
        res.json(filesService.listAtMentionCandidates(relativePath, query))
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.post('/files/import', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        const kind = typeof body.kind === 'string' ? body.kind : 'file'
        if (kind === 'file' && typeof body.srcPath === 'string') {
          res.json(materialsService().importFile(body.srcPath))
          return
        }
        if (kind === 'text' && typeof body.text === 'string') {
          res.json(materialsService().importText(body.text))
          return
        }
        if (kind === 'text_temp' && typeof body.text === 'string') {
          res.json(materialsService().importTextTemp(body.text))
          return
        }
        if (
          kind === 'image_temp' &&
          typeof body.data === 'string' &&
          typeof body.mediaType === 'string'
        ) {
          res.json(materialsService().importImageTemp(body.data, body.mediaType))
          return
        }
        res.status(400).json({
          error: { code: 'invalid_import_request', message: 'invalid import request' },
        })
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.post('/files/duplicate', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        if (typeof body.relativePath !== 'string') {
          res
            .status(400)
            .json({ error: { code: 'invalid_path', message: 'relativePath is required' } })
          return
        }
        res.json(filesService.duplicate(body.relativePath).result)
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.post('/files/rename', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        if (typeof body.relativePath !== 'string' || typeof body.newName !== 'string') {
          res.status(400).json({
            error: {
              code: 'invalid_rename_request',
              message: 'relativePath and newName are required',
            },
          })
          return
        }
        res.json(filesService.rename(body.relativePath, body.newName).result)
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.post('/files/move', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        if (typeof body.relativePath !== 'string' || typeof body.destDir !== 'string') {
          res.status(400).json({
            error: {
              code: 'invalid_move_request',
              message: 'relativePath and destDir are required',
            },
          })
          return
        }
        res.json(filesService.move(body.relativePath, body.destDir).result)
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.delete('/files', (req, res) => {
      try {
        const relativePath =
          typeof req.query.relativePath === 'string'
            ? req.query.relativePath
            : typeof (req.body as Record<string, unknown> | undefined)?.relativePath === 'string'
              ? ((req.body as Record<string, unknown>).relativePath as string)
              : ''
        if (!relativePath) {
          res
            .status(400)
            .json({ error: { code: 'invalid_path', message: 'relativePath is required' } })
          return
        }
        filesService.delete(relativePath)
        res.status(204).end()
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.post('/files/delete', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        if (typeof body.relativePath !== 'string') {
          res
            .status(400)
            .json({ error: { code: 'invalid_path', message: 'relativePath is required' } })
          return
        }
        filesService.delete(body.relativePath)
        res.status(204).end()
      } catch (err) {
        handleFsError(res, err)
      }
    })

    // POST /workspace/goals — add a goal
    app.post('/workspace/goals', (req, res) => {
      const goal = (req.body ?? {}) as { goal?: unknown }
      if (typeof goal.goal !== 'string' || !goal.goal.trim()) {
        res.status(400).json({ error: 'goal is required' })
        return
      }
      res.json(workspaceService.addGoal(goal.goal))
    })

    // POST /workspace/sources — mark a file as an active source
    app.post('/workspace/sources', (req, res) => {
      const body = (req.body ?? {}) as { source?: unknown }
      if (typeof body.source !== 'string' || !body.source.trim()) {
        res.status(400).json({ error: 'source is required' })
        return
      }
      res.json(workspaceService.addActiveSource(body.source))
    })

    // SSE event stream — 推送 mock 心跳事件，验证通道可用
    app.get('/events', (req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
      res.write(
        `data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`,
      )

      const interval = setInterval(() => {
        res.write(
          `data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`,
        )
      }, 5000)

      req.on('close', () => {
        clearInterval(interval)
      })
    })

    app.get('/events/:event', (req, res) => {
      const eventName = req.params.event
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
      res.write(
        `data: ${JSON.stringify({ type: 'subscribed', event: eventName, timestamp: new Date().toISOString() })}\n\n`,
      )
      const subscriber = (payload: unknown): void => {
        res.write(`data: ${JSON.stringify(payload)}\n\n`)
      }
      const set = namedEventSubscribers.get(eventName) ?? new Set<(payload: unknown) => void>()
      set.add(subscriber)
      namedEventSubscribers.set(eventName, set)
      req.on('close', () => {
        set.delete(subscriber)
        if (set.size === 0) namedEventSubscribers.delete(eventName)
      })
    })

    app.post('/ai-processing/trigger', async (req, res, next) => {
      const body = (req.body ?? {}) as Record<string, unknown>
      if (typeof body.materialPath !== 'string' || typeof body.yearMonth !== 'string') {
        res.status(400).json({ error: 'materialPath and yearMonth are required' })
        return
      }
      try {
        await aiProcessorService().trigger({
          materialPath: body.materialPath,
          yearMonth: body.yearMonth,
          note: typeof body.note === 'string' ? body.note : null,
        })
        res.status(204).end()
      } catch (err) {
        next(err)
      }
    })

    app.post('/ai-processing/prompt', async (req, res, next) => {
      const body = (req.body ?? {}) as Record<string, unknown>
      if (typeof body.prompt !== 'string') {
        res.status(400).json({ error: 'prompt is required' })
        return
      }
      try {
        await aiProcessorService().triggerPrompt(body.prompt)
        res.status(204).end()
      } catch (err) {
        next(err)
      }
    })

    app.post('/ai-processing/cancel', (_req, res) => {
      aiProcessorService().cancel()
      res.status(204).end()
    })

    app.post('/ai-processing/cancel-queued', (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>
      if (typeof body.materialPath !== 'string') {
        res.status(400).json({ error: 'materialPath is required' })
        return
      }
      aiProcessorService().cancelQueued(body.materialPath)
      res.status(204).end()
    })

    app.get('/ai-processing/workspace-prompt', (_req, res) => {
      const promptPath = `${workspaceRoot()}/CLAUDE.md`
      res
        .type('text/plain')
        .send(existsSync(promptPath) ? readFileSync(promptPath, 'utf8') : defaultWorkspacePrompt())
    })

    app.put('/ai-processing/workspace-prompt', (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>
      if (typeof body.content !== 'string') {
        res.status(400).json({ error: 'content is required' })
        return
      }
      writeFileSync(`${workspaceRoot()}/CLAUDE.md`, body.content, 'utf8')
      res.status(204).end()
    })

    app.post('/ai-processing/workspace-prompt/reset', (_req, res) => {
      const content = defaultWorkspacePrompt()
      writeFileSync(`${workspaceRoot()}/CLAUDE.md`, content, 'utf8')
      res.type('text/plain').send(content)
    })

    app.get('/work-queue', (_req, res) => {
      res.json(workQueueService().list())
    })

    app.post('/work-queue', (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>
      if (typeof body.displayName !== 'string') {
        res.status(400).json({ error: 'displayName is required' })
        return
      }
      const files = Array.isArray(body.files)
        ? body.files.filter((file): file is string => typeof file === 'string')
        : null
      res.status(201).json(
        workQueueService().enqueue({
          text: typeof body.text === 'string' ? body.text : null,
          files,
          prompt: typeof body.prompt === 'string' ? body.prompt : null,
          displayName: body.displayName,
        }),
      )
    })

    // ── Conversation session layer (M5) ───────────────────────────────────
    app.post('/conversation/create', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        const context = typeof body.context === 'string' ? body.context : null
        const contextFiles = Array.isArray(body.contextFiles)
          ? body.contextFiles.filter((file): file is string => typeof file === 'string')
          : null
        res.json(conversationService().create(context, contextFiles))
      } catch (err) {
        handleConversationError(res, err)
      }
    })

    app.post('/conversation/send', async (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        if (typeof body.sessionId !== 'string' || typeof body.message !== 'string') {
          res.status(400).json({ error: { code: 'invalid_conversation_send' } })
          return
        }
        const images = Array.isArray(body.images) ? body.images : null
        await conversationService().send(
          body.sessionId,
          body.message,
          images?.filter(
            (image): image is { media_type: string; data: string } =>
              typeof image === 'object' &&
              image !== null &&
              typeof (image as Record<string, unknown>).media_type === 'string' &&
              typeof (image as Record<string, unknown>).data === 'string',
          ) ?? null,
        )
        res.status(204).end()
      } catch (err) {
        handleConversationError(res, err)
      }
    })

    app.post('/conversation/cancel', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        conversationService().cancel(String(body.sessionId ?? ''))
        res.status(204).end()
      } catch (err) {
        handleConversationError(res, err)
      }
    })

    app.post('/conversation/close', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        conversationService().close(String(body.sessionId ?? ''))
        res.status(204).end()
      } catch (err) {
        handleConversationError(res, err)
      }
    })

    app.post('/conversation/inject', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        conversationService().inject(String(body.sessionId ?? ''), String(body.message ?? ''))
        res.status(204).end()
      } catch (err) {
        handleConversationError(res, err)
      }
    })

    app.post('/conversation/truncate', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        conversationService().truncate(String(body.sessionId ?? ''), Number(body.keepCount ?? 0))
        res.status(204).end()
      } catch (err) {
        handleConversationError(res, err)
      }
    })

    app.post('/conversation/retry', async (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        await conversationService().retry(String(body.sessionId ?? ''))
        res.status(204).end()
      } catch (err) {
        handleConversationError(res, err)
      }
    })

    app.get('/conversation/list', (_req, res) => {
      try {
        res.json(conversationService().list())
      } catch (err) {
        handleConversationError(res, err)
      }
    })

    app.post('/conversation/rename', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        conversationService().rename(String(body.sessionId ?? ''), String(body.title ?? ''))
        res.status(204).end()
      } catch (err) {
        handleConversationError(res, err)
      }
    })

    app.post('/conversation/delete', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        conversationService().delete(String(body.sessionId ?? ''))
        res.status(204).end()
      } catch (err) {
        handleConversationError(res, err)
      }
    })

    app.get('/conversation/load', (req, res) => {
      try {
        res.json(conversationService().load(String(req.query.sessionId ?? '')))
      } catch (err) {
        handleConversationError(res, err)
      }
    })

    app.get('/conversation/messages', (req, res) => {
      try {
        res.json(conversationService().getMessages(String(req.query.sessionId ?? '')))
      } catch (err) {
        handleConversationError(res, err)
      }
    })

    app.get('/conversation/stats', (req, res) => {
      try {
        res.json(conversationService().getStats(String(req.query.sessionId ?? '')))
      } catch (err) {
        handleConversationError(res, err)
      }
    })

    const handleConversationError = (res: express.Response, err: unknown): void => {
      const message = err instanceof Error ? err.message : String(err)
      const status = message.includes('not found') || message.includes('failed to read') ? 404 : 400
      res.status(status).json({ error: { code: 'conversation_error', message } })
    }

    // ── Automation / routines layer (M6) ──────────────────────────────────
    const handleAutomationError = (res: express.Response, err: unknown): void => {
      const message = err instanceof Error ? err.message : String(err)
      const status = message.includes('not found') ? 404 : 400
      res.status(status).json({ error: { code: 'automation_error', message } })
    }

    app.get('/automation/templates', (_req, res) => {
      res.json(builtInTemplates())
    })

    app.get('/automation/routines', (_req, res) => {
      res.json(automationService().listRoutines())
    })

    app.post('/automation/routines', (req, res) => {
      try {
        const request = parseCreateRoutineRequest(req.body)
        res.status(201).json(automationService().createRoutine(request))
      } catch (err) {
        handleAutomationError(res, err)
      }
    })

    app.patch('/automation/routines/:id', (req, res) => {
      try {
        const patch = parseUpdateRoutineRequest(req.body)
        res.json(automationService().updateRoutine(req.params.id, patch))
      } catch (err) {
        handleAutomationError(res, err)
      }
    })

    app.delete('/automation/routines/:id', (req, res) => {
      try {
        automationService().deleteRoutine(req.params.id)
        res.status(204).end()
      } catch (err) {
        handleAutomationError(res, err)
      }
    })

    app.post('/automation/routines/:id/pause', (req, res) => {
      try {
        res.json(automationService().pauseRoutine(req.params.id))
      } catch (err) {
        handleAutomationError(res, err)
      }
    })

    app.post('/automation/routines/:id/resume', (req, res) => {
      try {
        res.json(automationService().resumeRoutine(req.params.id))
      } catch (err) {
        handleAutomationError(res, err)
      }
    })

    app.post('/automation/routines/:id/run', async (req, res) => {
      try {
        const run = await automationService().runNow(req.params.id)
        res.status(201).json(run)
      } catch (err) {
        handleAutomationError(res, err)
      }
    })

    app.get('/automation/routines/:id/runs', (req, res) => {
      try {
        res.json(automationService().listRuns(req.params.id))
      } catch (err) {
        handleAutomationError(res, err)
      }
    })

    app.get('/automation/runs/:id', (req, res) => {
      try {
        res.json(automationService().getRun(req.params.id))
      } catch (err) {
        handleAutomationError(res, err)
      }
    })

    app.post('/work-queue/:id/cancel', (req, res) => {
      try {
        workQueueService().cancel(req.params.id)
        res.status(204).end()
      } catch (err) {
        res.status(404).json({ error: err instanceof Error ? err.message : String(err) })
      }
    })

    app.post('/work-queue/:id/retry', (req, res) => {
      try {
        workQueueService().retry(req.params.id)
        res.status(204).end()
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
      }
    })

    app.delete('/work-queue/:id', (req, res) => {
      workQueueService().dismiss(req.params.id)
      res.status(204).end()
    })

    // ── AgentRun routes ──────────────────────────────────────────────────────
    // POST /runs — 创建一个 run，返回 { id, status: 'queued', ... }
    app.post('/runs', (req, res) => {
      const body = (req.body ?? {}) as {
        goal?: unknown
        mode?: unknown
        agentId?: unknown
        prompt?: unknown
        model?: unknown
        engine?: unknown
        authorizationMode?: unknown
      }
      const goal = typeof body.goal === 'string' ? body.goal : ''
      const mode = typeof body.mode === 'string' ? (body.mode as AgentRunMode) : 'agent'
      if (!goal.trim()) {
        res.status(400).json({ error: 'goal is required' })
        return
      }
      if (!VALID_MODES.has(mode)) {
        res.status(400).json({ error: `invalid mode: ${String(body.mode)}` })
        return
      }
      const engine = body.engine === 'builtin' ? 'builtin' : 'cli'
      const agentId =
        engine === 'builtin'
          ? 'builtin'
          : typeof body.agentId === 'string' && body.agentId
            ? body.agentId
            : 'claude'
      const def = engine === 'cli' ? getAgentDef(agentId) : undefined
      if (engine === 'cli' && !def) {
        res.status(400).json({ error: `unknown agent: ${agentId}` })
        return
      }
      const VALID_AUTH_MODES = new Set([
        'wide_with_audit',
        'read_only',
        'workspace_write',
        'full_access',
      ])
      const authorizationMode = VALID_AUTH_MODES.has(body.authorizationMode as string)
        ? (body.authorizationMode as
            | 'wide_with_audit'
            | 'read_only'
            | 'workspace_write'
            | 'full_access')
        : 'workspace_write'
      const run = service.createRun({ goal, mode, agentId, authorizationMode })
      res.status(201).json(run)
      // Fire-and-forget: spawn the agent and stream its events into the run.
      // The promise must never reject — an unhandled rejection would crash the
      // daemon. executeRun already records run_failed on its known failure
      // paths; this catch is a belt-and-suspenders guard for anything thrown
      // synchronously before the inner Promise is constructed.
      const prompt = typeof body.prompt === 'string' ? body.prompt : goal
      const model = typeof body.model === 'string' && body.model ? body.model : null
      // G15+G14: assemble context before execution — the core loop's
      // "Agent 组装上下文" step. Wraps the user's goal with workspace
      // metadata (goals, active sources) and sedimented memory (preferences,
      // facts, rules) so the Agent starts with the workspace's accumulated
      // state.
      const assembledPrompt = assembleContext(
        prompt,
        workspaceService.getMeta(),
        sedimentService.listDurable(),
      )
      // Snapshot the workspace BEFORE the run so its real file changes can be
      // captured as ChangeSets after it finishes (no CLI internals intercepted).
      // Under read_only the CLI cannot write, so the diff is naturally empty.
      const runChangeSetService = engine === 'builtin' ? workspaceChangeSets() : changeSetService
      const beforeSnapshot = runChangeSetService.snapshotWorkspace()
      // Register an AbortController for this run so cancel can SIGTERM the
      // spawned child instead of merely flipping status.
      const abortController = new AbortController()
      runAbortControllers.set(run.id, abortController)
      const execution =
        engine === 'builtin'
          ? executeBuiltinRun(
              service,
              configService,
              {
                runId: run.id,
                prompt,
                systemPrompt: assembledPrompt,
                workspaceRoot: workspaceRoot(),
                authorizationMode,
              },
              {
                signal: abortController.signal,
                changeSetService: runChangeSetService,
                skillsService: skillsService(),
              },
            )
          : executeRun(
              service,
              { runId: run.id, agentId, prompt: assembledPrompt, model, authorizationMode },
              { signal: abortController.signal },
            )
      execution
        .then((result) => {
          runAbortControllers.delete(run.id)
          // Capture real filesystem changes the Agent performed (create/edit/
          // remove) by diffing the post-run snapshot against the pre-run one.
          // This is the feasible capture path that does not intercept CLI
          // internals. Existing explicit ChangeSets are preserved.
          const afterSnapshot = runChangeSetService.snapshotWorkspace()
          runChangeSetService.captureSnapshotDiff(
            run.id,
            beforeSnapshot,
            afterSnapshot,
            authorizationMode,
          )
          // G14 auto-sedimentation: when a run succeeds, capture its artifacts
          // and derive durable memory (summary + preferences/facts/rules),
          // completing the core loop's final step. Each record is traceable
          // to this run.
          if (!result.ok) return
          const events = service.readEvents(run.id)
          const assistantText = events
            .filter((e) => e.type === 'text_delta')
            .map((e) => {
              try {
                return (JSON.parse(e.data) as { text?: string }).text ?? ''
              } catch {
                return ''
              }
            })
            .join('')
          service.appendEvent(run.id, {
            type: 'sedimentation_started',
            runId: run.id,
            sessionId: run.sessionId,
            data: JSON.stringify({ message: 'sedimenting run' }),
            timestamp: new Date().toISOString(),
          })
          const artifacts = artifactIndex.captureFromRun(run.id, assistantText)
          // G6: capture which local files the Run used as evidence (Sources),
          // inferred from its file-touching tool calls.
          const sourceBindings = sourceBindingService.captureFromRun(run.id, events)
          const changeSets = runChangeSetService.listChangeSets(run.id)
          const sed = sedimentService.sediment(run.id, events, artifacts, changeSets, {
            authorizationMode,
          })
          service.appendEvent(run.id, {
            type: 'sedimentation_recorded',
            runId: run.id,
            sessionId: run.sessionId,
            data: JSON.stringify({
              memoryCount: sed.all.length,
              artifactCount: artifacts.length,
              sourceCount: sourceBindings.length,
            }),
            timestamp: new Date().toISOString(),
          })
        })
        .catch((err) => {
          runAbortControllers.delete(run.id)
          service.appendEvent(run.id, {
            type: 'run_failed',
            runId: run.id,
            sessionId: run.sessionId,
            data: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
            timestamp: new Date().toISOString(),
          })
        })
    })

    // GET /agents — list registered adapters with installed/authed status.
    app.get('/agents', async (_req, res) => {
      const defs = listAgentDefs()
      const out = await Promise.all(
        defs.map(async (d) => {
          const det = await detectAgent(d.bin, d.version.args, d.version.timeoutMs)
          const auth =
            det.installed && d.authProbe
              ? await detectAuth(d.bin, d.authProbe.args, d.authProbe.timeoutMs)
              : { authed: false }
          return {
            id: d.id,
            name: d.name,
            bin: d.bin,
            streamFormat: d.streamFormat,
            installed: det.installed,
            version: det.version,
            authed: auth.authed,
            authMethod: auth.authMethod ?? null,
            apiProvider: auth.apiProvider ?? null,
          }
        }),
      )
      res.json({ agents: out })
    })

    // GET /runs/:id/events — SSE：先回放已有事件，再推送后续新增事件
    app.get('/runs/:id/events', (req, res) => {
      const runId = req.params.id
      if (!service.hasRun(runId)) {
        res.status(404).json({ error: 'run not found' })
        return
      }
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })

      const writeEvent = (event: AgentRunEvent): void => {
        res.write(`data: ${JSON.stringify(event)}\n\n`)
      }

      // 先发送一个 sentinel，让客户端确认连接已建立
      res.write(`data: ${JSON.stringify({ type: 'subscribed', runId })}\n\n`)

      const unsubscribe = service.subscribe(runId, writeEvent)
      req.on('close', () => {
        unsubscribe()
      })
    })

    // POST /runs/:id/cancel — 取消 run，状态 → canceled
    app.post('/runs/:id/cancel', (req, res) => {
      const runId = req.params.id
      const run = service.cancelRun(runId)
      if (!run) {
        res.status(404).json({ error: 'run not found' })
        return
      }
      // Actually abort the running executeRun child: aborting the controller
      // SIGTERMs the spawned CLI (see runner.ts), rather than only marking the
      // status. A missing/already-aborted controller is a harmless no-op.
      const controller = runAbortControllers.get(runId)
      if (controller) {
        try {
          controller.abort()
        } catch {
          // ignore — abort is best-effort
        }
        runAbortControllers.delete(runId)
      }
      res.json(run)
    })

    // GET /runs/:id/changesets — list the recorded file changes for a run
    app.get('/runs/:id/changesets', (req, res) => {
      res.json({ changeSets: changeSetService.listChangeSets(req.params.id) })
    })

    // GET /runs/:id/artifacts — list the artifacts produced by a run
    app.get('/runs/:id/artifacts', (req, res) => {
      res.json({ artifacts: artifactIndex.listByRun(req.params.id) })
    })

    // GET /artifacts — list all indexed artifacts (optionally ?type=)
    app.get('/artifacts', (req, res) => {
      const type = typeof req.query.type === 'string' ? req.query.type : null
      res.json({ artifacts: type ? artifactIndex.listByType(type) : artifactIndex.listAll() })
    })

    // GET /runs/:id/memory — sedimented memory records for a run
    app.get('/runs/:id/memory', (req, res) => {
      res.json({ memory: sedimentService.listByRun(req.params.id) })
    })

    // GET /memory — all sedimented memory (optionally ?kind=)
    app.get('/memory', (req, res) => {
      const kind = typeof req.query.kind === 'string' ? req.query.kind : null
      const onlyDurable = req.query.durable === '1' || req.query.durable === 'true'
      if (onlyDurable) {
        res.json({ memory: sedimentService.listDurable() })
        return
      }
      res.json({
        memory: kind ? sedimentService.listByKind(kind as never) : sedimentService.listAll(),
      })
    })

    // ── sedimentation review lifecycle (G14 auditability) ───────────────────
    // The user can audit what the Agent "learned": edit a record's wording,
    // reject one that is wrong, or restore a rejected record. Rejected records
    // are excluded from durable context assembly (see assembleContext).

    // GET /memory/:id — fetch a single memory record
    app.get('/memory/:id', (req, res) => {
      const rec = sedimentService.getRecord(req.params.id)
      if (!rec) {
        res.status(404).json({ error: 'memory record not found' })
        return
      }
      res.json({ memory: rec })
    })

    // PATCH /memory/:id — edit summary/detail (status -> 'edited')
    app.patch('/memory/:id', (req, res) => {
      const body = (req.body ?? {}) as { summary?: unknown; detail?: unknown }
      const patch: { summary?: string; detail?: string } = {}
      if (typeof body.summary === 'string') patch.summary = body.summary
      if (typeof body.detail === 'string') patch.detail = body.detail
      const rec = sedimentService.editRecord(req.params.id, patch)
      if (!rec) {
        res.status(404).json({ error: 'memory record not found' })
        return
      }
      res.json({ memory: rec })
    })

    // POST /memory/:id/reject — reject a record (excluded from durable context)
    app.post('/memory/:id/reject', (req, res) => {
      const rec = sedimentService.rejectRecord(req.params.id)
      if (!rec) {
        res.status(404).json({ error: 'memory record not found' })
        return
      }
      res.json({ memory: rec })
    })

    // POST /memory/:id/restore — restore a rejected/edited record
    app.post('/memory/:id/restore', (req, res) => {
      const rec = sedimentService.restoreRecord(req.params.id)
      if (!rec) {
        res.status(404).json({ error: 'memory record not found' })
        return
      }
      res.json({ memory: rec })
    })

    // POST /runs/:id/changesets/:csId/revert — rollback a file change (restore stashed original)
    app.post('/runs/:id/changesets/:csId/revert', (req, res) => {
      const cs = changeSetService.getChangeSet(req.params.csId)
      if (!cs || cs.runId !== req.params.id) {
        res.status(404).json({ error: 'change set not found' })
        return
      }
      const reverted = changeSetService.revertChangeSet(req.params.csId)
      res.json({ changeSet: reverted })
    })

    // GET /runs/:id/sources — source bindings (which files the run used)
    app.get('/runs/:id/sources', (req, res) => {
      res.json({ sources: sourceBindingService.listByRun(req.params.id) })
    })

    // GET /runs/:id/subtasks — list child runs (multi-agent delegation)
    app.get('/runs/:id/subtasks', (req, res) => {
      res.json({ subtasks: service.listChildRuns(req.params.id) })
    })

    // POST /runs/:id/subtasks — spawn a child run (Agent Team delegation)
    app.post('/runs/:id/subtasks', (req, res) => {
      const parentId = req.params.id
      if (!service.hasRun(parentId)) {
        res.status(404).json({ error: 'parent run not found' })
        return
      }
      const body = (req.body ?? {}) as { goal?: unknown; agentId?: unknown; prompt?: unknown }
      const goal = typeof body.goal === 'string' ? body.goal : ''
      if (!goal.trim()) {
        res.status(400).json({ error: 'goal is required' })
        return
      }
      const agentId = typeof body.agentId === 'string' && body.agentId ? body.agentId : 'claude'
      const def = getAgentDef(agentId)
      if (!def) {
        res.status(400).json({ error: `unknown agent: ${agentId}` })
        return
      }
      const childRun = service.createRun({ goal, mode: 'agent', agentId, parentRunId: parentId })
      res.status(201).json(childRun)
      const prompt = typeof body.prompt === 'string' ? body.prompt : goal
      const childAbort = new AbortController()
      runAbortControllers.set(childRun.id, childAbort)
      executeRun(service, { runId: childRun.id, agentId, prompt }, { signal: childAbort.signal })
        .then((result) => {
          runAbortControllers.delete(childRun.id)
          if (!result.ok) return
          const events = service.readEvents(childRun.id)
          const assistantText = events
            .filter((e) => e.type === 'text_delta')
            .map((e) => {
              try {
                return (JSON.parse(e.data) as { text?: string }).text ?? ''
              } catch {
                return ''
              }
            })
            .join('')
          artifactIndex.captureFromRun(childRun.id, assistantText)
          const changeSets = changeSetService.listChangeSets(childRun.id)
          sedimentService.sediment(childRun.id, events, [], changeSets, {
            authorizationMode: childRun.authorizationMode,
          })
        })
        .catch(() => {
          runAbortControllers.delete(childRun.id)
        })
    })

    // Bind to loopback only: the daemon is a local runtime, not a network
    // service. Binding 0.0.0.0 would be both a sandbox EPERM and a needless
    // exposure of the workspace API.
    const server: Server = app.listen(opts.port, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${opts.port}`
      resolve({
        url,
        close: () =>
          new Promise<void>((res, rej) => {
            server.close((err) => (err ? rej(err) : res()))
          }),
      })
    })

    server.on('error', reject)
  })
}
