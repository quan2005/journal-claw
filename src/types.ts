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

export interface Transcript {
  status: TranscriptionProgress
  text: string
}

// ── 新类型（日志平台）────────────────────────────────────
export interface RawMaterial {
  filename: string
  path: string
  kind: 'audio' | 'text' | 'markdown' | 'pdf' | 'docx' | 'other'
  size_bytes: number
}

export interface JournalEntry {
  filename: string        // "28-AI平台产品会议纪要.md"
  path: string            // absolute path
  title: string           // "AI平台产品会议纪要"
  summary: string         // from frontmatter summary field
  tags: string[]          // from frontmatter tags field
  year_month: string      // "2603"
  day: number             // 28
  created_time: string    // "10:15"
  materials: RawMaterial[]
}

export interface ProcessingUpdate {
  material_path: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  error?: string
}

// ── Processing queue ────────────────────────────────────
export type QueueItemStatus = 'queued' | 'processing' | 'completed' | 'failed'

export interface QueueItem {
  path: string
  filename: string
  status: QueueItemStatus
  error?: string
  addedAt: number
}
