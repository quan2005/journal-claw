import { useState, useEffect, useCallback, useMemo } from 'react'
import type { JournalEntry, IdentityEntry, TreeSelection } from '../types'
import { MonthDivider } from './MonthDivider'
import { TreeItem } from './TreeItem'
import { TopicTree } from './TopicTree'
import { TreeContextMenu, type TreeContextMenuState } from './TreeContextMenu'
import { useTopics } from '../hooks/useTopics'
import { usePinned } from '../hooks/usePinned'
import { deleteJournalEntry, deleteIdentity, deleteTopic } from '../lib/tauri'

// ── Props ──────────────────────────────────────────────────────────────────────

interface TreeSidebarProps {
  selected: TreeSelection | null
  onSelect: (sel: TreeSelection) => void
  onDeselect: () => void
  entries: JournalEntry[]
  identities: IdentityEntry[]
  identityLoading: boolean
  loadingMore: boolean
  hasMore: boolean
  onLoadMore: () => void
  onAtRef: (path: string) => void
  todayYearMonth: string
  todayDay: number
  ideasCount: number
  ideasSelected: boolean
  onSelectIdeas: () => void
  automationSelected: boolean
  onSelectAutomation: () => void
}

// ── SectionHeader ──────────────────────────────────────────────────────────────

const TOP_LEVEL_LEADING_SLOT_WIDTH = 9
const COLLAPSED_SECTIONS_STORAGE_KEY = 'journal_tree_sidebar_collapsed_v1'

const TREE_SECTION_HEADER_CSS = `
  .tree-section-header:hover .tree-section-collapse-button,
  .tree-section-header:focus-within .tree-section-collapse-button {
    opacity: 1 !important;
    pointer-events: auto !important;
    transform: translateX(0) !important;
  }

  .tree-section-collapse-button:hover {
    background: var(--item-hover-bg) !important;
    color: var(--item-text) !important;
  }

  .tree-section-collapse-button:focus-visible {
    opacity: 1 !important;
    pointer-events: auto !important;
    transform: translateX(0) !important;
    outline: 1px solid color-mix(in srgb, var(--record-btn) 60%, transparent);
    outline-offset: 1px;
  }

  @media (prefers-reduced-motion: reduce) {
    .tree-section-collapse-button,
    .tree-section-collapse-icon {
      transition: none !important;
    }
  }
`

let _sectionHeaderCssInjected = false
function injectTreeSectionHeaderCss() {
  if (_sectionHeaderCssInjected) return
  _sectionHeaderCssInjected = true
  const style = document.createElement('style')
  style.textContent = TREE_SECTION_HEADER_CSS
  document.head.appendChild(style)
}

function loadCollapsedSections(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSED_SECTIONS_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((key): key is string => typeof key === 'string'))
  } catch {
    return new Set()
  }
}

function saveCollapsedSections(collapsed: Set<string>) {
  try {
    localStorage.setItem(COLLAPSED_SECTIONS_STORAGE_KEY, JSON.stringify([...collapsed].sort()))
  } catch {
    /* quota exceeded — ignore */
  }
}

function SectionHeader({
  collapsed,
  onToggle,
  label,
  count,
  icon,
}: {
  collapsed: boolean
  onToggle: () => void
  label: string
  count?: number | string
  icon: React.ReactNode
}) {
  injectTreeSectionHeaderCss()

  return (
    <div
      className="tree-section-header"
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        padding: '14px 6px 7px 0',
        cursor: 'pointer',
        userSelect: 'none' as const,
        position: 'sticky' as const,
        top: 0,
        zIndex: 1,
        background: 'var(--sidebar-bg)',
        boxShadow: '0 1px 0 color-mix(in srgb, var(--divider) 42%, transparent)',
      }}
    >
      {/* Alignment slot: keeps the section row restrained without reserving the full old chevron space. */}
      <span style={{ width: TOP_LEVEL_LEADING_SLOT_WIDTH, flexShrink: 0 }} />

      {/* Icon */}
      <span
        style={{
          width: 13,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: 'var(--item-meta)',
          opacity: 0.78,
        }}
      >
        {icon}
      </span>

      {/* Label */}
      <span
        style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'var(--item-meta)',
          letterSpacing: '0.02em',
          marginLeft: 6,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </span>

      {/* Collapse button */}
      <button
        type="button"
        className="tree-section-collapse-button"
        aria-label={`${collapsed ? '展开' : '折叠'}${label}`}
        aria-expanded={!collapsed}
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        style={{
          width: 22,
          height: 22,
          marginLeft: 4,
          padding: 0,
          border: 'none',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          cursor: 'pointer',
          color: 'var(--duration-text)',
          background: 'transparent',
          opacity: 0,
          pointerEvents: 'none' as const,
          transform: 'translateX(3px)',
          transition:
            'opacity 0.15s var(--ease-out), transform 0.15s var(--ease-out), color 0.15s var(--ease-out), background-color 0.15s var(--ease-out)',
        }}
      >
        <span
          className="tree-section-collapse-icon"
          style={{
            width: 12,
            height: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.15s ease-out',
            transform: collapsed ? 'rotate(-90deg)' : 'none',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            width="12"
            height="12"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {/* Count */}
      {count !== undefined && (
        <span
          style={{
            fontSize: '0.6875rem',
            fontWeight: 400,
            color: 'var(--duration-text)',
            marginLeft: 'auto',
            textAlign: 'right' as const,
          }}
        >
          {count}
        </span>
      )}
    </div>
  )
}

// ── SVG Icons ──────────────────────────────────────────────────────────────────

function PinIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function TopicIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 3h11a2 2 0 0 1 2 2v16H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M8 3v18" />
      <path d="M11 8h5" />
      <path d="M11 12h5" />
    </svg>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function TreeSidebar({
  selected,
  onSelect,
  onDeselect,
  entries,
  identities,
  identityLoading,
  loadingMore,
  hasMore,
  onLoadMore,
  onAtRef,
  todayYearMonth,
  todayDay,
  ideasCount,
  ideasSelected,
  onSelectIdeas,
  automationSelected,
  onSelectAutomation,
}: TreeSidebarProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsedSections)
  const [ctxMenu, setCtxMenu] = useState<TreeContextMenuState | null>(null)
  const { items: pinnedItems, pin, unpin, refresh: refreshPinned } = usePinned()
  const { dirs, loading: topicsLoading, load: loadTopics, toggleDir } = useTopics()

  // Initialize on mount
  useEffect(() => {
    refreshPinned()
    loadTopics()
  }, [refreshPinned, loadTopics])

  // ── Collapse toggle ───────────────────────────────────────────────────────

  const toggleSection = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      saveCollapsedSections(next)
      return next
    })
  }, [])

  const isCollapsed = useCallback((key: string) => collapsed.has(key), [collapsed])

  // ── Selection ─────────────────────────────────────────────────────────────

  const handleSelect = useCallback(
    (sel: TreeSelection) => {
      if (selected && selected.type === sel.type && selected.path === sel.path) {
        return
      }
      onSelect(sel)
    },
    [selected, onSelect],
  )

  const isSelected = useCallback(
    (type: string, path: string) => selected?.type === type && selected?.path === path,
    [selected],
  )

  // ── Group journal entries by month ────────────────────────────────────────

  const monthGroups = useMemo(() => {
    const groups = new Map<string, JournalEntry[]>()
    for (const entry of entries) {
      const key = entry.year_month
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(entry)
    }
    // Sort within each month: by day descending (newest first)
    for (const group of groups.values()) {
      group.sort((a, b) => b.day - a.day)
    }
    // Sort months descending
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [entries])

  // ── Sorted identities ─────────────────────────────────────────────────────

  const sortedIdentities = useMemo(
    () => [...identities].sort((a, b) => a.name.localeCompare(b.name)),
    [identities],
  )

  // ── Resolve pinned item to actual entry ───────────────────────────────────

  const resolvePinnedEntry = useCallback(
    (pinned: { type: 'journal' | 'identity'; path: string }) => {
      if (pinned.type === 'journal') {
        return entries.find((e) => `${e.year_month}/${e.filename}` === pinned.path)
      }
      if (pinned.type === 'identity') {
        return identities.find(
          (i) => i.path === pinned.path || `identities/${i.filename}` === pinned.path,
        )
      }
      return undefined
    },
    [entries, identities],
  )

  // ── Context menu ────────────────────────────────────────────────────────

  const handleMore = useCallback(
    (
      itemType: string,
      name: string,
      path: string,
      isPinned: boolean,
      x: number,
      y: number,
      absolutePath?: string,
    ) => {
      setCtxMenu({
        itemType: itemType as TreeContextMenuState['itemType'],
        name,
        path,
        absolutePath,
        isPinned,
        x,
        y,
      })
    },
    [],
  )

  const handleDelete = useCallback(
    async (itemType: string, path: string) => {
      try {
        if (itemType === 'journal') {
          // path is relative like "2605/25-xxx.md", resolve to absolute
          const entry = entries.find((e) => `${e.year_month}/${e.filename}` === path)
          const absPath = entry?.path ?? path
          await deleteJournalEntry(absPath)
        } else if (itemType === 'identity') {
          // path is already absolute for identities
          await deleteIdentity(path)
        } else if (itemType === 'topic-file' || itemType === 'topic-folder') {
          await deleteTopic(path)
        }
        onDeselect()
        refreshPinned()
        loadTopics()
      } catch (e) {
        console.error('[TreeSidebar] delete failed:', e)
      }
    },
    [entries, onDeselect, refreshPinned, loadTopics],
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '0 8px',
        background: 'var(--sidebar-bg)',
      }}
    >
      {/* ════════════════════════════════════════════════════════════════════
          Ideas Entry (想法) — permanent, non-collapsible
          Matches SectionHeader layout: leading slot + icon(13) + label margin.
          ════════════════════════════════════════════════════════════════════ */}
      <div
        onClick={onSelectIdeas}
        onMouseEnter={(e) => {
          if (!ideasSelected) {
            ;(e.currentTarget as HTMLElement).style.background = 'var(--item-hover-bg)'
          }
        }}
        onMouseLeave={(e) => {
          if (!ideasSelected) {
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          padding: '10px 0',
          margin: '4px 0 6px',
          cursor: 'pointer',
          userSelect: 'none' as const,
          borderRadius: 6,
          background: ideasSelected ? 'var(--item-selected-bg)' : 'transparent',
          transition: 'background-color 0.15s var(--ease-out)',
        }}
      >
        {/* Indicator slot — same width as section leading slot.
            Contains a 3px bar that grows to 16px when selected. */}
        <span
          style={{
            width: TOP_LEVEL_LEADING_SLOT_WIDTH,
            height: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 3,
              height: 16,
              borderRadius: 2,
              background: 'var(--record-btn)',
              transition: 'transform 0.2s var(--ease-out)',
              transform: ideasSelected ? 'scaleY(1)' : 'scaleY(0)',
            }}
          />
        </span>

        {/* Checkmark icon — 13px, same width as section icons */}
        <span
          style={{
            width: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: ideasSelected ? 'var(--record-btn)' : 'var(--item-meta)',
            opacity: !ideasSelected ? 0.7 : 1,
            transition: 'opacity 0.15s var(--ease-out), color 0.15s var(--ease-out)',
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        </span>

        {/* Label */}
        <span
          style={{
            fontSize: 'var(--text-base, 0.875rem)',
            fontWeight: 'var(--font-semibold, 600)',
            color: ideasSelected ? 'var(--item-selected-text)' : 'var(--item-text)',
            marginLeft: 6,
            transition: 'color 0.15s var(--ease-out)',
          }}
        >
          想法
        </span>

        {/* Count */}
        {ideasCount > 0 && (
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 'var(--font-medium, 500)',
              color: ideasSelected ? 'var(--item-selected-meta)' : 'var(--duration-text)',
              opacity: ideasSelected ? 0.7 : 1,
              marginLeft: 'auto',
              transition: 'color 0.15s var(--ease-out)',
            }}
          >
            {ideasCount}
          </span>
        )}
      </div>

      <div
        onClick={onSelectAutomation}
        onMouseEnter={(e) => {
          if (!automationSelected) {
            ;(e.currentTarget as HTMLElement).style.background = 'var(--item-hover-bg)'
          }
        }}
        onMouseLeave={(e) => {
          if (!automationSelected) {
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          padding: '10px 0',
          margin: '0 0 6px',
          cursor: 'pointer',
          userSelect: 'none' as const,
          borderRadius: 6,
          background: automationSelected ? 'var(--item-selected-bg)' : 'transparent',
          transition: 'background-color 0.15s var(--ease-out)',
        }}
      >
        <span
          style={{
            width: TOP_LEVEL_LEADING_SLOT_WIDTH,
            height: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 3,
              height: 16,
              borderRadius: 2,
              background: 'var(--record-btn)',
              transition: 'transform 0.2s var(--ease-out)',
              transform: automationSelected ? 'scaleY(1)' : 'scaleY(0)',
            }}
          />
        </span>
        <span
          style={{
            width: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: automationSelected ? 'var(--record-btn)' : 'var(--item-meta)',
            opacity: !automationSelected ? 0.7 : 1,
            transition: 'opacity 0.15s var(--ease-out), color 0.15s var(--ease-out)',
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </span>
        <span
          style={{
            fontSize: 'var(--text-base, 0.875rem)',
            fontWeight: 'var(--font-semibold, 600)',
            color: automationSelected ? 'var(--item-selected-text)' : 'var(--item-text)',
            marginLeft: 6,
            transition: 'color 0.15s var(--ease-out)',
          }}
        >
          自动化
        </span>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          Pinned Section
          ════════════════════════════════════════════════════════════════════ */}
      {pinnedItems.length > 0 && (
        <div style={{ marginBottom: 2 }}>
          <SectionHeader
            collapsed={isCollapsed('pinned')}
            onToggle={() => toggleSection('pinned')}
            label="置顶"
            count={pinnedItems.length}
            icon={<PinIcon />}
          />
          {!isCollapsed('pinned') &&
            pinnedItems.map((pinned) => {
              const resolved = resolvePinnedEntry(pinned)
              if (!resolved) return null

              if (pinned.type === 'journal') {
                const entry = resolved as JournalEntry
                return (
                  <TreeItem
                    key={`pinned-journal-${entry.path}`}
                    itemType="journal"
                    entry={entry}
                    isToday={entry.year_month === todayYearMonth && entry.day === todayDay}
                    isSelected={isSelected('journal', `${entry.year_month}/${entry.filename}`)}
                    onClick={() =>
                      handleSelect({
                        type: 'journal',
                        path: `${entry.year_month}/${entry.filename}`,
                      })
                    }
                    onAt={() => onAtRef(`${entry.year_month}/${entry.filename}`)}
                    onMore={(x, y) =>
                      handleMore(
                        'journal',
                        entry.title,
                        `${entry.year_month}/${entry.filename}`,
                        true,
                        x,
                        y,
                        entry.path,
                      )
                    }
                  />
                )
              }

              // Identity
              const identity = resolved as IdentityEntry
              return (
                <TreeItem
                  key={`pinned-identity-${identity.path}`}
                  itemType="identity"
                  identity={identity}
                  isSelected={isSelected('identity', identity.path)}
                  onClick={() => handleSelect({ type: 'identity', path: identity.path })}
                  onAt={() => onAtRef(`identities/${identity.filename}`)}
                  onMore={(x, y) =>
                    handleMore('identity', identity.name, identity.path, true, x, y)
                  }
                />
              )
            })}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          Identities Section (画像)
          ════════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionHeader
          collapsed={isCollapsed('identities')}
          onToggle={() => toggleSection('identities')}
          label="画像"
          count={identities.length}
          icon={<PersonIcon />}
        />
        {!isCollapsed('identities') && (
          <>
            {sortedIdentities.map((identity) => (
              <TreeItem
                key={identity.path}
                itemType="identity"
                identity={identity}
                isSelected={isSelected('identity', identity.path)}
                onClick={() => handleSelect({ type: 'identity', path: identity.path })}
                onAt={() => onAtRef(`identities/${identity.filename}`)}
                onMore={(x, y) => handleMore('identity', identity.name, identity.path, false, x, y)}
              />
            ))}
            {identityLoading && (
              <div
                style={{
                  padding: '8px 6px',
                  fontSize: '0.75rem',
                  color: 'var(--text-tertiary, #5c5852)',
                }}
              >
                加载中...
              </div>
            )}
          </>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          Journal Pipeline Section (流水)
          ════════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionHeader
          collapsed={isCollapsed('journal')}
          onToggle={() => toggleSection('journal')}
          label="流水"
          count={entries.length}
          icon={<ClockIcon />}
        />
        {!isCollapsed('journal') && (
          <>
            {monthGroups.map(([yearMonth, monthEntries]) => (
              <div key={yearMonth}>
                <MonthDivider label={yearMonth} />
                {monthEntries.map((entry) => (
                  <TreeItem
                    key={entry.path}
                    itemType="journal"
                    entry={entry}
                    isToday={entry.year_month === todayYearMonth && entry.day === todayDay}
                    isSelected={isSelected('journal', `${entry.year_month}/${entry.filename}`)}
                    onClick={() =>
                      handleSelect({
                        type: 'journal',
                        path: `${entry.year_month}/${entry.filename}`,
                      })
                    }
                    onAt={() => onAtRef(`${entry.year_month}/${entry.filename}`)}
                    onMore={(x, y) =>
                      handleMore(
                        'journal',
                        entry.title,
                        `${entry.year_month}/${entry.filename}`,
                        false,
                        x,
                        y,
                        entry.path,
                      )
                    }
                  />
                ))}
              </div>
            ))}
            {hasMore && (
              <div
                style={{
                  padding: '8px 6px',
                  textAlign: 'center',
                }}
              >
                <button
                  onClick={onLoadMore}
                  disabled={loadingMore}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary, #a0988c)',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    padding: '4px 12px',
                    borderRadius: 4,
                  }}
                >
                  {loadingMore ? '加载中…' : '加载更多'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          Topics Section (专题)
          ════════════════════════════════════════════════════════════════════ */}
      <div>
        <SectionHeader
          collapsed={isCollapsed('topics')}
          onToggle={() => toggleSection('topics')}
          label="专题"
          icon={<TopicIcon />}
        />
        {!isCollapsed('topics') && (
          <>
            {topicsLoading ? (
              <div
                style={{
                  padding: '8px 6px',
                  fontSize: '0.75rem',
                  color: 'var(--text-tertiary, #5c5852)',
                }}
              >
                加载中...
              </div>
            ) : (
              <TopicTree
                entries={dirs.get('')?.entries ?? []}
                dirs={dirs}
                selectedPath={
                  selected?.type === 'topic' || selected?.type === 'topic-file'
                    ? selected.path
                    : null
                }
                onToggleDir={toggleDir}
                onSelectFile={(entry) =>
                  handleSelect({
                    type: entry.is_dir ? 'topic' : 'topic-file',
                    path: entry.path,
                    name: entry.name,
                    created_secs: entry.created_secs,
                    mtime_secs: entry.mtime_secs,
                  })
                }
                onAt={(path) => onAtRef(path)}
                onMore={(entry, x, y) =>
                  handleMore(
                    entry.is_dir ? 'topic-folder' : 'topic-file',
                    entry.name,
                    entry.path,
                    false,
                    x,
                    y,
                  )
                }
              />
            )}
          </>
        )}
      </div>

      {/* Context Menu */}
      {ctxMenu && (
        <TreeContextMenu
          state={ctxMenu}
          onClose={() => setCtxMenu(null)}
          onPin={(type, path) => {
            pin(type, path)
            setCtxMenu(null)
          }}
          onUnpin={(path) => {
            unpin(path)
            setCtxMenu(null)
          }}
          onDelete={(type, path) => {
            handleDelete(type, path)
            setCtxMenu(null)
          }}
        />
      )}
    </div>
  )
}
