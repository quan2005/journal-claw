import { useEffect, useRef } from 'react'
import { revealInFinder, openFile } from '../lib/tauri'

export interface TreeContextMenuState {
  x: number
  y: number
  itemType: 'identity' | 'journal' | 'topic-file' | 'topic-folder'
  name: string
  path: string // workspace-relative or absolute
  isPinned: boolean
}

interface TreeContextMenuProps {
  state: TreeContextMenuState
  onClose: () => void
  onAt: (path: string) => void
  onPin: (type: 'journal' | 'identity', path: string) => void
  onUnpin: (path: string) => void
  onDelete: (type: string, path: string) => void
}

type MenuItem =
  | { type: 'action'; label: string; icon: string; danger?: boolean; onClick: () => void }
  | { type: 'divider' }

export function TreeContextMenu({
  state, onClose, onAt, onPin, onUnpin, onDelete,
}: TreeContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [onClose])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    if (rect.right > window.innerWidth)
      ref.current.style.left = `${Math.max(4, window.innerWidth - rect.width - 8)}px`
    if (rect.bottom > window.innerHeight)
      ref.current.style.top = `${Math.max(4, window.innerHeight - rect.height - 8)}px`
  }, [])

  const { itemType, name, path, isPinned, x, y } = state

  async function copyPath() {
    try {
      await navigator.clipboard.writeText(path)
    } catch { /* ignore */ }
  }

  async function handleShowInFinder() {
    await revealInFinder(path)
  }

  async function handleOpenInEditor() {
    await openFile(path)
  }

  function handlePin() {
    const pinType = itemType === 'identity' ? 'identity' : 'journal'
    onPin(pinType, path)
    onClose()
  }

  function handleUnpin() {
    onUnpin(path)
    onClose()
  }

  function handleAt() {
    onAt(itemType === 'topic-file' || itemType === 'topic-folder' ? `topics/${path}` : path)
    onClose()
  }

  function handleDelete() {
    onDelete(itemType, path)
    onClose()
  }

  const items: MenuItem[] = [
    {
      type: 'action',
      label: '@ 引用',
      icon: 'at',
      onClick: handleAt,
    },
    {
      type: 'action',
      label: isPinned ? '取消钉选' : '钉选',
      icon: 'pin',
      onClick: isPinned ? handleUnpin : handlePin,
    },
    { type: 'action', label: '复制路径', icon: 'copy', onClick: copyPath },
    { type: 'divider' },
  ]

  // File operations (skip for identities — they have different flow)
  if (itemType !== 'identity') {
    items.push(
      { type: 'action', label: '在编辑器中打开', icon: 'edit', onClick: handleOpenInEditor },
      { type: 'action', label: '在 Finder 中显示', icon: 'finder', onClick: handleShowInFinder },
      { type: 'divider' },
    )
  } else {
    items.push(
      { type: 'action', label: '在编辑器中打开', icon: 'edit', onClick: handleOpenInEditor },
      { type: 'action', label: '在 Finder 中显示', icon: 'finder', onClick: handleShowInFinder },
      { type: 'divider' },
    )
  }

  items.push({
    type: 'action',
    label: `删除${itemType === 'identity' ? '画像' : itemType === 'topic-folder' ? '文件夹' : '条目'}`,
    icon: 'delete',
    danger: true,
    onClick: handleDelete,
  })

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: y,
        left: x,
        zIndex: 9999,
        background: 'var(--context-menu-bg)',
        border: '1px solid var(--context-menu-border)',
        borderRadius: 8,
        boxShadow: '0 4px 20px var(--context-menu-shadow)',
        minWidth: 180,
        overflow: 'hidden',
        padding: '4px 0',
      }}
    >
      {/* Header: item name */}
      <div
        style={{
          padding: '6px 12px 8px',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          borderBottom: '0.5px solid var(--divider)',
          marginBottom: 4,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {name}
      </div>

      {items.map((item, i) => {
        if (item.type === 'divider') {
          return (
            <div key={i} style={{ height: 1, background: 'var(--divider)', margin: '4px 0' }} />
          )
        }
        return (
          <MenuItemRow
            key={i}
            label={item.label}
            icon={item.icon}
            danger={item.danger}
            onClick={item.onClick}
          />
        )
      })}
    </div>
  )
}

// ── MenuIcon ────────────────────────────────────────────────────────────────────

function MenuIcon({ icon, danger }: { icon: string; danger?: boolean }) {
  const color = danger ? 'var(--status-danger)' : 'var(--item-meta)'
  const size = 14
  const props = {
    width: size, height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: color,
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  switch (icon) {
    case 'at':
      return (
        <svg {...props}>
          <text x="12" y="18" textAnchor="middle" fontSize="20" fontWeight="700" fill={color} stroke="none">@</text>
        </svg>
      )
    case 'pin':
      return (
        <svg {...props}>
          <line x1="4" y1="20" x2="12" y2="8" />
          <line x1="18" y1="14" x2="12" y2="8" />
          <line x1="12" y1="8" x2="12" y2="2" />
        </svg>
      )
    case 'copy':
      return (
        <svg {...props}>
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )
    case 'edit':
      return (
        <svg {...props}>
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      )
    case 'finder':
      return (
        <svg {...props}>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      )
    case 'delete':
      return (
        <svg {...props}>
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      )
    default:
      return null
  }
}

// ── MenuItemRow ─────────────────────────────────────────────────────────────────

function MenuItemRow({
  label, icon, danger, onClick,
}: {
  label: string
  icon: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 12px', fontSize: 'var(--text-sm)',
        cursor: 'pointer',
        color: danger ? 'var(--status-danger)' : 'var(--item-text)',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.background = danger
          ? 'rgba(255,59,48,0.06)'
          : 'var(--item-hover-bg)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
      }}
      onClick={onClick}
    >
      <MenuIcon icon={icon} danger={danger} />
      <span>{label}</span>
    </div>
  )
}
