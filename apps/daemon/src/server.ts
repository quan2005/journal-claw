/**
 * journal daemon HTTP server
 *
 * 参照 open-design apps/daemon/src/server.ts 的 Express 形态。
 * 最小骨架：GET /health + GET /workspace + GET /events (SSE)。
 * 不依赖平台专属二进制；跨平台 Node 能力。
 */

import express from 'express'
import type { Server } from 'node:http'
import { AgentRunService } from './runs/service.js'
import { listAgentDefs, getAgentDef } from './runtimes/registry.js'
import { executeRun } from './runtimes/runner.js'
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
import { compileMdx } from './mdx/service.js'
import { DirectiveMigrationService } from './directive_migration/service.js'
import { LocalCrudError } from './local/service.js'
import { execFile } from 'node:child_process'
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
    const directiveMigrationService = (): DirectiveMigrationService =>
      new DirectiveMigrationService(workspaceRoot())

    // Per-run AbortControllers so POST /runs/:id/cancel can actually abort the
    // running executeRun child (SIGTERM the spawned CLI), not just flip status.
    const runAbortControllers = new Map<string, AbortController>()

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

    // ── M3: skills / MDX / onboarding / permissions / misc ───────────────
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

    app.post('/mdx/compile', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        if (typeof body.source !== 'string') {
          res.status(400).json({ error: { code: 'invalid_mdx_request' } })
          return
        }
        res
          .type('text/plain')
          .send(compileMdx(body.source, typeof body.filepath === 'string' ? body.filepath : null))
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

    app.get('/directive-migration/legacy-files', (_req, res) => {
      try {
        res.json(directiveMigrationService().scanLegacyDirectiveFiles())
      } catch (err) {
        handleFsError(res, err)
      }
    })

    app.post('/directive-migration/apply', (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>
        res.json(
          directiveMigrationService().applyDirectiveMigration({
            source_path: String(body.source_path ?? ''),
            destination_path: String(body.destination_path ?? ''),
            content: String(body.content ?? ''),
          }),
        )
        eventLogService.record('journal-updated', null)
      } catch (err) {
        handleFsError(res, err)
      }
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

    // ── AgentRun routes ──────────────────────────────────────────────────────
    // POST /runs — 创建一个 run，返回 { id, status: 'queued', ... }
    app.post('/runs', (req, res) => {
      const body = (req.body ?? {}) as {
        goal?: unknown
        mode?: unknown
        agentId?: unknown
        prompt?: unknown
        model?: unknown
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
      const agentId = typeof body.agentId === 'string' && body.agentId ? body.agentId : 'claude'
      const def = getAgentDef(agentId)
      if (!def) {
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
      const beforeSnapshot = changeSetService.snapshotWorkspace()
      // Register an AbortController for this run so cancel can SIGTERM the
      // spawned child instead of merely flipping status.
      const abortController = new AbortController()
      runAbortControllers.set(run.id, abortController)
      executeRun(
        service,
        { runId: run.id, agentId, prompt: assembledPrompt, model, authorizationMode },
        { signal: abortController.signal },
      )
        .then((result) => {
          runAbortControllers.delete(run.id)
          // Capture real filesystem changes the Agent performed (create/edit/
          // remove) by diffing the post-run snapshot against the pre-run one.
          // This is the feasible capture path that does not intercept CLI
          // internals. Existing explicit ChangeSets are preserved.
          const afterSnapshot = changeSetService.snapshotWorkspace()
          changeSetService.captureSnapshotDiff(
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
          const changeSets = changeSetService.listChangeSets(run.id)
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
