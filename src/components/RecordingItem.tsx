import { useState } from 'react'
import { formatDuration } from '../lib/format'
import type { RecordingItem as RecordingItemType } from '../types'

interface RecordingItemProps {
  item: RecordingItemType
  isActive?: boolean
  elapsedSecs?: number
  onContextMenu: (e: React.MouseEvent, item: RecordingItemType) => void
}

const MicIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="5" y="1" width="6" height="9" rx="3" />
    <path d="M3 8a5 5 0 0 0 10 0M8 13v2" />
  </svg>
)

export function RecordingItem({ item, isActive, elapsedSecs, onContextMenu }: RecordingItemProps) {
  const [hovered, setHovered] = useState(false)
  const duration = isActive && elapsedSecs !== undefined
    ? formatDuration(elapsedSecs)
    : formatDuration(item.duration_secs)

  const bg = isActive
    ? 'var(--record-highlight)'
    : hovered ? 'var(--item-hover-bg)' : 'transparent'

  return (
    <div
      onContextMenu={e => onContextMenu(e, item)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 20px',
        gap: 12,
        cursor: 'default',
        background: bg,
      }}
    >
      <div style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: isActive ? 'var(--record-highlight-icon)' : 'var(--item-icon-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: isActive ? 'var(--record-btn)' : 'var(--item-meta)',
      }}>
        <MicIcon />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          color: isActive ? 'var(--record-btn)' : 'var(--item-text)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {item.display_name}
        </div>
        {isActive && (
          <div style={{ fontSize: 11, color: 'var(--item-meta)', marginTop: 2 }}>
            录制中…
          </div>
        )}
      </div>
      <div style={{
        fontSize: 12,
        color: isActive ? 'var(--record-btn)' : 'var(--duration-text)',
        fontVariantNumeric: 'tabular-nums',
        flexShrink: 0,
        animation: isActive ? 'blink 1s ease-in-out infinite' : 'none',
      }}>
        {duration}
      </div>
    </div>
  )
}
