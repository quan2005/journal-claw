export interface RecordingItem {
  filename: string;       // "录音 2026-03-12 22:41.m4a"
  path: string;           // absolute path
  display_name: string;   // "录音 2026-03-12 22:41"
  duration_secs: number;  // 0 if unreadable
  year_month: string;     // "202603"
}
