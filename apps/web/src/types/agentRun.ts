/**
 * Frontend AgentRun types — mirror the @journal/contracts shapes the daemon
 * emits over HTTP/SSE. Kept as a local mirror (not imported from contracts,
 * which is a daemon-node package) so the web bundle stays browser-only.
 */
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

export type AuthorizationMode =
  | 'wide_with_audit'
  | 'read_only'
  | 'workspace_write'
  | 'full_access'

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
