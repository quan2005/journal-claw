/**
 * SedimentationService — completes the core loop's final step
 * ("沉淀为笔记/规则/记忆"). When a Run finishes, this derives durable
 * memory from it so the workspace accumulates long-term knowledge the Agent
 * can reuse, rather than every Run starting from scratch.
 *
 * Today's extraction is deterministic + structural (it reads the Run's events,
 * artifacts, and change sets for signals). The shape is the product value:
 * records carry source run + evidence + linked artifact/changeSet ids + a
 * review status, so the user can audit and reject what the Agent "learned".
 * An LLM-based extractor can drop into extractFromRun() later without
 * changing the MemoryRecord contract.
 *
 * Outputs (all traceable to the source run):
 *   - a run summary note persisted to <workspace>/.journal/runs/<runId>/summary.md
 *   - preference/project_fact/writing_rule/tool_rule records extracted from
 *     the run's assistant text and tool calls
 *
 * Review lifecycle (status field):
 *   auto_recorded -> edited | rejected. Rejected records are kept for audit
 *   but excluded from durable context assembly (see listDurable()).
 */
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type {
  AgentRunEvent,
  Artifact,
  ChangeSet,
  AuthorizationMode,
  MemoryKind,
  MemoryRecord,
  MemoryRecordStatus,
} from '@journal/contracts'

export interface SedimentationResult {
  /** Run summary note record. */
  summary: MemoryRecord
  /** Extracted memory records (preferences/facts/rules). */
  records: MemoryRecord[]
  /** All records produced, for convenience. */
  all: MemoryRecord[]
}

export class SedimentationService {
  private readonly byRun = new Map<string, MemoryRecord[]>()
  private readonly byId = new Map<string, MemoryRecord>()

  /**
   * @param workspaceRoot Absolute workspace root. Used to persist the run
   * summary note to `<root>/.journal/runs/<runId>/summary.md`. May be omitted
   * in pure-unit test scenarios; the summary file is then skipped.
   */
  constructor(private readonly workspaceRoot?: string) {}

  /**
   * Run sedimentation over a completed run's events + artifacts + changes.
   * Idempotent by runId: re-running for the same run replaces (not duplicates)
   * that run's sedimented records.
   */
  sediment(
    runId: string,
    events: AgentRunEvent[],
    artifacts: Artifact[],
    changeSets: ChangeSet[],
    options: { authorizationMode?: AuthorizationMode } = {},
  ): SedimentationResult {
    const records: MemoryRecord[] = []
    const assistantText = collectAssistantText(events)
    const toolCalls = collectToolCalls(events)
    const changeSetIds = changeSets.map((c) => c.id)

    // 1. Run summary note — always produced; persisted to disk so the
    // workspace carries a human-readable account of what each run did.
    const summaryDetail = buildRunSummary(runId, assistantText, artifacts, changeSets, toolCalls)
    const summaryPath =
      options.authorizationMode === 'read_only'
        ? undefined
        : this.persistSummary(runId, summaryDetail)
    const summary: MemoryRecord = this.make(
      runId,
      'note',
      `Run ${shortId(runId)} summary`,
      summaryDetail,
      [assistantText.slice(0, 400)],
      undefined,
      changeSetIds,
      summaryPath,
    )

    // 2. Preferences — detect explicit preference phrasing in assistant text.
    for (const p of extractPreferences(assistantText)) {
      records.push(
        this.make(runId, 'preference', p.summary, p.detail, p.evidence, artifactIds(artifacts)),
      )
    }

    // 3. Project facts — detect factual assertions about the project.
    for (const f of extractFacts(assistantText)) {
      records.push(
        this.make(runId, 'project_fact', f.summary, f.detail, f.evidence, undefined, changeSetIds),
      )
    }

    // 4. Writing rules — detect style/format guidance.
    for (const r of extractWritingRules(assistantText)) {
      records.push(this.make(runId, 'writing_rule', r.summary, r.detail, r.evidence))
    }

    // 5. Tool rules — infer from tool-call patterns (e.g. a tool used repeatedly).
    for (const t of inferToolRules(toolCalls)) {
      records.push(this.make(runId, 'tool_rule', t.summary, t.detail, t.evidence))
    }

    const all = [summary, ...records]
    // refresh the id index for this run
    for (const r of all) this.byId.set(r.id, r)
    this.byRun.set(runId, all)
    return { summary, records, all }
  }

  // ── review lifecycle (status) ────────────────────────────────────────────

  /** Edit a record's summary/detail (status -> 'edited'). */
  editRecord(id: string, patch: { summary?: string; detail?: string }): MemoryRecord | undefined {
    const rec = this.byId.get(id)
    if (!rec) return undefined
    if (typeof patch.summary === 'string') rec.summary = patch.summary
    if (typeof patch.detail === 'string') rec.detail = patch.detail
    rec.status = 'edited'
    rec.updatedAt = new Date().toISOString()
    return rec
  }

  /** Reject a record (status -> 'rejected'); it is kept for audit but excluded from durable context. */
  rejectRecord(id: string): MemoryRecord | undefined {
    const rec = this.byId.get(id)
    if (!rec) return undefined
    rec.status = 'rejected'
    rec.updatedAt = new Date().toISOString()
    return rec
  }

  /** Restore a rejected/edited record to auto_recorded (undo a reject). */
  restoreRecord(id: string): MemoryRecord | undefined {
    const rec = this.byId.get(id)
    if (!rec) return undefined
    rec.status = 'auto_recorded'
    rec.updatedAt = new Date().toISOString()
    return rec
  }

  // ── queries ───────────────────────────────────────────────────────────────

  listByRun(runId: string): MemoryRecord[] {
    return this.byRun.get(runId) ?? []
  }

  listByKind(kind: MemoryKind): MemoryRecord[] {
    return [...this.byRun.values()].flat().filter((r) => r.kind === kind)
  }

  /** All records regardless of status (audit view). */
  listAll(): MemoryRecord[] {
    return [...this.byRun.values()].flat()
  }

  /**
   * Durable records usable for context assembly: excludes rejected records
   * (the user has decided these should not influence future runs) and run
   * summary notes (ephemeral, not reusable knowledge).
   */
  listDurable(): MemoryRecord[] {
    return [...this.byRun.values()]
      .flat()
      .filter((r) => r.kind !== 'note' && r.status !== 'rejected')
  }

  getRecord(id: string): MemoryRecord | undefined {
    return this.byId.get(id)
  }

  // ── internal ──────────────────────────────────────────────────────────────

  private persistSummary(runId: string, detail: string): string | undefined {
    if (!this.workspaceRoot) return undefined
    try {
      const dir = join(this.workspaceRoot, '.journal', 'runs', runId)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      const file = join(dir, 'summary.md')
      writeFileSync(file, detail, 'utf8')
      return `.journal/runs/${runId}/summary.md`
    } catch {
      return undefined
    }
  }

  private make(
    sourceRunId: string,
    kind: MemoryKind,
    summary: string,
    detail: string,
    evidence: string[],
    sourceArtifactIds?: string[],
    changeSetIds?: string[],
    path?: string,
  ): MemoryRecord {
    const status: MemoryRecordStatus = 'auto_recorded'
    return {
      id: `mem-${randomUUID()}`,
      sourceRunId,
      kind,
      summary,
      detail,
      evidence,
      sourceArtifactIds,
      changeSetIds,
      path,
      status,
      createdAt: new Date().toISOString(),
    }
  }
}

// ── extraction helpers ────────────────────────────────────────────────────

function collectAssistantText(events: AgentRunEvent[]): string {
  return events
    .filter((e) => e.type === 'text_delta')
    .map((e) => {
      try {
        const d = JSON.parse(e.data) as { text?: string }
        return typeof d.text === 'string' ? d.text : ''
      } catch {
        return ''
      }
    })
    .join('')
}

function collectToolCalls(events: AgentRunEvent[]): { name: string; input: unknown }[] {
  const out: { name: string; input: unknown }[] = []
  for (const e of events) {
    if (e.type !== 'tool_call') continue
    try {
      const d = JSON.parse(e.data) as { name?: string; input?: unknown }
      out.push({ name: d.name ?? 'tool', input: d.input })
    } catch {
      // ignore
    }
  }
  return out
}

interface Extracted {
  summary: string
  detail: string
  evidence: string[]
}

function snippetAround(text: string, idx: number, span = 160): string {
  const start = Math.max(0, idx - 20)
  return text.slice(start, Math.min(text.length, idx + span)).trim()
}

// Preference signals: "I prefer", "you prefer", "preference:", "default to",
// "always use", "never use" (near an action).
function extractPreferences(text: string): Extracted[] {
  const patterns = [
    /\b(?:I|you)\s+(?:prefer|like|want|always use|never use)\b/gi,
    /\bpreference\s*:/gi,
    /\bdefault\s+to\b/gi,
  ]
  return dedupeExtracted(
    patterns
      .flatMap((re) => [...text.matchAll(re)])
      .map((m) => {
        const around = snippetAround(text, m.index ?? 0)
        return {
          summary: around.slice(0, 80),
          detail: around,
          evidence: [around],
        }
      }),
  )
}

// Fact signals: "the project is", "we use", "our stack", "this workspace",
// "located at", factual "X is Y" about the project.
function extractFacts(text: string): Extracted[] {
  const patterns = [
    /\b(?:the\s+project|this\s+workspace|our\s+(?:stack|codebase|repo))\b/gi,
    /\bwe\s+(?:use|built|deploy|store)\b/gi,
    /\blocated\s+at\b/gi,
  ]
  return dedupeExtracted(
    patterns
      .flatMap((re) => [...text.matchAll(re)])
      .map((m) => {
        const around = snippetAround(text, m.index ?? 0)
        return { summary: around.slice(0, 80), detail: around, evidence: [around] }
      }),
  )
}

// Writing-rule signals: "write in", "use a tone", "format as", "keep it
// concise", "avoid".
function extractWritingRules(text: string): Extracted[] {
  const patterns = [
    /\bwrite\s+(?:in|using|with)\b/gi,
    /\b(?:tone|format|style)\s*:/gi,
    /\b(?:keep\s+it|avoid|don'?t)\b/gi,
  ]
  return dedupeExtracted(
    patterns
      .flatMap((re) => [...text.matchAll(re)])
      .map((m) => {
        const around = snippetAround(text, m.index ?? 0)
        return { summary: around.slice(0, 80), detail: around, evidence: [around] }
      }),
  )
}

// Tool-rule inference: a tool used 3+ times suggests a habitual tool choice.
function inferToolRules(calls: { name: string; input: unknown }[]): Extracted[] {
  const counts = new Map<string, number>()
  for (const c of calls) counts.set(c.name, (counts.get(c.name) ?? 0) + 1)
  const out: Extracted[] = []
  for (const [name, n] of counts) {
    if (n >= 3) {
      out.push({
        summary: `Agent favors ${name} (used ${n}×)`,
        detail: `The run invoked ${name} ${n} times, suggesting it as a habitual tool choice for similar tasks.`,
        evidence: [`${name} ×${n}`],
      })
    }
  }
  return out
}

function dedupeExtracted(items: Extracted[]): Extracted[] {
  const seen = new Set<string>()
  const out: Extracted[] = []
  for (const it of items) {
    const key = it.summary.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(it)
  }
  return out.slice(0, 10)
}

function artifactIds(artifacts: Artifact[]): string[] {
  return artifacts.map((a) => a.id)
}

function shortId(id: string): string {
  return id.slice(0, 8)
}

function buildRunSummary(
  runId: string,
  assistantText: string,
  artifacts: Artifact[],
  changeSets: ChangeSet[],
  toolCalls: { name: string }[],
): string {
  const lines: string[] = []
  lines.push(`# Run ${shortId(runId)}`)
  lines.push('')
  lines.push(`**Artifacts produced:** ${artifacts.length}`)
  lines.push(`**Files changed:** ${changeSets.length}`)
  lines.push(
    `**Tool calls:** ${toolCalls.length} (${[...new Set(toolCalls.map((t) => t.name))].join(', ') || 'none'})`,
  )
  if (artifacts.length > 0) {
    lines.push('')
    lines.push('## Artifacts')
    for (const a of artifacts) lines.push(`- **${a.title}** (${a.type})`)
  }
  if (changeSets.length > 0) {
    lines.push('')
    lines.push('## File changes')
    for (const c of changeSets) lines.push(`- \`${c.operation}\` ${c.path}`)
  }
  if (assistantText.trim()) {
    lines.push('')
    lines.push('## Assistant output (excerpt)')
    lines.push(assistantText.slice(0, 600))
  }
  return lines.join('\n')
}
