import { useState, useEffect, useCallback, useMemo } from 'react'
import type { JournalEntry, IdentityEntry, TreeSelection } from '../types'
import type { TopicEntry } from '../lib/apiTypes'
import type { Category } from '../contexts/UIContext'
import { MonthDivider } from './MonthDivider'
import { TreeItem } from './TreeItem'
import { TopicTree } from './TopicTree'
import { TreeContextMenu, type TreeContextMenuState } from './TreeContextMenu'
import { useTopics } from '../hooks/useTopics'
import { usePinned } from '../hooks/usePinned'
import { selectRuntimeClient } from '../lib/runtimeClient'

const deleteJournalEntry = (path: string) =>
  selectRuntimeClient().invoke<void>('delete_journal_entry', { path })
const deleteIdentity = (path: string) =>
  selectRuntimeClient().invoke<void>('delete_identity', { path })
const deleteTopic = (relativePath: string) =>
  selectRuntimeClient().invoke<void>('delete_topic', { relativePath })
const getWorkspacePath = () => selectRuntimeClient().invoke<string>('get_workspace_path')
const archiveIdentity = (path: string) =>
  selectRuntimeClient().invoke<void>('archive_identity', { path })
const unarchiveIdentity = (path: string) =>
  selectRuntimeClient().invoke<void>('unarchive_identity', { path })
const listTopicsDir = (relativePath: string) =>
  selectRuntimeClient()
    .invoke<TopicEntry[]>('list_workspace_dir', { relativePath })
    // 防御性过滤 dot 条目（AC-3，与 useTopics 保持一致）
    .then((entries) => entries.filter((e) => !e.name.startsWith('.')))
import { Search, LayoutGrid } from 'lucide-react'

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
  category: Category
}

// ── SectionHeader ──────────────────────────────────────────────────────────────

const TOP_LEVEL_LEADING_SLOT_WIDTH = 9
const COLLAPSED_SECTIONS_STORAGE_KEY = 'journal_tree_sidebar_collapsed_v1'
const DEFAULT_COLLAPSED_SECTIONS = ['identity-archived']

const TREE_SECTION_HEADER_CSS = `
  .tree-section-header:hover .tree-section-collapse-button,
  .tree-section-header:focus-within .tree-section-collapse-button {
    opacity: 1 !important;
    pointer-events: auto !important;
    transform: translateX(0) !important;
  }

  .tree-section-header:hover .tree-section-label,
  .tree-section-header:focus-within .tree-section-label,
  .tree-month-header:hover .tree-month-label,
  .tree-month-header:hover .tree-month-collapse-icon,
  .tree-month-header:focus-visible .tree-month-collapse-icon,
  .tree-month-header:focus-visible .tree-month-label {
    color: var(--item-text) !important;
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
    .tree-section-collapse-icon,
    .tree-month-collapse-icon {
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
    // eslint-disable-next-line no-restricted-syntax -- ARCH.md 白名单：侧栏折叠态（纯 UI 状态），非业务数据
    const raw = localStorage.getItem(COLLAPSED_SECTIONS_STORAGE_KEY)
    if (!raw) return new Set(DEFAULT_COLLAPSED_SECTIONS)
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set(DEFAULT_COLLAPSED_SECTIONS)
    return new Set(parsed.filter((key): key is string => typeof key === 'string'))
  } catch {
    return new Set(DEFAULT_COLLAPSED_SECTIONS)
  }
}

function saveCollapsedSections(collapsed: Set<string>) {
  try {
    // eslint-disable-next-line no-restricted-syntax -- ARCH.md 白名单：侧栏折叠态（纯 UI 状态），非业务数据
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
        className="tree-section-label"
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
      <path d="M3 6.5h6l2 2H21v9.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 9h18" />
    </svg>
  )
}

function IdentityIcon() {
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
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function ArchiveIcon() {
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
      <rect x="2" y="3" width="20" height="5" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
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
  category,
}: TreeSidebarProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsedSections)
  const [ctxMenu, setCtxMenu] = useState<TreeContextMenuState | null>(null)
  const { items: pinnedItems, pin, unpin, refresh: refreshPinned } = usePinned()
  const { dirs, loading: topicsLoading, load: loadTopics, toggleDir } = useTopics()
  const [wsPath, setWsPath] = useState('')

  // Independent state for pinned folder expansion (does not affect main TopicTree)
  const [pinnedExpanded, setPinnedExpanded] = useState<Set<string>>(() => new Set())
  const [pinnedChildren, setPinnedChildren] = useState<Map<string, TopicEntry[]>>(() => new Map())

  const togglePinnedDir = useCallback(
    async (path: string) => {
      setPinnedExpanded((prev) => {
        const next = new Set(prev)
        if (next.has(path)) {
          next.delete(path)
        } else {
          next.add(path)
        }
        return next
      })
      // Load children if not yet loaded
      if (!pinnedChildren.has(path)) {
        try {
          const children = await listTopicsDir(path)
          setPinnedChildren((prev) => new Map(prev).set(path, children))
        } catch (e) {
          console.error('[TreeSidebar] pinned dir load failed:', e)
        }
      }
    },
    [pinnedChildren],
  )

  // Initialize on mount
  useEffect(() => {
    refreshPinned()
    loadTopics()
    getWorkspacePath()
      .then(setWsPath)
      .catch(() => {})
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

  const coreIdentities = useMemo(
    () => identities.filter((i) => i.path === '__soul__' || i.filename === 'README.md'),
    [identities],
  )

  const identityGroups = useMemo(() => {
    const nonCore = identities.filter(
      (i) => i.path !== '__soul__' && i.filename !== 'README.md' && !i.archived,
    )
    const groups = new Map<string, typeof nonCore>()
    for (const id of nonCore) {
      const key = id.region || '其他'
      const list = groups.get(key) ?? []
      list.push(id)
      groups.set(key, list)
    }
    // Sort each group alphabetically
    for (const list of groups.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name))
    }
    // Sort group keys alphabetically, but "其他" last
    return [...groups.entries()].sort((a, b) => {
      if (a[0] === '其他') return 1
      if (b[0] === '其他') return -1
      return a[0].localeCompare(b[0])
    })
  }, [identities])

  const archivedIdentities = useMemo(
    () =>
      identities
        .filter((i) => i.archived && i.path !== '__soul__' && i.filename !== 'README.md')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [identities],
  )

  const sortedIdentities = useMemo(
    () =>
      [...identities]
        .filter((i) => i.path !== '__soul__' && i.filename !== 'README.md' && !i.archived)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [identities],
  )

  // ── Resolve pinned item to actual entry ───────────────────────────────────

  const resolvePinnedEntry = useCallback(
    (pinned: { type: 'journal' | 'identity' | 'topic'; path: string }) => {
      if (pinned.type === 'journal') {
        return entries.find((e) => `${e.year_month}/${e.filename}` === pinned.path)
      }
      if (pinned.type === 'identity') {
        return identities.find(
          (i) => i.path === pinned.path || `identities/${i.filename}` === pinned.path,
        )
      }
      if (pinned.type === 'topic') {
        for (const [, dirState] of dirs) {
          const found = dirState.entries.find((e) => e.path === pinned.path)
          if (found) return found
        }
      }
      return undefined
    },
    [entries, identities, dirs],
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
      isArchived?: boolean,
      isCoreIdentity?: boolean,
    ) => {
      setCtxMenu({
        itemType: itemType as TreeContextMenuState['itemType'],
        name,
        path,
        absolutePath,
        isPinned,
        isArchived,
        isCoreIdentity,
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
      {category === 'topics' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 8px 8px',
            fontSize: 'var(--text-base)',
            fontWeight: 'var(--font-semibold)',
            color: 'var(--text-primary)',
          }}
        >
          <span>Workspace</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              aria-label="Search"
              style={{
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: 'transparent',
                color: 'var(--item-meta)',
                cursor: 'pointer',
              }}
            >
              <Search size={16} strokeWidth={1.6} />
            </button>
            <button
              type="button"
              aria-label="View layout"
              style={{
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: 'transparent',
                color: 'var(--item-meta)',
                cursor: 'pointer',
              }}
            >
              <LayoutGrid size={16} strokeWidth={1.6} />
            </button>
          </div>
        </div>
      )}
      <div
        key={category}
        style={{
          flex: 1,
          overflow: 'hidden auto',
          animation: 'nav-rail-fade-in 120ms ease-out',
        }}
      >
        {category === 'journal' && (
          <>
            {/* ════════════════════════════════════════════════════════════════════
                Journal Pipeline Section (流水)
                ════════════════════════════════════════════════════════════════════ */}
            <div>
              {monthGroups.map(([yearMonth, monthEntries]) => (
                <div key={yearMonth}>
                  <MonthDivider
                    label={yearMonth}
                    collapsed={isCollapsed(`journal-month:${yearMonth}`)}
                    onToggle={() => toggleSection(`journal-month:${yearMonth}`)}
                  />
                  {!isCollapsed(`journal-month:${yearMonth}`) &&
                    monthEntries.map((entry) => (
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
                      color: 'var(--text-secondary, #9CA3AF)',
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
            </div>
          </>
        )}

        {category === 'identity' && (
          <>
            {/* ════════════════════════════════════════════════════════════════════
                Core Identities Section (核心画像)
                ════════════════════════════════════════════════════════════════════ */}
            {coreIdentities.length > 0 && (
              <div style={{ marginBottom: 2 }}>
                <SectionHeader
                  collapsed={isCollapsed('core-identity')}
                  onToggle={() => toggleSection('core-identity')}
                  label="核心画像"
                  count={coreIdentities.length}
                  icon={<PinIcon />}
                />
                {!isCollapsed('core-identity') &&
                  coreIdentities.map((identity) => (
                    <TreeItem
                      key={`core-${identity.path}`}
                      itemType="identity"
                      identity={identity}
                      isSelected={isSelected('identity', identity.path)}
                      onClick={() => handleSelect({ type: 'identity', path: identity.path })}
                      onAt={() => onAtRef(`identities/${identity.filename}`)}
                      onMore={(x, y) =>
                        handleMore(
                          'identity',
                          identity.name,
                          identity.path,
                          false,
                          x,
                          y,
                          undefined,
                          false,
                          true,
                        )
                      }
                    />
                  ))}
              </div>
            )}

            {coreIdentities.length > 0 && sortedIdentities.length > 0 && (
              <div
                style={{
                  height: 0,
                  borderBottom: '0.5px solid var(--divider)',
                  margin: '6px 12px',
                }}
              />
            )}

            {/* ════════════════════════════════════════════════════════════════════
                Identities by Region (按分组)
                ════════════════════════════════════════════════════════════════════ */}
            {identityGroups.map(([region, groupIdentities]) => (
              <div key={region} style={{ marginBottom: 2 }}>
                <SectionHeader
                  collapsed={isCollapsed(`identity-region:${region}`)}
                  onToggle={() => toggleSection(`identity-region:${region}`)}
                  label={region}
                  count={groupIdentities.length}
                  icon={<IdentityIcon />}
                />
                {!isCollapsed(`identity-region:${region}`) &&
                  groupIdentities.map((identity) => (
                    <TreeItem
                      key={identity.path}
                      itemType="identity"
                      identity={identity}
                      isSelected={isSelected('identity', identity.path)}
                      onClick={() => handleSelect({ type: 'identity', path: identity.path })}
                      onAt={() => onAtRef(`identities/${identity.filename}`)}
                      onMore={(x, y) =>
                        handleMore(
                          'identity',
                          identity.name,
                          identity.path,
                          false,
                          x,
                          y,
                          undefined,
                          false,
                          false,
                        )
                      }
                    />
                  ))}
              </div>
            ))}

            {/* ════════════════════════════════════════════════════════════════════
                Archived Identities (归档)
                ════════════════════════════════════════════════════════════════════ */}
            {archivedIdentities.length > 0 && (
              <>
                {sortedIdentities.length > 0 && (
                  <div
                    style={{
                      height: 0,
                      borderBottom: '0.5px solid var(--divider)',
                      margin: '6px 12px',
                    }}
                  />
                )}
                <div style={{ marginBottom: 2 }}>
                  <SectionHeader
                    collapsed={isCollapsed('identity-archived')}
                    onToggle={() => toggleSection('identity-archived')}
                    label="归档"
                    count={archivedIdentities.length}
                    icon={<ArchiveIcon />}
                  />
                  {!isCollapsed('identity-archived') &&
                    archivedIdentities.map((identity) => (
                      <TreeItem
                        key={identity.path}
                        itemType="identity"
                        identity={identity}
                        isSelected={isSelected('identity', identity.path)}
                        onClick={() => handleSelect({ type: 'identity', path: identity.path })}
                        onAt={() => onAtRef(`identities/${identity.filename}`)}
                        onMore={(x, y) =>
                          handleMore(
                            'identity',
                            identity.name,
                            identity.path,
                            false,
                            x,
                            y,
                            undefined,
                            true,
                            false,
                          )
                        }
                      />
                    ))}
                </div>
              </>
            )}
            {identityLoading && (
              <div
                style={{
                  padding: '8px 6px',
                  fontSize: '0.75rem',
                  color: 'var(--text-tertiary, #9CA3AF)',
                }}
              >
                加载中...
              </div>
            )}
          </>
        )}

        {category === 'topics' && (
          <>
            {/* ════════════════════════════════════════════════════════════════════
                Pinned Topics Section
                ════════════════════════════════════════════════════════════════════ */}
            {pinnedItems.filter((p) => p.type === 'topic').length > 0 && (
              <div style={{ marginBottom: 2 }}>
                <SectionHeader
                  collapsed={isCollapsed('pinned')}
                  onToggle={() => toggleSection('pinned')}
                  label="置顶"
                  count={pinnedItems.filter((p) => p.type === 'topic').length}
                  icon={<PinIcon />}
                />
                {!isCollapsed('pinned') &&
                  pinnedItems
                    .filter((p) => p.type === 'topic')
                    .map((pinned) => {
                      const resolved = resolvePinnedEntry(pinned)
                      if (!resolved) return null
                      const topicEntry = resolved as TopicEntry
                      if (topicEntry.is_dir) {
                        const isExpanded = pinnedExpanded.has(topicEntry.path)
                        const children = pinnedChildren.get(topicEntry.path)
                        return (
                          <div key={`pinned-topic-${topicEntry.path}`}>
                            <TreeItem
                              itemType="topic-file"
                              topicEntry={topicEntry}
                              isSelected={isSelected('topic', topicEntry.path)}
                              onClick={() => togglePinnedDir(topicEntry.path)}
                              onAt={() => onAtRef(topicEntry.path)}
                              onMore={(x, y) =>
                                handleMore(
                                  'topic-folder',
                                  topicEntry.name,
                                  topicEntry.path,
                                  true,
                                  x,
                                  y,
                                  wsPath ? `${wsPath}/${topicEntry.path}` : undefined,
                                )
                              }
                            />
                            {isExpanded && children && (
                              <TopicTree
                                entries={children}
                                dirs={dirs}
                                selectedPath={
                                  selected?.type === 'topic' || selected?.type === 'topic-file'
                                    ? selected.path
                                    : null
                                }
                                indent={1}
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
                                    pinnedItems.some(
                                      (p) => p.type === 'topic' && p.path === entry.path,
                                    ),
                                    x,
                                    y,
                                    wsPath ? `${wsPath}/${entry.path}` : undefined,
                                  )
                                }
                              />
                            )}
                          </div>
                        )
                      }
                      // pinned file
                      return (
                        <TreeItem
                          key={`pinned-topic-${topicEntry.path}`}
                          itemType="topic-file"
                          topicEntry={topicEntry}
                          isSelected={isSelected('topic-file', topicEntry.path)}
                          onClick={() =>
                            handleSelect({
                              type: 'topic-file',
                              path: topicEntry.path,
                              name: topicEntry.name,
                              created_secs: topicEntry.created_secs,
                              mtime_secs: topicEntry.mtime_secs,
                            })
                          }
                          onAt={() => onAtRef(topicEntry.path)}
                          onMore={(x, y) =>
                            handleMore(
                              'topic-file',
                              topicEntry.name,
                              topicEntry.path,
                              true,
                              x,
                              y,
                              wsPath ? `${wsPath}/${topicEntry.path}` : undefined,
                            )
                          }
                        />
                      )
                    })}
              </div>
            )}

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
                        color: 'var(--text-tertiary, #9CA3AF)',
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
                          pinnedItems.some((p) => p.type === 'topic' && p.path === entry.path),
                          x,
                          y,
                          wsPath ? `${wsPath}/${entry.path}` : undefined,
                        )
                      }
                    />
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* ideas, automation, skills: sidebar shows nothing — workbench fills center panel */}
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
          onArchive={(path) => {
            archiveIdentity(path).then(() => setCtxMenu(null))
          }}
          onUnarchive={(path) => {
            unarchiveIdentity(path).then(() => setCtxMenu(null))
          }}
        />
      )}
    </div>
  )
}
