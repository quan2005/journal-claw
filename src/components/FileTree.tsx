import { useState, useEffect, useCallback } from 'react'
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

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
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
