import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'
import { listWorkspaceDir, getWorkspacePath, type WorkspaceDirEntry } from '../lib/tauri'
import { fileKindFromName } from '../lib/fileKind'
import { useTranslation } from '../contexts/I18nContext'
import { Spinner } from './Spinner'
import { FileTreeContextMenu } from './FileTreeContextMenu'

interface FileTreeProps {
  selectedPath: string | null
  onSelectFile: (entry: WorkspaceDirEntry) => void
}

type DirState = {
  entries: WorkspaceDirEntry[]
  loading: boolean
  expanded: boolean
}

const MAX_INDENT_DEPTH = 8

function FileIcon({ name, isDir }: { name: string; isDir: boolean }) {
  const props = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style: { flexShrink: 0 } as const,
  }

  if (isDir) {
    return (
      <svg {...props}>
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    )
  }

  const kind = fileKindFromName(name)
  switch (kind) {
    case 'markdown':
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      )
    case 'html':
      return (
        <svg {...props}>
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      )
    case 'image':
      return (
        <svg {...props}>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      )
    case 'audio':
      return (
        <svg {...props}>
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      )
    default:
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      )
  }
}

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
        transition: 'transform 0.15s ease-out',
        flexShrink: 0,
      }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

/** Recursively load all subdirectories under the given paths */
async function loadAllDirectories(
  currentDirs: Map<string, DirState>,
): Promise<Map<string, DirState>> {
  const next = new Map(currentDirs)

  // Collect all unloaded directories
  const toLoad: string[] = []
  for (const [, state] of currentDirs) {
    for (const entry of state.entries) {
      if (entry.is_dir && !currentDirs.has(entry.path)) {
        toLoad.push(entry.path)
      }
    }
  }

  // Load in batches to avoid overwhelming the system
  const BATCH_SIZE = 8
  for (let i = 0; i < toLoad.length; i += BATCH_SIZE) {
    const batch = toLoad.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map(async (path) => {
        const entries = await listWorkspaceDir(path)
        return { path, entries }
      }),
    )
    for (const r of results) {
      if (r.status === 'fulfilled') {
        next.set(r.value.path, {
          entries: r.value.entries,
          loading: false,
          expanded: false,
        })
      }
    }
  }

  // Recurse: check if any newly loaded dirs contain more subdirs
  let hasMore = false
  for (const path of toLoad) {
    const state = next.get(path)
    if (state) {
      for (const entry of state.entries) {
        if (entry.is_dir && !next.has(entry.path)) {
          hasMore = true
          break
        }
      }
    }
    if (hasMore) break
  }

  if (hasMore) {
    return loadAllDirectories(next)
  }

  return next
}

export function FileTree({ selectedPath, onSelectFile }: FileTreeProps) {
  const { t } = useTranslation()
  const [dirs, setDirs] = useState<Map<string, DirState>>(new Map())
  const [workspacePath, setWorkspacePath] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [hoveredPath, setHoveredPath] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    entry: WorkspaceDirEntry
    x: number
    y: number
  } | null>(null)
  const [filterQuery, setFilterQuery] = useState('')
  const [searchActive, setSearchActive] = useState(false)
  const [loadingAll, setLoadingAll] = useState(false)
  const filterRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const searchBarRef = useRef<HTMLDivElement>(null)
  const didInitialScroll = useRef(false)
  const allDirsLoaded = useRef(false)

  useEffect(() => {
    getWorkspacePath().then((wp) => {
      setWorkspacePath(wp)
      const name = wp.split('/').filter(Boolean).pop() ?? ''
      setWorkspaceName(name)
    })
    listWorkspaceDir('').then((entries) => {
      setDirs(new Map([['', { entries, loading: false, expanded: true }]]))
    })
  }, [])

  // When user starts typing a filter query, eagerly load all subdirectories
  useEffect(() => {
    if (!filterQuery || allDirsLoaded.current) return

    let cancelled = false
    setLoadingAll(true)

    // Need to read latest dirs — use the setter callback pattern
    setDirs((prev) => {
      if (cancelled) return prev
      loadAllDirectories(prev).then((full) => {
        if (!cancelled) {
          setDirs(full)
          setLoadingAll(false)
          allDirsLoaded.current = true
        }
      })
      return prev
    })

    return () => {
      cancelled = true
    }
  }, [filterQuery])

  // Reset allDirsLoaded when filter is cleared (so next search re-scans freshest state)
  useEffect(() => {
    if (!filterQuery) {
      allDirsLoaded.current = false
      setLoadingAll(false)
    }
  }, [filterQuery])

  // Hide search bar on mount by scrolling past it
  useLayoutEffect(() => {
    if (!didInitialScroll.current && scrollRef.current && searchBarRef.current) {
      scrollRef.current.scrollTop = searchBarRef.current.offsetHeight
      didInitialScroll.current = true
    }
  }, [])

  // Keep search bar hidden when search is inactive
  useEffect(() => {
    if (!searchActive && didInitialScroll.current && scrollRef.current && searchBarRef.current) {
      const barH = searchBarRef.current.offsetHeight
      if (scrollRef.current.scrollTop < barH) {
        scrollRef.current.scrollTop = barH
      }
    }
  }, [searchActive])

  function dismissSearch() {
    setFilterQuery('')
    filterRef.current?.blur()
    setSearchActive(false)
    if (scrollRef.current && searchBarRef.current) {
      scrollRef.current.scrollTo({
        top: searchBarRef.current.offsetHeight,
        behavior: 'smooth',
      })
    }
  }

  const toggleDir = useCallback((path: string) => {
    setDirs((prev) => {
      const next = new Map(prev)
      const state = next.get(path)
      if (state) {
        next.set(path, { ...state, expanded: !state.expanded })
      } else {
        next.set(path, { entries: [], loading: true, expanded: true })
        listWorkspaceDir(path).then((entries) => {
          setDirs((p) => {
            const n = new Map(p)
            n.set(path, { entries, loading: false, expanded: true })
            return n
          })
        })
      }
      return next
    })
  }, [])

  const renderEntries = (parentPath: string, depth: number) => {
    const state = dirs.get(parentPath)
    if (!state || !state.expanded) return null

    if (state.loading) {
      return (
        <div
          style={{
            padding: '6px 14px',
            paddingLeft: 14 + Math.min(depth + 1, MAX_INDENT_DEPTH) * 16,
            color: 'var(--item-meta)',
          }}
        >
          <Spinner size={12} />
        </div>
      )
    }

    if (state.entries.length === 0 && parentPath !== '') {
      return (
        <div
          style={{
            paddingLeft: 14 + Math.min(depth + 1, MAX_INDENT_DEPTH) * 16,
            paddingTop: 4,
            paddingBottom: 4,
            fontSize: 'var(--text-xs)',
            color: 'var(--item-meta)',
            fontStyle: 'italic',
          }}
        >
          {t('emptyFolder')}
        </div>
      )
    }

    return state.entries.map((entry) => {
      const indent = 14 + Math.min(depth, MAX_INDENT_DEPTH) * 16
      const isSelected = entry.path === selectedPath
      const isHovered = entry.path === hoveredPath

      const childState = dirs.get(entry.path)

      return (
        <div key={entry.path}>
          <div
            onClick={() => {
              if (entry.is_dir) {
                toggleDir(entry.path)
              } else {
                onSelectFile(entry)
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              setContextMenu({ entry, x: e.clientX, y: e.clientY })
            }}
            onMouseEnter={() => setHoveredPath(entry.path)}
            onMouseLeave={() => setHoveredPath(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              paddingLeft: indent,
              paddingRight: 14,
              paddingTop: 5,
              paddingBottom: 5,
              cursor: 'pointer',
              userSelect: 'none' as const,
              background: isSelected
                ? 'var(--item-selected-bg)'
                : isHovered
                  ? 'var(--item-hover-bg)'
                  : 'transparent',
              color: isSelected ? 'var(--item-selected-text)' : 'var(--item-text)',
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-body)',
              lineHeight: 1.4,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {entry.is_dir && <Chevron expanded={!!childState?.expanded} />}
            {!entry.is_dir && <div style={{ width: 10, flexShrink: 0 }} />}
            <FileIcon name={entry.name} isDir={entry.is_dir} />
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {entry.name}
            </span>
          </div>
          {entry.is_dir && renderEntries(entry.path, depth + 1)}
        </div>
      )
    })
  }

  const lowerFilter = filterQuery.toLowerCase()
  const isFiltering = filterQuery.length > 0

  // Check if a directory or any of its descendants contain a matching file
  const dirContainsMatch = (parentPath: string): boolean => {
    const state = dirs.get(parentPath)
    if (!state) return false
    for (const entry of state.entries) {
      if (!entry.is_dir) {
        if (entry.name.toLowerCase().includes(lowerFilter)) return true
      } else {
        if (dirContainsMatch(entry.path)) return true
      }
    }
    return false
  }

  // Filtered tree rendering — only shows matching files and dirs that contain matches
  const renderFilteredEntries = (parentPath: string, depth: number): React.ReactNode => {
    const state = dirs.get(parentPath)
    if (!state) return null

    return state.entries.map((entry) => {
      const indent = 14 + Math.min(depth, MAX_INDENT_DEPTH) * 16
      const isSelected = entry.path === selectedPath
      const isHovered = entry.path === hoveredPath
      const nameMatches = entry.name.toLowerCase().includes(lowerFilter)

      if (entry.is_dir) {
        // Only show directory if it contains matching descendants
        if (!dirContainsMatch(entry.path)) return null
        const childState = dirs.get(entry.path)
        return (
          <div key={entry.path}>
            <div
              onClick={() => toggleDir(entry.path)}
              onContextMenu={(e) => {
                e.preventDefault()
                setContextMenu({ entry, x: e.clientX, y: e.clientY })
              }}
              onMouseEnter={() => setHoveredPath(entry.path)}
              onMouseLeave={() => setHoveredPath(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                paddingLeft: indent,
                paddingRight: 14,
                paddingTop: 5,
                paddingBottom: 5,
                cursor: 'pointer',
                userSelect: 'none' as const,
                background: isSelected
                  ? 'var(--item-selected-bg)'
                  : isHovered
                    ? 'var(--item-hover-bg)'
                    : 'transparent',
                color: isSelected ? 'var(--item-selected-text)' : 'var(--item-text)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-body)',
                lineHeight: 1.4,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              <Chevron expanded={!!childState?.expanded} />
              <FileIcon name={entry.name} isDir={true} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.name}</span>
            </div>
            {childState?.expanded && renderFilteredEntries(entry.path, depth + 1)}
          </div>
        )
      }

      // File: only show if name matches
      if (!nameMatches) return null
      return (
        <div key={entry.path}>
          <div
            onClick={() => onSelectFile(entry)}
            onContextMenu={(e) => {
              e.preventDefault()
              setContextMenu({ entry, x: e.clientX, y: e.clientY })
            }}
            onMouseEnter={() => setHoveredPath(entry.path)}
            onMouseLeave={() => setHoveredPath(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              paddingLeft: indent,
              paddingRight: 14,
              paddingTop: 5,
              paddingBottom: 5,
              cursor: 'pointer',
              userSelect: 'none' as const,
              background: isSelected
                ? 'var(--item-selected-bg)'
                : isHovered
                  ? 'var(--item-hover-bg)'
                  : 'transparent',
              color: isSelected ? 'var(--item-selected-text)' : 'var(--item-text)',
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-body)',
              lineHeight: 1.4,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            <div style={{ width: 10, flexShrink: 0 }} />
            <FileIcon name={entry.name} isDir={false} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.name}</span>
          </div>
        </div>
      )
    })
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {/* Search input — inside scroll container, hidden above fold */}
        <div
          ref={searchBarRef}
          style={{
            padding: '8px 12px',
            borderBottom: '0.5px solid var(--divider)',
            background: 'var(--sidebar-bg-translucent, rgba(30,30,30,0.72))',
            backdropFilter: 'saturate(180%) blur(20px)',
            WebkitBackdropFilter: 'saturate(180%) blur(20px)',
            ...(searchActive ? { position: 'sticky' as const, top: 0, zIndex: 10 } : {}),
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 8px',
              background: 'var(--filter-input-bg, rgba(128,128,128,0.08))',
              borderRadius: 6,
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: 0.35, flexShrink: 0 }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={filterRef}
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              onFocus={() => setSearchActive(true)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  dismissSearch()
                }
              }}
              placeholder={t('filterFiles') ?? 'Filter files…'}
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-body)',
                color: 'var(--item-text)',
              }}
            />
            {loadingAll && <Spinner size={12} />}
            {filterQuery && !loadingAll && (
              <button
                onClick={() => {
                  setFilterQuery('')
                  filterRef.current?.focus()
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: 'var(--item-meta)',
                  display: 'flex',
                  alignItems: 'center',
                  opacity: 0.5,
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Content: filtered tree or normal tree */}
        {isFiltering ? (
          loadingAll ? (
            <div
              style={{
                padding: '24px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                color: 'var(--item-meta)',
                fontSize: 'var(--text-xs)',
              }}
            >
              <Spinner size={12} />
              <span>扫描文件中…</span>
            </div>
          ) : dirContainsMatch('') ? (
            <>{renderFilteredEntries('', 0)}</>
          ) : (
            <div
              style={{
                padding: '24px 14px',
                textAlign: 'center',
                fontSize: 'var(--text-xs)',
                color: 'var(--item-meta)',
                fontStyle: 'italic',
              }}
            >
              {t('noResults')}
            </div>
          )
        ) : (
          <>
            {workspaceName && (
              <div
                style={{
                  padding: '10px 14px 6px',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--item-meta)',
                  fontWeight: 'var(--font-semibold)' as unknown as number,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                {workspaceName}
              </div>
            )}
            {renderEntries('', 0)}
          </>
        )}
      </div>
      {contextMenu && (
        <FileTreeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          name={contextMenu.entry.name}
          relativePath={contextMenu.entry.path}
          absolutePath={
            workspacePath ? `${workspacePath}/${contextMenu.entry.path}` : contextMenu.entry.path
          }
          isDir={contextMenu.entry.is_dir}
          onClose={() => setContextMenu(null)}
          onReference={
            !contextMenu.entry.is_dir
              ? () => {
                  window.dispatchEvent(
                    new CustomEvent('chat-append-text', {
                      detail: `@${contextMenu.entry.path}`,
                    }),
                  )
                }
              : undefined
          }
          onRefresh={() => {
            const parentPath = contextMenu.entry.path.includes('/')
              ? contextMenu.entry.path.substring(0, contextMenu.entry.path.lastIndexOf('/'))
              : ''
            listWorkspaceDir(parentPath).then((entries) => {
              setDirs((prev) => {
                const next = new Map(prev)
                const state = next.get(parentPath)
                if (state) {
                  next.set(parentPath, { ...state, entries })
                }
                return next
              })
            })
          }}
        />
      )}
    </div>
  )
}
