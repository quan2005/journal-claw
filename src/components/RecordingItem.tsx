import { useState } from 'react'
import { formatDuration } from '../lib/format'
import type { RecordingItem as RecordingItemType, TranscriptionProgress } from '../types'

interface RecordingItemProps {
  item: RecordingItemType
  isActive?: boolean
  isSelected?: boolean
  elapsedSecs?: number
  onContextMenu: (e: React.MouseEvent, item: RecordingItemType) => void
  onClick: (item: RecordingItemType) => void
  transcriptionStatus?: TranscriptionProgress | string | null
}

const MicIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="5" y="1" width="6" height="9" rx="3" />
    <path d="M3 8a5 5 0 0 0 10 0M8 13v2" />
  </svg>
)

export function RecordingItem({
  item, isActive, isSelected, elapsedSecs, onContextMenu, onClick, transcriptionStatus
}: RecordingItemProps) {
  const [hovered, setHovered] = useState(false)

  const duration = isActive && elapsedSecs !== undefined
    ? formatDuration(elapsedSecs)
    : formatDuration(item.duration_secs)

  const bg = isActive
    ? 'var(--record-highlight)'
    : isSelected
      ? 'var(--item-selected-bg)'
      : hovered ? 'var(--item-hover-bg)' : 'transparent'

  const textColor = isActive
    ? 'var(--record-btn)'
    : isSelected
      ? 'var(--item-selected-text)'
      : 'var(--item-text)'

  const metaColor = isSelected && !isActive ? 'var(--item-selected-meta)' : 'var(--item-meta)'
  const durationColor = isActive ? 'var(--record-btn)' : isSelected ? 'var(--item-selected-meta)' : 'var(--duration-text)'

  const statusIcon = (() => {
    if (!transcriptionStatus) return null
    if (transcriptionStatus === 'completed') {
      return (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 8.5 6.5 12 13 4" />
        </svg>
      )
    }
    if (transcriptionStatus === 'failed') {
      return (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none"
          stroke="var(--record-btn)" strokeWidth="2" strokeLinecap="round">
          <line x1="4" y1="4" x2="12" y2="12" />
          <line x1="12" y1="4" x2="4" y2="12" />
        </svg>
      )
    }
    return (
      <div style={{
        width: 10,
        height: 10,
        border: '1.5px solid currentColor',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
    )
  })()

  return (
    <div
      onClick={() => onClick(item)}
      onContextMenu={e => onContextMenu(e, item)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 16px',
        gap: 10,
        cursor: 'default',
        background: bg,
        color: textColor,
      }}
    >
      <div style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: isActive
          ? 'var(--record-highlight-icon)'
          : isSelected
            ? 'var(--item-selected-icon-bg)'
            : 'var(--item-icon-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: isActive ? 'var(--record-btn)' : isSelected ? 'var(--item-selected-text)' : 'var(--item-meta)',
      }}>
        <MicIcon />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          color: textColor,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {item.display_name}
        </div>
        {isActive && (
          <div style={{ fontSize: 11, color: metaColor, marginTop: 2 }}>
            录制中…
          </div>
        )}
      </div>
      {statusIcon && (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', color: metaColor }}>
          {statusIcon}
        </div>
      )}
      <div style={{
        fontSize: 12,
        color: durationColor,
        fontVariantNumeric: 'tabular-nums',
        flexShrink: 0,
        animation: isActive ? 'blink 1s ease-in-out infinite' : 'none',
      }}>
        {duration}
      </div>
    </div>
  )
}
