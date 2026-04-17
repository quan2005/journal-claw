import { useState, useEffect, useCallback, useRef } from 'react'
import { listWorkspaceDir, type WorkspaceDirEntry } from '../lib/tauri'

interface AtMentionMenuProps {
  query: string
  onSelect: (path: string) => void
  onClose: () => void
}

const FILE_ICON_TYPES: Record<string, string> = {
  m4a: 'audio',
  wav: 'audio',
  mp3: 'audio',
  aac: 'audio',
  ogg: 'audio',
  flac: 'audio',
  md: 'text',
  txt: 'text',
  pdf: 'clip',
  docx: 'clip',
  xlsx: 'clip',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  svg: 'image',
  html: 'globe',
  json: 'code',
}

function FileIconSvg({ name, isDir }: { name: string; isDir?: boolean }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const type = isDir ? 'folder' : (FILE_ICON_TYPES[ext] ?? 'file')
  const props = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (type) {
    case 'folder':
      return (
        <svg {...props}>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
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
    case 'text':
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M16 13H8" />
          <path d="M16 17H8" />
          <path d="M10 9H8" />
        </svg>
      )
    case 'clip':
      return (
        <svg {...props}>
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
      )
    case 'image':
      return (
        <svg {...props}>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      )
    case 'globe':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      )
    case 'code':
      return (
        <svg {...props}>
          <path d="M16 18l6-6-6-6" />
          <path d="M8 6l-6 6 6 6" />
        </svg>
      )
    default:
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
        </svg>
      )
  }
}

export function AtMentionMenu({ query, onSelect, onClose }: AtMentionMenuProps) {
  const [currentPath, setCurrentPath] = useState('')
  const [entries, setEntries] = useState<WorkspaceDirEntry[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)

  const loadDir = useCallback(async (path: string) => {
    setLoading(true)
    try {
      const items = await listWorkspaceDir(path)
      items.sort((a, b) => b.name.localeCompare(a.name))
      setEntries(items)
      setActiveIndex(0)
    } catch {
      setEntries([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadDir(currentPath)
  }, [currentPath, loadDir])

  const q = query.toLowerCase()
  const filtered = q ? entries.filter((e) => e.name.toLowerCase().includes(q)) : entries

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const item = list.children[activeIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const breadcrumbs = currentPath ? currentPath.split('/') : []

  const navigateUp = useCallback(() => {
    if (!currentPath) {
      onClose()
      return
    }
    const parts = currentPath.split('/')
    parts.pop()
    setCurrentPath(parts.join('/'))
  }, [currentPath, onClose])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % (filtered.length || 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + (filtered.length || 1)) % (filtered.length || 1))
      } else if (e.key === 'ArrowRight' && filtered.length > 0) {
        const entry = filtered[activeIndex]
        if (entry?.is_dir) {
          e.preventDefault()
          setCurrentPath(entry.path)
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        navigateUp()
      } else if (e.key === 'Enter' && filtered.length > 0) {
        e.preventDefault()
        const entry = filtered[activeIndex]
        if (entry.is_dir) {
          setCurrentPath(entry.path)
        } else {
          onSelect(entry.path)
        }
      } else if (e.key === 'Backspace' && currentPath && !query) {
        e.preventDefault()
        navigateUp()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    },
    [filtered, activeIndex, currentPath, query, onSelect, onClose, navigateUp],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [handleKeyDown])

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        right: 0,
        marginBottom: 4,
        background: 'var(--queue-bg)',
        border: '0.5px solid var(--queue-border)',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 -4px 16px var(--context-menu-shadow)',
        zIndex: 10,
        maxHeight: 280,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Breadcrumb */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '6px 12px',
          fontSize: 'var(--text-xs)',
          color: 'var(--item-meta)',
          borderBottom: '0.5px solid var(--queue-border)',
          flexShrink: 0,
        }}
      >
        <span
          onClick={() => setCurrentPath('')}
          style={{ cursor: 'pointer', opacity: currentPath ? 0.7 : 1 }}
        >
          workspace
        </span>
        {breadcrumbs.map((part, i) => {
          const path = breadcrumbs.slice(0, i + 1).join('/')
          return (
            <span key={path} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ opacity: 0.4 }}>/</span>
              <span
                onClick={() => setCurrentPath(path)}
                style={{ cursor: 'pointer', opacity: i === breadcrumbs.length - 1 ? 1 : 0.7 }}
              >
                {part}
              </span>
            </span>
          )
        })}
        {q && (
          <span style={{ opacity: 0.4, marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>
            {q}
          </span>
        )}
      </div>

      {/* Entries */}
      <div ref={listRef} style={{ overflowY: 'auto', flex: 1 }}>
        {loading ? (
          <div
            style={{
              padding: '12px',
              fontSize: 'var(--text-xs)',
              color: 'var(--item-meta)',
              textAlign: 'center',
            }}
          >
            ...
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              padding: '12px',
              fontSize: 'var(--text-xs)',
              color: 'var(--item-meta)',
              textAlign: 'center',
            }}
          >
            {q ? '无匹配' : '空目录'}
          </div>
        ) : (
          filtered.map((entry, i) => (
            <div
              key={entry.path}
              onClick={() => {
                if (entry.is_dir) {
                  setCurrentPath(entry.path)
                } else {
                  onSelect(entry.path)
                }
              }}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 12px',
                cursor: 'pointer',
                background: i === activeIndex ? 'var(--item-hover-bg)' : 'transparent',
                transition: 'background 0.1s ease-out',
              }}
            >
              <span
                style={{
                  width: 20,
                  textAlign: 'center',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--item-meta)',
                }}
              >
                <FileIconSvg name={entry.name} isDir={entry.is_dir} />
              </span>
              <span
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--item-text)',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {entry.name}
              </span>
              {entry.is_dir && (
                <span
                  style={{ fontSize: 'var(--text-xs)', color: 'var(--item-meta)', opacity: 0.5 }}
                >
                  →
                </span>
              )}
              {!entry.is_dir && i === activeIndex && (
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--item-meta)',
                    opacity: 0.5,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  ↵
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
