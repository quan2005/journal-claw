import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fauxAssistantMessage, fauxProvider, fauxText, fauxToolCall } from '@earendil-works/pi-ai'
import { ChangeSetService } from '../changeset/service.js'
import { ConfigService, type EngineConfig } from '../config/service.js'
import { PiEngineService } from './service.js'

describe('PiEngineService', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `journal-pi-engine-${Math.random().toString(36).slice(2)}`)
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('runs one prompt through the pi faux provider and emits the agent lifecycle', async () => {
    const faux = fauxProvider({
      provider: 'faux',
      models: [{ id: 'faux-model', reasoning: false }],
    })
    faux.setResponses([fauxAssistantMessage([fauxText('pong')])])

    const config = new ConfigService({ configDir: dir })
    config.setEngineConfig(engineConfig('faux', 'faux-model'))
    const service = new PiEngineService(config, { providers: [faux.provider] })

    const result = await service.prompt('ping')

    expect(result.eventTypes[0]).toBe('agent_start')
    expect(result.eventTypes.slice(1, 5)).toEqual([
      'turn_start',
      'message_start',
      'message_end',
      'message_start',
    ])
    expect(result.eventTypes.at(-2)).toBe('turn_end')
    expect(result.eventTypes.at(-1)).toBe('agent_end')
    expect(result.eventTypes).toContain('message_update')
    expect(faux.state.callCount).toBe(1)
  })

  it('registers domestic vendors as openai-completions providers with custom base URLs', async () => {
    const config = new ConfigService({ configDir: dir })
    config.setApiKey('sk-zhipu')
    config.setEngineConfig(
      engineConfig('zhipu', 'glm-4.5', {
        label: 'Zhipu',
        base_url: 'https://open.bigmodel.cn/api/paas/v4',
      }),
    )

    const engine = new PiEngineService(config).resolveEngine()

    expect(engine.model).toMatchObject({
      id: 'glm-4.5',
      provider: 'zhipu',
      api: 'openai-completions',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    })
    await expect(engine.getApiKey?.('zhipu')).resolves.toBe('sk-zhipu')
  })

  it('resolveModelFor resolves any configured provider entry and returns null for unknown ids', () => {
    const config = new ConfigService({ configDir: dir })
    config.setEngineConfig({
      active_provider: 'primary',
      providers: [
        {
          protocol: 'openai',
          id: 'primary',
          label: 'Primary',
          model: 'primary-model',
          api_key: 'sk-primary',
          base_url: 'https://api.deepseek.com/v1',
        },
        {
          protocol: 'openai',
          id: 'secondary',
          label: 'Secondary',
          model: 'secondary-model',
          api_key: 'sk-secondary',
          base_url: 'https://open.bigmodel.cn/api/paas/v4',
        },
      ],
    })

    const service = new PiEngineService(config)

    const primary = service.resolveModelFor('primary')
    expect(primary?.model).toMatchObject({ id: 'primary-model', provider: 'primary' })

    const secondary = service.resolveModelFor('secondary')
    expect(secondary?.model).toMatchObject({ id: 'secondary-model', provider: 'secondary' })

    expect(service.resolveModelFor('not-configured')).toBeNull()
  })

  it('getApiKey resolves the key for any configured provider, not only the active one', async () => {
    const config = new ConfigService({ configDir: dir })
    config.setEngineConfig({
      active_provider: 'primary',
      providers: [
        {
          protocol: 'openai',
          id: 'primary',
          label: 'Primary',
          model: 'primary-model',
          api_key: 'sk-primary',
          base_url: 'https://api.deepseek.com/v1',
        },
        {
          protocol: 'openai',
          id: 'secondary',
          label: 'Secondary',
          model: 'secondary-model',
          api_key: 'sk-secondary',
          base_url: 'https://open.bigmodel.cn/api/paas/v4',
        },
      ],
    })

    const engine = new PiEngineService(config).resolveEngine()

    await expect(engine.getApiKey?.('primary')).resolves.toBe('sk-primary')
    await expect(engine.getApiKey?.('secondary')).resolves.toBe('sk-secondary')
    await expect(engine.getApiKey?.('unknown')).resolves.toBeUndefined()
  })

  it.each([
    ['volcengine', 'doubao-seed-1.6', 'https://ark.cn-beijing.volces.com/api/v3'],
    ['dashscope', 'qwen-max', 'https://dashscope.aliyuncs.com/compatible-mode/v1'],
  ])('registers %s with the configured OpenAI-compatible base URL', (vendor, model, baseUrl) => {
    const config = new ConfigService({ configDir: dir })
    config.setEngineConfig(engineConfig(vendor, model, { base_url: baseUrl }))

    expect(() => new PiEngineService(config).resolveEngine()).not.toThrow()
    expect(new PiEngineService(config).resolveEngine().model).toMatchObject({
      provider: vendor,
      id: model,
      api: 'openai-completions',
      baseUrl,
    })
  })

  it('blocks write_file and bash before execution in read_only mode', async () => {
    const faux = fauxProvider({
      provider: 'faux',
      models: [{ id: 'faux-model', reasoning: false }],
    })
    faux.setResponses([
      fauxAssistantMessage([fauxToolCall('write_file', { path: 'blocked.md', content: 'nope' })], {
        stopReason: 'toolUse',
      }),
      fauxAssistantMessage([fauxToolCall('bash', { command: 'touch also-blocked.md' })], {
        stopReason: 'toolUse',
      }),
      fauxAssistantMessage([fauxText('done')]),
    ])

    const workspace = join(dir, 'workspace')
    mkdirSync(workspace, { recursive: true })
    const changes = new ChangeSetService(workspace)
    const config = new ConfigService({ configDir: join(dir, 'config') })
    config.setEngineConfig(engineConfig('faux', 'faux-model'))
    const service = new PiEngineService(config, {
      providers: [faux.provider],
      workspaceRoot: workspace,
      runId: 'read-only-run',
      authorizationMode: 'read_only',
      changeSetService: changes,
    })

    const result = await service.prompt('try forbidden tools')

    expect(result.eventTypes).toContain('tool_execution_start')
    expect(existsSync(join(workspace, 'blocked.md'))).toBe(false)
    expect(existsSync(join(workspace, 'also-blocked.md'))).toBe(false)
    expect(changes.listChangeSets('read-only-run')).toEqual([])
    expect(toolResultText(result)).toContain('bash is disabled in read_only mode')
  })

  it('allows workspace_write write_file inside root and records an applied ChangeSet', async () => {
    const faux = fauxProvider({
      provider: 'faux',
      models: [{ id: 'faux-model', reasoning: false }],
    })
    faux.setResponses([
      fauxAssistantMessage([fauxToolCall('write_file', { path: 'note.md', content: 'hello' })], {
        stopReason: 'toolUse',
      }),
      fauxAssistantMessage([fauxText('done')]),
    ])

    const workspace = join(dir, 'workspace')
    mkdirSync(workspace, { recursive: true })
    const changes = new ChangeSetService(workspace)
    const config = new ConfigService({ configDir: join(dir, 'config') })
    config.setEngineConfig(engineConfig('faux', 'faux-model'))
    const service = new PiEngineService(config, {
      providers: [faux.provider],
      workspaceRoot: workspace,
      runId: 'write-run',
      authorizationMode: 'workspace_write',
      changeSetService: changes,
    })

    const result = await service.prompt('write a file')

    expect(readFileSync(join(workspace, 'note.md'), 'utf8')).toBe('hello')
    expect(changes.listChangeSets('write-run')).toMatchObject([
      {
        path: 'note.md',
        operation: 'create',
        status: 'applied',
        authorizationMode: 'workspace_write',
      },
    ])
    expect(result.auditEvents[0]).toMatchObject({
      toolName: 'write_file',
      isError: false,
    })
    expect(result.auditEvents[0]?.details).toMatchObject({
      operation: 'create',
      changeSet: { path: 'note.md', status: 'applied' },
    })
  })

  it('blocks workspace_write write_file outside the workspace root', async () => {
    const faux = fauxProvider({
      provider: 'faux',
      models: [{ id: 'faux-model', reasoning: false }],
    })
    const outside = join(dir, 'outside.md')
    faux.setResponses([
      fauxAssistantMessage([fauxToolCall('write_file', { path: outside, content: 'escape' })], {
        stopReason: 'toolUse',
      }),
      fauxAssistantMessage([fauxText('done')]),
    ])

    const workspace = join(dir, 'workspace')
    mkdirSync(workspace, { recursive: true })
    const changes = new ChangeSetService(workspace)
    const config = new ConfigService({ configDir: join(dir, 'config') })
    config.setEngineConfig(engineConfig('faux', 'faux-model'))
    const service = new PiEngineService(config, {
      providers: [faux.provider],
      workspaceRoot: workspace,
      runId: 'escape-run',
      authorizationMode: 'workspace_write',
      changeSetService: changes,
    })

    const result = await service.prompt('try escape')

    expect(existsSync(outside)).toBe(false)
    expect(changes.listChangeSets('escape-run')).toEqual([])
    expect(toolResultText(result)).toContain('path escapes workspace root')
  })

  it('delete_file moves into .journal/trash and can be reverted', async () => {
    const faux = fauxProvider({
      provider: 'faux',
      models: [{ id: 'faux-model', reasoning: false }],
    })
    faux.setResponses([
      fauxAssistantMessage([fauxToolCall('delete_file', { path: 'gone.md' })], {
        stopReason: 'toolUse',
      }),
      fauxAssistantMessage([fauxText('done')]),
    ])

    const workspace = join(dir, 'workspace')
    mkdirSync(workspace, { recursive: true })
    writeFileSync(join(workspace, 'gone.md'), 'restore me')
    const changes = new ChangeSetService(workspace)
    const config = new ConfigService({ configDir: join(dir, 'config') })
    config.setEngineConfig(engineConfig('faux', 'faux-model'))
    const service = new PiEngineService(config, {
      providers: [faux.provider],
      workspaceRoot: workspace,
      runId: 'delete-run',
      authorizationMode: 'workspace_write',
      changeSetService: changes,
    })

    await service.prompt('delete a file')

    const [changeSet] = changes.listChangeSets('delete-run')
    expect(existsSync(join(workspace, 'gone.md'))).toBe(false)
    expect(changeSet).toMatchObject({
      path: 'gone.md',
      operation: 'remove',
      status: 'applied',
    })
    expect(changeSet?.beforePath).toContain('.journal/trash')
    expect(existsSync(changeSet!.beforePath!)).toBe(true)

    const reverted = changes.revertChangeSet(changeSet!.id)
    expect(reverted?.status).toBe('reverted')
    expect(readFileSync(join(workspace, 'gone.md'), 'utf8')).toBe('restore me')
  })
})

function toolResultText(result: { agent: { state: { messages: unknown[] } } }): string {
  return JSON.stringify(result.agent.state.messages)
}

function engineConfig(
  provider: string,
  model: string,
  overrides: Partial<EngineConfig['providers'][number]> = {},
): EngineConfig {
  return {
    active_provider: provider,
    providers: [
      {
        protocol: 'openai',
        id: provider,
        label: provider,
        api_key: '',
        base_url: '',
        model,
        ...overrides,
      },
    ],
  }
}
