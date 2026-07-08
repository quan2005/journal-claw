import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { Provider } from '@earendil-works/pi-ai'
import type { AgentRunEvent } from '@journal/contracts'
import type { ChangeSetService } from '../changeset/service.js'
import type { ConfigService } from '../config/service.js'
import type { AgentRunService } from '../runs/service.js'
import type { SkillsService } from '../skills/service.js'
import { executeBuiltinRun } from '../engine/run.js'
import { memoryMonthDir, todosPath } from '../workspace/paths.js'

export type ProcessingStatus = 'queued' | 'processing' | 'completed' | 'failed'
export type MaterialType = 'audio' | 'text' | 'image' | 'other'

export interface ProcessingUpdate {
  material_path: string
  status: ProcessingStatus
  error?: string | null
  structured_error?: unknown
}

export interface AiLogLine {
  material_path: string
  level: 'info' | 'error' | 'phase'
  message: string
}

export interface ProcessingPlan {
  material_path: string
  year_month: string
  material_type: MaterialType
  source_digest: string
  is_duplicate: boolean
  user_prompt: string
  model: string
}

export interface TriggerAiProcessingInput {
  materialPath: string
  yearMonth: string
  note?: string | null
  promptText?: string | null
}

export interface AiProcessorEvents {
  processing?: (event: ProcessingUpdate) => void
  log?: (event: AiLogLine) => void
  journalUpdated?: (yearMonth: string) => void
  todosUpdated?: () => void
}

export interface AiProcessorOptions {
  providers?: Provider[]
  changeSetService?: () => ChangeSetService
  skillsService?: () => SkillsService
  now?: () => Date
  events?: AiProcessorEvents
}

interface QueueTask extends TriggerAiProcessingInput {
  materialPath: string
  yearMonth: string
  promptText?: string | null
}

const COMPACT_PREAMBLE =
  '本会话已从之前的对话延续，上下文超出限制已被压缩。以下摘要涵盖了早期对话内容。\n\n'
const COMPACT_RECENT_NOTE = '近期消息已原样保留。'
const COMPACT_RESUME =
  '请从上次中断处继续对话，不要询问用户额外问题。直接继续——不要确认摘要，不要复述之前的内容。'
const PRESERVE_RECENT_MESSAGES = 6
const AUTO_COMPACT_INPUT_TOKENS_THRESHOLD = 100_000

export class AiProcessorService {
  private queue: QueueTask[] = []
  private running = false
  private current: AbortController | null = null
  private readonly cancelledPaths = new Set<string>()

  constructor(
    private readonly workspaceRoot: string,
    private readonly runService: AgentRunService,
    private readonly configService: ConfigService,
    private readonly opts: AiProcessorOptions = {},
  ) {}

  async trigger(input: TriggerAiProcessingInput): Promise<void> {
    this.emitProcessing({
      material_path: input.materialPath,
      status: 'queued',
      error: null,
      structured_error: null,
    })
    this.queue.push({
      materialPath: input.materialPath,
      yearMonth: input.yearMonth,
      note: input.note ?? null,
      promptText: input.promptText ?? null,
    })
    void this.consume()
  }

  async triggerPrompt(prompt: string): Promise<void> {
    const label = promptLabel(prompt)
    await this.trigger({
      materialPath: label,
      yearMonth: currentYearMonth(this.opts.now?.() ?? new Date()),
      promptText: prompt,
    })
  }

  cancel(): void {
    this.current?.abort()
    this.current = null
  }

  cancelQueued(materialPath: string): void {
    this.cancelledPaths.add(materialPath)
    this.queue = this.queue.filter((task) => task.materialPath !== materialPath)
  }

  plan(input: TriggerAiProcessingInput): ProcessingPlan | null {
    const model = resolveModelForDigest(this.configService)
    return planProcessing(
      this.workspaceRoot,
      input.materialPath,
      input.yearMonth,
      input.note,
      input.promptText,
      model,
    )
  }

  private async consume(): Promise<void> {
    if (this.running) return
    this.running = true
    try {
      while (this.queue.length > 0) {
        const task = this.queue.shift()
        if (!task) continue
        if (this.cancelledPaths.delete(task.materialPath)) continue
        await this.process(task)
      }
    } finally {
      this.running = false
    }
  }

  private async process(task: QueueTask): Promise<void> {
    this.emitProcessing({
      material_path: task.materialPath,
      status: 'processing',
      error: null,
      structured_error: null,
    })

    const plan = this.plan(task)
    if (!plan) {
      this.emitProcessing({
        material_path: task.materialPath,
        status: 'failed',
        error: '无法读取素材文件',
        structured_error: null,
      })
      return
    }

    if (plan.is_duplicate) {
      this.emitProcessing({
        material_path: task.materialPath,
        status: 'completed',
        error: '相同内容已处理，跳过重复处理',
        structured_error: null,
      })
      return
    }

    const run = this.runService.createRun({
      goal: plan.user_prompt,
      mode: 'agent',
      agentId: 'builtin',
      authorizationMode: 'workspace_write',
    })
    const controller = new AbortController()
    this.current = controller
    const started = this.opts.now?.() ?? new Date()
    let finalText = ''
    const unsubscribe = this.runService.subscribe(run.id, (event) => {
      finalText += this.handleRunEvent(task.materialPath, event)
    })

    this.emitLog({
      material_path: task.materialPath,
      level: 'info',
      message: `启动 内置引擎 (${resolveProviderId(this.configService)}/${plan.model}) ...`,
    })

    const result = await executeBuiltinRun(
      this.runService,
      this.configService,
      {
        runId: run.id,
        prompt: plan.user_prompt,
        systemPrompt: `Workspace: ${this.workspaceRoot}`,
        workspaceRoot: this.workspaceRoot,
        authorizationMode: 'workspace_write',
      },
      {
        providers: this.opts.providers,
        signal: controller.signal,
        changeSetService: this.opts.changeSetService?.(),
        skillsService: this.opts.skillsService?.(),
      },
    )
    unsubscribe()
    if (this.current === controller) this.current = null

    if (!result.ok) {
      const status = this.runService.getRun(run.id)?.status
      this.emitProcessing({
        material_path: task.materialPath,
        status: 'failed',
        error: status === 'canceled' || controller.signal.aborted ? 'cancelled' : 'AI 处理失败',
        structured_error: null,
      })
      return
    }

    injectSourceDigest(
      this.workspaceRoot,
      task.yearMonth,
      plan.source_digest,
      this.opts.now?.() ?? new Date(),
    )
    this.emitLog({
      material_path: task.materialPath,
      level: 'info',
      message: `完成 · ${(((this.opts.now?.() ?? new Date()).getTime() - started.getTime()) / 1000).toFixed(1)}s`,
    })
    this.emitProcessing({
      material_path: task.materialPath,
      status: 'completed',
      error: null,
      structured_error: null,
    })
    this.opts.events?.journalUpdated?.(task.yearMonth)
    if (existsSync(todosPath(this.workspaceRoot))) this.opts.events?.todosUpdated?.()
    void finalText
  }

  private handleRunEvent(materialPath: string, event: AgentRunEvent): string {
    if (event.type === 'text_delta') {
      return parseEventText(event.data)
    }
    if (event.type === 'tool_call') {
      const tool = parseEventJson(event.data)
      const name = typeof tool.name === 'string' ? tool.name : 'tool'
      this.emitLog({ material_path: materialPath, level: 'phase', message: phaseLabel(name) })
      this.emitLog({ material_path: materialPath, level: 'info', message: name })
    }
    if (event.type === 'tool_result') {
      const result = parseEventJson(event.data)
      if (result.isError === true) {
        this.emitLog({
          material_path: materialPath,
          level: 'error',
          message: '[error] 工具执行失败',
        })
      }
    }
    return ''
  }

  private emitProcessing(event: ProcessingUpdate): void {
    this.opts.events?.processing?.(event)
  }

  private emitLog(event: AiLogLine): void {
    this.opts.events?.log?.(event)
  }
}

export function classifyMaterial(path: string): MaterialType {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  if (['m4a', 'wav', 'mp3', 'aac', 'ogg', 'flac', 'webm'].includes(ext)) return 'audio'
  if (['txt', 'md', 'pdf', 'docx', 'doc'].includes(ext)) return 'text'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext)) return 'image'
  return 'other'
}

export function buildDefaultUserPrompt(
  materialPath: string,
  yearMonth: string,
  note?: string | null,
): string {
  const suffix = note?.trim() ? ` ${note.trim()}` : ''
  return `分析和处理 @.journal/memory/${yearMonth}/raw/${basename(materialPath)}${suffix}`
}

export function computeSourceDigest(
  materialBytes: Buffer | Uint8Array,
  promptVersion: string,
  modelId: string,
): string {
  return createHash('sha256')
    .update(materialBytes)
    .update(promptVersion)
    .update(modelId)
    .digest('hex')
}

export function planProcessing(
  workspaceRoot: string,
  materialPath: string,
  yearMonth: string,
  note: string | null | undefined,
  promptText: string | null | undefined,
  model: string,
): ProcessingPlan | null {
  let materialBytes: Buffer
  try {
    materialBytes = readFileSync(materialPath)
  } catch {
    if (!promptText?.trim()) return null
    materialBytes = Buffer.from(promptText)
  }
  const sourceDigest = computeSourceDigest(materialBytes, 'v1', model)
  return {
    material_path: materialPath,
    year_month: yearMonth,
    material_type: classifyMaterial(materialPath),
    source_digest: sourceDigest,
    is_duplicate: hasExistingDigest(workspaceRoot, yearMonth, sourceDigest),
    user_prompt: promptText?.trim()
      ? promptText
      : buildDefaultUserPrompt(materialPath, yearMonth, note),
    model,
  }
}

export function shouldAutoCompact(cumulativeInputTokens: number): boolean {
  return cumulativeInputTokens >= AUTO_COMPACT_INPUT_TOKENS_THRESHOLD
}

export interface CompactMessage {
  role: 'user' | 'assistant'
  content: string
}

export function compactMessages(
  messages: CompactMessage[],
): { messages: CompactMessage[]; removed: number } | null {
  const prefixLen = messages[0]?.content.startsWith(COMPACT_PREAMBLE.trimEnd()) ? 1 : 0
  if (messages.length - prefixLen <= PRESERVE_RECENT_MESSAGES) return null
  const keepFrom = Math.max(prefixLen, messages.length - PRESERVE_RECENT_MESSAGES)
  if (keepFrom <= prefixLen) return null
  const removed = messages.slice(prefixLen, keepFrom)
  const preserved = messages.slice(keepFrom)
  const summary = summarizeMessages(removed)
  const continuation = `${COMPACT_PREAMBLE}${summary}\n\n${preserved.length ? `${COMPACT_RECENT_NOTE}\n` : ''}${COMPACT_RESUME}`
  return {
    messages: [{ role: 'user', content: continuation }, ...preserved],
    removed: removed.length,
  }
}

export function promptLabel(prompt: string): string {
  const chars = [...prompt]
  const label = chars.slice(0, 20).join('')
  return chars.length > 20 ? `${label}…` : label
}

function resolveModelForDigest(configService: ConfigService): string {
  const config = configService.getEngineConfig()
  const provider = config.providers.find((entry) => entry.id === config.active_provider)
  return provider?.model || 'unknown-model'
}

function resolveProviderId(configService: ConfigService): string {
  return configService.getEngineConfig().active_provider || 'unknown'
}

function hasExistingDigest(workspaceRoot: string, yearMonth: string, digest: string): boolean {
  const monthDir = memoryMonthDir(workspaceRoot, yearMonth)
  if (!existsSync(monthDir)) return false
  return readdirSync(monthDir, { withFileTypes: true }).some((entry) => {
    if (!entry.isFile() || !entry.name.endsWith('.md')) return false
    return parseSourceDigest(readFileSync(join(monthDir, entry.name), 'utf8')) === digest
  })
}

function parseSourceDigest(content: string): string | null {
  if (!content.startsWith('---')) return null
  const rest = content.slice(3)
  const end = rest.indexOf('---')
  if (end < 0) return null
  for (const line of rest.slice(0, end).split(/\r?\n/)) {
    const match = line.match(/^\s*source_digest\s*:\s*(.+?)\s*$/)
    if (match) return match[1].replace(/^['"]|['"]$/g, '')
  }
  return null
}

function injectSourceDigest(
  workspaceRoot: string,
  yearMonth: string,
  digest: string,
  now: Date,
): void {
  const monthDir = memoryMonthDir(workspaceRoot, yearMonth)
  if (!existsSync(monthDir)) return
  const cutoff = now.getTime() - 30_000
  const newest = readdirSync(monthDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => {
      const path = join(monthDir, entry.name)
      return { path, mtime: statSync(path).mtimeMs }
    })
    .filter((entry) => entry.mtime > cutoff)
    .sort((a, b) => b.mtime - a.mtime)[0]
  if (!newest) return
  const content = readFileSync(newest.path, 'utf8')
  if (parseSourceDigest(content)) return
  if (!content.startsWith('---')) return
  const rest = content.slice(3)
  const end = rest.indexOf('---')
  if (end < 0) return
  writeFileSync(
    newest.path,
    `---${rest.slice(0, end)}source_digest: ${digest}\n---${rest.slice(end + 3)}`,
    'utf8',
  )
}

function summarizeMessages(messages: CompactMessage[]): string {
  const userCount = messages.filter((message) => message.role === 'user').length
  const assistantCount = messages.filter((message) => message.role === 'assistant').length
  const recent = messages
    .filter((message) => message.role === 'user' && message.content.trim())
    .slice(-3)
    .map((message) => `  - ${truncate(message.content, 160)}`)
  const lines = [
    '<summary>',
    '对话摘要:',
    `- 范围: 压缩了 ${messages.length} 条早期消息 (用户=${userCount}, 助手=${assistantCount})。`,
  ]
  if (recent.length) lines.push('- 近期用户请求:', ...recent)
  lines.push('</summary>')
  return lines.join('\n')
}

function truncate(content: string, maxChars: number): string {
  return [...content].length <= maxChars
    ? content
    : `${[...content].slice(0, maxChars - 1).join('')}…`
}

function currentYearMonth(date: Date): string {
  return `${String(date.getFullYear()).slice(2)}${String(date.getMonth() + 1).padStart(2, '0')}`
}

function phaseLabel(toolName: string): string {
  if (toolName === 'bash') return '执行命令'
  if (toolName === 'read_file') return '读取文件'
  if (toolName === 'write_file') return '写入文件'
  if (toolName === 'edit_file') return '编辑文件'
  if (toolName === 'load_skill') return '加载技能'
  if (toolName === 'glob_search' || toolName === 'grep_search') return '搜索文件'
  return '调用工具'
}

function parseEventJson(data: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(data) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function parseEventText(data: string): string {
  const parsed = parseEventJson(data)
  return typeof parsed.text === 'string' ? parsed.text : ''
}

export function newSessionId(): string {
  return randomUUID()
}
