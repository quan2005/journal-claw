import { useEffect, useRef } from 'react'
import type { JournalEntry } from '../types'
import { getJournalEntryContent, revealInFinder, openFile } from '../lib/tauri'
import { useTranslation } from '../contexts/I18nContext'

interface JournalContextMenuProps {
  x: number
  y: number
  entry: JournalEntry
  onDelete: () => void
  onClose: () => void
}

type MenuItem =
  | { type: 'action'; label: string; icon: string; danger?: boolean; onClick: () => void }
  | { type: 'divider' }

export function JournalContextMenu({ x, y, entry, onDelete, onClose }: JournalContextMenuProps) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Adjust position so menu doesn't overflow viewport
  useEffect(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (rect.right > vw) ref.current.style.left = `${Math.max(4, vw - rect.width - 8)}px`
    if (rect.bottom > vh) ref.current.style.top = `${Math.max(4, vh - rect.height - 8)}px`
  }, [])

  async function copyTitle() {
    await navigator.clipboard.writeText(entry.title)
  }

  async function copyContent() {
    try {
      const content = await getJournalEntryContent(entry.path)
      await navigator.clipboard.writeText(content)
    } catch { /* silent */ }
  }

  async function copyPath() {
    await navigator.clipboard.writeText(entry.path)
  }

  async function handleShowInFinder() {
    await revealInFinder(entry.path)
  }

  async function handleOpenWithEditor() {
    await openFile(entry.path)
  }

  const items: MenuItem[] = [
    { type: 'action', label: t('copyTitle'), icon: 'title', onClick: copyTitle },
    { type: 'action', label: t('copyContent'), icon: 'content', onClick: copyContent },
    { type: 'action', label: t('copyFilePath'), icon: 'path', onClick: copyPath },
    { type: 'divider' },
    { type: 'action', label: t('openInEditor'), icon: 'edit', onClick: handleOpenWithEditor },
    { type: 'action', label: t('showInFinder'), icon: 'finder', onClick: handleShowInFinder },
    { type: 'divider' },
    { type: 'action', label: t('delete'), icon: 'delete', danger: true, onClick: () => { onDelete(); onClose() } },
  ]

  const menuStyle: React.CSSProperties = {
    position: 'fixed', top: y, left: x, zIndex: 9999,
    background: 'var(--context-menu-bg)',
    border: '1px solid var(--context-menu-border)',
    borderRadius: 8,
    boxShadow: '0 4px 20px var(--context-menu-shadow)',
    minWidth: 180, overflow: 'hidden',
    padding: '4px 0',
  }

  return (
    <div ref={ref} style={menuStyle}>
      {items.map((item, i) => {
        if (item.type === 'divider') {
          return <div key={i} style={{ height: 1, background: 'var(--divider)', margin: '4px 0' }} />
        }
        return (
          <MenuItemRow
            key={i}
            label={item.label}
            icon={item.icon}
            danger={item.danger}
            onClick={() => {
              item.onClick()
              onClose()
            }}
          />
        )
      })}
    </div>
  )
}

function MenuIcon({ icon, danger }: { icon: string; danger?: boolean }) {
  const color = danger ? '#ff3b30' : 'var(--item-meta)'
  const size = 14
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  switch (icon) {
    case 'title':
      return <svg {...props}><path d="M4 7V4h16v3"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="8" y1="20" x2="16" y2="20"/></svg>
    case 'content':
      return <svg {...props}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="16" x2="13" y2="16"/></svg>
    case 'path':
      return <svg {...props}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
    case 'edit':
      return <svg {...props}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    case 'finder':
      return <svg {...props}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
    case 'delete':
      return <svg {...props}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
    default:
      return null
  }
}

function MenuItemRow({ label, icon, danger, onClick }: { label: string; icon: string; danger?: boolean; onClick: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 12px',
        fontSize: 'var(--text-sm)',
        cursor: 'pointer',
        color: danger ? '#ff3b30' : 'var(--item-text)',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.background = danger ? 'rgba(255,59,48,0.06)' : 'var(--item-hover-bg)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.background = 'transparent'
      }}
      onClick={onClick}
    >
      <MenuIcon icon={icon} danger={danger} />
      <span>{label}</span>
    </div>
  )
}
