/**
 * SedimentationService — completes the core loop's final step
 * ("沉淀为笔记/规则/记忆"). When a Run finishes, this derives durable
 * memory from it so the workspace accumulates long-term knowledge the Agent
 * can reuse, rather than every Run starting from scratch.
 *
 * Today's extraction is deterministic + structural (it reads the Run's events,
 * artifacts, and change sets for signals). The shape is the product value:
 * records carry source run + evidence + linked artifact ids, so the user can
 * audit and revert what the Agent "learned". An LLM-based extractor can drop
 * into extractFromRun() later without changing the MemoryRecord contract.
 *
 * Outputs (all traceable to the source run):
 *   - a run summary note (what the run did, in prose)
 *   - preference/project_fact/writing_rule/tool_rule records extracted from
 *     the run's assistant text and tool calls
 */
import { randomUUID } from 'node:crypto'
import type {
  AgentRunEvent,
  Artifact,
  ChangeSet,
  MemoryKind,
  MemoryRecord,
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
  ): SedimentationResult {
    const records: MemoryRecord[] = []
    const assistantText = collectAssistantText(events)
    const toolCalls = collectToolCalls(events)

    // 1. Run summary note — always produced.
    const summaryDetail = buildRunSummary(runId, assistantText, artifacts, changeSets, toolCalls)
    const summary: MemoryRecord = this.make(runId, 'note', `Run ${shortId(runId)} summary`, summaryDetail, [assistantText.slice(0, 400)])

    // 2. Preferences — detect explicit preference phrasing in assistant text.
    for (const p of extractPreferences(assistantText)) {
      records.push(this.make(runId, 'preference', p.summary, p.detail, p.evidence, artifactIds(artifacts)))
    }

    // 3. Project facts — detect factual assertions about the project.
    for (const f of extractFacts(assistantText)) {
      records.push(this.make(runId, 'project_fact', f.summary, f.detail, f.evidence))
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
    this.byRun.set(runId, all)
    return { summary, records, all }
  }

  listByRun(runId: string): MemoryRecord[] {
    return this.byRun.get(runId) ?? []
  }

  listByKind(kind: MemoryKind): MemoryRecord[] {
    return [...this.byRun.values()].flat().filter((r) => r.kind === kind)
  }

  listAll(): MemoryRecord[] {
    return [...this.byRun.values()].flat()
  }

  private make(
    sourceRunId: string,
    kind: MemoryKind,
    summary: string,
    detail: string,
    evidence: string[],
    sourceArtifactIds?: string[],
  ): MemoryRecord {
    return {
      id: `mem-${randomUUID()}`,
      sourceRunId,
      kind,
      summary,
      detail,
      evidence,
      sourceArtifactIds,
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
  lines.push(`**Tool calls:** ${toolCalls.length} (${[...new Set(toolCalls.map((t) => t.name))].join(', ') || 'none'})`)
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
