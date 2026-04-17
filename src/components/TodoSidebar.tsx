import { useState, useRef, useEffect, useCallback } from 'react'
import type { TodoItem } from '../types'
import { useTranslation } from '../contexts/I18nContext'
import { pickFolder } from '../lib/tauri'

// ── Custom date picker ───────────────────────────────────────────────────────
function DatePicker({
  initialValue,
  onSelect,
  onClose,
}: {
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

  const prevMonth = () => {
    if (month === 0) {
      setYear((y) => y - 1)
      setMonth(11)
    } else setMonth((m) => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) {
      setYear((y) => y + 1)
      setMonth(0)
    } else setMonth((m) => m + 1)
  }

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

  useEffect(() => {
    reposition()
  }, [year, month, reposition])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const { s } = useTranslation()
  const selectedStr = initialValue
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const WEEKDAYS = s.weekdaysFull
  const MONTHS = s.monthsFull
  const cellSize = 26
  const arrowStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'var(--item-meta)',
    cursor: 'pointer',
    fontSize: 'var(--text-xs)',
    padding: '2px 6px',
    borderRadius: 3,
  }

  return (
    <div
      ref={ref}
      style={{
        background: 'var(--sidebar-bg)',
        border: '0.5px solid var(--divider)',
        borderRadius: 8,
        padding: 8,
        zIndex: 1001,
        boxShadow: '0 4px 20px var(--context-menu-shadow)',
        width: 210,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <button
          style={arrowStyle}
          onClick={prevMonth}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = 'var(--item-hover-bg)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = 'none'
          }}
        >
          ◀
        </button>
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--item-text)',
            fontWeight: 'var(--font-medium)',
          }}
        >
          {year} {MONTHS[month]}
        </span>
        <button
          style={arrowStyle}
          onClick={nextMonth}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = 'var(--item-hover-bg)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = 'none'
          }}
        >
          ▶
        </button>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(7, ${cellSize}px)`,
          justifyContent: 'center',
        }}
      >
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            style={{
              textAlign: 'center',
              fontSize: 'var(--text-xs)',
              color: 'var(--duration-text)',
              padding: '2px 0',
            }}
          >
            {w}
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(7, ${cellSize}px)`,
          justifyContent: 'center',
        }}
      >
        {days.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isSelected = dateStr === selectedStr
          const isToday = dateStr === todayStr
          return (
            <div
              key={day}
              onClick={() => handleSelect(day)}
              onMouseEnter={(e) => {
                if (!isSelected)
                  (e.currentTarget as HTMLElement).style.background = 'var(--item-hover-bg)'
              }}
              onMouseLeave={(e) => {
                if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
              style={{
                width: cellSize,
                height: cellSize,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'var(--text-xs)',
                borderRadius: 4,
                cursor: 'pointer',
                color: isSelected
                  ? 'var(--record-btn-icon)'
                  : isToday
                    ? 'var(--record-btn)'
                    : 'var(--item-text)',
                background: isSelected ? 'var(--record-btn)' : 'transparent',
                fontWeight: isToday || isSelected ? 'var(--font-semibold)' : 'var(--font-normal)',
              }}
            >
              {day}
            </div>
          )
        })}
      </div>
      {initialValue && (
        <div
          onClick={() => onSelect(null)}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = 'var(--item-hover-bg)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
          }}
          style={{
            marginTop: 6,
            padding: '4px 0',
            textAlign: 'center',
            fontSize: 'var(--text-xs)',
            color: 'var(--duration-text)',
            cursor: 'pointer',
            borderTop: '0.5px solid var(--divider)',
          }}
        >
          {s.clearDueDate}
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function statusBarStyle(item: TodoItem): { background: string; opacity?: number } {
  if (item.done) return { background: 'var(--divider)' }
  return { background: 'var(--divider)' }
}

function dueBadgeStyle(due: string): { color: string; background: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(due + 'T00:00:00')
  if (d.getTime() < today.getTime())
    return { color: 'var(--status-danger)', background: 'var(--status-danger-bg)' }
  if (d.getTime() === today.getTime())
    return { color: 'var(--status-danger)', background: 'var(--status-danger-bg)' }
  return { color: 'var(--duration-text)', background: 'var(--item-hover-bg)' }
}

function formatDueShort(due: string): string {
  const p = due.split('-')
  return `${p[1]}/${p[2]}`
}

// ── TodoRow ──────────────────────────────────────────────────────────────────
function TodoRow({
  item,
  onToggle,
  onSetDue,
  onUpdateText,
  onDelete,
  onContextMenu,
  onNavigateToSource,
  onOpenConversation,
}: {
  item: TodoItem
  onToggle: (lineIndex: number, checked: boolean, doneFile: boolean) => void
  onSetDue: (lineIndex: number, due: string | null, doneFile: boolean) => void
  onUpdateText: (lineIndex: number, text: string, doneFile: boolean) => void
  onDelete: (lineIndex: number, doneFile: boolean) => void
  onContextMenu: (e: React.MouseEvent) => void
  onNavigateToSource?: (filename: string) => void
  onOpenConversation?: (opts: {
    mode: 'chat'
    context: string
    sessionId: string | null
    lineIndex: number
    doneFile: boolean
  }) => void
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
    if (!trimmed) {
      onDelete(item.line_index, item.done_file)
      return
    }
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
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = 'var(--item-hover-bg)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = 'transparent'
      }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '6px 14px',
        borderBottom: '0.5px solid var(--divider)',
        transition: 'background 0.1s ease-out',
      }}
    >
      {/* Status bar */}
      <div
        style={{
          width: 3,
          alignSelf: 'stretch',
          borderRadius: 1.5,
          flexShrink: 0,
          ...statusBarStyle(item),
        }}
      />

      {/* Checkbox */}
      <div
        onClick={() => onToggle(item.line_index, !item.done, item.done_file)}
        onMouseEnter={(e) => {
          if (!item.done) (e.currentTarget as HTMLElement).style.borderColor = 'var(--record-btn)'
        }}
        onMouseLeave={(e) => {
          if (!item.done) (e.currentTarget as HTMLElement).style.borderColor = 'var(--divider)'
        }}
        style={{
          width: 12,
          height: 12,
          flexShrink: 0,
          cursor: 'pointer',
          marginTop: 3,
          border: `1.5px solid ${item.done ? 'var(--record-btn)' : 'var(--divider)'}`,
          borderRadius: 3,
          background: item.done ? 'var(--record-btn)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s ease-out, opacity 0.15s ease-out',
        }}
      >
        {item.done && (
          <svg
            width="8"
            height="8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--bg)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>

      {/* Text */}
      {editingText ? (
        <div
          ref={textRef}
          contentEditable
          suppressContentEditableWarning
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleTextSubmit()
            }
            if (e.key === 'Escape') {
              if (textRef.current) textRef.current.textContent = item.text
              setEditingText(false)
            }
          }}
          onPaste={(e) => {
            e.preventDefault()
            const text = e.clipboardData.getData('text/plain').replace(/\n/g, ' ')
            document.execCommand('insertText', false, text)
          }}
          onBlur={() => handleTextSubmit()}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 'var(--text-xs)',
            lineHeight: '18px',
            fontFamily: 'var(--font-body)',
            fontWeight: 'var(--font-normal)',
            color: 'var(--item-text)',
            outline: 'none',
            cursor: 'text',
            userSelect: 'text',
          }}
        >
          {item.text}
        </div>
      ) : (
        <span
          onClick={() => !item.done && setEditingText(true)}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 'var(--text-xs)',
            lineHeight: '18px',
            fontFamily: 'var(--font-body)',
            fontWeight: 'var(--font-normal)',
            color: item.done ? 'var(--muted-text)' : 'var(--item-text)',
            textDecoration: item.done ? 'line-through' : 'none',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const,
            overflow: 'hidden',
            wordBreak: 'break-word' as const,
            cursor: item.done ? 'default' : 'text',
          }}
        >
          {item.text}
        </span>
      )}

      {/* Due badge or calendar icon */}
      {item.due ? (
        <span
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            if (!item.done) openPicker(e)
          }}
          style={{
            fontSize: 10,
            padding: '1px 4px',
            borderRadius: 3,
            flexShrink: 0,
            cursor: item.done ? 'default' : 'pointer',
            whiteSpace: 'nowrap',
            marginTop: 3,
            ...dueBadgeStyle(item.due),
          }}
        >
          {formatDueShort(item.due)}
        </span>
      ) : !item.done ? (
        <span
          className="todo-calendar-icon"
          onMouseDown={(e) => e.preventDefault()}
          onClick={openPicker}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLElement).style.color = 'var(--record-btn)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.color = 'var(--duration-text)'
          }}
          style={{
            cursor: 'pointer',
            color: 'var(--duration-text)',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            marginTop: 3,
          }}
          title={t('setDueDate')}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </span>
      ) : null}

      {/* Source icon */}
      {item.source && (
        <span
          className="todo-source-icon"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onNavigateToSource?.(item.source!)}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLElement).style.color = 'var(--record-btn)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.color = 'var(--duration-text)'
          }}
          title={item.source}
          style={{
            cursor: 'pointer',
            color: 'var(--duration-text)',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            transition: 'color 0.1s',
            marginTop: 3,
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </span>
      )}

      {/* Discuss icon */}
      {!item.done && (
        <span
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            onOpenConversation?.({
              mode: 'chat',
              context: item.text,
              sessionId: item.session_id,
              lineIndex: item.line_index,
              doneFile: item.done_file,
            })
          }
          onMouseEnter={(e) => {
            ;(e.currentTarget.querySelector('svg') as SVGElement | null)?.setAttribute(
              'stroke',
              'var(--record-btn)',
            )
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget.querySelector('svg') as SVGElement | null)?.setAttribute(
              'stroke',
              'var(--duration-text)',
            )
          }}
          title={t('exploreInDepth')}
          style={{
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            marginTop: 3,
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--duration-text)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <path d="M8 10h.01M12 10h.01M16 10h.01" />
          </svg>
        </span>
      )}

      {/* Date picker popup */}
      {editingDue && (
        <div style={{ position: 'fixed', left: pickerPos.x, top: pickerPos.y, zIndex: 1001 }}>
          <DatePicker
            initialValue={item.due}
            onSelect={(date) => {
              onSetDue(item.line_index, date, item.done_file)
              setEditingDue(false)
            }}
            onClose={() => setEditingDue(false)}
          />
        </div>
      )}
    </div>
  )
}

function computeGroupDisplayNames(paths: string[]): Map<string, string> {
  const result = new Map<string, string>()
  const baseCount = new Map<string, string[]>()
  for (const p of paths) {
    const base = p.split('/').pop() || p
    if (!baseCount.has(base)) baseCount.set(base, [])
    baseCount.get(base)!.push(p)
  }
  for (const p of paths) {
    const segments = p.split('/')
    const base = segments[segments.length - 1] || p
    const siblings = baseCount.get(base)!
    if (siblings.length === 1) {
      result.set(p, base)
    } else {
      let display = base
      for (let depth = 2; depth <= segments.length; depth++) {
        const candidate = segments.slice(-depth).join('/')
        const isUnique = siblings.every((s) => s === p || !s.endsWith(candidate))
        if (isUnique) {
          display = candidate
          break
        }
      }
      result.set(p, display)
    }
  }
  return result
}

// ── TodoSidebar ──────────────────────────────────────────────────────────────
interface TodoSidebarProps {
  width: number
  todos: TodoItem[]
  onToggle: (lineIndex: number, checked: boolean, doneFile: boolean) => void
  onAdd: (text: string, due?: string, source?: string, path?: string) => void
  onDelete: (lineIndex: number, doneFile: boolean) => void
  onSetDue: (lineIndex: number, due: string | null, doneFile: boolean) => void
  onUpdateText: (lineIndex: number, text: string, doneFile: boolean) => void
  onSetPath: (lineIndex: number, path: string | null, doneFile: boolean) => void
  onRemovePath: (lineIndex: number, doneFile: boolean) => void
  onOpenConversation?: (opts: {
    mode: 'chat'
    context: string
    sessionId: string | null
    lineIndex: number
    doneFile: boolean
  }) => void
  onNavigateToSource?: (filename: string) => void
}

export function TodoSidebar({
  width,
  todos,
  onToggle,
  onAdd,
  onDelete,
  onSetDue,
  onUpdateText,
  onSetPath,
  onRemovePath,
  onOpenConversation,
  onNavigateToSource,
}: TodoSidebarProps) {
  const { t } = useTranslation()
  const [showCompleted, setShowCompleted] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [addingGroup, setAddingGroup] = useState<string | null>(null) // group key or null
  const [addingText, setAddingText] = useState('')
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    lineIndex: number
    text: string
    due: string | null
    path: string | null
    sessionId: string | null
    doneFile: boolean
  } | null>(null)
  const addInputRef = useRef<HTMLInputElement>(null)
  const ctxMenuRef = useRef<HTMLDivElement>(null)

  const unchecked = todos.filter((t) => !t.done).sort((a, b) => a.line_index - b.line_index)
  const checked = todos.filter((t) => t.done).sort((a, b) => a.line_index - b.line_index)

  // Group unchecked by path
  const groupMap = new Map<string, TodoItem[]>()
  for (const item of unchecked) {
    const key = item.path ?? '__inbox__'
    if (!groupMap.has(key)) groupMap.set(key, [])
    groupMap.get(key)!.push(item)
  }
  // Gap 1: preserve insertion order (Map preserves first-appearance order)
  const groups: Array<{ key: string; path: string | null; items: TodoItem[] }> = []
  if (groupMap.has('__inbox__'))
    groups.push({ key: '__inbox__', path: null, items: groupMap.get('__inbox__')! })
  for (const [key, items] of [...groupMap.entries()].filter(([k]) => k !== '__inbox__')) {
    groups.push({ key, path: key, items })
  }
  const multiGroup = groups.length > 1
  const nonInboxPaths = groups.filter((g) => g.path !== null).map((g) => g.path!)
  const displayNames = computeGroupDisplayNames(nonInboxPaths)

  useEffect(() => {
    if (addingGroup !== null && addInputRef.current) addInputRef.current.focus()
  }, [addingGroup])

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

  const handleAddSubmit = (_groupKey: string, groupPath: string | null) => {
    const text = addingText.trim()
    if (text) onAdd(text, undefined, undefined, groupPath ?? undefined)
    setAddingText('')
    setAddingGroup(null)
  }

  const handleAddKeyDown = (
    e: React.KeyboardEvent,
    _groupKey: string,
    groupPath: string | null,
  ) => {
    if (e.key === 'Enter') handleAddSubmit(_groupKey, groupPath)
    if (e.key === 'Escape') {
      setAddingGroup(null)
      setAddingText('')
    }
  }

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const menuItemStyle: React.CSSProperties = {
    padding: '7px 12px',
    fontSize: 'var(--text-sm)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: 'var(--item-text)',
  }
  const hi = (e: React.MouseEvent) => {
    ;(e.currentTarget as HTMLElement).style.background = 'var(--item-hover-bg)'
  }
  const ho = (e: React.MouseEvent) => {
    ;(e.currentTarget as HTMLElement).style.background = 'transparent'
  }

  return (
    <div
      style={{
        width,
        flexShrink: 0,
        borderLeft: '0.5px solid var(--divider)',
        padding: '12px 0',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          padding: '0 14px',
        }}
      >
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--record-btn)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
            fontWeight: 'var(--font-medium)',
          }}
        >
          {t('todo')}
        </span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--duration-text)' }}>
          {t('itemCount', { count: unchecked.length })}
        </span>
      </div>

      {/* Grouped unchecked */}
      {groups.map(({ key, path, items }) => {
        const collapsed = collapsedGroups.has(key)
        const isAddingHere = addingGroup === key
        return (
          <div key={key}>
            {/* Group header — only shown when multiple groups exist */}
            {multiGroup && (
              <div
                onClick={() => toggleGroup(key)}
                title={path ?? undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 14px',
                  cursor: 'pointer',
                  userSelect: 'none' as const,
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLElement).style.background = 'var(--item-hover-bg)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
              >
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--duration-text)',
                    letterSpacing: '0.06em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '70%',
                  }}
                >
                  {collapsed ? '▸' : '▾'}{' '}
                  {path === null ? (
                    <>
                      journal{' '}
                      <span style={{ opacity: 0.45, fontWeight: 400 }}>
                        {t('pathGroupDefault')}
                      </span>
                    </>
                  ) : (
                    (displayNames.get(path) ?? path.split('/').pop() ?? path)
                  )}
                </span>
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--duration-text)',
                    opacity: 0.6,
                  }}
                >
                  {items.length}
                </span>
              </div>
            )}

            {/* Rows */}
            {!collapsed &&
              items.map((item) => (
                <TodoRow
                  key={item.line_index}
                  item={item}
                  onToggle={onToggle}
                  onSetDue={onSetDue}
                  onUpdateText={onUpdateText}
                  onDelete={onDelete}
                  onNavigateToSource={onNavigateToSource}
                  onOpenConversation={onOpenConversation}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      lineIndex: item.line_index,
                      text: item.text,
                      due: item.due,
                      path: item.path,
                      sessionId: item.session_id,
                      doneFile: item.done_file,
                    })
                  }}
                />
              ))}

            {/* Per-group add */}
            {!collapsed &&
              (isAddingHere ? (
                <div style={{ padding: '6px 14px', borderBottom: '0.5px solid var(--divider)' }}>
                  <input
                    ref={addInputRef}
                    value={addingText}
                    onChange={(e) => setAddingText(e.target.value)}
                    onKeyDown={(e) => handleAddKeyDown(e, key, path)}
                    onBlur={() => handleAddSubmit(key, path)}
                    placeholder={t('addTodo')}
                    style={{
                      width: '100%',
                      fontSize: 'var(--text-xs)',
                      fontFamily: 'var(--font-body)',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: 'var(--item-text)',
                      padding: 0,
                    }}
                  />
                </div>
              ) : (
                <div
                  onClick={() => {
                    setAddingGroup(key)
                    setAddingText('')
                  }}
                  style={{
                    padding: '6px 14px',
                    cursor: 'pointer',
                    borderBottom: '0.5px solid var(--divider)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'background 0.1s ease-out',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLElement).style.background = 'var(--item-hover-bg)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                  }}
                >
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--muted-icon)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-text)' }}>
                    {t('addTodoBtn')}
                  </span>
                </div>
              ))}
          </div>
        )
      })}

      {/* Inbox add when no groups exist yet */}
      {groups.length === 0 &&
        (addingGroup === '__inbox__' ? (
          <div style={{ padding: '6px 14px', borderBottom: '0.5px solid var(--divider)' }}>
            <input
              ref={addInputRef}
              value={addingText}
              onChange={(e) => setAddingText(e.target.value)}
              onKeyDown={(e) => handleAddKeyDown(e, '__inbox__', null)}
              onBlur={() => handleAddSubmit('__inbox__', null)}
              placeholder={t('addTodo')}
              style={{
                width: '100%',
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-body)',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--item-text)',
                padding: 0,
              }}
            />
          </div>
        ) : (
          <div
            onClick={() => {
              setAddingGroup('__inbox__')
              setAddingText('')
            }}
            style={{
              padding: '6px 14px',
              cursor: 'pointer',
              borderBottom: '0.5px solid var(--divider)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'background 0.1s ease-out',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'var(--item-hover-bg)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--muted-icon)"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted-text)' }}>
              {t('addTodoBtn')}
            </span>
          </div>
        ))}

      {/* Completed */}
      {checked.length > 0 && (
        <>
          <div
            onClick={() => setShowCompleted(!showCompleted)}
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--muted-text)',
              marginTop: 8,
              padding: '6px 14px 4px',
              cursor: 'pointer',
              userSelect: 'none' as const,
              letterSpacing: '0.08em',
              textTransform: 'uppercase' as const,
            }}
          >
            {t('completedSection', { count: checked.length })} {showCompleted ? '▾' : '▸'}
          </div>
          {showCompleted &&
            checked.map((item) => (
              <div key={item.line_index} style={{ opacity: 0.5 }}>
                <TodoRow
                  item={item}
                  onToggle={onToggle}
                  onSetDue={onSetDue}
                  onUpdateText={onUpdateText}
                  onDelete={onDelete}
                  onNavigateToSource={onNavigateToSource}
                  onOpenConversation={onOpenConversation}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      lineIndex: item.line_index,
                      text: item.text,
                      due: item.due,
                      path: item.path,
                      sessionId: item.session_id,
                      doneFile: item.done_file,
                    })
                  }}
                />
              </div>
            ))}
        </>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={ctxMenuRef}
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            background: 'var(--sidebar-bg)',
            border: '0.5px solid var(--divider)',
            borderRadius: 8,
            padding: '4px 0',
            zIndex: 1000,
            boxShadow: '0 4px 20px var(--context-menu-shadow)',
            minWidth: 160,
          }}
        >
          {!contextMenu.doneFile && (
            <div
              style={menuItemStyle}
              onMouseEnter={hi}
              onMouseLeave={ho}
              onClick={() => {
                onOpenConversation?.({
                  mode: 'chat',
                  context: contextMenu.text,
                  sessionId: contextMenu.sessionId,
                  lineIndex: contextMenu.lineIndex,
                  doneFile: contextMenu.doneFile,
                })
                setContextMenu(null)
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--item-meta)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <path d="M8 10h.01M12 10h.01M16 10h.01" />
              </svg>
              {t('exploreInDepth')}
            </div>
          )}
          <div
            style={menuItemStyle}
            onMouseEnter={hi}
            onMouseLeave={ho}
            onClick={() => {
              navigator.clipboard.writeText(contextMenu.text)
              setContextMenu(null)
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--item-meta)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            {t('copyText')}
          </div>
          {contextMenu.due && (
            <div
              style={menuItemStyle}
              onMouseEnter={hi}
              onMouseLeave={ho}
              onClick={() => {
                onSetDue(contextMenu.lineIndex, null, contextMenu.doneFile)
                setContextMenu(null)
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--item-meta)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
              {t('clearDueDate')}
            </div>
          )}
          {!contextMenu.doneFile && (
            <div
              style={menuItemStyle}
              onMouseEnter={hi}
              onMouseLeave={ho}
              onClick={async () => {
                const picked = await pickFolder()
                if (picked) {
                  const homePath = picked.replace(/^\/Users\/[^/]+/, '~')
                  onSetPath(contextMenu.lineIndex, homePath, contextMenu.doneFile)
                }
                setContextMenu(null)
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--item-meta)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              {t('setPath')}
            </div>
          )}
          {!contextMenu.doneFile && contextMenu.path && (
            <div
              style={menuItemStyle}
              onMouseEnter={hi}
              onMouseLeave={ho}
              onClick={() => {
                onRemovePath(contextMenu.lineIndex, contextMenu.doneFile)
                setContextMenu(null)
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--item-meta)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                <line x1="9" y1="14" x2="15" y2="14" />
              </svg>
              {t('removePath')}
            </div>
          )}
          <div style={{ height: 1, background: 'var(--divider)', margin: '4px 0' }} />
          <div
            style={{ ...menuItemStyle, color: 'var(--status-danger)' }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'var(--status-danger-bg)'
            }}
            onMouseLeave={ho}
            onClick={() => {
              onDelete(contextMenu.lineIndex, contextMenu.doneFile)
              setContextMenu(null)
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--status-danger)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            {t('deleteTodo')}
          </div>
        </div>
      )}
    </div>
  )
}
