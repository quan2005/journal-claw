import { useState, useRef, useEffect } from 'react'
import type { TodoItem } from '../types'

interface TodoSidebarProps {
  width: number
  todos: TodoItem[]
  onToggle: (lineIndex: number, checked: boolean) => void
  onAdd: (text: string) => void
  onDelete: (lineIndex: number) => void
  onSetDue: (lineIndex: number, due: string | null) => void
  onUpdateText: (lineIndex: number, text: string) => void
}

export function TodoSidebar({ width, todos, onToggle, onAdd, onDelete, onSetDue, onUpdateText }: TodoSidebarProps) {
  const [adding, setAdding] = useState(false)
  const [inputText, setInputText] = useState('')
  const [showCompleted, setShowCompleted] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; lineIndex: number; text: string; due: string | null } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const unchecked = todos.filter(t => !t.done)
  const checked = todos.filter(t => t.done)

  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus()
  }, [adding])

  useEffect(() => {
    if (!contextMenu) return
    const handler = () => setContextMenu(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [contextMenu])

  const handleSubmit = () => {
    const text = inputText.trim()
    if (text) {
      onAdd(text)
      setInputText('')
    }
    setAdding(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit()
    if (e.key === 'Escape') { setAdding(false); setInputText('') }
  }

  return (
    <div style={{
      width: width, flexShrink: 0, borderLeft: '0.5px solid var(--divider)',
      padding: '12px 14px', overflowY: 'auto', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{
          fontSize: 10, color: 'var(--record-btn)', letterSpacing: '0.08em',
          textTransform: 'uppercase' as const, fontWeight: 500,
        }}>待办</span>
        <span style={{ fontSize: 10, color: 'var(--duration-text)' }}>{unchecked.length} 项</span>
      </div>

      {/* Unchecked items */}
      {unchecked.map(item => (
        <TodoRow
          key={item.line_index}
          item={item}
          onToggle={onToggle}
          onSetDue={onSetDue}
          onUpdateText={onUpdateText}
          onContextMenu={(e) => {
            e.preventDefault()
            setContextMenu({ x: e.clientX, y: e.clientY, lineIndex: item.line_index, text: item.text, due: item.due })
          }}
        />
      ))}

      {/* Add button / input */}
      {adding ? (
        <div style={{ padding: '6px 8px', marginBottom: 10 }}>
          <input
            ref={inputRef}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSubmit}
            placeholder="输入待办内容..."
            style={{
              width: '100%', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace",
              background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--item-text)', padding: 0,
            }}
          />
        </div>
      ) : (
        <div
          onClick={() => setAdding(true)}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--record-btn)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--divider)'
          }}
          style={{
            marginTop: 4, padding: 8, border: '1px dashed var(--divider)',
            borderRadius: 5, textAlign: 'center' as const, cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--duration-text)' }}>+ 添加待办</span>
        </div>
      )}

      {/* Completed section */}
      {checked.length > 0 && (
        <>
          <div
            onClick={() => setShowCompleted(!showCompleted)}
            style={{
              fontSize: 10, color: 'var(--duration-text)', letterSpacing: '0.08em',
              textTransform: 'uppercase' as const, marginTop: 16, marginBottom: 8,
              paddingTop: 8, borderTop: '0.5px solid var(--divider)', cursor: 'pointer',
              userSelect: 'none' as const,
            }}
          >
            已完成 · {checked.length} {showCompleted ? '▾' : '▸'}
          </div>
          {showCompleted && checked.map(item => (
            <TodoRow
              key={item.line_index}
              item={item}
              onToggle={onToggle}
              onSetDue={onSetDue}
              onUpdateText={onUpdateText}
              onContextMenu={(e) => {
                e.preventDefault()
                setContextMenu({ x: e.clientX, y: e.clientY, lineIndex: item.line_index, text: item.text, due: item.due })
              }}
            />
          ))}
        </>
      )}

      {/* Context menu */}
      {contextMenu && (() => {
        const menuItemStyle: React.CSSProperties = {
          padding: '7px 12px', fontSize: 13, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8, color: 'var(--item-text)',
        }
        const hoverIn = (e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.background = 'var(--item-hover-bg)' }
        const hoverOut = (e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }
        return (
          <div style={{
            position: 'fixed', left: contextMenu.x, top: contextMenu.y,
            background: 'var(--sidebar-bg)', border: '0.5px solid var(--divider)',
            borderRadius: 8, padding: '4px 0', zIndex: 1000,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)', minWidth: 140,
          }}>
            {/* 复制文本 */}
            <div style={menuItemStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}
              onClick={() => { navigator.clipboard.writeText(contextMenu.text); setContextMenu(null) }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--item-meta)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              复制文本
            </div>
            {/* 清除截止日期 (仅有截止日期时显示) */}
            {contextMenu.due && (
              <div style={menuItemStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}
                onClick={() => { onSetDue(contextMenu.lineIndex, null); setContextMenu(null) }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--item-meta)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
                清除截止日期
              </div>
            )}
            <div style={{ height: 1, background: 'var(--divider)', margin: '4px 0' }} />
            {/* 删除 */}
            <div style={{ ...menuItemStyle, color: '#ff3b30' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,59,48,0.06)' }}
              onMouseLeave={hoverOut}
              onClick={() => { onDelete(contextMenu.lineIndex); setContextMenu(null) }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              删除
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function dueDateColor(due: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDate = new Date(due + 'T00:00:00')
  if (dueDate.getTime() < today.getTime()) return 'var(--accent)'       // 已过期 → 红色
  if (dueDate.getTime() === today.getTime()) return 'var(--record-btn)' // 今天 → 主题色
  return 'var(--duration-text)'                                          // 未来 → 默认
}

function TodoRow({ item, onToggle, onSetDue, onUpdateText, onContextMenu }: {
  item: TodoItem
  onToggle: (lineIndex: number, checked: boolean) => void
  onSetDue: (lineIndex: number, due: string | null) => void
  onUpdateText: (lineIndex: number, text: string) => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const [editingDue, setEditingDue] = useState(false)
  const [editingText, setEditingText] = useState(false)
  const [editText, setEditText] = useState(item.text)
  const dateRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingDue && dateRef.current) dateRef.current.showPicker?.()
  }, [editingDue])

  useEffect(() => {
    if (editingText && textRef.current) {
      const el = textRef.current
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }
  }, [editingText])

  const handleTextSubmit = () => {
    const trimmed = editText.trim()
    if (trimmed && trimmed !== item.text) {
      onUpdateText(item.line_index, trimmed)
    } else {
      setEditText(item.text)
    }
    setEditingText(false)
  }

  return (
    <div
      onContextMenu={onContextMenu}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
        marginBottom: 10, padding: '6px 8px', borderRadius: 5,
        background: 'var(--todo-row-bg, rgba(255,255,255,0.02))',
      }}
    >
      <div
        onClick={() => onToggle(item.line_index, !item.done)}
        onMouseEnter={e => {
          if (!item.done) (e.currentTarget as HTMLElement).style.borderColor = 'var(--record-btn)'
        }}
        onMouseLeave={e => {
          if (!item.done) (e.currentTarget as HTMLElement).style.borderColor = 'var(--divider)'
        }}
        style={{
          width: 14, height: 14, flexShrink: 0, marginTop: 2, cursor: 'pointer',
          border: `1.5px solid ${item.done ? 'var(--record-btn)' : 'var(--divider)'}`,
          borderRadius: 3,
          background: item.done ? 'var(--record-btn)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s ease, border-color 0.15s ease',
        }}
      >
        {item.done && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        {editingText ? (
          <input
            ref={textRef}
            value={editText}
            onChange={e => setEditText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleTextSubmit()
              if (e.key === 'Escape') { setEditText(item.text); setEditingText(false) }
            }}
            onBlur={handleTextSubmit}
            style={{
              width: '100%', fontSize: 14, fontFamily: "'Noto Serif SC', serif",
              fontWeight: 700, lineHeight: '19.6px',
              background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--item-text)', padding: 0, margin: 0,
              boxSizing: 'border-box',
            }}
          />
        ) : (
          <div
            onClick={() => !item.done && setEditingText(true)}
            style={{
              fontSize: 14, lineHeight: '19.6px',
              fontFamily: "'Noto Serif SC', serif", fontWeight: 700,
              color: item.done ? 'var(--duration-text)' : 'var(--item-text)',
              textDecoration: item.done ? 'line-through' : 'none',
              transition: 'color 0.2s ease',
              cursor: item.done ? 'default' : 'text',
            }}
          >
            {item.text}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
          {!editingDue && item.due && (
            <span
              onClick={() => !item.done && setEditingDue(true)}
              style={{ fontSize: 9, color: item.done ? 'var(--duration-text)' : dueDateColor(item.due), cursor: item.done ? 'default' : 'pointer' }}
            >
              截止 {item.due.replace(/-/g, '/')}
            </span>
          )}
          {!item.done && !editingDue && !item.due && (
            <span
              onClick={() => setEditingDue(true)}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--record-btn)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--duration-text)' }}
              style={{ cursor: 'pointer', color: 'var(--duration-text)', display: 'flex', alignItems: 'center' }}
              title="设置截止日期"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </span>
          )}
          {editingDue && (
            <input
              ref={dateRef}
              type="date"
              defaultValue={item.due ?? ''}
              onKeyDown={e => {
                if (e.key === 'Escape') { setEditingDue(false); return }
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value
                  onSetDue(item.line_index, val || null)
                  setEditingDue(false)
                }
              }}
              onChange={e => {
                // Only submit when a full date is picked (YYYY-MM-DD)
                const val = e.target.value
                if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
                  onSetDue(item.line_index, val)
                  setEditingDue(false)
                }
              }}
              onBlur={() => setEditingDue(false)}
              style={{
                fontSize: 9, fontFamily: "'IBM Plex Mono', monospace",
                background: 'transparent', border: '0.5px solid var(--divider)',
                borderRadius: 3, color: 'var(--item-text)', padding: '1px 3px',
                outline: 'none', width: 90,
                colorScheme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
