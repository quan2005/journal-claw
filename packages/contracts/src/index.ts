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
  authorizationMode: AuthorizationMode
  contextBindings: string[]
  steps: AgentStep[]
  createdAt: string
  updatedAt: string
}

// ── AgentRunEvent ─────────────────────────────────────────────────────────
// Run 生命周期事件。SSE 流 + JSONL 落盘的统一事件类型。

export type AgentRunEventType =
  | 'run_started'
  | 'step_started'
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

// ── AuthorizationMode ─────────────────────────────────────────────────────

export type AuthorizationMode =
  | 'wide_with_audit'
  | 'read_only'
  | 'workspace_write'
  | 'full_access'

// ── ChangeSet ─────────────────────────────────────────────────────────────

export type ChangeSetOperation = 'create' | 'edit' | 'move' | 'remove'
export type ChangeSetRisk = 'low' | 'medium' | 'high'
export type ChangeSetStatus =
  | 'recorded'
  | 'blocked'
  | 'applied'
  | 'reverted'
  | 'failed'

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

export function isAgentRunEvent(value: unknown): value is AgentRunEvent {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.type === 'string' &&
    typeof v.runId === 'string' &&
    typeof v.sessionId === 'string' &&
    typeof v.data === 'string' &&
    typeof v.timestamp === 'string'
  )
}

export * from './runtime.js'

export * from './artifact.js'
