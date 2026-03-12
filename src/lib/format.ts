/**
 * Format seconds into m:ss or h:mm:ss display string.
 */
export function formatDuration(totalSecs: number): string {
  const secs = Math.floor(totalSecs)
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Format elapsed seconds for the title bar timer. Alias of formatDuration.
 */
export function formatTimer(totalSecs: number): string {
  return formatDuration(totalSecs)
}

/**
 * Extract yyyyMM group key from a display_name like "录音 2026-03-12 22:41".
 * Returns "202603".
 */
export function formatYearMonth(displayName: string): string {
  const match = displayName.match(/(\d{4})-(\d{2})-\d{2}/)
  if (!match) return '000000'
  return `${match[1]}${match[2]}`
}

/**
 * Format a display_name as the list label (pass-through).
 */
export function formatDisplayDate(displayName: string): string {
  return displayName
}
