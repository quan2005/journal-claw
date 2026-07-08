import { useRef, useEffect, memo } from 'react'
import type { JournalEntry, IdentityEntry } from '../types'
import type { TopicEntry } from '../lib/apiTypes'
import { pickDisplayTags } from '../lib/tags'
import { useTextOverflow } from '../hooks/useTextOverflow'
import { fileTypeIconKindFromName } from '../lib/fileTypeIconKind'
import { FileTypeIcon } from './FileTypeIcon'

// ── Hover CSS for action buttons ───────────────────────────────────────────────
// Inline styles can't express :hover, so we inject a minimal <style> once.
// The class names match the component's className props below.
const TREE_ITEM_CSS = `
  .tree-item-row:hover .tree-item-actions {
    width: 48px !important;
    margin-left: 0 !important;
    opacity: 1 !important;
    pointer-events: auto !important;
    transform: translateX(0) !important;
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
    return normalizeTags(identity.tags)
      .filter((t) => t !== 'journal')
      .slice(0, 2)
  }
  if (itemType === 'journal' && entry) {
    // pickDisplayTags already filters 'journal' and returns {label} objects
    return pickDisplayTags(entry.tags, Infinity).map((t) => t.label)
  }
  return []
}

function getDisplayName(
  itemType: TreeItemProps['itemType'],
  identity?: IdentityEntry,
  entry?: JournalEntry,
  topicEntry?: TopicEntry,
): string {
  if (itemType === 'identity' && identity) return identity.name
  if (itemType === 'journal' && entry) return entry.title
  if (itemType === 'topic-file' && topicEntry) return topicEntry.name
  return ''
}

function getDescription(
  itemType: TreeItemProps['itemType'],
  identity?: IdentityEntry,
  entry?: JournalEntry,
): string | undefined {
  if (itemType === 'identity' && identity?.summary) return identity.summary
  if (itemType === 'journal' && entry?.summary) return entry.summary
  return undefined
}

// ── Block ──────────────────────────────────────────────────────────────────────

function ItemBlock({
  itemType,
  identity,
  entry,
  topicEntry,
  isToday,
  isSelected,
}: {
  itemType: TreeItemProps['itemType']
  identity?: IdentityEntry
  entry?: JournalEntry
  topicEntry?: TopicEntry
  isToday?: boolean
  isSelected: boolean
}) {
  if (itemType === 'topic-file' && topicEntry) {
    const iconKind = topicEntry.is_dir ? 'folder' : fileTypeIconKindFromName(topicEntry.name)
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
        <FileTypeIcon kind={iconKind} selected={isSelected} />
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
          background: isTodayBlock ? 'var(--record-highlight)' : 'var(--item-icon-bg)',
          color: isTodayBlock ? 'var(--record-btn)' : 'var(--item-meta)',
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
          color: 'var(--item-text)',
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

export const TreeItem = memo(function TreeItem({
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
  const visibleTags = itemType === 'journal' ? tags.slice(0, 1) : tags
  const hiddenTagCount = itemType === 'journal' ? tags.length - visibleTags.length : 0
  const displayName = getDisplayName(itemType, identity, entry, topicEntry)
  const description = getDescription(itemType, identity, entry)
  const ref = useRef<HTMLDivElement>(null)
  const [titleRef, titleOverflow] = useTextOverflow<HTMLDivElement>()

  useEffect(() => {
    if (isSelected && ref.current) {
      const el = ref.current
      const scrollParent = el.parentElement
      if (scrollParent) {
        const parentRect = scrollParent.getBoundingClientRect()
        const elRect = el.getBoundingClientRect()
        const isFullyVisible = elRect.top >= parentRect.top && elRect.bottom <= parentRect.bottom
        if (!isFullyVisible) {
          el.scrollIntoView({ block: 'nearest', behavior: 'instant' as ScrollBehavior })
        }
      }
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
        background: isSelected ? 'var(--item-selected-bg)' : 'transparent',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          ;(e.currentTarget as HTMLDivElement).style.background = 'var(--item-hover-bg)'
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
          background: 'var(--record-btn)',
          transform: isSelected ? 'scaleY(1)' : 'scaleY(0)',
          transition: 'transform 0.2s var(--ease-out)',
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
          topicEntry={topicEntry}
          isToday={isToday}
          isSelected={isSelected}
        />

        {/* Name / Title — shrinks only after tags are hidden */}
        <div
          className="tree-item-title"
          ref={titleRef}
          title={titleOverflow ? displayName : undefined}
          style={{
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: itemType === 'journal' ? 0 : 'auto',
            minWidth: 0,
            maxWidth: '100%',
            fontSize: 'var(--text-base, 0.875rem)',
            fontWeight: 'var(--font-semibold, 600)',
            color: isSelected ? 'var(--item-selected-text)' : 'var(--item-text)',
            lineHeight: 1.4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {displayName}
        </div>

        {/* Tags — hidden first when space is tight (high flex-shrink) */}
        {visibleTags.length > 0 && (
          <div
            className="tree-item-tags"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              flexShrink: itemType === 'journal' ? 1 : 999,
              minWidth: itemType === 'journal' && hiddenTagCount > 0 ? 28 : 0,
              maxWidth: itemType === 'journal' ? '45%' : undefined,
              overflow: 'hidden',
            }}
          >
            {visibleTags.map((tag, i) => (
              <span
                key={i}
                className="tree-item-tag"
                title={itemType === 'journal' ? tag : undefined}
                style={{
                  fontSize: '0.6875rem',
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: 'var(--tag-bg)',
                  color: 'var(--item-meta)',
                  whiteSpace: 'nowrap',
                  minWidth: itemType === 'journal' ? 0 : undefined,
                  maxWidth: itemType === 'journal' ? '100%' : undefined,
                  overflow: itemType === 'journal' ? 'hidden' : undefined,
                  textOverflow: itemType === 'journal' ? 'ellipsis' : undefined,
                  flexShrink: itemType === 'journal' ? 1 : 0,
                  lineHeight: 1.3,
                }}
              >
                {tag}
              </span>
            ))}
            {hiddenTagCount > 0 && (
              <span
                className="tree-item-tag-overflow"
                aria-label={`还有 ${hiddenTagCount} 个标签`}
                style={{
                  fontSize: '0.6875rem',
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: 'var(--tag-bg)',
                  color: 'var(--item-meta)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  lineHeight: 1.3,
                }}
              >
                +{hiddenTagCount}
              </span>
            )}
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
              marginLeft: -8,
              overflow: 'hidden',
              opacity: 0,
              pointerEvents: 'none' as const,
              transform: 'translateX(4px)',
              transition:
                'width 0.15s var(--ease-out), margin-left 0.15s var(--ease-out), opacity 0.15s var(--ease-out), transform 0.15s var(--ease-out)',
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
                  color: 'var(--item-meta)',
                  fontSize: '0.75rem',
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--item-hover-bg)'
                  ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--item-text)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--item-meta)'
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
                  color: 'var(--item-meta)',
                  fontSize: '0.875rem',
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--item-hover-bg)'
                  ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--item-text)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--item-meta)'
                }}
              >
                <svg
                  width="14"
                  height="4"
                  viewBox="0 0 16 4"
                  fill="currentColor"
                  style={{ display: 'block' }}
                >
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
            color: 'var(--text-secondary, #9CA3AF)',
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
})
