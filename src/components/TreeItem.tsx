import { useRef, useEffect } from 'react'
import type { JournalEntry, IdentityEntry } from '../types'
import type { TopicEntry } from '../lib/tauri'
import { pickDisplayTags } from '../lib/tags'
import { useTextOverflow } from '../hooks/useTextOverflow'

// ── Hover CSS for action buttons ───────────────────────────────────────────────
// Inline styles can't express :hover, so we inject a minimal <style> once.
// The class names match the component's className props below.
const TREE_ITEM_CSS = `
  .tree-item-row:hover .tree-item-actions {
    width: 48px !important;
    opacity: 1 !important;
  }
`

let _cssInjected = false
function injectTreeItemCss() {
  if (_cssInjected) return
  _cssInjected = true
  const style = document.createElement('style')
  style.textContent = TREE_ITEM_CSS
  document.head.appendChild(style)
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface TreeItemProps {
  itemType: 'identity' | 'journal' | 'topic-file'
  identity?: IdentityEntry
  entry?: JournalEntry
  topicEntry?: TopicEntry
  indent?: number
  isToday?: boolean
  isSelected: boolean
  onClick: () => void
  onAt?: () => void
  onMore?: (x: number, y: number) => void
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalizeTags(tags: string[] | { label: string }[] | undefined): string[] {
  if (!tags) return []
  return tags.map((t) => (typeof t === 'string' ? t : t.label))
}

function getDisplayTags(
  itemType: TreeItemProps['itemType'],
  identity?: IdentityEntry,
  entry?: JournalEntry,
): string[] {
  if (itemType === 'identity' && identity) {
    return normalizeTags(identity.tags).filter((t) => t !== 'journal').slice(0, 2)
  }
  if (itemType === 'journal' && entry) {
    // pickDisplayTags already filters 'journal' and returns {label} objects
    return pickDisplayTags(entry.tags, Infinity).map((t) => t.label)
  }
  return []
}

function getDisplayName(itemType: TreeItemProps['itemType'], identity?: IdentityEntry, entry?: JournalEntry, topicEntry?: TopicEntry): string {
  if (itemType === 'identity' && identity) return identity.name
  if (itemType === 'journal' && entry) return entry.title
  if (itemType === 'topic-file' && topicEntry) return topicEntry.name
  return ''
}

function getDescription(itemType: TreeItemProps['itemType'], identity?: IdentityEntry, entry?: JournalEntry): string | undefined {
  if (itemType === 'identity' && identity?.summary) return identity.summary
  if (itemType === 'journal' && entry?.summary) return entry.summary
  return undefined
}

// ── Block ──────────────────────────────────────────────────────────────────────

function ItemBlock({
  itemType,
  identity,
  entry,
  isToday,
}: {
  itemType: TreeItemProps['itemType']
  identity?: IdentityEntry
  entry?: JournalEntry
  isToday?: boolean
}) {
  // Topic file: SVG document icon
  if (itemType === 'topic-file') {
    return (
      <div
        style={{
          width: 20,
          height: 20,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#a0988c"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      </div>
    )
  }

  // Journal: day number block
  if (itemType === 'journal' && entry) {
    const isTodayBlock = isToday === true
    return (
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 5,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.6875rem',
          fontWeight: 600,
          background: isTodayBlock ? '#C8933B' : 'rgba(128,128,128,0.12)',
          color: isTodayBlock ? '#C8933B' : '#a0988c',
          ...(isTodayBlock
            ? { background: 'rgba(200,147,59,0.15)', color: 'var(--accent, #C8933B)' }
            : {}),
        }}
      >
        {entry.day}
      </div>
    )
  }

  // Identity: colored initial block
  if (itemType === 'identity' && identity) {
    const char = identity.name.charAt(0) || '?'
    return (
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 5,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.6875rem',
          fontWeight: 600,
          background: 'rgba(128,128,128,0.15)',
          color: '#e6ded4',
          userSelect: 'none' as const,
        }}
      >
        {char}
      </div>
    )
  }

  return null
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function TreeItem({
  itemType,
  identity,
  entry,
  topicEntry,
  indent = 0,
  isToday,
  isSelected,
  onClick,
  onAt,
  onMore,
}: TreeItemProps) {
  injectTreeItemCss()
  const tags = getDisplayTags(itemType, identity, entry)
  const displayName = getDisplayName(itemType, identity, entry, topicEntry)
  const description = getDescription(itemType, identity, entry)
  const ref = useRef<HTMLDivElement>(null)
  const [titleRef, titleOverflow] = useTextOverflow<HTMLDivElement>()

  useEffect(() => {
    if (isSelected) {
      ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [isSelected])

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    onMore?.(e.clientX, e.clientY)
  }

  const handleAtClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onAt?.()
  }

  const handleMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    onMore?.(rect.left, rect.bottom)
  }

  // Base padding left from indent (each level = 16px)
  const paddingLeft = 14 + indent * 16

  return (
    <div
      ref={ref}
      className="tree-item-row"
      onClick={onClick}
      onContextMenu={handleContextMenu}
      style={{
        padding: '9px 14px 9px 0',
        paddingLeft,
        userSelect: 'none' as const,
        cursor: 'pointer',
        position: 'relative' as const,
        background: isSelected
          ? 'rgba(200,147,59,0.10)'
          : 'transparent',
        transition: 'background 0.15s ease-out',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          ;(e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.025)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
        }
      }}
    >

      {/* Animated selection bar — 3px wide, adapts to item height */}
      <span
        style={{
          position: 'absolute' as const,
          left: 0,
          top: 9,
          bottom: 9,
          width: 3,
          borderRadius: 2,
          background: 'var(--accent, #C8933B)',
          transform: isSelected ? 'scaleY(1)' : 'scaleY(0)',
          transition: 'transform 0.2s ease-out',
        }}
      />

      {/* Header row: block + name/title + tags + actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minWidth: 0,
        }}
      >
        {/* Block (identity initial / journal date / topic icon) */}
        <ItemBlock
          itemType={itemType}
          identity={identity}
          entry={entry}
          isToday={isToday}
        />

        {/* Name / Title — shrinks only after tags are hidden */}
        <div
          ref={titleRef}
          title={titleOverflow ? displayName : undefined}
          style={{
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: 'auto',
            minWidth: 0,
            fontSize: 'var(--text-base, 0.875rem)',
            fontWeight: 'var(--font-semibold, 600)',
            color: isSelected ? 'var(--accent, #C8933B)' : '#e6ded4',
            lineHeight: 1.4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {displayName}
        </div>

        {/* Tags — hidden first when space is tight (high flex-shrink) */}
        {tags.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              flexShrink: 999,
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            {tags.map((tag, i) => (
              <span
                key={i}
                style={{
                  fontSize: '0.6875rem',
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: 'rgba(128,128,128,0.08)',
                  color: '#a0988c',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  lineHeight: 1.3,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Hover action buttons: @ + … */}
        {(onAt || onMore) && (
          <div
            className="tree-item-actions"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              flexShrink: 0,
              width: 0,
              overflow: 'hidden',
              opacity: 0,
              transition: 'width 0.15s ease-out, opacity 0.15s ease-out',
            }}
          >
            {onAt && (
              <button
                onClick={handleAtClick}
                style={{
                  width: 22,
                  height: 22,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 4,
                  padding: 0,
                  color: '#a0988c',
                  fontSize: '0.75rem',
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.background =
                    'rgba(255,255,255,0.06)'
                  ;(e.currentTarget as HTMLButtonElement).style.color = '#e6ded4'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLButtonElement).style.color = '#a0988c'
                }}
              >
                @
              </button>
            )}
            {onMore && (
              <button
                onClick={handleMoreClick}
                style={{
                  width: 22,
                  height: 22,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 4,
                  padding: 0,
                  color: '#a0988c',
                  fontSize: '0.875rem',
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.background =
                    'rgba(255,255,255,0.06)'
                  ;(e.currentTarget as HTMLButtonElement).style.color = '#e6ded4'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLButtonElement).style.color = '#a0988c'
                }}
              >
                <svg width="14" height="4" viewBox="0 0 16 4" fill="currentColor" style={{ display: 'block' }}>
                    <circle cx="2" cy="2" r="1.5" />
                    <circle cx="8" cy="2" r="1.5" />
                    <circle cx="14" cy="2" r="1.5" />
                  </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Description (identity & journal only) */}
      {description && (
        <div
          style={{
            fontSize: '0.75rem',
            color: '#5c5852',
            lineHeight: 1.5,
            marginTop: 2,
            paddingLeft: 0,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {description}
        </div>
      )}
    </div>
  )
}
