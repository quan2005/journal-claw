import { useState } from 'react'
import { formatDuration } from '../lib/format'
import type { RecordingItem as RecordingItemType, TranscriptionProgress } from '../types'
import { Spinner } from './Spinner'

interface RecordingItemProps {
  item: RecordingItemType
  showDate: boolean
  isActive?: boolean
  isSelected?: boolean
  isProcessing?: boolean
  elapsedSecs?: number
  onContextMenu: (e: React.MouseEvent, item: RecordingItemType) => void
  onClick: (item: RecordingItemType) => void
  transcriptionStatus?: TranscriptionProgress | null
  isNew?: boolean
}

function getWeekday(displayName: string): string {
  const match = displayName.match(/(\d{4}-\d{2}-\d{2})/)
  if (!match) return ''
  const date = new Date(match[1])
  return new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(date)
}

function getTimeStr(displayName: string): string {
  const match = displayName.match(/(\d{2}:\d{2})$/)
  return match ? match[1] : ''
}

function StatusIcon({ status }: { status: TranscriptionProgress | null | undefined }) {
  if (!status) return null
  if (status === 'completed') {
    return (
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 8.5 6.5 12 13 4" />
      </svg>
    )
  }
  if (status === 'failed') {
    return (
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none"
        stroke="var(--record-btn)" strokeWidth="2" strokeLinecap="round">
        <line x1="4" y1="4" x2="12" y2="12" />
        <line x1="12" y1="4" x2="4" y2="12" />
      </svg>
    )
  }
  return <Spinner size={9} borderWidth={1.5} />
}

export function RecordingItem({
  item, showDate, isActive, isSelected, isProcessing, elapsedSecs,
  onContextMenu, onClick, transcriptionStatus, isNew,
}: RecordingItemProps) {
  const [hovered, setHovered] = useState(false)

  const duration = isActive && elapsedSecs !== undefined
    ? formatDuration(elapsedSecs)
    : formatDuration(item.duration_secs)

  const timeStr = getTimeStr(item.display_name)
  const weekday = showDate ? getWeekday(item.display_name) : ''
  const dayNum = showDate ? item.display_name.match(/\d{4}-\d{2}-(\d{2})/)?.[1] ?? '' : ''

  const bg = isSelected
    ? 'var(--item-selected-bg)'
    : hovered ? 'var(--item-hover-bg)' : 'transparent'

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <div
      onClick={() => onClick(item)}
      onContextMenu={e => onContextMenu(e, item)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        cursor: 'default',
        background: bg,
        position: 'relative',
        borderBottom: '1px solid var(--divider)',
        animation: isNew
          ? reducedMotion
            ? 'card-enter 150ms ease forwards'
            : 'card-enter 280ms ease-out forwards'
          : undefined,
      }}
    >
      {isSelected && (
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 2,
          background: 'var(--card-selected-bar)',
          borderRadius: '0 1px 1px 0',
        }} />
      )}

      <div style={{
        width: 52,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px 0 12px 8px',
        gap: 2,
      }}>
        {showDate && dayNum ? (
          <>
            <span style={{
              fontSize: 'var(--text-2xl)',
              fontWeight: 'var(--font-normal)',
              color: 'var(--date-number)',
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {dayNum}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--date-secondary)', lineHeight: 1 }}>
              {weekday}
            </span>
          </>
        ) : null}
      </div>

      <div style={{
        flex: 1,
        minWidth: 0,
        padding: '12px 16px 12px 8px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 4,
      }}>
        <div style={{
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--font-medium)',
          color: 'var(--item-text)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {item.display_name}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 'var(--text-xs)',
          color: 'var(--item-meta)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {isActive ? (
            <span style={{ color: 'var(--record-btn)', animation: 'blink 1s ease-in-out infinite' }}>
              {duration}
            </span>
          ) : (
            <>
              {timeStr && <span>{timeStr}</span>}
              {timeStr && <span>·</span>}
              <span>{duration}</span>
              {(transcriptionStatus || isProcessing) && (
                <span style={{ display: 'flex', alignItems: 'center', color: 'var(--item-meta)' }}>
                  <StatusIcon status={isProcessing ? 'uploading' : transcriptionStatus} />
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

