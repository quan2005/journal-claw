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
import type { AuthorizationMode } from '@journal/contracts'
import { ChangeSetService } from '../changeset/service.js'
import { ConfigService, type ProviderEntry } from '../config/service.js'
import type { AgentRunService } from '../runs/service.js'
import {
  FS_TOOL_NAMES,
  WRITE_TOOL_NAMES,
  authorizeToolPath,
  createEngineToolContext,
  createEngineTools,
  type EngineToolAuditEvent,
  type EngineToolContext,
} from './tools/index.js'

export interface PiEngineServiceOptions {
  providers?: Provider[]
  systemPrompt?: string
  workspaceRoot?: string
  runId?: string
  authorizationMode?: AuthorizationMode
  changeSetService?: ChangeSetService
  runService?: AgentRunService
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
  auditEvents: EngineToolAuditEvent[]
}

const DEFAULT_SYSTEM_PROMPT = 'You are JournalClaw daemon built-in agent.'
const OPENAI_COMPATIBLE_VENDORS = new Set(['volcengine', 'zhipu', 'dashscope'])
const DEFAULT_OPENAI_COMPATIBLE_BASE_URL: Record<string, string> = {
  deepseek: 'https://api.deepseek.com/v1',
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
  private readonly auditEvents: EngineToolAuditEvent[] = []

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
    const toolContext = this.resolveToolContext()
    return new Agent({
      initialState: {
        systemPrompt: this.opts.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
        model: engine.model,
        tools: toolContext ? createEngineTools(toolContext) : [],
        messages: [],
      },
      streamFn: engine.models.streamSimple.bind(engine.models),
      getApiKey: engine.getApiKey,
      beforeToolCall: async ({ toolCall, args }) => {
        if (!toolContext) return undefined
        return authorizeBeforeToolCall(toolContext, toolCall.name, args)
      },
      afterToolCall: async ({ toolCall, result, isError }) => {
        const audit = {
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          details: result.details,
          isError,
          timestamp: new Date().toISOString(),
        }
        this.auditEvents.push(audit)
        if (
          !result.details ||
          typeof result.details !== 'object' ||
          Array.isArray(result.details)
        ) {
          return { details: { audit } }
        }
        return { details: { ...result.details, audit } }
      },
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
      auditEvents: [...this.auditEvents],
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

  private resolveToolContext(): EngineToolContext | undefined {
    if (!this.opts.workspaceRoot) return undefined
    return createEngineToolContext({
      workspaceRoot: this.opts.workspaceRoot,
      runId: this.opts.runId ?? 'pi-engine-run',
      authorizationMode: this.opts.authorizationMode ?? 'workspace_write',
      changeSetService: this.opts.changeSetService,
      runService: this.opts.runService,
    })
  }

  getAuditEvents(): EngineToolAuditEvent[] {
    return [...this.auditEvents]
  }
}

function authorizeBeforeToolCall(
  ctx: EngineToolContext,
  toolName: string,
  args: unknown,
): { block: true; reason: string } | undefined {
  if (toolName === 'bash' && ctx.authorizationMode === 'read_only') {
    return { block: true, reason: 'bash is disabled in read_only mode' }
  }
  if (!WRITE_TOOL_NAMES.has(toolName)) {
    if (FS_TOOL_NAMES.has(toolName as never)) {
      return authorizePathArgs(ctx, toolName, args, 'read')
    }
    return undefined
  }
  return authorizePathArgs(ctx, toolName, args, 'write')
}

function authorizePathArgs(
  ctx: EngineToolContext,
  toolName: string,
  args: unknown,
  access: 'read' | 'write',
): { block: true; reason: string } | undefined {
  const paths = extractToolPaths(toolName, args)
  for (const path of paths) {
    const decision = authorizeToolPath(ctx.authorizationMode, ctx.workspaceRoot, path, access)
    if (!decision.allowed) {
      return { block: true, reason: decision.reason ?? `path not allowed: ${path}` }
    }
  }
  return undefined
}

function extractToolPaths(toolName: string, args: unknown): string[] {
  if (!args || typeof args !== 'object') return []
  const record = args as Record<string, unknown>
  if (toolName === 'move_file') {
    return [record.source, record.destination].filter(
      (value): value is string => typeof value === 'string',
    )
  }
  return typeof record.path === 'string' ? [record.path] : []
}

function shouldRegisterOpenAICompatibleProvider(
  provider: ProviderEntry,
  models: MutableModels,
): boolean {
  if (models.getModel(provider.id, provider.model)) return false
  if (OPENAI_COMPATIBLE_VENDORS.has(provider.id)) return true
  if (DEFAULT_OPENAI_COMPATIBLE_BASE_URL[provider.id]) return true
  if (
    provider.base_url &&
    Object.values(DEFAULT_OPENAI_COMPATIBLE_BASE_URL).some((url) =>
      provider.base_url.toLowerCase().startsWith(url.toLowerCase()),
    )
  ) {
    return true
  }
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
