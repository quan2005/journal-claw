import { useState, useEffect, useCallback, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import { conversationList, conversationDelete, type SessionSummary } from '../lib/tauri'
import { useTranslation } from '../contexts/I18nContext'

interface HistoryFloatingButtonProps {
  activeSessionId: string | null
  onSelect: (id: string) => void
}

export function HistoryFloatingButton({ activeSessionId, onSelect }: HistoryFloatingButtonProps) {
  const { t } = useTranslation()
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [hovered, setHovered] = useState(false)
  const [panelVisible, setPanelVisible] = useState(false)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const list = await conversationList()
      setSessions(list)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [refresh])

  useEffect(() => {
    const unlisten = listen<{ session_id: string; event: string; data: string }>(
      'conversation-stream',
      (event) => {
        const { session_id, event: evt, data } = event.payload
        if (evt === 'title') {
          setSessions((prev) => prev.map((s) => (s.id === session_id ? { ...s, title: data } : s)))
        }
        if (evt === 'done') {
          refresh()
        }
      },
    )
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [refresh])

  // Mouse enter with delay — prevents accidental triggers
  const handleMouseEnter = useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
    hoverTimerRef.current = setTimeout(() => {
      setHovered(true)
      // Stagger panel visibility for smooth cascade
      requestAnimationFrame(() => {
        setPanelVisible(true)
      })
    }, 150)
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    setPanelVisible(false)
    leaveTimerRef.current = setTimeout(() => {
      setHovered(false)
    }, 250) // matches CSS transition
  }, [])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    }
  }, [])

  // Filter + sort
  const visible = sessions
    .filter((s) => s.message_count > 0 || s.id === activeSessionId)
    .sort((a, b) => b.updated_at - a.updated_at)

  const filtered = searchQuery.trim()
    ? visible.filter((s) => s.title?.toLowerCase().includes(searchQuery.toLowerCase()))
    : visible

  // Time grouping (simplified for floating panel)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000
  const yesterdayStart = todayStart - 86400
  const weekStart = todayStart - (now.getDay() || 7) * 86400

  const formatTime = (secs: number) => {
    const d = new Date(secs * 1000)
    if (d.getTime() / 1000 >= todayStart)
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    if (d.getTime() / 1000 >= yesterdayStart) return t('timeYesterday')
    if (d.getTime() / 1000 >= weekStart) {
      const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      return days[d.getDay()]
    }
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (confirmDeleteId === id) {
      setConfirmDeleteId(null)
      await conversationDelete(id)
      refresh()
    } else {
      setConfirmDeleteId(id)
      setTimeout(() => setConfirmDeleteId((prev) => (prev === id ? null : prev)), 3000)
    }
  }

  const panelWidth = 260
  const btnSize = 32

  return (
    <div
      className="history-float-container"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 20,
        width: hovered ? panelWidth : btnSize,
        height: hovered ? 'auto' : btnSize,
        maxHeight: hovered ? 'min(60vh, 480px)' : btnSize,
        borderRadius: hovered ? 12 : btnSize / 2,
        background: hovered
          ? 'var(--dialog-glass-bg, rgba(28,28,30,0.92))'
          : 'var(--item-hover-bg)',
        backdropFilter: hovered ? 'blur(20px) saturate(1.2)' : 'none',
        WebkitBackdropFilter: hovered ? 'blur(20px) saturate(1.2)' : 'none',
        border: hovered
          ? '0.5px solid var(--dialog-glass-border, rgba(255,255,255,0.08))'
          : '0.5px solid transparent',
        boxShadow: hovered ? '0 8px 32px rgba(0,0,0,0.24), 0 2px 8px rgba(0,0,0,0.12)' : 'none',
        overflow: 'hidden',
        transition: `
          width 0.25s cubic-bezier(0.16, 1, 0.3, 1),
          height 0.25s cubic-bezier(0.16, 1, 0.3, 1),
          max-height 0.25s cubic-bezier(0.16, 1, 0.3, 1),
          border-radius 0.25s cubic-bezier(0.16, 1, 0.3, 1),
          background 0.2s ease-out,
          border-color 0.2s ease-out,
          box-shadow 0.25s ease-out,
          backdrop-filter 0.2s ease-out
        `,
        cursor: hovered ? 'default' : 'pointer',
        userSelect: 'none',
      }}
    >
      {/* Collapsed state: clock icon button */}
      {!hovered && (
        <div
          style={{
            width: btnSize,
            height: btnSize,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: 'var(--item-meta)', opacity: 0.75 }}
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
      )}

      {/* Expanded panel */}
      {hovered && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            maxHeight: 'min(60vh, 480px)',
            opacity: panelVisible ? 1 : 0,
            transition: 'opacity 0.15s ease-out 0.08s',
          }}
        >
          {/* Search input */}
          <div style={{ padding: '8px 10px 4px', flexShrink: 0 }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setSearchQuery('')
                  ;(e.target as HTMLInputElement).blur()
                }
              }}
              placeholder={t('sessionSearchPlaceholder')}
              autoFocus
              style={{
                width: '100%',
                height: 28,
                border: 'none',
                borderRadius: 6,
                padding: '0 8px',
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-body)',
                background: 'var(--dialog-inset-bg)',
                color: 'var(--item-text)',
                outline: 'none',
              }}
            />
          </div>

          {/* Session list */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: '2px 0',
              scrollbarWidth: 'thin',
            }}
          >
            {filtered.length === 0 ? (
              <div
                style={{
                  padding: '20px 12px',
                  textAlign: 'center',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--item-meta)',
                  opacity: 0.4,
                }}
              >
                {t('sessionEmpty')}
              </div>
            ) : (
              filtered.map((s) => {
                const isActive = s.id === activeSessionId
                return (
                  <div
                    key={s.id}
                    onClick={() => onSelect(s.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 10px',
                      margin: '0 4px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: isActive ? 'var(--item-hover-bg)' : 'transparent',
                      transition: 'background 0.1s ease-out',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive)
                        (e.currentTarget as HTMLElement).style.background = 'var(--item-hover-bg)'
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive)
                        (e.currentTarget as HTMLElement).style.background = 'transparent'
                    }}
                  >
                    {/* Status dot */}
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        flexShrink: 0,
                        background: s.is_streaming ? 'var(--status-success)' : 'var(--item-meta)',
                        opacity: s.is_streaming ? 1 : 0.3,
                        animation: s.is_streaming
                          ? 'rec-pulse 1.5s ease-in-out infinite'
                          : undefined,
                      }}
                    />
                    {/* Title + time */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 'var(--text-xs)',
                          fontWeight: isActive ? 'var(--font-semibold)' : 'var(--font-normal)',
                          color: 'var(--item-text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {s.title || (
                          <span style={{ color: 'var(--item-meta)', fontStyle: 'italic' }}>
                            {t('sessionNewChat')}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: '0.625rem',
                          color: 'var(--item-meta)',
                          marginTop: 1,
                        }}
                      >
                        {formatTime(s.updated_at)}
                        {s.message_count > 0 && (
                          <span style={{ opacity: 0.5, marginLeft: 6 }}>
                            {s.message_count} 条消息
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Delete button */}
                    <button
                      onClick={(e) => handleDelete(e, s.id)}
                      style={{
                        flexShrink: 0,
                        width: 16,
                        height: 16,
                        borderRadius: 3,
                        border: 'none',
                        background: 'transparent',
                        color:
                          confirmDeleteId === s.id ? 'var(--status-danger)' : 'var(--item-meta)',
                        cursor: 'pointer',
                        fontSize: 10,
                        lineHeight: 1,
                        padding: 0,
                        opacity: 0,
                        transition: 'opacity 0.1s ease-out',
                      }}
                      className="history-item-delete"
                      title={confirmDeleteId === s.id ? t('confirmDelete') : undefined}
                    >
                      {confirmDeleteId === s.id ? '!' : '×'}
                    </button>
                  </div>
                )
              })
            )}
          </div>

          {/* Delete button hover style */}
          <style>{`
            .history-float-container div:hover > .history-item-delete {
              opacity: 0.6 !important;
            }
            .history-float-container .history-item-delete:hover {
              opacity: 1 !important;
            }
          `}</style>

          {/* Footer: new session shortcut */}
          <div
            style={{
              padding: '6px 10px',
              borderTop: '0.5px solid var(--dialog-glass-divider)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.625rem',
              color: 'var(--item-meta)',
              opacity: 0.5,
            }}
          >
            <span>⌘N 新建对话</span>
          </div>
        </div>
      )}
    </div>
  )
}
