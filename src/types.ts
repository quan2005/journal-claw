// ── UI 主题 ────────────────────────────────────────────
export type Theme = 'light' | 'dark' | 'system'

// ── 旧类型（保留，录音管道仍在使用）──────────────────────
export type TranscriptionProgress = 'uploading' | 'transcribing' | 'completed' | 'failed'

export interface RecordingItem {
  filename: string
  path: string
  display_name: string
  duration_secs: number
  year_month: string
  transcript_status: TranscriptionProgress | null
}

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
  materials: RawMaterial[]
}

export interface ProcessingUpdate {
  material_path: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  error?: string
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
  recording_count: number
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
  speaker_id: string // linked speaker profile id
  mtime_secs: number // Unix timestamp for sorting
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
export type QueueItemStatus =
  | 'recording'
  | 'converting'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'

export interface QueueItem {
  id: string // work queue id (wq-xxx) or synthetic path for recording/converting
  path: string
  filename: string
  status: QueueItemStatus
  error?: string
  addedAt: number
  logs: string[]
  elapsedSecs?: number // only for 'recording' status
  audioLevel?: number // only for 'recording' status, 0.0–1.0 RMS
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
