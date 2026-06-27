import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fauxAssistantMessage, fauxProvider, fauxText } from '@earendil-works/pi-ai'
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
})

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
