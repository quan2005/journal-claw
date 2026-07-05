export interface AppError {
  code: string
  message: string
  retryable: boolean
  details?: unknown
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

export interface TurnStats {
  elapsedSecs: number
  totalInputTokens: number
  totalOutputTokens: number
}

export interface ToolCall {
  id: string
  name: string
  label: string
  input?: Record<string, unknown>
}

export interface ToolOutput {
  content: string
  isError: boolean
}

export type ConversationEvent =
  | { sessionId: string; kind: 'turn_started'; turnId: string }
  | { sessionId: string; kind: 'text_delta'; turnId: string; delta: string }
  | { sessionId: string; kind: 'thinking_delta'; turnId: string; delta: string }
  | { sessionId: string; kind: 'tool_started'; turnId: string; toolCall: ToolCall }
  | {
      sessionId: string
      kind: 'tool_finished'
      turnId: string
      toolCallId: string
      output: ToolOutput
    }
  | {
      sessionId: string
      kind: 'artifact_delta'
      turnId: string
      artifactId: string
      delta: string
    }
  | { sessionId: string; kind: 'artifact_finished'; turnId: string; artifactId: string }
  | { sessionId: string; kind: 'usage'; usage: TokenUsage }
  | { sessionId: string; kind: 'failed'; error: AppError }
  | { sessionId: string; kind: 'turn_finished'; stats: TurnStats }

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'

export interface JobEvent {
  jobId: string
  status: JobStatus
  error?: AppError
}

export interface WorkspaceEvent {
  reason: 'root_changed' | 'files_changed' | 'settings_changed'
  paths?: string[]
}

export interface JournalUpdatedEvent {
  entryIds?: string[]
  paths?: string[]
}

export interface SettingsChangedEvent {
  keys: string[]
}

export type AppEvent =
  | { v: 1; type: 'workspace.changed'; data: WorkspaceEvent }
  | { v: 1; type: 'journal.updated'; data: JournalUpdatedEvent }
  | { v: 1; type: 'job.updated'; data: JobEvent }
  | { v: 1; type: 'conversation.event'; data: ConversationEvent }
  | { v: 1; type: 'settings.changed'; data: SettingsChangedEvent }

const APP_EVENT_TYPES = new Set<AppEvent['type']>([
  'workspace.changed',
  'journal.updated',
  'job.updated',
  'conversation.event',
  'settings.changed',
])

export function isAppEvent(value: unknown): value is AppEvent {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { v?: unknown; type?: unknown; data?: unknown }
  return (
    candidate.v === 1 &&
    typeof candidate.type === 'string' &&
    APP_EVENT_TYPES.has(candidate.type as AppEvent['type']) &&
    typeof candidate.data === 'object' &&
    candidate.data !== null
  )
}
