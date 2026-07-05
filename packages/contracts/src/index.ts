/**
 * @journal/contracts — journal monorepo 共享契约
 *
 * 前端 (apps/web) 与 daemon (apps/daemon) 共享的类型定义。
 * 参照 open-design packages/contracts 的角色：web/daemon/CLI 的单一契约源。
 */

// ── AgentRun ──────────────────────────────────────────────────────────────
// 一次可追踪的 Agent 工作。详见 docs/adr/ts-daemon-agent-runtime-migration.md §AgentRun

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
  parentStepId?: string
  summary?: string
}

export interface AgentRun {
  id: string
  sessionId: string
  goal: string
  mode: AgentRunMode
  status: AgentRunStatus
  /** Runtime adapter that executes this run, e.g. claude/codex/opencode. */
  agentId?: string
  authorizationMode: AuthorizationMode
  contextBindings: string[]
  steps: AgentStep[]
  /** Parent run id if this run is a subtask (multi-agent delegation). */
  parentRunId?: string
  createdAt: string
  updatedAt: string
}

// ── AgentRunEvent ─────────────────────────────────────────────────────────
// Run 生命周期事件。SSE 流 + JSONL 落盘的统一事件类型。

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

/**
 * Explicit, frozen allow-list of AgentRunEventType values.
 *
 * The strict `isAgentRunEvent` guard consults this set so unknown / misspelled
 * event types (e.g. adapter-internal labels that leaked onto the wire) are
 * rejected at the runtime boundary instead of silently flowing into the
 * event log. Mirrors the minimum event set in
 * docs/adr/ts-daemon-agent-runtime-migration.md §AgentRunEvent (which
 * explicitly lists `step_finished` alongside `step_started`).
 */
export const AGENT_RUN_EVENT_TYPES: readonly AgentRunEventType[] = [
  'run_started',
  'step_started',
  'step_finished',
  'thinking_delta',
  'text_delta',
  'tool_call',
  'tool_result',
  'change_proposed',
  'artifact_created',
  'sedimentation_started',
  'sedimentation_recorded',
  'run_finished',
  'run_failed',
]

const AGENT_RUN_EVENT_TYPE_SET: ReadonlySet<string> = new Set(AGENT_RUN_EVENT_TYPES)

export interface AgentRunEvent {
  type: AgentRunEventType
  runId: string
  sessionId: string
  spanId?: string
  parentSpanId?: string
  data: string
  timestamp: string
}

// ── AuthorizationMode ─────────────────────────────────────────────────────

export type AuthorizationMode = 'wide_with_audit' | 'read_only' | 'workspace_write' | 'full_access'

// ── ChangeSet ─────────────────────────────────────────────────────────────

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

// ── 类型守卫 ──────────────────────────────────────────────────────────────

/**
 * Strict structural guard for AgentRunEvent.
 *
 * In addition to the field shape, `type` must be one of the explicit
 * AGENT_RUN_EVENT_TYPES values. Unknown / future / misspelled types are
 * rejected so they cannot silently pollute the event log; new event types
 * must be added to the allow-list first.
 */
export function isAgentRunEvent(value: unknown): value is AgentRunEvent {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.type === 'string' &&
    AGENT_RUN_EVENT_TYPE_SET.has(v.type) &&
    typeof v.runId === 'string' &&
    typeof v.sessionId === 'string' &&
    typeof v.data === 'string' &&
    typeof v.timestamp === 'string'
  )
}

export * from './runtime.js'

export * from './registry.js'

export * from './artifact.js'

export * from './memory.js'

export * from './source.js'

export * from './workspace.js'
