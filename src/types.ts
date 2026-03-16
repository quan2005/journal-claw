export interface RecordingItem {
  filename: string       // "录音 2026-03-12 22:41.m4a"
  path: string           // absolute path
  display_name: string   // "录音 2026-03-12 22:41"
  duration_secs: number  // 0 if unreadable
  year_month: string     // "202603"
  transcript_status: string | null  // "completed" | "failed" | null
}

export interface Transcript {
  status: string
  text: string
}

export type TranscriptionProgress = 'uploading' | 'transcribing' | 'completed' | 'failed'
