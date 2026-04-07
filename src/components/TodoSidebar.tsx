import { useState, useRef, useEffect, useCallback } from 'react'
import type { TodoItem } from '../types'
import { useTranslation } from '../contexts/I18nContext'
import { openBrainstormTerminal, listBrainstormKeys } from '../lib/tauri'

// ── Custom date picker ───────────────────────────────────────────────────────
function DatePicker({ initialValue, onSelect, onClose }: {
  initialValue: string | null
  onSelect: (date: string | null) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const init = initialValue ? new Date(initialValue + 'T00:00:00') : today
  const [year, setYear] = useState(init.getFullYear())
  const [month, setMonth] = useState(init.getMonth())

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()
  const days: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(d)

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }

  const handleSelect = (day: number) => {
    onSelect(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
  }

  const reposition = useCallback(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (rect.right > vw - 4) el.style.left = `${Math.max(4, vw - rect.width - 8)}px`
    if (rect.left < 4) el.style.left = '4px'
    if (rect.bottom > vh - 4) el.style.top = `${Math.max(4, vh - rect.height - 8)}px`
  }, [])

  useEffect(() => { reposition() }, [year, month, reposition])

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey) }
  }, [onClose])

  const { s } = useTranslation()
  const selectedStr = initialValue
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const WEEKDAYS = s.weekdaysFull
  const MONTHS = s.monthsFull
  const cellSize = 26
  const arrowStyle: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--item-meta)', cursor: 'pointer', fontSize: 'var(--text-xs)', padding: '2px 6px', borderRadius: 3 }

  return (
    <div ref={ref} style={{ background: 'var(--sidebar-bg)', border: '0.5px solid var(--divider)', borderRadius: 8, padding: 8, zIndex: 1001, boxShadow: '0 4px 20px rgba(0,0,0,0.4)', width: 210 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <button style={arrowStyle} onClick={prevMonth}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--item-hover-bg)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
        >◀</button>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--item-text)', fontWeight: 'var(--font-medium)' }}>{year} {MONTHS[month]}</span>
        <button style={arrowStyle} onClick={nextMonth}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--item-hover-bg)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
        >▶</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(7, ${cellSize}px)`, justifyContent: 'center' }}>
        {WEEKDAYS.map(w => <div key={w} style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--duration-text)', padding: '2px 0' }}>{w}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(7, ${cellSize}px)`, justifyContent: 'center' }}>
        {days.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isSelected = dateStr === selectedStr
          const isToday = dateStr === todayStr
          return (
            <div key={day} onClick={() => handleSelect(day)}
              onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--item-hover-bg)' }}
              onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              style={{
                width: cellSize, height: cellSize, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 'var(--text-xs)', borderRadius: 4, cursor: 'pointer',
                color: isSelected ? 'var(--bg)' : isToday ? '#ff3b30' : 'var(--item-text)',
                background: isSelected ? '#ff3b30' : 'transparent',
                fontWeight: isToday || isSelected ? 'var(--font-semibold)' : 'var(--font-normal)',
              }}
            >{day}</div>
          )
        })}
      </div>
      {initialValue && (
        <div onClick={() => onSelect(null)}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--item-hover-bg)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          style={{ marginTop: 6, padding: '4px 0', textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--duration-text)', cursor: 'pointer', borderTop: '0.5px solid var(--divider)' }}
        >{s.clearDueDate}</div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function statusBarColor(item: TodoItem): string {
  if (item.done) return 'var(--divider)'
  if (item.due) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (new Date(item.due + 'T00:00:00') <= today) return '#ff3b30'
  }
  return 'var(--divider)'
}

function dueBadgeStyle(due: string): { color: string; background: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(due + 'T00:00:00')
  if (d.getTime() < today.getTime()) return { color: '#ff3b30', background: 'rgba(255,59,48,0.1)' }
  if (d.getTime() === today.getTime()) return { color: '#ff3b30', background: 'rgba(255,59,48,0.08)' }
  return { color: 'var(--duration-text)', background: 'var(--item-hover-bg)' }
}

function formatDueShort(due: string): string {
  const p = due.split('-')
  return `${p[1]}/${p[2]}`
}

// ── TodoRow ──────────────────────────────────────────────────────────────────
function TodoRow({ item, onToggle, onSetDue, onUpdateText, onDelete, onContextMenu, onNavigateToSource, hasBrainstorm, onBrainstorm }: {
  item: TodoItem
  onToggle: (lineIndex: number, checked: boolean, doneFile: boolean) => void
  onSetDue: (lineIndex: number, due: string | null, doneFile: boolean) => void
  onUpdateText: (lineIndex: number, text: string, doneFile: boolean) => void
  onDelete: (lineIndex: number, doneFile: boolean) => void
  onContextMenu: (e: React.MouseEvent) => void
  onNavigateToSource?: (filename: string) => void
  hasBrainstorm?: boolean
  onBrainstorm?: () => void
}) {
  const { t } = useTranslation()
  const [editingDue, setEditingDue] = useState(false)
  const [editingText, setEditingText] = useState(false)
  const [pickerPos, setPickerPos] = useState({ x: 0, y: 0 })
  const textRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editingText && textRef.current) {
      const el = textRef.current
      el.focus()
      const range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  }, [editingText])

  const handleTextSubmit = () => {
    const trimmed = (textRef.current?.textContent ?? '').trim()
    if (!trimmed) { onDelete(item.line_index, item.done_file); return }
    if (trimmed !== item.text) onUpdateText(item.line_index, trimmed, item.done_file)
    else if (textRef.current) textRef.current.textContent = item.text
    setEditingText(false)
  }

  const openPicker = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPickerPos({ x: rect.right - 210, y: rect.bottom + 4 })
    setEditingDue(true)
  }

  return (
    <div
      onContextMenu={onContextMenu}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = 'var(--item-hover-bg)'
        const cal = (e.currentTarget as HTMLElement).querySelector('.todo-calendar-icon') as HTMLElement | null
        if (cal) cal.style.display = 'flex'
        const src = (e.currentTarget as HTMLElement).querySelector('.todo-source-icon') as HTMLElement | null
        if (src) src.style.opacity = '0.6'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = 'transparent'
        const cal = (e.currentTarget as HTMLElement).querySelector('.todo-calendar-icon') as HTMLElement | null
        if (cal) cal.style.display = 'none'
        const src = (e.currentTarget as HTMLElement).querySelector('.todo-source-icon') as HTMLElement | null
        if (src) src.style.opacity = '0.35'
      }}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderBottom: '0.5px solid var(--divider)', transition: 'background 0.1s' }}
    >
      {/* Status bar */}
      <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 1.5, flexShrink: 0, background: statusBarColor(item) }} />

      {/* Checkbox */}
      <div
        onClick={() => onToggle(item.line_index, !item.done, item.done_file)}
        onMouseEnter={e => { if (!item.done) (e.currentTarget as HTMLElement).style.borderColor = 'var(--record-btn)' }}
        onMouseLeave={e => { if (!item.done) (e.currentTarget as HTMLElement).style.borderColor = 'var(--divider)' }}
        style={{
          width: 13, height: 13, flexShrink: 0, cursor: 'pointer',
          border: `1.5px solid ${item.done ? 'var(--record-btn)' : 'var(--divider)'}`,
          borderRadius: 3, background: item.done ? 'var(--record-btn)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s ease, opacity 0.15s ease',
        }}
      >
        {item.done && (
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>

      {/* Text */}
      {editingText ? (
        <div ref={textRef} contentEditable suppressContentEditableWarning
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); handleTextSubmit() }
            if (e.key === 'Escape') { if (textRef.current) textRef.current.textContent = item.text; setEditingText(false) }
          }}
          onBlur={() => handleTextSubmit()}
          style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-xs)', lineHeight: '18px', fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-normal)', color: 'var(--item-text)', outline: 'none', cursor: 'text' }}
        >{item.text}</div>
      ) : (
        <span onClick={() => !item.done && setEditingText(true)}
          style={{
            flex: 1, minWidth: 0, fontSize: 'var(--text-xs)', lineHeight: '18px',
            fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-normal)',
            color: item.done ? '#555' : 'var(--item-text)',
            textDecoration: item.done ? 'line-through' : 'none',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            cursor: item.done ? 'default' : 'text',
          }}
        >{item.text}</span>
      )}

      {/* Due badge or calendar icon */}
      {item.due ? (
        <span onMouseDown={e => e.preventDefault()} onClick={e => { if (!item.done) openPicker(e) }}
          style={{ fontSize: 'var(--text-xs)', padding: '1px 4px', borderRadius: 3, flexShrink: 0, cursor: item.done ? 'default' : 'pointer', whiteSpace: 'nowrap', ...dueBadgeStyle(item.due) }}
        >{formatDueShort(item.due)}</span>
      ) : !item.done ? (
        <span className="todo-calendar-icon" onMouseDown={e => e.preventDefault()} onClick={openPicker}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--record-btn)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--duration-text)' }}
          style={{ cursor: 'pointer', color: 'var(--duration-text)', display: 'none', alignItems: 'center', flexShrink: 0 }}
          title={t('setDueDate')}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </span>
      ) : null}

      {/* Source icon */}
      {item.source && (
        <span className="todo-source-icon" onMouseDown={e => e.preventDefault()} onClick={() => onNavigateToSource?.(item.source!)}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.35' }}
          title={item.source}
          style={{ cursor: 'pointer', opacity: 0.35, display: 'flex', alignItems: 'center', flexShrink: 0, transition: 'opacity 0.1s', willChange: 'opacity' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        </span>
      )}

      {/* Brainstorm icon */}
      {!item.done && (
        <span
          onMouseDown={e => e.preventDefault()}
          onClick={() => {
            openBrainstormTerminal(item.text, item.line_index, item.done_file)
              .then(() => onBrainstorm?.())
              .catch(console.error)
          }}
          onMouseEnter={e => { (e.currentTarget.querySelector('svg') as SVGElement | null)?.setAttribute('stroke', 'var(--record-btn)') }}
          onMouseLeave={e => { (e.currentTarget.querySelector('svg') as SVGElement | null)?.setAttribute('stroke', hasBrainstorm ? 'var(--record-btn)' : 'var(--duration-text)') }}
          title={t('exploreInDepth')}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={hasBrainstorm ? 'var(--record-btn)' : 'var(--duration-text)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            <path d="M8 10h.01M12 10h.01M16 10h.01"/>
          </svg>
        </span>
      )}

      {/* Date picker popup */}
      {editingDue && (
        <div style={{ position: 'fixed', left: pickerPos.x, top: pickerPos.y, zIndex: 1001 }}>
          <DatePicker initialValue={item.due}
            onSelect={date => { onSetDue(item.line_index, date, item.done_file); setEditingDue(false) }}
            onClose={() => setEditingDue(false)}
          />
        </div>
      )}
    </div>
  )
}

// ── TodoSidebar ──────────────────────────────────────────────────────────────
interface TodoSidebarProps {
  width: number
  todos: TodoItem[]
  onToggle: (lineIndex: number, checked: boolean, doneFile: boolean) => void
  onAdd: (text: string, due?: string, source?: string) => void
  onDelete: (lineIndex: number, doneFile: boolean) => void
  onSetDue: (lineIndex: number, due: string | null, doneFile: boolean) => void
  onUpdateText: (lineIndex: number, text: string, doneFile: boolean) => void
  onNavigateToSource?: (filename: string) => void
}

export function TodoSidebar({ width, todos, onToggle, onAdd, onDelete, onSetDue, onUpdateText, onNavigateToSource }: TodoSidebarProps) {
  const { t } = useTranslation()
  const [adding, setAdding] = useState(false)
  const [inputText, setInputText] = useState('')
  const [showCompleted, setShowCompleted] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; lineIndex: number; text: string; due: string | null; doneFile: boolean } | null>(null)
  const [brainstormKeys, setBrainstormKeys] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)
  const ctxMenuRef = useRef<HTMLDivElement>(null)

  const unchecked = todos.filter(t => !t.done).sort((a, b) => a.line_index - b.line_index)
  const checked = todos.filter(t => t.done).sort((a, b) => a.line_index - b.line_index)

  const refreshBrainstormKeys = useCallback(() => {
    listBrainstormKeys()
      .then(keys => setBrainstormKeys(new Set(keys)))
      .catch(console.error)
  }, [])

  useEffect(() => { refreshBrainstormKeys() }, [todos, refreshBrainstormKeys])

  useEffect(() => { if (adding && inputRef.current) inputRef.current.focus() }, [adding])

  useEffect(() => {
    if (!contextMenu) return
    const handler = () => setContextMenu(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [contextMenu])

  useEffect(() => {
    if (!contextMenu || !ctxMenuRef.current) return
    const el = ctxMenuRef.current
    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (rect.right > vw) el.style.left = `${Math.max(4, vw - rect.width - 8)}px`
    if (rect.bottom > vh) el.style.top = `${Math.max(4, vh - rect.height - 8)}px`
  }, [contextMenu])

  const handleSubmit = () => {
    const text = inputText.trim()
    if (text) { onAdd(text); setInputText('') }
    setAdding(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit()
    if (e.key === 'Escape') { setAdding(false); setInputText('') }
  }

  return (
    <div style={{ width, flexShrink: 0, borderLeft: '0.5px solid var(--divider)', padding: '12px 0', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '0 14px' }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--record-btn)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontWeight: 'var(--font-medium)' }}>{t('todo')}</span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--duration-text)' }}>{t('itemCount', { count: unchecked.length })}</span>
      </div>

      {unchecked.map(item => (
        <TodoRow key={item.line_index} item={item} onToggle={onToggle} onSetDue={onSetDue} onUpdateText={onUpdateText} onDelete={onDelete} onNavigateToSource={onNavigateToSource}
          hasBrainstorm={brainstormKeys.has(item.text)} onBrainstorm={refreshBrainstormKeys}
          onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, lineIndex: item.line_index, text: item.text, due: item.due, doneFile: item.done_file }) }}
        />
      ))}

      {/* Add */}
      {adding ? (
        <div style={{ padding: '6px 14px', borderBottom: '0.5px solid var(--divider)' }}>
          <input ref={inputRef} value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={handleKeyDown} onBlur={handleSubmit}
            placeholder={t('addTodo')}
            style={{ width: '100%', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', background: 'transparent', border: 'none', outline: 'none', color: 'var(--item-text)', padding: 0 }}
          />
        </div>
      ) : (
        <div onClick={() => setAdding(true)}
          style={{ padding: '6px 14px', cursor: 'pointer', borderBottom: '0.5px solid var(--divider)', display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.1s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--item-hover-bg)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span style={{ fontSize: 'var(--text-xs)', color: '#555' }}>{t('addTodoBtn')}</span>
        </div>
      )}

      {/* Completed */}
      {checked.length > 0 && (
        <>
          <div onClick={() => setShowCompleted(!showCompleted)}
            style={{ fontSize: 'var(--text-xs)', color: '#555', marginTop: 8, padding: '6px 14px 4px', cursor: 'pointer', userSelect: 'none' as const, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}
          >{t('completedSection', { count: checked.length })} {showCompleted ? '▾' : '▸'}</div>
          {showCompleted && checked.map(item => (
            <div key={item.line_index} style={{ opacity: 0.5 }}>
              <TodoRow item={item} onToggle={onToggle} onSetDue={onSetDue} onUpdateText={onUpdateText} onDelete={onDelete} onNavigateToSource={onNavigateToSource}
                hasBrainstorm={brainstormKeys.has(item.text)} onBrainstorm={refreshBrainstormKeys}
                onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, lineIndex: item.line_index, text: item.text, due: item.due, doneFile: item.done_file }) }}
              />
            </div>
          ))}
        </>
      )}

      {/* Context menu */}
      {contextMenu && (() => {
        const menuItemStyle: React.CSSProperties = { padding: '7px 12px', fontSize: 'var(--text-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--item-text)' }
        const hi = (e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.background = 'var(--item-hover-bg)' }
        const ho = (e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }
        return (
          <div ref={ctxMenuRef} style={{
            position: 'fixed', left: contextMenu.x, top: contextMenu.y,
            background: 'var(--sidebar-bg)', border: '0.5px solid var(--divider)',
            borderRadius: 8, padding: '4px 0', zIndex: 1000,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)', minWidth: 140,
          }}>
            {!contextMenu.doneFile && (
              <div style={menuItemStyle} onMouseEnter={hi} onMouseLeave={ho}
                onClick={() => {
                  openBrainstormTerminal(contextMenu.text, contextMenu.lineIndex, contextMenu.doneFile)
                    .then(() => listBrainstormKeys())
                    .then(keys => setBrainstormKeys(new Set(keys)))
                    .catch(console.error)
                  setContextMenu(null)
                }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--item-meta)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  <path d="M8 10h.01M12 10h.01M16 10h.01"/>
                </svg>
                {t('exploreInDepth')}
              </div>
            )}
            <div style={menuItemStyle} onMouseEnter={hi} onMouseLeave={ho}
              onClick={() => { navigator.clipboard.writeText(contextMenu.text); setContextMenu(null) }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--item-meta)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              {t('copyText')}
            </div>
            {contextMenu.due && (
              <div style={menuItemStyle} onMouseEnter={hi} onMouseLeave={ho}
                onClick={() => { onSetDue(contextMenu.lineIndex, null, contextMenu.doneFile); setContextMenu(null) }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--item-meta)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
                {t('clearDueDate')}
              </div>
            )}
            <div style={{ height: 1, background: 'var(--divider)', margin: '4px 0' }} />
            <div style={{ ...menuItemStyle, color: '#ff3b30' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,59,48,0.06)' }}
              onMouseLeave={ho}
              onClick={() => { onDelete(contextMenu.lineIndex, contextMenu.doneFile); setContextMenu(null) }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              {t('deleteTodo')}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
