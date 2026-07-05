export type AutomationSchedule =
  | { kind: 'daily'; time: string; timezone: string }
  | { kind: 'weekdays'; time: string; timezone: string }
  | { kind: 'weekly'; weekday: number; time: string; timezone: string }
  | { kind: 'monthly'; day: number; time: string; timezone: string }

export type AutomationScope =
  | { kind: 'relative'; range: string }
  | { kind: 'recent_days'; days: number }
  | { kind: 'month'; year_month: string }
  | { kind: 'tags'; tags: string[]; range?: AutomationScope }
  | { kind: 'identities'; identity_ids: string[]; range?: AutomationScope }
  | { kind: 'keyword'; query: string; range?: AutomationScope }
  | { kind: 'workspace' }

export interface AutomationTemplate {
  id: string
  title: string
  category: string
  description: string
  default_prompt: string
  default_schedule: AutomationSchedule
  default_scope: AutomationScope
  default_context: string[]
}

export type AutomationRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped'
export type AutomationRunTrigger = 'scheduled' | 'manual'

export interface AutomationRunSummary {
  id: string
  status: AutomationRunStatus
  trigger: AutomationRunTrigger
  started_at: string
  completed_at: string | null
  summary: string | null
  error: string | null
  conversation_id: string | null
}

export interface AutomationRoutine {
  id: string
  title: string
  template_id: string | null
  prompt: string
  schedule: AutomationSchedule
  scope: AutomationScope
  enabled: boolean
  full_agent_access: boolean
  created_at: string
  updated_at: string
  last_run: AutomationRunSummary | null
}

export interface RunManifest {
  summary: string
  files_read: string[]
  files_changed: string[]
  entries_created: string[]
  todos_changed: string[]
  identities_changed: string[]
  warnings: string[]
  conversation_id: string
}

export interface AutomationRun {
  id: string
  routine_id: string
  trigger: AutomationRunTrigger
  status: AutomationRunStatus
  started_at: string
  completed_at: string | null
  error: string | null
  conversation_id: string | null
  manifest: RunManifest | null
}

export interface CreateRoutineRequest {
  title: string
  template_id: string | null
  prompt: string
  schedule: AutomationSchedule
  scope: AutomationScope
  enabled: boolean
}

export interface UpdateRoutineRequest {
  title?: string
  prompt?: string
  schedule?: AutomationSchedule
  scope?: AutomationScope
  enabled?: boolean
}

export function summarizeRun(run: AutomationRun): AutomationRunSummary {
  return {
    id: run.id,
    status: run.status,
    trigger: run.trigger,
    started_at: run.started_at,
    completed_at: run.completed_at,
    summary: run.manifest?.summary ?? null,
    error: run.error,
    conversation_id: run.conversation_id,
  }
}
