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
    background: 'white', border: '1px solid #e5e5ea',
    borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    minWidth: 160, overflow: 'hidden',
  }
  const itemStyle: React.CSSProperties = {
    padding: '8px 14px', fontSize: 13, cursor: 'pointer',
    color: '#1c1c1e',
  }
  const deleteStyle: React.CSSProperties = { ...itemStyle, color: '#ff3b30' }

  return (
    <div ref={ref} style={menuStyle}>
      <div style={itemStyle}
        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#f2f2f7'}
        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
        onClick={() => { onShowInFinder(); onClose() }}
      >
        在 Finder 中显示
      </div>
      <div style={{ height: 1, background: '#e5e5ea' }} />
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
