import { Agent, type AgentOptions } from '@earendil-works/pi-agent-core'
import type { AgentEvent } from '@earendil-works/pi-agent-core'
import {
  createModels,
  createProvider,
  type Api,
  type Model,
  type MutableModels,
  type Provider,
} from '@earendil-works/pi-ai'
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy'
import { anthropicProvider } from '@earendil-works/pi-ai/providers/anthropic'
import { openaiProvider } from '@earendil-works/pi-ai/providers/openai'
import { ConfigService, type ProviderEntry } from '../config/service.js'

export interface PiEngineServiceOptions {
  providers?: Provider[]
  systemPrompt?: string
}

export interface ResolvedPiEngine {
  model: Model<Api>
  models: MutableModels
  provider: ProviderEntry
  getApiKey: AgentOptions['getApiKey']
}

export interface PiPromptResult {
  events: AgentEvent[]
  eventTypes: AgentEvent['type'][]
  agent: Agent
}

const DEFAULT_SYSTEM_PROMPT = 'You are JournalClaw daemon built-in agent.'
const OPENAI_COMPATIBLE_VENDORS = new Set(['volcengine', 'zhipu', 'dashscope'])
const DEFAULT_OPENAI_COMPATIBLE_BASE_URL: Record<string, string> = {
  volcengine: 'https://ark.cn-beijing.volces.com/api/v3',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  dashscope: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
}

export class PiEngineConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PiEngineConfigError'
  }
}

export class PiEngineService {
  constructor(
    private readonly configService: ConfigService,
    private readonly opts: PiEngineServiceOptions = {},
  ) {}

  resolveEngine(): ResolvedPiEngine {
    const provider = this.resolveActiveProvider()
    const models = createModels()
    models.setProvider(anthropicProvider())
    models.setProvider(openaiProvider())
    for (const extraProvider of this.opts.providers ?? []) {
      models.setProvider(extraProvider)
    }

    if (shouldRegisterOpenAICompatibleProvider(provider, models)) {
      models.setProvider(createOpenAICompatibleProvider(provider))
    }

    const model = models.getModel(provider.id, provider.model)
    if (!model) {
      throw new PiEngineConfigError(
        `model not found for provider ${provider.id}: ${provider.model || '(empty)'}`,
      )
    }

    return {
      model,
      models,
      provider,
      getApiKey: async (providerId) => {
        if (providerId !== provider.id) return undefined
        return this.resolveApiKey(provider)
      },
    }
  }

  createAgent(): Agent {
    const engine = this.resolveEngine()
    return new Agent({
      initialState: {
        systemPrompt: this.opts.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
        model: engine.model,
        tools: [],
        messages: [],
      },
      streamFn: engine.models.streamSimple.bind(engine.models),
      getApiKey: engine.getApiKey,
    })
  }

  async prompt(input: string): Promise<PiPromptResult> {
    const agent = this.createAgent()
    const events: AgentEvent[] = []
    agent.subscribe((event) => {
      events.push(event)
    })

    await agent.prompt(input)
    return {
      events,
      eventTypes: events.map((event) => event.type),
      agent,
    }
  }

  private resolveActiveProvider(): ProviderEntry {
    const config = this.configService.getEngineConfig()
    const provider = config.providers.find((entry) => entry.id === config.active_provider)
    if (!provider) {
      throw new PiEngineConfigError(`active provider not configured: ${config.active_provider}`)
    }
    if (!provider.model) {
      throw new PiEngineConfigError(`model is required for provider ${provider.id}`)
    }
    return provider
  }

  private resolveApiKey(provider: ProviderEntry): string | undefined {
    const key = provider.api_key || this.configService.getApiKey()
    return key || undefined
  }
}

function shouldRegisterOpenAICompatibleProvider(
  provider: ProviderEntry,
  models: MutableModels,
): boolean {
  if (models.getModel(provider.id, provider.model)) return false
  if (OPENAI_COMPATIBLE_VENDORS.has(provider.id)) return true
  return provider.protocol === 'openai' && Boolean(provider.base_url)
}

function createOpenAICompatibleProvider(provider: ProviderEntry): Provider<'openai-completions'> {
  const baseUrl = resolveOpenAICompatibleBaseUrl(provider)
  const model = createOpenAICompatibleModel(provider, baseUrl)
  return createProvider({
    id: provider.id,
    name: provider.label || provider.id,
    baseUrl,
    auth: {
      apiKey: {
        name: `${provider.label || provider.id} API key`,
        resolve: async ({ credential }) => {
          if (!credential?.key) return undefined
          return { auth: { apiKey: credential.key } }
        },
      },
    },
    models: [model],
    api: openAICompletionsApi(),
  })
}

function createOpenAICompatibleModel(
  provider: ProviderEntry,
  baseUrl: string,
): Model<'openai-completions'> {
  return {
    id: provider.model,
    name: provider.model,
    api: 'openai-completions',
    provider: provider.id,
    baseUrl,
    reasoning: false,
    input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 8192,
    compat: {
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
    },
  }
}

function resolveOpenAICompatibleBaseUrl(provider: ProviderEntry): string {
  const baseUrl = provider.base_url || DEFAULT_OPENAI_COMPATIBLE_BASE_URL[provider.id]
  if (!baseUrl) {
    throw new PiEngineConfigError(`base_url is required for provider ${provider.id}`)
  }
  return baseUrl
}
