// ── UI 主题 ────────────────────────────────────────────
export type Theme = 'light' | 'dark' | 'system'

// ── 转写类型（用于导入音频的 transcript sidecar）──────────
export type TranscriptionProgress = 'uploading' | 'transcribing' | 'completed' | 'failed'

export interface TranscriptSegment {
  speaker: string | null
  start: number
  end: number
  text: string
}

export interface Transcript {
  status: TranscriptionProgress
  text: string
  segments?: TranscriptSegment[]
}

// ── 新类型（日志平台）────────────────────────────────────
export interface RawMaterial {
  filename: string
  path: string
  kind: 'audio' | 'text' | 'markdown' | 'pdf' | 'docx' | 'other'
  size_bytes: number
}

export interface JournalEntry {
  filename: string // "28-AI平台产品会议纪要.md"
  path: string // absolute path
  title: string // "AI平台产品会议纪要"
  summary: string // from frontmatter summary field
  tags: string[] // from frontmatter tags field
  sources: string[] // workspace-relative paths of source materials
  year_month: string // "2603"
  day: number // 28
  created_time: string // "10:15" (from file birthtime)
  created_at_secs: number // birthtime Unix timestamp for stable same-day sorting
  mtime_secs: number // mtime Unix timestamp for change detection
  mtime_ms?: number // mtime Unix timestamp in milliseconds for sub-second change detection
  materials: RawMaterial[]
}

export interface LegacyDirectiveFile {
  path: string
  relative_path: string
  extension: 'md' | 'mdx'
}

export interface ApplyDirectiveMigrationRequest {
  source_path: string
  destination_path: string
  content: string
}

export interface ApplyDirectiveMigrationResult {
  destination_path: string
  backup_path: string
}

export interface ProcessingUpdate {
  material_path: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  error?: string
  structured_error?: AiProcessingError
}

export interface AiProcessingError {
  code:
    | 'rate_limited'
    | 'auth_failed'
    | 'network_timeout'
    | 'model_unavailable'
    | 'quota_exhausted'
    | 'transcription_failed'
    | 'invalid_material'
    | 'llm_error'
    | 'internal_error'
  message: string
  retryable: boolean
  user_action: string | null
  attempt: number
}

export interface AiLogLine {
  material_path: string
  level: 'info' | 'error'
  message: string
}

// ── 声纹档案 ─────────────────────────────────────────────
export interface SpeakerProfile {
  id: string
  /** 用户命名，空字符串表示未命名，显示时用 auto_name 代替 */
  name: string
  /** 自动生成的名称，如"说话人 1" */
  auto_name: string
  audio_count: number
  created_at: number
  last_seen_at: number
}

// ── 身份档案 ─────────────────────────────────────────────
export interface IdentityEntry {
  filename: string // "广州-张三.md"
  path: string // absolute path
  name: string // "张三"
  region: string // "广州"
  summary: string // from frontmatter
  tags: string[] // from frontmatter
  aliases: string[] // alternative names used by @ expert search
  expert_skill: string // linked skill dir/name for expert perspectives
  is_expert: boolean // true when tags contain 专家/expert or expert_skill is set
  speaker_id: string // linked speaker profile id
  mtime_secs: number // Unix timestamp for sorting
  archived: boolean // frontmatter archived flag
}

export type MergeMode = 'voice_only' | 'full'

// ── 待办事项 ─────────────────────────────────────────────
export interface TodoItem {
  text: string
  done: boolean
  due: string | null
  done_date: string | null
  source: string | null
  path: string | null
  session_id: string | null
  line_index: number
  done_file: boolean
}

// ── Processing queue ────────────────────────────────────
export type QueueItemStatus = 'converting' | 'queued' | 'processing' | 'completed' | 'failed'

export interface QueueItem {
  id: string // work queue id (wq-xxx) or synthetic path for local audio conversion
  path: string
  filename: string
  status: QueueItemStatus
  error?: string
  structured_error?: AiProcessingError
  addedAt: number
  logs: string[]
  sessionId?: string // conversation session ID
}

// ── 通用附件（文件拖放 / 粘贴）───────────────────────
export interface Attachment {
  path: string
  filename: string
  kind: string
}

// ── 斜杠命令 ──────────────────────────────────────────
export interface SlashCommand {
  name: string
  description: string
}

export interface WebSearchResultItem {
  url: string
  title: string
  page_age?: string
}

export type MessageBlock =
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string }
  | {
      type: 'tool'
      name: string
      label: string
      input?: Record<string, unknown>
      output?: string
      isError?: boolean
    }
  | { type: 'web_search'; query: string; results: WebSearchResultItem[] }
  | { type: 'error'; code: string; message: string; retryable: boolean }
  | { type: 'loop_warning'; message: string }
  | { type: 'truncated' }
  | {
      type: 'subtask'
      toolUseId: string
      prompt: string
      summary?: string
      isError?: boolean
      isRunning?: boolean
      tools?: { name: string; label: string; output?: string; isError?: boolean }[]
    }
  | {
      type: 'artifact'
      artifactType: string
      title: string
      content: string
      isStreaming: boolean
    }

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  thinking?: string
  tools?: { name: string; label: string; output?: string; isError?: boolean }[]
  /** Ordered blocks preserving the sequence of text, thinking, and tool calls */
  blocks?: MessageBlock[]
}

export interface ConversationStreamPayload {
  session_id: string
  event:
    | 'text_delta'
    | 'thinking_delta'
    | 'tool_start'
    | 'tool_end'
    | 'web_search_result'
    | 'done'
    | 'error'
    | 'loop_warning'
    | 'truncated'
    | 'compacted'
    | 'user_inject'
    | 'title'
    | 'turn_start'
    | 'usage'
    | 'subtask_start'
    | 'subtask_delta'
    | 'subtask_end'
  data: string
  span_id?: string
  parent_span_id?: string
}

// ── Automation Workbench ─────────────────────────────────
export type AutomationSchedule =
  | { kind: 'daily'; time: string; timezone: string }
  | { kind: 'weekdays'; time: string; timezone: string }
  | { kind: 'weekly'; weekday: number; time: string; timezone: string }
  | { kind: 'monthly'; day: number; time: string; timezone: string }

export type AutomationScope =
  | {
      kind: 'relative'
      range: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month'
    }
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

// ── Tree Sidebar ───────────────────────────────────────────

/** 树节点类型 */
export type TreeNodeType =
  | 'pinned-section'
  | 'identity'
  | 'journal'
  | 'journal-month'
  | 'topic'
  | 'topic-file'
  | 'ideas'
  | 'automation'

/** 树中选中项的标识 —— 由 (type, path) 唯一确定 */
export interface TreeSelection {
  type: TreeNodeType
  path: string
  name?: string
  created_secs?: number
  mtime_secs?: number
}

/** 置顶条目（持久化在 workspace settings.json） */
export interface PinnedItem {
  type: 'journal' | 'identity' | 'topic'
  path: string // workspace-relative path, e.g. "2605/25-xxx.md" or "identities/张三.md" or "topics/xxx"
  order: number
}

// ── Event Log (catch-up mechanism) ──────────────────────
export interface DomainEvent {
  seq: number
  timestamp_ms: number
  kind:
    | 'journal-updated'
    | 'todos-updated'
    | 'identity-updated'
    | 'speakers-updated'
    | 'ai-processing'
    | 'recording-processed'
  payload: unknown
}
