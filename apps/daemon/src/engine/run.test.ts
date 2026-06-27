import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fauxAssistantMessage, fauxProvider, fauxText, fauxToolCall } from '@earendil-works/pi-ai'
import { ChangeSetService } from '../changeset/service.js'
import { ConfigService, type EngineConfig } from '../config/service.js'
import { assembleContext } from '../context/assemble.js'
import { AgentRunService } from '../runs/service.js'
import { SettingsService } from '../settings/service.js'
import { SkillsService } from '../skills/service.js'
import { buildPiSystemPrompt, executeBuiltinRun } from './run.js'

describe('executeBuiltinRun', () => {
  let dir: string
  let workspace: string
  let config: ConfigService
  let runService: AgentRunService

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'journal-builtin-run-'))
    workspace = join(dir, 'workspace')
    mkdirSync(workspace, { recursive: true })
    config = new ConfigService({ configDir: join(dir, 'config') })
    config.setEngineConfig(engineConfig('faux', 'faux-model'))
    runService = new AgentRunService(join(dir, 'data'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('streams pi faux provider events into AgentRunService and JSONL in order', async () => {
    const faux = fauxProvider({
      provider: 'faux',
      models: [{ id: 'faux-model', reasoning: false }],
      tokenSize: { min: 64, max: 64 },
    })
    writeFileSync(join(workspace, 'note.md'), 'hello')
    faux.setResponses([
      fauxAssistantMessage(
        [fauxText('pong'), fauxToolCall('read_file', { path: 'note.md' }, { id: 'tc-1' })],
        {
          stopReason: 'toolUse',
        },
      ),
      fauxAssistantMessage([fauxText('done')]),
    ])
    const run = runService.createRun({ goal: 'read note', mode: 'agent', agentId: 'builtin' })

    const result = await executeBuiltinRun(
      runService,
      config,
      {
        runId: run.id,
        prompt: 'read note',
        systemPrompt: 'assembled context',
        workspaceRoot: workspace,
        authorizationMode: 'workspace_write',
      },
      {
        providers: [faux.provider],
        changeSetService: new ChangeSetService(workspace),
      },
    )

    expect(result.ok).toBe(true)
    expect(runService.getRun(run.id)?.status).toBe('succeeded')
    const types = runService.readEvents(run.id).map((event) => event.type)
    expectInOrder(types, ['run_started', 'text_delta', 'tool_call', 'tool_result', 'run_finished'])
    expect(types.filter((type) => type === 'run_finished')).toHaveLength(1)
    expect(runService.readEvents(run.id).map((event) => event.type)).toEqual(types)
  })

  it('keeps assembled workspace context and enabled skills in the pi system prompt', async () => {
    const faux = fauxProvider({
      provider: 'faux',
      models: [{ id: 'faux-model', reasoning: false }],
    })
    faux.setResponses([fauxAssistantMessage([fauxText('ok')])])
    const skillDir = join(workspace, '.agents', 'skills', 'demo')
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      '---\nname: demo\ndescription: Use for demo tasks\n---\n\n# Demo',
    )
    const assembled = assembleContext(
      'do work',
      {
        path: workspace,
        name: 'Journal R&D',
        type: 'project',
        description: 'Knowledge workspace',
        goals: ['ship builtin pi'],
        activeSources: ['stories/'],
        updatedAt: '2026-06-27T00:00:00Z',
      },
      [
        {
          id: 'mem-1',
          sourceRunId: 'old-run',
          kind: 'project_fact',
          summary: 'Memory injection works',
          detail: '',
          evidence: [],
          createdAt: '2026-06-27T00:00:00Z',
        },
      ],
    )
    const skills = new SkillsService(workspace, new SettingsService(workspace), dir, dir)
    const run = runService.createRun({ goal: 'do work', mode: 'agent', agentId: 'builtin' })
    let captured = ''

    await executeBuiltinRun(
      runService,
      config,
      {
        runId: run.id,
        prompt: 'do work',
        systemPrompt: assembled,
        workspaceRoot: workspace,
      },
      {
        providers: [faux.provider],
        skillsService: skills,
        onSystemPrompt: (systemPrompt) => {
          captured = systemPrompt
        },
      },
    )

    expect(captured).toContain('Journal R&D')
    expect(captured).toContain('ship builtin pi')
    expect(captured).toContain('Memory injection works')
    expect(captured).toContain('<available_skills>')
    expect(captured).toContain('<name>demo</name>')
    expect(captured).toContain('Use for demo tasks')
  })

  it('aborts the pi agent when the run AbortSignal is canceled', async () => {
    const run = runService.createRun({ goal: 'slow', mode: 'agent', agentId: 'builtin' })
    const controller = new AbortController()
    let abortCount = 0
    let listener: ((event: { type: 'agent_start' }) => void) | null = null
    let releasePrompt: (() => void) | null = null
    const fakeAgent = {
      subscribe(fn: (event: { type: 'agent_start' }) => void) {
        listener = fn
        return () => {
          listener = null
        }
      },
      async prompt() {
        listener?.({ type: 'agent_start' })
        await new Promise<void>((resolve) => {
          releasePrompt = resolve
        })
        throw new Error('aborted')
      },
      abort() {
        abortCount += 1
        releasePrompt?.()
      },
    }

    const promise = executeBuiltinRun(
      runService,
      config,
      {
        runId: run.id,
        prompt: 'slow',
        systemPrompt: 'context',
        workspaceRoot: workspace,
      },
      { signal: controller.signal, createAgent: () => fakeAgent as never },
    )
    await waitForEvent(runService, run.id, 'run_started')
    runService.cancelRun(run.id)
    controller.abort()

    const result = await promise
    expect(result.ok).toBe(false)
    expect(abortCount).toBe(1)
    expect(runService.getRun(run.id)?.status).toBe('canceled')
  })
})

describe('buildPiSystemPrompt', () => {
  it('works without skillsService', () => {
    expect(buildPiSystemPrompt('ctx')).toContain('ctx')
  })
})

function expectInOrder(types: string[], expected: string[]): void {
  let cursor = -1
  for (const type of expected) {
    const next = types.indexOf(type, cursor + 1)
    expect(next, `${type} should appear after index ${cursor}`).toBeGreaterThan(cursor)
    cursor = next
  }
}

function waitForEvent(service: AgentRunService, runId: string, type: string): Promise<void> {
  if (service.readEvents(runId).some((event) => event.type === type)) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    let stop = (): void => {}
    stop = service.subscribe(runId, (event) => {
      if (event.type === type) {
        stop()
        resolve()
      }
    })
  })
}

function engineConfig(provider: string, model: string): EngineConfig {
  return {
    active_provider: provider,
    providers: [
      {
        protocol: 'openai',
        id: provider,
        label: provider,
        model,
        api_key: '',
        base_url: 'http://localhost:0',
      },
    ],
  }
}
