import { useEffect, useRef } from 'react'
import { revealInFileManager, openFile } from '../lib/tauri'
import { ask } from '@tauri-apps/plugin-dialog'

export interface TreeContextMenuState {
  x: number
  y: number
  itemType: 'identity' | 'journal' | 'topic-file' | 'topic-folder'
  name: string
  path: string
  absolutePath?: string
  isPinned: boolean
}

interface TreeContextMenuProps {
  state: TreeContextMenuState
  onClose: () => void
  onPin: (type: 'journal' | 'identity', path: string) => void
  onUnpin: (path: string) => void
  onDelete: (type: string, path: string) => void
}

type MenuItemDef =
  | { type: 'action'; label: string; shortcut?: string; icon: string; danger?: boolean; onClick: () => void }
  | { type: 'divider' }

export function TreeContextMenu({
  state, onClose, onPin, onUnpin, onDelete,
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
    try { await navigator.clipboard.writeText(path) } catch { /* ignore */ }
    onClose()
  }

  async function handleShowInFileManager() {
    await revealInFileManager(state.absolutePath ?? path)
    onClose()
  }
  async function handleOpenInEditor() { await openFile(state.absolutePath ?? path); onClose() }

  function handlePin() {
    onPin(itemType === 'identity' ? 'identity' : 'journal', path)
    onClose()
  }
  function handleUnpin() { onUnpin(path); onClose() }
  async function handleDelete() {
    onClose()
    const confirmed = await ask(`确认删除「${name}」？`, { title: '删除确认', kind: 'warning' })
    if (confirmed) onDelete(itemType, path)
  }

  const deleteLabel =
    itemType === 'identity' ? '删除画像' :
    itemType === 'topic-folder' ? '删除文件夹' : '删除条目'

  const items: MenuItemDef[] = [
    {
      type: 'action',
      label: isPinned ? '取消置顶' : '置顶',
      icon: 'pin',
      onClick: isPinned ? handleUnpin : handlePin,
    },
    { type: 'action', label: '复制路径', shortcut: '⌘C', icon: 'copy', onClick: copyPath },
    { type: 'divider' },
    { type: 'action', label: '在编辑器中打开', icon: 'edit', onClick: handleOpenInEditor },
    {
      type: 'action',
      label: '在文件管理器中显示',
      icon: 'folder',
      onClick: handleShowInFileManager,
    },
    { type: 'divider' },
    { type: 'action', label: deleteLabel, shortcut: '⌫', icon: 'delete', danger: true, onClick: handleDelete },
  ]

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: y,
        left: x,
        zIndex: 9999,
        background: 'var(--context-menu-bg)',
        border: '0.5px solid var(--context-menu-border)',
        borderRadius: 8,
        boxShadow: '0 4px 24px var(--context-menu-shadow)',
        minWidth: 200,
        maxWidth: 280,
        overflow: 'hidden',
        padding: '4px 0',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '4px 10px 6px',
          fontSize: '0.6875rem',
          fontWeight: 500,
          color: 'var(--text-tertiary, #5c5852)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          letterSpacing: '0.02em',
        }}
      >
        {name}
      </div>

      <div style={{ height: 0.5, background: 'var(--divider)', margin: '2px 8px' }} />

      {items.map((item, i) => {
        if (item.type === 'divider') {
          return <div key={i} style={{ height: 0.5, background: 'var(--divider)', margin: '2px 8px' }} />
        }
        return (
          <MenuItemRow
            key={i}
            label={item.label}
            shortcut={item.shortcut}
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

const iconPaths: Record<string, React.ReactNode> = {
  pin: (
    <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  ),
  copy: (
    <g>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </g>
  ),
  edit: (
    <g>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </g>
  ),
  folder: (
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  ),
  delete: (
    <g>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </g>
  ),
}

function MenuIcon({ icon, danger }: { icon: string; danger?: boolean }) {
  const color = danger ? 'var(--status-danger)' : 'var(--item-meta)'
  return (
    <svg
      width={14} height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      {iconPaths[icon]}
    </svg>
  )
}

// ── MenuItemRow ─────────────────────────────────────────────────────────────────

function MenuItemRow({
  label, shortcut, icon, danger, onClick,
}: {
  label: string
  shortcut?: string
  icon: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '5px 10px',
        fontSize: 'var(--text-sm, 0.8125rem)',
        cursor: 'pointer',
        color: danger ? 'var(--status-danger)' : 'var(--item-text)',
        transition: 'background 0.08s',
        borderRadius: 0,
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.background = danger
          ? 'rgba(255,59,48,0.08)'
          : 'var(--item-hover-bg, rgba(255,255,255,0.025))'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
      }}
    >
      <span style={{ width: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <MenuIcon icon={icon} danger={danger} />
      </span>
      <span style={{ flex: 1 }}>{label}</span>
      {shortcut && (
        <span style={{
          fontSize: '0.6875rem',
          color: 'var(--text-tertiary, #5c5852)',
          fontFamily: 'var(--font-body)',
          flexShrink: 0,
          marginLeft: 16,
        }}>
          {shortcut}
        </span>
      )}
    </div>
  )
}
