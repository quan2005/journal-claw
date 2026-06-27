/**
 * SourceBindingService — captures which local files a Run used as evidence
 * (G6). Makes the "Sources" first-class object explicit: instead of files
 * being opaque inputs, each Run declares what it read/referenced/cited, so
 * the Run panel can show "正在读哪些本地资料" and conclusions can carry
 * "引用依据".
 *
 * captureFromRun() inspects the Run's tool_call events and infers source
 * bindings from file-touching tools (Read, Bash/grep, etc.). This is the
 * deterministic baseline; richer citation extraction can layer on later.
 */
import { randomUUID } from 'node:crypto'
import type { AgentRunEvent, SourceBinding, SourceBindingKind } from '@journal/contracts'

// Tools that read/access files and the kind of binding they imply.
const TOOL_KIND: Record<string, SourceBindingKind> = {
  Read: 'read',
  read_file: 'read',
  Glob: 'search',
  Grep: 'search',
  Bash: 'search',
}

// Extract plausible file paths from a tool's input. Matches bare filenames
// with known extensions OR any token containing a path separator.
const PATH_RE = /(?:[\w./-]+\/[\w./-]+)|(?:\b[\w-]+\.(?:md|mdx|txt|json|ts|tsx|js|jsx|rs|toml|yaml|yml|csv|pdf|html|css)\b)/g

export interface RecordBindingInput {
  runId: string
  path: string
  kind: SourceBindingKind
  excerpt?: string
  sourceSpanId?: string
  note?: string
}

export class SourceBindingService {
  private readonly byRun = new Map<string, SourceBinding[]>()
  private readonly byId = new Map<string, SourceBinding>()

  recordBinding(input: RecordBindingInput): SourceBinding {
    const id = `src-${randomUUID()}`
    const binding: SourceBinding = {
      id,
      runId: input.runId,
      path: input.path,
      kind: input.kind,
      excerpt: input.excerpt,
      sourceSpanId: input.sourceSpanId,
      note: input.note,
      createdAt: new Date().toISOString(),
    }
    this.byId.set(id, binding)
    const list = this.byRun.get(input.runId) ?? []
    list.push(binding)
    this.byRun.set(input.runId, list)
    return binding
  }

  getBinding(id: string): SourceBinding | null {
    return this.byId.get(id) ?? null
  }

  listByRun(runId: string): SourceBinding[] {
    return this.byRun.get(runId) ?? []
  }

  listByKind(kind: SourceBindingKind): SourceBinding[] {
    return [...this.byId.values()].filter((b) => b.kind === kind)
  }

  listAll(): SourceBinding[] {
    return [...this.byId.values()]
  }

  /**
   * Inspect a Run's tool_call events and record a binding for each
   * file-touching tool, with the path(s) extracted from the tool input.
   * Dedupes (runId, path, kind). Returns the newly recorded bindings.
   */
  captureFromRun(runId: string, events: AgentRunEvent[]): SourceBinding[] {
    const seen = new Set(this.listByRun(runId).map((b) => `${b.path}|${b.kind}`))
    const recorded: SourceBinding[] = []
    const resultsBySpan = collectToolResultsBySpan(events)
    for (const ev of events) {
      if (ev.type !== 'tool_call') continue
      let name: string
      let input: unknown
      try {
        const d = JSON.parse(ev.data) as { name?: string; input?: unknown }
        name = d.name ?? ''
        input = d.input
      } catch {
        continue
      }
      const kind = TOOL_KIND[name]
      if (!kind) continue
      const paths = extractPaths(input)
      for (const path of paths) {
        const key = `${path}|${kind}`
        if (seen.has(key)) continue
        seen.add(key)
        recorded.push(
          this.recordBinding({
            runId,
            path,
            kind,
            sourceSpanId: ev.spanId,
            excerpt: excerptFromResult(resultsBySpan.get(ev.spanId ?? '')),
            note: `inferred from ${name} tool call`,
          }),
        )
      }
    }
    return recorded
  }
}

function collectToolResultsBySpan(events: AgentRunEvent[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const ev of events) {
    if (ev.type !== 'tool_result' || !ev.spanId) continue
    const text = extractResultText(ev.data)
    if (text) out.set(ev.spanId, text)
  }
  return out
}

function extractResultText(data: string): string {
  try {
    const parsed = JSON.parse(data) as { content?: unknown; result?: unknown; text?: unknown }
    const candidate = parsed.content ?? parsed.result ?? parsed.text
    return stringify(candidate)
  } catch {
    return data
  }
}

function excerptFromResult(text: string | undefined): string | undefined {
  const trimmed = text?.replace(/\s+/g, ' ').trim()
  if (!trimmed) return undefined
  return trimmed.slice(0, 240)
}

function stringify(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return ''
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function extractPaths(input: unknown): string[] {
  if (input == null) return []
  const text =
    typeof input === 'string'
      ? input
      : (() => {
          try {
            return JSON.stringify(input)
          } catch {
            return ''
          }
        })()
  const matches = text.match(PATH_RE)
  return matches ? dedupe(matches).slice(0, 20) : []
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)]
}
