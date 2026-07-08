import { randomUUID } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { basename, join } from 'node:path'
import { Agent, type AgentEvent, type AgentMessage } from '@earendil-works/pi-agent-core'
import type { Api, Provider } from '@earendil-works/pi-ai'
import type {
  AssistantMessage,
  ImageContent,
  TextContent,
  ToolResultMessage,
  Usage,
} from '@earendil-works/pi-ai'
import { ChangeSetService } from '../changeset/service.js'
import type { ConfigService } from '../config/service.js'
import { mapPiAgentEvent } from '../engine/events.js'
import { buildPiSystemPrompt } from '../engine/run.js'
import { PiEngineService } from '../engine/service.js'
import type { IdentityService } from '../identity/service.js'
import { parseSimpleFrontmatter } from '../local/service.js'
import type { AgentRunService } from '../runs/service.js'
import type { SkillsService } from '../skills/service.js'

const EXPERT_MENTION_RE = /@(identities\/[^\s@]+\.md)/g
// \b is ASCII-word-boundary only and does not fire around CJK text; use an
// explicit lookahead for "end of mention" instead.
const CLEAR_EXPERT_RE = /@清除专家(?=\s|@|$)/

export interface ImageAttachment {
  media_type: string
  data: string
}

export interface ConversationStreamPayload {
  session_id: string
  event: string
  data: string
}

export interface SessionSummary {
  id: string
  title: string | null
  created_at: number
  updated_at: number
  is_streaming: boolean
  message_count: number
}

export interface DisplayTool {
  name: string
  label: string
  output?: string
  is_error?: boolean
}

export interface LoadedMessage {
  role: string
  content: string
  thinking?: string
  tools?: DisplayTool[]
}

export interface SessionStats {
  elapsed_secs: number
  total_input_tokens: number
  total_output_tokens: number
}

export interface ConversationServiceOptions {
  workspaceRoot: string
  configService: ConfigService
  runService: AgentRunService
  providers?: Provider[]
  changeSetService?: ChangeSetService
  skillsService?: SkillsService
  identityService?: IdentityService
  publishEvent?: (event: string, payload: unknown) => void
  now?: () => Date
  createAgent?: (engine: PiEngineService, sessionId: string, messages: AgentMessage[]) => Agent
  maxContextMessages?: number
}

interface ConversationSession {
  id: string
  agent: Agent
  workspaceRoot: string
  title: string | null
  titleLocked: boolean
  createdAt: number
  updatedAt: number
  systemPrompt: string
  runningRunId: string | null
  activePromise: Promise<void> | null
  elapsedSecs: number
  totalInputTokens: number
  totalOutputTokens: number
  pendingUserMessages: string[]
  expertContexts: string[]
}

interface PersistedSessionV2 {
  id: string
  title: string | null
  title_locked: boolean
  created_at: number
  updated_at: number
  version: number
  messages: RustMessage[]
  system_prompt?: string | null
  expert_contexts?: unknown[]
  elapsed_secs?: number
  total_input_tokens?: number
  total_output_tokens?: number
  pi_messages?: AgentMessage[]
}

interface PersistedSessionV1 {
  id: string
  title?: string | null
  title_locked?: boolean
  created_at: number
  updated_at: number
  messages: PersistedMessageV1[]
  system_prompt?: string | null
}

interface PersistedMessageV1 {
  role: string
  content: string
}

type RustMessage = {
  role: 'user' | 'assistant'
  content: RustContentBlock[]
}

type RustContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; media_type: string; data: string }
  | { type: 'thinking'; thinking: string; signature?: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }
  | { type: 'server_tool_use'; id: string; name: string; input: unknown }
  | Record<string, unknown>

type RetryAction = 'continue' | 'none'

const DEFAULT_SYSTEM_CONTEXT =
  'You are JournalClaw. Help maintain this knowledge workspace and write journal entries in Markdown/MDX.'

const EMPTY_USAGE: Usage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    total: 0,
  },
}

export class ConversationService {
  private readonly sessions = new Map<string, ConversationSession>()
  private readonly workspaceRoot: string
  private readonly configService: ConfigService
  private readonly runService: AgentRunService
  private readonly providers?: Provider[]
  private readonly changeSetService: ChangeSetService
  private readonly skillsService?: SkillsService
  private readonly identityService?: IdentityService
  private readonly publishEvent: (event: string, payload: unknown) => void
  private readonly now: () => Date
  private readonly createAgentOverride?: (
    engine: PiEngineService,
    sessionId: string,
    messages: AgentMessage[],
  ) => Agent
  private readonly maxContextMessages: number

  constructor(opts: ConversationServiceOptions) {
    this.workspaceRoot = opts.workspaceRoot
    this.configService = opts.configService
    this.runService = opts.runService
    this.providers = opts.providers
    this.changeSetService = opts.changeSetService ?? new ChangeSetService(opts.workspaceRoot)
    this.skillsService = opts.skillsService
    this.identityService = opts.identityService
    this.publishEvent = opts.publishEvent ?? (() => {})
    this.now = opts.now ?? (() => new Date())
    this.createAgentOverride = opts.createAgent
    this.maxContextMessages = Math.max(1, opts.maxContextMessages ?? 120)
  }

  create(context?: string | null, contextFiles?: string[] | null): string {
    const id = generateSessionId(this.now())
    const createdAt = nowSecs(this.now)
    const systemPrompt = this.buildSystemPrompt(context ?? null, contextFiles ?? null)
    const session = this.createSession({
      id,
      title: null,
      titleLocked: false,
      createdAt,
      updatedAt: createdAt,
      systemPrompt,
      messages: [],
      elapsedSecs: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      expertContexts: [],
    })
    this.sessions.set(id, session)
    return id
  }

  async send(sessionId: string, message: string, images?: ImageAttachment[] | null): Promise<void> {
    const session = this.requireSession(sessionId)
    if (session.agent.state.isStreaming) {
      session.agent.followUp(userMessage(message, images))
      session.pendingUserMessages.push(message)
      this.emit(sessionId, 'user_inject', message)
      return
    }

    if (!session.title && !session.titleLocked) {
      const title = message.slice(0, 15).trim()
      if (title) {
        session.title = title
        this.emit(sessionId, 'title', title)
      }
    }

    this.applyExpertMentions(session, message)
    this.runAgent(session, () => session.agent.prompt(message, toPiImages(images)))
  }

  /** Parses `@清除专家` and `@identities/*.md` mentions out of the outgoing
   * user message, updates the session's expert context list, and recomputes
   * the per-turn system prompt suffix (AC-1/AC-7 of expert-perspective-at).
   * Stores contexts by identity *filename* — `AtMentionCandidate.path` (what
   * the mention captures) is workspace-relative, while `IdentityEntry.path`
   * (what `getContent()` needs) is an absolute filesystem path; filename is
   * the stable key shared by both. */
  private applyExpertMentions(session: ConversationSession, message: string): void {
    if (!this.identityService) return

    if (CLEAR_EXPERT_RE.test(message)) {
      session.expertContexts = []
    }

    const mentioned = [...message.matchAll(EXPERT_MENTION_RE)].map((m) =>
      m[1].replace(/^identities\//, ''),
    )
    if (mentioned.length > 0) {
      const experts = new Set(
        this.identityService
          .list()
          .filter((e) => e.is_expert)
          .map((e) => e.filename),
      )
      for (const filename of mentioned) {
        if (!experts.has(filename)) continue
        session.expertContexts = session.expertContexts.filter((f) => f !== filename)
        session.expertContexts.push(filename)
      }
    }

    session.agent.state.systemPrompt = session.systemPrompt + this.expertSystemPromptSuffix(session)
  }

  /** Builds the dynamic system-prompt suffix for currently mounted expert
   * contexts. Last-mentioned expert is the primary perspective; earlier ones
   * are kept as secondary reference (mirrors pre-migration Rust behavior). */
  private expertSystemPromptSuffix(session: ConversationSession): string {
    if (session.expertContexts.length === 0 || !this.identityService) return ''
    const entries = this.identityService.list()
    const blocks = session.expertContexts.map((filename, index) => {
      const entry = entries.find((e) => e.filename === filename)
      if (!entry) return ''
      let content = ''
      try {
        content = this.identityService!.getContent(entry.path)
      } catch {
        return ''
      }
      const { body } = parseSimpleFrontmatter(content)
      const role = index === session.expertContexts.length - 1 ? '主视角' : '参考视角'
      const skillHint = entry.expert_skill.trim()
        ? `（如果关联 skill 为 "${entry.expert_skill.trim()}"，应先调用 load_skill 加载该 skill 获取完整视角；若无法加载，使用下方画像内容作为降级）\n\n`
        : ''
      return `### 专家（${role}）：${entry.name}\n\n${skillHint}${body.trim()}`
    })
    const joined = blocks.filter(Boolean).join('\n\n')
    if (!joined) return ''
    return `\n\n---\n\n以下是本轮对话需要采用的专家视角，请以其思考框架、关注点和追问方式回应，不要只是泛泛赞同：\n\n${joined}`
  }

  cancel(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    session.agent.abort()
    if (session.runningRunId) this.runService.cancelRun(session.runningRunId)
  }

  close(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    session.agent.abort()
    if (session.runningRunId) this.runService.cancelRun(session.runningRunId)
    this.sessions.delete(sessionId)
  }

  inject(sessionId: string, message: string): void {
    const session = this.requireSession(sessionId)
    if (session.agent.state.isStreaming) {
      session.agent.followUp(userMessage(message))
    }
    session.pendingUserMessages.push(message)
    this.emit(sessionId, 'user_inject', message)
  }

  truncate(sessionId: string, keepCount: number): void {
    const session = this.requireSession(sessionId)
    const count = Math.max(0, Math.floor(keepCount))
    session.agent.state.messages = session.agent.state.messages.slice(0, count)
    session.updatedAt = nowSecs(this.now)
    this.save(session)
  }

  async retry(sessionId: string): Promise<void> {
    const session = this.requireSession(sessionId)
    const messages = session.agent.state.messages.slice()
    if (messages[messages.length - 1]?.role === 'assistant') {
      messages.pop()
    }

    const action = resolveRetryAction(messages)
    if (action === 'none') throw new Error('no user message to retry')

    session.agent.state.messages = messages
    this.runAgent(session, () => session.agent.continue())
  }

  list(): SessionSummary[] {
    const summaries = loadSessionSummaries(this.workspaceRoot)
    for (const summary of summaries) {
      const session = this.sessions.get(summary.id)
      if (!session) continue
      summary.is_streaming = session.agent.state.isStreaming
      summary.message_count = visibleMessageCount(session.agent.state.messages)
      summary.title = session.title
      summary.updated_at = session.updatedAt
    }

    for (const session of this.sessions.values()) {
      if (summaries.some((summary) => summary.id === session.id)) continue
      summaries.push({
        id: session.id,
        title: session.title,
        created_at: session.createdAt,
        updated_at: session.updatedAt,
        is_streaming: session.agent.state.isStreaming,
        message_count: visibleMessageCount(session.agent.state.messages),
      })
    }

    return summaries.sort((a, b) => b.updated_at - a.updated_at)
  }

  rename(sessionId: string, title: string): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.title = title
      session.titleLocked = true
      this.touchAndSave(session)
      return
    }

    const persisted = this.loadPersisted(sessionId)
    persisted.title = title
    persisted.title_locked = true
    writePersisted(this.workspaceRoot, persisted)
  }

  delete(sessionId: string): void {
    this.close(sessionId)
    const path = sessionPath(this.workspaceRoot, sessionId)
    if (existsSync(path)) unlinkSync(path)
  }

  getMessages(sessionId: string): LoadedMessage[] {
    const session = this.sessions.get(sessionId)
    if (session) return messagesToDisplay(session.agent.state.messages)
    return this.load(sessionId)
  }

  getStats(sessionId: string): SessionStats {
    const session = this.sessions.get(sessionId)
    if (session) return statsFromSession(session)
    const persisted = this.loadPersisted(sessionId)
    return {
      elapsed_secs: persisted.elapsed_secs ?? 0,
      total_input_tokens: persisted.total_input_tokens ?? 0,
      total_output_tokens: persisted.total_output_tokens ?? 0,
    }
  }

  load(sessionId: string): LoadedMessage[] {
    const persisted = this.loadPersisted(sessionId)
    const messages = persisted.pi_messages ?? rustMessagesToPi(persisted.messages)
    const systemPrompt = persisted.system_prompt || this.buildSystemPrompt(null, null)
    const session = this.createSession({
      id: persisted.id,
      title: persisted.title ?? null,
      titleLocked: persisted.title_locked === true,
      createdAt: persisted.created_at,
      updatedAt: persisted.updated_at,
      systemPrompt,
      messages,
      elapsedSecs: persisted.elapsed_secs ?? 0,
      totalInputTokens: persisted.total_input_tokens ?? 0,
      totalOutputTokens: persisted.total_output_tokens ?? 0,
      expertContexts: (persisted.expert_contexts ?? []).filter(
        (p): p is string => typeof p === 'string',
      ),
    })
    this.sessions.set(sessionId, session)
    return messagesToDisplay(messages)
  }

  waitForIdle(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    return session?.activePromise ?? Promise.resolve()
  }

  private runAgent(session: ConversationSession, execute: () => Promise<void>): void {
    if (session.activePromise) {
      throw new Error(`session already streaming: ${session.id}`)
    }

    const run = this.runService.createRun({
      goal: session.title ?? 'conversation',
      mode: 'chat',
      agentId: 'builtin',
      authorizationMode: 'workspace_write',
    })
    session.runningRunId = run.id
    const startedAt = this.now().getTime()
    const promise = execute()
      .then(() => {
        session.elapsedSecs += (this.now().getTime() - startedAt) / 1000
        this.recalculateUsage(session)
        session.updatedAt = nowSecs(this.now)
        this.save(session)
        this.emitDone(session)
      })
      .catch((err) => {
        session.elapsedSecs += (this.now().getTime() - startedAt) / 1000
        this.recalculateUsage(session)
        session.updatedAt = nowSecs(this.now)
        this.save(session)
        const isCanceled = this.runService.getRun(run.id)?.status === 'canceled'
        this.emit(
          session.id,
          'error',
          JSON.stringify({
            code: isCanceled ? 'cancelled' : 'unknown',
            message: err instanceof Error ? err.message : String(err),
            retryable: !isCanceled,
          }),
        )
        if (!isCanceled) {
          this.runService.appendEvent(run.id, {
            type: 'run_failed',
            runId: run.id,
            sessionId: run.sessionId,
            data: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
            timestamp: this.now().toISOString(),
          })
        }
        this.emitDone(session)
      })
      .finally(() => {
        session.runningRunId = null
        session.activePromise = null
        session.pendingUserMessages = []
      })

    session.activePromise = promise
  }

  private createSession(input: {
    id: string
    title: string | null
    titleLocked: boolean
    createdAt: number
    updatedAt: number
    systemPrompt: string
    messages: AgentMessage[]
    elapsedSecs: number
    totalInputTokens: number
    totalOutputTokens: number
    expertContexts: string[]
  }): ConversationSession {
    const agent = this.createAgent(input.id, input.systemPrompt, input.messages)
    const session: ConversationSession = {
      id: input.id,
      agent,
      workspaceRoot: this.workspaceRoot,
      title: input.title,
      titleLocked: input.titleLocked,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      systemPrompt: input.systemPrompt,
      runningRunId: null,
      activePromise: null,
      elapsedSecs: input.elapsedSecs,
      totalInputTokens: input.totalInputTokens,
      totalOutputTokens: input.totalOutputTokens,
      pendingUserMessages: [],
      expertContexts: input.expertContexts,
    }
    if (input.expertContexts.length > 0) {
      agent.state.systemPrompt = input.systemPrompt + this.expertSystemPromptSuffix(session)
    }
    this.subscribeAgent(session)
    return session
  }

  private createAgent(sessionId: string, systemPrompt: string, messages: AgentMessage[]): Agent {
    const engine = new PiEngineService(this.configService, {
      providers: this.providers,
      systemPrompt,
      workspaceRoot: this.workspaceRoot,
      runId: sessionId,
      authorizationMode: 'workspace_write',
      changeSetService: this.changeSetService,
      runService: this.runService,
    })
    const agent = this.createAgentOverride
      ? this.createAgentOverride(engine, sessionId, messages)
      : engine.createAgent()
    agent.sessionId = sessionId
    agent.state.systemPrompt = systemPrompt
    agent.state.messages = messages
    agent.transformContext = async (current) => transformContext(current, this.maxContextMessages)
    return agent
  }

  private subscribeAgent(session: ConversationSession): void {
    session.agent.subscribe((event) => {
      const runId = session.runningRunId
      const run = runId ? this.runService.getRun(runId) : null
      if (runId && run) {
        for (const mapped of mapPiAgentEvent(event, {
          runId,
          sessionId: run.sessionId,
        })) {
          this.runService.appendEvent(runId, mapped)
        }
      }
      this.emitConversationEvent(session, event)
    })
  }

  private emitConversationEvent(session: ConversationSession, event: AgentEvent): void {
    switch (event.type) {
      case 'turn_start':
        this.emit(session.id, 'turn_start', '')
        break
      case 'message_update': {
        const assistantEvent = event.assistantMessageEvent
        if (assistantEvent.type === 'text_delta') {
          this.emit(session.id, 'text_delta', assistantEvent.delta)
        } else if (assistantEvent.type === 'thinking_delta') {
          this.emit(session.id, 'thinking_delta', assistantEvent.delta)
        }
        break
      }
      case 'tool_execution_start':
        this.emit(
          session.id,
          'tool_start',
          JSON.stringify({
            name: event.toolName,
            label: toolLabel(event.toolName, event.args),
            input: event.args,
          }),
        )
        break
      case 'tool_execution_end':
        this.emit(
          session.id,
          'tool_end',
          JSON.stringify({
            name: event.toolName,
            is_error: event.isError,
            output: stringifyToolResult(event.result),
          }),
        )
        break
      case 'agent_end':
        session.updatedAt = nowSecs(this.now)
        this.recalculateUsage(session)
        break
    }
  }

  private emit(sessionId: string, event: string, data: string): void {
    this.publishEvent('conversation-stream', {
      session_id: sessionId,
      event,
      data,
    } satisfies ConversationStreamPayload)
  }

  private emitDone(session: ConversationSession): void {
    this.emit(session.id, 'done', JSON.stringify(statsFromSession(session)))
  }

  private touchAndSave(session: ConversationSession): void {
    session.updatedAt = nowSecs(this.now)
    this.save(session)
  }

  private save(session: ConversationSession): void {
    const persisted: PersistedSessionV2 = {
      id: session.id,
      title: session.title,
      title_locked: session.titleLocked,
      created_at: session.createdAt,
      updated_at: session.updatedAt,
      version: 2,
      messages: piMessagesToRust(session.agent.state.messages),
      system_prompt: session.systemPrompt,
      expert_contexts: session.expertContexts,
      elapsed_secs: session.elapsedSecs,
      total_input_tokens: session.totalInputTokens,
      total_output_tokens: session.totalOutputTokens,
      pi_messages: session.agent.state.messages,
    }
    writePersisted(session.workspaceRoot, persisted)
  }

  private loadPersisted(sessionId: string): PersistedSessionV2 {
    const raw = readFileSync(sessionPath(this.workspaceRoot, sessionId), 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) throw new Error('failed to parse session')
    if (parsed.version === 2 || Array.isArray(parsed.messages)) {
      const maybeV2 = parsed as Partial<PersistedSessionV2>
      if (maybeV2.version === 2 || looksLikeRustMessages(maybeV2.messages)) {
        return {
          id: String(maybeV2.id ?? sessionId),
          title: typeof maybeV2.title === 'string' ? maybeV2.title : null,
          title_locked: maybeV2.title_locked === true,
          created_at: Number(maybeV2.created_at ?? nowSecs(this.now)),
          updated_at: Number(maybeV2.updated_at ?? nowSecs(this.now)),
          version: 2,
          messages: Array.isArray(maybeV2.messages) ? maybeV2.messages : [],
          system_prompt: typeof maybeV2.system_prompt === 'string' ? maybeV2.system_prompt : null,
          expert_contexts: Array.isArray(maybeV2.expert_contexts) ? maybeV2.expert_contexts : [],
          elapsed_secs: Number(maybeV2.elapsed_secs ?? 0),
          total_input_tokens: Number(maybeV2.total_input_tokens ?? 0),
          total_output_tokens: Number(maybeV2.total_output_tokens ?? 0),
          pi_messages: Array.isArray(maybeV2.pi_messages) ? maybeV2.pi_messages : undefined,
        }
      }
    }
    return migrateV1ToV2(parsed as unknown as PersistedSessionV1, sessionId)
  }

  private buildSystemPrompt(context: string | null, contextFiles: string[] | null): string {
    const parts = [context || `Workspace: ${this.workspaceRoot}`]
    const fileContext = buildContextSection(contextFiles ?? [])
    if (fileContext) parts.push(fileContext)
    return buildPiSystemPrompt(parts.join('\n\n') || DEFAULT_SYSTEM_CONTEXT, this.skillsService)
  }

  private requireSession(sessionId: string): ConversationSession {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`session not found: ${sessionId}`)
    return session
  }

  private recalculateUsage(session: ConversationSession): void {
    const usage = sumUsage(session.agent.state.messages)
    session.totalInputTokens = usage.input
    session.totalOutputTokens = usage.output
  }
}

function transformContext(messages: AgentMessage[], maxContextMessages: number): AgentMessage[] {
  if (messages.length <= maxContextMessages) return messages
  const first = messages[0]
  const tail = messages.slice(-maxContextMessages)
  if (first?.role === 'user' && tail[0] !== first) {
    return [first, ...tail].slice(-maxContextMessages)
  }
  return tail
}

function resolveRetryAction(messages: AgentMessage[]): RetryAction {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const role = messages[i]?.role
    if (role === 'toolResult') return 'continue'
    if (role === 'user') return 'continue'
  }
  return 'none'
}

function messagesToDisplay(messages: AgentMessage[]): LoadedMessage[] {
  const out: LoadedMessage[] = []
  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i]
    if (message.role === 'toolResult') continue
    if (message.role !== 'user' && message.role !== 'assistant') continue

    const content = textFromContent(message.content)
    const thinking = message.role === 'assistant' ? thinkingFromAssistant(message) : ''
    const tools = message.role === 'assistant' ? toolsFromAssistant(message, messages, i) : []
    out.push({
      role: message.role,
      content,
      thinking: thinking || undefined,
      tools: tools.length ? tools : undefined,
    })
  }
  return out
}

function toolsFromAssistant(
  message: Extract<AgentMessage, { role: 'assistant' }>,
  messages: AgentMessage[],
  index: number,
): DisplayTool[] {
  const tools: DisplayTool[] = []
  for (const block of message.content) {
    if (block.type !== 'toolCall') continue
    const result = findToolResult(messages, index + 1, block.id)
    tools.push({
      name: block.name,
      label: toolLabel(block.name, block.arguments),
      output: result ? textFromContent(result.content) : undefined,
      is_error: result?.isError,
    })
  }
  return tools
}

function findToolResult(
  messages: AgentMessage[],
  start: number,
  toolCallId: string,
): ToolResultMessage | null {
  for (let i = start; i < messages.length; i += 1) {
    const message = messages[i]
    if (message.role === 'assistant' || message.role === 'user') break
    if (message.role === 'toolResult' && message.toolCallId === toolCallId) return message
  }
  return null
}

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter((block): block is TextContent => isRecord(block) && block.type === 'text')
    .map((block) => block.text)
    .join('')
}

function thinkingFromAssistant(message: AssistantMessage): string {
  return message.content
    .filter((block) => block.type === 'thinking')
    .map((block) => block.thinking)
    .join('')
}

function piMessagesToRust(messages: AgentMessage[]): RustMessage[] {
  const out: RustMessage[] = []
  for (const message of messages) {
    if (message.role === 'user') {
      out.push({
        role: 'user',
        content: piUserContentToRust(message.content),
      })
    } else if (message.role === 'assistant') {
      out.push({
        role: 'assistant',
        content: message.content.flatMap(piAssistantBlockToRust),
      })
    } else if (message.role === 'toolResult') {
      out.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: message.toolCallId,
            content: textFromContent(message.content),
            is_error: message.isError,
          },
        ],
      })
    }
  }
  return out
}

function piUserContentToRust(content: string | (TextContent | ImageContent)[]): RustContentBlock[] {
  if (typeof content === 'string') return [{ type: 'text', text: content }]
  return content.map((block) => {
    if (block.type === 'image') {
      return { type: 'image', media_type: block.mimeType, data: block.data }
    }
    return { type: 'text', text: block.text }
  })
}

function piAssistantBlockToRust(block: AssistantMessage['content'][number]): RustContentBlock[] {
  if (block.type === 'text') return [{ type: 'text', text: block.text }]
  if (block.type === 'thinking') {
    return [
      {
        type: 'thinking',
        thinking: block.thinking,
        signature: block.thinkingSignature ?? '',
      },
    ]
  }
  return [
    {
      type: 'tool_use',
      id: block.id,
      name: block.name,
      input: block.arguments,
    },
  ]
}

function rustMessagesToPi(messages: RustMessage[]): AgentMessage[] {
  const out: AgentMessage[] = []
  for (const message of messages) {
    const toolResults = message.content.filter(isRustToolResult)
    const nonTool = message.content.filter((block) => !isRustToolResult(block))
    if (message.role === 'user' && toolResults.length === message.content.length) {
      for (const block of toolResults) {
        out.push({
          role: 'toolResult',
          toolCallId: block.tool_use_id,
          toolName: 'tool',
          content: [{ type: 'text', text: block.content }],
          isError: block.is_error === true,
          timestamp: Date.now(),
        })
      }
      continue
    }

    if (message.role === 'user') {
      out.push({
        role: 'user',
        content: rustUserBlocksToPi(nonTool),
        timestamp: Date.now(),
      })
    } else {
      out.push({
        role: 'assistant',
        content: nonTool.flatMap(rustAssistantBlockToPi),
        api: 'unknown' as Api,
        provider: 'unknown',
        model: 'unknown',
        usage: EMPTY_USAGE,
        stopReason: 'stop',
        timestamp: Date.now(),
      })
    }
  }
  return out
}

function rustUserBlocksToPi(blocks: RustContentBlock[]): string | (TextContent | ImageContent)[] {
  const content = blocks.flatMap((block): (TextContent | ImageContent)[] => {
    if (isRustText(block)) return [{ type: 'text', text: block.text }]
    if (isRustImage(block)) return [{ type: 'image', data: block.data, mimeType: block.media_type }]
    return []
  })
  if (content.length === 1 && content[0].type === 'text') return content[0].text
  return content
}

function rustAssistantBlockToPi(block: RustContentBlock): AssistantMessage['content'][number][] {
  if (isRustText(block)) return [{ type: 'text', text: block.text }]
  if (isRustThinking(block)) {
    return [
      {
        type: 'thinking',
        thinking: block.thinking,
        thinkingSignature: block.signature,
      },
    ]
  }
  if (isRustToolUse(block)) {
    return [
      {
        type: 'toolCall',
        id: block.id,
        name: block.name,
        arguments: isRecord(block.input) ? block.input : {},
      },
    ]
  }
  return []
}

function userMessage(message: string, images?: ImageAttachment[] | null): AgentMessage {
  const content: (TextContent | ImageContent)[] = []
  for (const image of images ?? []) {
    content.push({ type: 'image', data: image.data, mimeType: image.media_type })
  }
  content.push({ type: 'text', text: message })
  return { role: 'user', content, timestamp: Date.now() }
}

function toPiImages(images?: ImageAttachment[] | null): ImageContent[] | undefined {
  if (!images?.length) return undefined
  return images.map((image) => ({
    type: 'image',
    data: image.data,
    mimeType: image.media_type,
  }))
}

function buildContextSection(files: string[]): string {
  const chunks: string[] = []
  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf8').slice(0, 8000)
      chunks.push(`### ${basename(file)}\n\n${content}`)
    } catch {
      // Best effort, matching the Rust command's non-fatal context-file reads.
    }
  }
  return chunks.length ? `## 当前上下文\n\n${chunks.join('\n\n')}` : ''
}

function writePersisted(workspaceRoot: string, persisted: PersistedSessionV2): void {
  mkdirSync(conversationsDir(workspaceRoot), { recursive: true })
  writeFileSync(sessionPath(workspaceRoot, persisted.id), `${JSON.stringify(persisted, null, 2)}\n`)
}

function loadSessionSummaries(workspaceRoot: string): SessionSummary[] {
  const dir = conversationsDir(workspaceRoot)
  if (!existsSync(dir)) return []
  const summaries: SessionSummary[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    const path = join(dir, entry.name)
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
      const session = isLikelyPersistedV2(parsed)
        ? normalizePersistedV2(parsed)
        : migrateV1ToV2(parsed as PersistedSessionV1, entry.name.replace(/\.json$/, ''))
      if (!session.messages.length && !session.pi_messages?.length) {
        rmSync(path, { force: true })
        continue
      }
      summaries.push({
        id: session.id,
        title: session.title,
        created_at: session.created_at,
        updated_at: session.updated_at,
        is_streaming: false,
        message_count: session.pi_messages
          ? visibleMessageCount(session.pi_messages)
          : messagesToDisplay(rustMessagesToPi(session.messages)).length,
      })
    } catch {
      // Ignore broken history files, matching Rust's best-effort list behavior.
    }
  }
  return summaries.sort((a, b) => b.updated_at - a.updated_at)
}

function normalizePersistedV2(value: unknown): PersistedSessionV2 {
  const record = value as Partial<PersistedSessionV2>
  return {
    id: String(record.id ?? ''),
    title: typeof record.title === 'string' ? record.title : null,
    title_locked: record.title_locked === true,
    created_at: Number(record.created_at ?? 0),
    updated_at: Number(record.updated_at ?? 0),
    version: 2,
    messages: Array.isArray(record.messages) ? record.messages : [],
    system_prompt: typeof record.system_prompt === 'string' ? record.system_prompt : null,
    expert_contexts: Array.isArray(record.expert_contexts) ? record.expert_contexts : [],
    elapsed_secs: Number(record.elapsed_secs ?? 0),
    total_input_tokens: Number(record.total_input_tokens ?? 0),
    total_output_tokens: Number(record.total_output_tokens ?? 0),
    pi_messages: Array.isArray(record.pi_messages) ? record.pi_messages : undefined,
  }
}

function migrateV1ToV2(value: PersistedSessionV1, fallbackId: string): PersistedSessionV2 {
  const messages: RustMessage[] = []
  for (const message of value.messages ?? []) {
    if (!message.content) continue
    messages.push({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: [{ type: 'text', text: message.content }],
    })
  }
  return {
    id: value.id || fallbackId,
    title: value.title ?? null,
    title_locked: value.title_locked === true,
    created_at: Number(value.created_at ?? 0),
    updated_at: Number(value.updated_at ?? 0),
    version: 2,
    messages,
    system_prompt: value.system_prompt ?? null,
    expert_contexts: [],
    elapsed_secs: 0,
    total_input_tokens: 0,
    total_output_tokens: 0,
  }
}

function conversationsDir(workspaceRoot: string): string {
  return join(workspaceRoot, '.conversations')
}

function sessionPath(workspaceRoot: string, sessionId: string): string {
  return join(conversationsDir(workspaceRoot), `${sessionId}.json`)
}

function nowSecs(now: () => Date): number {
  return Math.floor(now().getTime() / 1000)
}

function generateSessionId(now: Date): string {
  return `${formatDate(now)}_${randomUUID().slice(0, 8)}`
}

function formatDate(date: Date): string {
  const yyyy = String(date.getFullYear())
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}${mm}${dd}`
}

function statsFromSession(session: ConversationSession): SessionStats {
  return {
    elapsed_secs: session.elapsedSecs,
    total_input_tokens: session.totalInputTokens,
    total_output_tokens: session.totalOutputTokens,
  }
}

function sumUsage(messages: AgentMessage[]): { input: number; output: number } {
  return messages.reduce(
    (acc, message) => {
      if (message.role === 'assistant') {
        acc.input += message.usage?.input ?? 0
        acc.output += message.usage?.output ?? 0
      }
      return acc
    },
    { input: 0, output: 0 },
  )
}

function visibleMessageCount(messages: AgentMessage[]): number {
  return messages.filter((message) => message.role === 'user' || message.role === 'assistant')
    .length
}

function toolLabel(name: string, args: unknown): string {
  if (name === 'bash' && isRecord(args) && typeof args.command === 'string') return args.command
  if (isRecord(args) && typeof args.path === 'string') return `${name}: ${args.path}`
  if (isRecord(args) && typeof args.prompt === 'string')
    return `${name}: ${args.prompt.slice(0, 80)}`
  return name
}

function stringifyToolResult(result: unknown): string {
  if (isRecord(result)) {
    const content = result.content
    if (Array.isArray(content)) {
      const text = textFromContent(content)
      if (text) return text
    }
    if (typeof result.output === 'string') return result.output
    if (typeof result.details === 'string') return result.details
  }
  return typeof result === 'string' ? result : JSON.stringify(result ?? null)
}

function isLikelyPersistedV2(value: unknown): value is PersistedSessionV2 {
  if (!isRecord(value)) return false
  return value.version === 2 || looksLikeRustMessages(value.messages)
}

function looksLikeRustMessages(value: unknown): value is RustMessage[] {
  return (
    Array.isArray(value) &&
    value.every((message) => isRecord(message) && Array.isArray(message.content))
  )
}

function isRustText(block: RustContentBlock): block is { type: 'text'; text: string } {
  return isRecord(block) && block.type === 'text' && typeof block.text === 'string'
}

function isRustImage(
  block: RustContentBlock,
): block is { type: 'image'; media_type: string; data: string } {
  return (
    isRecord(block) &&
    block.type === 'image' &&
    typeof block.media_type === 'string' &&
    typeof block.data === 'string'
  )
}

function isRustThinking(
  block: RustContentBlock,
): block is { type: 'thinking'; thinking: string; signature?: string } {
  return isRecord(block) && block.type === 'thinking' && typeof block.thinking === 'string'
}

function isRustToolUse(
  block: RustContentBlock,
): block is { type: 'tool_use'; id: string; name: string; input: unknown } {
  return (
    isRecord(block) &&
    block.type === 'tool_use' &&
    typeof block.id === 'string' &&
    typeof block.name === 'string'
  )
}

function isRustToolResult(
  block: RustContentBlock,
): block is { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean } {
  return (
    isRecord(block) &&
    block.type === 'tool_result' &&
    typeof block.tool_use_id === 'string' &&
    typeof block.content === 'string'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
