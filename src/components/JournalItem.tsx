import { useRef, useEffect } from 'react'
import type { JournalEntry } from '../types'
import { pickDisplayTags } from '../lib/tags'

interface JournalItemProps {
  entry: JournalEntry
  isSelected: boolean
  onClick: (entry: JournalEntry) => void
  onContextMenu?: (entry: JournalEntry, x: number, y: number) => void
}

export function JournalItem({ entry, isSelected, onClick, onContextMenu }: JournalItemProps) {
  const tags = pickDisplayTags(entry.tags, Infinity)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isSelected) {
      ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [isSelected])

  return (
    <div
      ref={ref}
      onClick={() => onClick(entry)}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu?.(entry, e.clientX, e.clientY)
      }}
      style={{
        padding: '9px 14px',
        cursor: 'pointer',
        background: isSelected ? 'var(--item-selected-bg)' : 'transparent',
        borderLeft: isSelected ? '2px solid var(--record-btn)' : '2px solid transparent',
      }}
      onMouseEnter={e => {
        if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'var(--item-hover-bg)'
      }}
      onMouseLeave={e => {
        if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
      }}
    >
      {/* Title */}
      <div style={{
        fontSize: 'var(--text-base)',
        fontWeight: 'var(--font-semibold)',
        color: isSelected ? 'var(--item-selected-text)' : 'var(--item-text)',
        fontFamily: 'var(--font-serif)',
        ...(isSelected ? { textShadow: '0 0 0.4px currentColor, 0 0 0.4px currentColor' } : {}),
        lineHeight: 1.4,
        marginBottom: 4,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {entry.title}
      </div>

      {/* Preview / summary */}
      {entry.summary && (
        <div style={{
          fontSize: 'var(--text-xs)',
          color: isSelected ? 'var(--item-selected-meta)' : 'var(--item-meta)',
          lineHeight: 1.4,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          marginBottom: 5,
        }}>
          {entry.summary}
        </div>
      )}

      {/* Meta row: tags + time */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        overflow: 'hidden',
      }}>
        {/* Tags — flex shrink and hide overflow */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
        }}>
          {tags.map((tag, i) => (
            <span key={i} style={{
              fontSize: 'var(--text-xs)',
              padding: '1px 5px',
              borderRadius: 3,
              background: tag.bg,
              color: tag.color,
              border: `0.5px solid ${tag.bg}`,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}>
              {tag.label}
            </span>
          ))}
        </div>

        {/* Time — pushed right */}
        <span style={{ fontSize: 'var(--text-xs)', color: isSelected ? 'var(--item-selected-meta)' : 'var(--item-meta)', flexShrink: 0 }}>
          {entry.created_time}
        </span>
      </div>
    </div>
  )
}
