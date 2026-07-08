import { lstatSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { ConversationService } from '../conversation/service.js'
import type { AutomationRoutine, AutomationRun, RunManifest } from './types.js'

/**
 * RoutineRunner — executes a routine through the ME pi engine via
 * ConversationService (the M5 multi-turn session layer), then derives a
 * RunManifest from the conversation output + a before/after workspace diff.
 *
 * This is the daemon analog of Rust automation_runner.rs::run_routine_agent,
 * which ran an unattended agent session. We reuse ConversationService instead
 * of spawning a separate engine/run store, per the M6 constraint.
 */
export interface RoutineRunnerOptions {
  now?: () => Date
  /**
   * Walk the workspace to build the before/after file diff. Exposed so tests
   * can inject a no-op snapshot. Defaults to a real recursive directory walk.
   */
  snapshot?: (workspaceRoot: string) => Map<string, FileStamp>
}

export interface RoutineRunSuccess {
  conversationId: string
  manifest: RunManifest
}

export interface RoutineRunFailure {
  message: string
  conversationId: string | null
  manifest: RunManifest | null
}

export interface FileStamp {
  mtimeMs: number
  size: number
}

interface SnapshotDiff {
  created: string[]
  modified: string[]
  deleted: string[]
}

export class RoutineRunner {
  private readonly conversation: ConversationService
  private readonly now: () => Date
  private readonly snapshot: (workspaceRoot: string) => Map<string, FileStamp>

  constructor(conversation: ConversationService, opts: RoutineRunnerOptions = {}) {
    this.conversation = conversation
    this.now = opts.now ?? (() => new Date())
    this.snapshot = opts.snapshot ?? snapshotWorkspace
  }

  async run(
    workspaceRoot: string,
    routine: AutomationRoutine,
    run: AutomationRun,
  ): Promise<RoutineRunSuccess> {
    const before = this.snapshot(workspaceRoot)
    const prompt = buildUnattendedPrompt(routine, run)
    const sessionId = this.conversation.create(`自动化：${routine.title}`)
    let agentError: Error | null = null
    try {
      await this.conversation.send(sessionId, prompt)
      await this.conversation.waitForIdle(sessionId)
    } catch (err) {
      agentError = err instanceof Error ? err : new Error(String(err))
    }

    const messages = this.conversation.getMessages(sessionId)
    const assistantText = extractAssistantText(messages)
    const filesRead = collectFilesRead(messages)
    // The before/after diff is best-effort: a snapshot failure must not erase
    // the conversation output, so fall back to an empty diff.
    let changed: SnapshotDiff = { created: [], modified: [], deleted: [] }
    try {
      const after = this.snapshot(workspaceRoot)
      changed = diffSnapshots(before, after)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      agentError = agentError ?? new Error(message)
    }

    const warnings = agentError ? [`automation failed: ${agentError.message}`] : []
    const manifest = buildManifest(
      sessionId,
      routine.title,
      assistantText,
      filesRead,
      warnings,
      changed,
    )
    if (agentError) {
      throw {
        message: agentError.message,
        conversationId: sessionId,
        manifest,
      } satisfies RoutineRunFailure
    }
    return { conversationId: sessionId, manifest }
  }
}

/** Build the unattended prompt, mirroring Rust build_unattended_prompt. */
export function buildUnattendedPrompt(routine: AutomationRoutine, run: AutomationRun): string {
  return `你正在执行一个无人值守的 JournalClaw 自动化任务。

规则：
- 你拥有完整 Agent 权限，可以根据任务目标自主读取、创建、修改 workspace 文件。
- 不要向用户反问。信息不足时，记录不确定性并继续完成任务。
- 必须遵守 workspace AGENTS.md 和相关 skill 规则。
- 结束前用简短自然语言说明你做了什么。

Routine:
- id: ${routine.id}
- title: ${routine.title}
- run_id: ${run.id}
- schedule_trigger: ${run.trigger}
- scope: ${JSON.stringify(routine.scope)}

任务 Prompt:
${routine.prompt}

结束前请尽量列出你读取和修改的文件。系统会自动生成 run manifest。`
}

function buildManifest(
  conversationId: string,
  title: string,
  assistantText: string,
  filesRead: string[],
  warnings: string[],
  changed: SnapshotDiff,
): RunManifest {
  const filesChanged = [...changed.created, ...changed.modified, ...changed.deleted].sort()
  const entriesCreated = changed.created.filter(isJournalEntryPath)
  const todosChanged = filesChanged.filter(isTodosPath)
  const identitiesChanged = filesChanged.filter((p) => p.startsWith('identities/'))
  return {
    summary: summarizeText(title, assistantText),
    files_read: filesRead,
    files_changed: filesChanged,
    entries_created: entriesCreated,
    todos_changed: todosChanged,
    identities_changed: identitiesChanged,
    warnings,
    conversation_id: conversationId,
  }
}

function summarizeText(title: string, assistantText: string): string {
  const firstLine =
    assistantText
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? '运行完成'
  const clipped = [...firstLine].slice(0, 120).join('')
  return `${title}：${clipped}`
}

interface LoadedMessage {
  role: string
  content: string
  tools?: { name: string; label?: string; output?: string; is_error?: boolean }[]
}

function extractAssistantText(messages: LoadedMessage[]): string {
  return messages
    .filter((message) => message.role === 'assistant')
    .map((message) => message.content)
    .join('')
}

function collectFilesRead(messages: LoadedMessage[]): string[] {
  const out = new Set<string>()
  for (const message of messages) {
    for (const tool of message.tools ?? []) {
      if (tool.is_error) continue
      const match = tool.label?.match(/^(?:read_file|glob|grep|list):\s*(.+)$/)
      if (match) out.add(match[1].trim())
    }
  }
  return [...out].sort()
}

function isJournalEntryPath(path: string): boolean {
  const parts = path.split('/')
  // Legacy layout: <YYMM>/<file>.md
  if (parts.length === 2 && /^\d{4}$/.test(parts[0]) && parts[1].endsWith('.md')) return true
  // Current layout: .journal/memory/<YYMM>/<file>.md
  if (
    parts.length === 4 &&
    parts[0] === '.journal' &&
    parts[1] === 'memory' &&
    /^\d{4}$/.test(parts[2]) &&
    parts[3].endsWith('.md')
  ) {
    return true
  }
  return false
}

function isTodosPath(path: string): boolean {
  return (
    path === 'todos.md' ||
    path === 'done.md' ||
    path === '.journal/todos.md' ||
    path === '.journal/todos.done.md' ||
    path === '.journal/done.md'
  )
}

export function diffSnapshots(
  before: Map<string, FileStamp>,
  after: Map<string, FileStamp>,
): SnapshotDiff {
  const created = [...after.keys()].filter((path) => !before.has(path))
  const modified = [...after.entries()]
    .filter(([path, stamp]) => {
      const prev = before.get(path)
      return prev ? prev.mtimeMs !== stamp.mtimeMs || prev.size !== stamp.size : false
    })
    .map(([path]) => path)
  const deleted = [...before.keys()].filter((path) => !after.has(path))
  return { created, modified, deleted }
}

/**
 * Recursive workspace snapshot: maps relative posix path -> {mtimeMs, size}.
 * Excludes `.conversations/` and `.Codex/automations/`, and does not follow
 * symlinked directories — matching the Rust snapshot_workspace hardening.
 */
export function snapshotWorkspace(workspaceRoot: string): Map<string, FileStamp> {
  const out = new Map<string, FileStamp>()
  visit(workspaceRoot, workspaceRoot, out)
  return out
}

function visit(root: string, dir: string, out: Map<string, FileStamp>): void {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const path = join(dir, entry.name)
    const rel = toPosix(relative(root, path))
    if (isExcludedSnapshotPath(rel)) continue
    let stat
    try {
      stat = lstatSync(path)
    } catch {
      continue
    }
    if (stat.isSymbolicLink()) {
      // Do not follow symlinked directories.
      let target
      try {
        target = statSync(path)
      } catch {
        continue
      }
      if (target.isDirectory()) continue
    }
    if (stat.isDirectory()) {
      visit(root, path, out)
    } else if (stat.isFile()) {
      out.set(rel, { mtimeMs: stat.mtimeMs, size: stat.size })
    }
  }
}

function isExcludedSnapshotPath(rel: string): boolean {
  return (
    rel === '.conversations' ||
    rel.startsWith('.conversations/') ||
    rel === '.Codex/automations' ||
    rel.startsWith('.Codex/automations/')
  )
}

function toPosix(path: string): string {
  return path.replace(/\\/g, '/')
}
