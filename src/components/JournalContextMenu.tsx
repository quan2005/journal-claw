import { useEffect, useRef } from 'react'

interface JournalContextMenuProps {
  x: number
  y: number
  entryPath: string
  onShowInFinder: () => void
  onDelete: () => void
  onClose: () => void
}

export function JournalContextMenu({ x, y, entryPath: _entryPath, onShowInFinder, onDelete, onClose }: JournalContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [onClose])

  const menuStyle: React.CSSProperties = {
    position: 'fixed', top: y, left: x, zIndex: 9999,
    background: 'var(--context-menu-bg)',
    border: '1px solid var(--context-menu-border)',
    borderRadius: 8,
    boxShadow: '0 4px 20px var(--context-menu-shadow)',
    minWidth: 160, overflow: 'hidden',
  }
  const itemStyle: React.CSSProperties = {
    padding: '8px 14px', fontSize: 13, cursor: 'pointer',
    color: 'var(--item-text)',
  }
  const deleteStyle: React.CSSProperties = { ...itemStyle, color: '#ff3b30' }

  return (
    <div ref={ref} style={menuStyle}>
      <div style={itemStyle}
        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--item-hover-bg)'}
        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
        onClick={() => { onShowInFinder(); onClose() }}
      >
        在 Finder 中显示
      </div>
      <div style={{ height: 1, background: 'var(--divider)' }} />
      <div style={deleteStyle}
        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,59,48,0.06)'}
        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
        onClick={() => { onDelete(); onClose() }}
      >
        删除
      </div>
    </div>
  )
}
