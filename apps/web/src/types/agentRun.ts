/**
 * Frontend AgentRun types — local browser-only mirror of @journal/contracts.
 *
 * These shapes mirror the @journal/contracts package (the single source of
 * truth shared with the daemon). The contracts package ships daemon runtime
 * code (type guards etc.) and its compiled dist is not guaranteed to be
 * present when the web app runs `tsc --noEmit` in CI, so we keep a local
 * type-only mirror here to keep the web bundle browser-only and the
 * typecheck hermetic.
 *
 * Drift discipline: when contracts evolve, update this mirror to match.
 * Fields tracked for parity: AgentRun.parentRunId, AgentStep.parentStepId
 * (multi-agent delegation), AgentRunEventType lifecycle events, and the
 * MemoryRecord / AgentRunStatus / ChangeSetStatus unions.
 */
/**
 * Which backend executes a run. `builtin` routes through the daemon's
 * in-process pi engine; `cli` spawns a local external CLI agent
 * (Claude Code / Codex / OpenCode …) detected via GET /agents.
 *
 * Mirrors the daemon's POST /runs `engine` field (server.ts ~1586).
 */
export type RunEngine = 'builtin' | 'cli'

export type AgentRunMode = 'chat' | 'agent' | 'observe'
export type AgentRunStatus =
  | 'queued'
  | 'running'
  | 'waiting_for_confirmation'
  | 'succeeded'
  | 'failed'
  | 'canceled'

export interface AgentStep {
  id: string
  runId: string
  title: string
  status: AgentRunStatus
  startedAt: string
  finishedAt?: string
  /** Parent step id when this step is a subtask (multi-agent delegation). */
  parentStepId?: string
  summary?: string
}

export interface AgentRun {
  id: string
  sessionId: string
  goal: string
  mode: AgentRunMode
  status: AgentRunStatus
  agentId?: string
  authorizationMode: AuthorizationMode
  contextBindings: string[]
  steps: AgentStep[]
  /** Parent run id if this run is a subtask (multi-agent delegation). */
  parentRunId?: string
  createdAt: string
  updatedAt: string
}

export type AgentRunEventType =
  | 'run_started'
  | 'step_started'
  | 'step_finished'
  | 'thinking_delta'
  | 'text_delta'
  | 'tool_call'
  | 'tool_result'
  | 'change_proposed'
  | 'artifact_created'
  | 'sedimentation_started'
  | 'sedimentation_recorded'
  | 'run_finished'
  | 'run_failed'

export interface AgentRunEvent {
  type: AgentRunEventType
  runId: string
  sessionId: string
  spanId?: string
  parentSpanId?: string
  data: string
  timestamp: string
}

export type AuthorizationMode = 'wide_with_audit' | 'read_only' | 'workspace_write' | 'full_access'

export type ChangeSetOperation = 'create' | 'edit' | 'move' | 'remove'
export type ChangeSetRisk = 'low' | 'medium' | 'high'
export type ChangeSetStatus = 'recorded' | 'blocked' | 'applied' | 'reverted' | 'failed'

export interface ChangeSet {
  id: string
  runId: string
  path: string
  operation: ChangeSetOperation
  beforeHash?: string
  afterHash?: string
  beforePath?: string
  afterPath?: string
  diffPreview: string
  risk: ChangeSetRisk
  authorizationMode: AuthorizationMode
  status: ChangeSetStatus
}

// ── Artifact (G7) ─────────────────────────────────────────────────────────
export type ArtifactType =
  | 'article'
  | 'outline'
  | 'report'
  | 'summary'
  | 'plan'
  | 'todo'
  | 'index'
  | 'card'
  | 'note'
  | string

export interface Artifact {
  id: string
  runId: string
  type: ArtifactType
  title: string
  content: string
  path?: string
  sourceRefs?: string[]
  createdAt: string
}

// ── MemoryRecord (G14) ────────────────────────────────────────────────────
export type MemoryKind = 'preference' | 'project_fact' | 'writing_rule' | 'tool_rule' | 'note'
export type MemoryRecordStatus = 'auto_recorded' | 'edited' | 'rejected'

export interface MemoryRecord {
  id: string
  sourceRunId: string
  kind: MemoryKind
  summary: string
  detail: string
  evidence: string[]
  sourceArtifactIds?: string[]
  changeSetIds?: string[]
  path?: string
  status?: MemoryRecordStatus
  createdAt: string
  updatedAt?: string
}

// ── SourceBinding (G6) ────────────────────────────────────────────────────
export type SourceBindingKind = 'read' | 'reference' | 'search' | 'cite'

export interface SourceBinding {
  id: string
  runId: string
  path: string
  kind: SourceBindingKind
  excerpt?: string
  sourceSpanId?: string
  note?: string
  createdAt: string
}
