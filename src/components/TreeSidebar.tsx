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
}

// ── SectionHeader ──────────────────────────────────────────────────────────────

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
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '12px 6px 8px',
        cursor: 'pointer',
      }}
    >
      {/* Chevron */}
      <span
        style={{
          width: 12,
          height: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'transform 0.15s ease-out',
          transform: collapsed ? 'rotate(-90deg)' : 'none',
          color: 'var(--text-tertiary, #5c5852)',
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

      {/* Icon */}
      <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary, #a0988c)' }}>{icon}</span>

      {/* Label */}
      <span
        style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'var(--text-secondary, #a0988c)',
        }}
      >
        {label}
      </span>

      {/* Count */}
      {count !== undefined && (
        <span
          style={{
            fontSize: '0.6875rem',
            fontWeight: 400,
            color: 'var(--text-tertiary, #5c5852)',
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

function FolderIcon() {
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
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
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
}: TreeSidebarProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
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
      return next
    })
  }, [])

  const isCollapsed = useCallback(
    (key: string) => collapsed.has(key),
    [collapsed],
  )

  // ── Selection ─────────────────────────────────────────────────────────────

  const handleSelect = useCallback(
    (sel: TreeSelection) => {
      if (selected && selected.type === sel.type && selected.path === sel.path) {
        onDeselect()
      } else {
        onSelect(sel)
      }
    },
    [selected, onSelect, onDeselect],
  )

  const isSelected = useCallback(
    (type: string, path: string) =>
      selected?.type === type && selected?.path === path,
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
        return entries.find(
          (e) => `${e.year_month}/${e.filename}` === pinned.path,
        )
      }
      if (pinned.type === 'identity') {
        return identities.find(
          (i) =>
            i.path === pinned.path ||
            `identities/${i.filename}` === pinned.path,
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
    ) => {
      setCtxMenu({ itemType: itemType as TreeContextMenuState['itemType'], name, path, isPinned, x, y })
    },
    [],
  )

  const handleDelete = useCallback(
    async (itemType: string, path: string) => {
      try {
        if (itemType === 'journal') {
          // path is relative like "2605/25-xxx.md", resolve to absolute
          const entry = entries.find(e => `${e.year_month}/${e.filename}` === path)
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
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 8px' }}>
      {/* ════════════════════════════════════════════════════════════════════
          Pinned Section
          ════════════════════════════════════════════════════════════════════ */}
      {pinnedItems.length > 0 && (
        <div
          style={{
            background: 'rgba(200,147,59,0.03)',
            borderRadius: 8,
            padding: '4px 0 6px',
            marginBottom: 6,
          }}
        >
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
                    isToday={
                      entry.year_month === todayYearMonth &&
                      entry.day === todayDay
                    }
                    isSelected={isSelected('journal', entry.path)}
                    onClick={() =>
                      handleSelect({ type: 'journal', path: entry.path })
                    }
                    onAt={() =>
                      onAtRef(`${entry.year_month}/${entry.filename}`)
                    }
                    onMore={(x, y) =>
                      handleMore('journal', entry.title, `${entry.year_month}/${entry.filename}`, true, x, y)
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
                  onClick={() =>
                    handleSelect({ type: 'identity', path: identity.path })
                  }
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
                onClick={() =>
                  handleSelect({ type: 'identity', path: identity.path })
                }
                onAt={() => onAtRef(`identities/${identity.filename}`)}
                onMore={(x, y) =>
                  handleMore('identity', identity.name, identity.path, false, x, y)
                }
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
                    isToday={
                      entry.year_month === todayYearMonth &&
                      entry.day === todayDay
                    }
                    isSelected={isSelected('journal', entry.path)}
                    onClick={() =>
                      handleSelect({ type: 'journal', path: entry.path })
                    }
                    onAt={() =>
                      onAtRef(`${entry.year_month}/${entry.filename}`)
                    }
                    onMore={(x, y) =>
                      handleMore('journal', entry.title, `${entry.year_month}/${entry.filename}`, false, x, y)
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
          icon={<FolderIcon />}
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
          onAt={(path) => {
            onAtRef(path)
            setCtxMenu(null)
          }}
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
