/**
 * MemoryRecord — the Rules/Memory first-class object (G14).
 *
 * When a Run finishes, the sedimentation pipeline extracts durable memory
 * from it: user preferences, project facts, writing rules, tool rules. Each
 * record carries its source run + evidence so the provenance chain
 * (Run → Memory) is traceable and the user can audit/revert what the Agent
 * "learned".
 *
 * Kinds:
 *   preference    — a durable user preference (tone, format, defaults)
 *   project_fact  — a long-lived fact about the project/workspace
 *   writing_rule  — a writing/style rule to apply to future outputs
 *   tool_rule     — a rule about how/when to use a tool
 *   note          — a free-form sedimented note (e.g. a run summary)
 */
export type MemoryKind = 'preference' | 'project_fact' | 'writing_rule' | 'tool_rule' | 'note'

/**
 * Review lifecycle of a sedimented record.
 *   auto_recorded — produced by the deterministic extractor, not yet reviewed
 *   edited        — a human (or the user) has revised the record's content
 *   rejected      — the user rejected this record; it must NOT be returned for
 *                   durable context assembly, only for audit/history
 */
export type MemoryRecordStatus = 'auto_recorded' | 'edited' | 'rejected'

export interface MemoryRecord {
  id: string
  /** Run that produced this memory (provenance). */
  sourceRunId: string
  kind: MemoryKind
  /** Short human-readable summary. */
  summary: string
  /** Full detail / body. */
  detail: string
  /** Evidence: the text or tool-call snippets that justify this record. */
  evidence: string[]
  /** Artifact ids cited as evidence, if any. */
  sourceArtifactIds?: string[]
  /** ChangeSet ids cited as evidence, if any (provenance: Run → ChangeSet). */
  changeSetIds?: string[]
  /** Workspace-relative path of the sedimented note (e.g. summary.md path). */
  path?: string
  /** Review lifecycle status; defaults to 'auto_recorded'. */
  status?: MemoryRecordStatus
  createdAt: string
  /** Last edit timestamp, if reviewed/edited. */
  updatedAt?: string
}

export function isMemoryRecord(value: unknown): value is MemoryRecord {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.sourceRunId === 'string' &&
    typeof v.kind === 'string' &&
    typeof v.summary === 'string' &&
    typeof v.detail === 'string' &&
    Array.isArray(v.evidence) &&
    typeof v.createdAt === 'string'
  )
}
