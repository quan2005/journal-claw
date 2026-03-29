import type { JournalEntry } from '../types'

// Tag display names and colors
const TAG_DISPLAY: Record<string, { label: string; color: string; bg: string }> = {
  meeting: { label: '会议', color: '#5856d6', bg: 'rgba(88,86,214,0.10)' },
  reading: { label: '阅读', color: '#ff9500', bg: 'rgba(255,149,0,0.10)' },
  design:  { label: '设计', color: '#30b0c7', bg: 'rgba(48,176,199,0.10)' },
  report:  { label: '报告', color: '#34c759', bg: 'rgba(52,199,89,0.10)' },
  goal:    { label: '目标', color: '#ff3b30', bg: 'rgba(255,59,48,0.10)' },
  plan:    { label: '计划', color: '#007aff', bg: 'rgba(0,122,255,0.10)' },
}

// Pick the first non-journal tag to display
function pickDisplayTag(tags: string[]) {
  for (const tag of tags) {
    if (tag !== 'journal' && TAG_DISPLAY[tag]) return TAG_DISPLAY[tag]
  }
  return null
}

// Day of week from year_month + day
function getDayOfWeek(yearMonth: string, day: number): string {
  // yearMonth: "2603" → year=2026, month=03
  const year = 2000 + parseInt(yearMonth.slice(0, 2))
  const month = parseInt(yearMonth.slice(2, 4)) - 1
  const d = new Date(year, month, day)
  return ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()]
}

function formatSourceCount(materials: JournalEntry['materials']): string {
  const audio = materials.filter(m => m.kind === 'audio').length
  const docs = materials.filter(m => m.kind !== 'audio').length
  const parts = []
  if (audio > 0) parts.push(`🎙×${audio}`)
  if (docs > 0) parts.push(`📄×${docs}`)
  return parts.join(' ')
}

interface JournalItemProps {
  entry: JournalEntry
  showDate: boolean
  isSelected: boolean
  onClick: (entry: JournalEntry) => void
  onContextMenu?: (entry: JournalEntry, x: number, y: number) => void
}

export function JournalItem({ entry, showDate, isSelected, onClick, onContextMenu }: JournalItemProps) {
  const tag = pickDisplayTag(entry.tags)
  const srcCount = formatSourceCount(entry.materials)

  return (
    <div
      onClick={() => onClick(entry)}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu?.(entry, e.clientX, e.clientY)
      }}
      style={{
        display: 'flex',
        padding: isSelected ? '7px 16px 8px 14px' : '7px 16px 8px',
        gap: 10,
        alignItems: 'flex-start',
        cursor: 'pointer',
        background: isSelected ? 'rgba(0,0,0,0.055)' : 'transparent',
        borderLeft: isSelected ? '2px solid #ff3b30' : '2px solid transparent',
      }}
      onMouseEnter={e => {
        if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0.035)'
      }}
      onMouseLeave={e => {
        if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
      }}
    >
      {/* Date column */}
      <div style={{ width: 28, flexShrink: 0, textAlign: 'center', paddingTop: 1 }}>
        {showDate && (
          <>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--item-text)', lineHeight: 1 }}>
              {entry.day}
            </div>
            <div style={{ fontSize: 10, color: 'var(--item-meta)', marginTop: 1 }}>
              {getDayOfWeek(entry.year_month, entry.day)}
            </div>
          </>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Title + tag */}
        <div style={{
          fontSize: 13, fontWeight: 500, color: 'var(--item-text)',
          display: 'flex', alignItems: 'center', gap: 5,
          whiteSpace: 'nowrap', overflow: 'hidden',
        }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1 }}>
            {entry.title}
          </span>
          {tag && (
            <span style={{
              fontSize: 10, flexShrink: 0, padding: '1px 6px',
              borderRadius: 4, fontWeight: 500,
              color: tag.color, background: tag.bg,
            }}>
              {tag.label}
            </span>
          )}
        </div>

        {/* Summary */}
        {entry.summary && (
          <div style={{
            fontSize: 12, color: 'var(--item-meta)', marginTop: 2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {entry.summary}
          </div>
        )}

        {/* Meta */}
        <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
          <span style={{ fontSize: 11, color: 'var(--item-meta)' }}>{entry.created_time}</span>
          {srcCount && <span style={{ fontSize: 11, color: '#c7c7cc' }}>{srcCount}</span>}
        </div>
      </div>
    </div>
  )
}
