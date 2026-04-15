import { useState, useEffect, useCallback } from 'react'
import {
  conversationList,
  conversationDelete,
  conversationRename,
  type SessionSummary,
} from '../lib/tauri'

interface SessionListProps {
  activeSessionId: string | null
  onSelect: (id: string) => void
  onNewSession: () => void
}

export function SessionList({ activeSessionId, onSelect, onNewSession }: SessionListProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

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
    const interval = setInterval(refresh, 3000)
    return () => clearInterval(interval)
  }, [refresh])

  const streaming = sessions.filter((s) => s.is_streaming)
  const done = sessions.filter((s) => !s.is_streaming)

  const handleDelete = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation()
      await conversationDelete(id)
      refresh()
    },
    [refresh],
  )

  const handleDoubleClick = useCallback((id: string, currentTitle: string | null) => {
    setEditingId(id)
    setEditTitle(currentTitle ?? '')
  }, [])

  const handleRenameSubmit = useCallback(
    async (id: string) => {
      if (editTitle.trim()) {
        await conversationRename(id, editTitle.trim())
        refresh()
      }
      setEditingId(null)
    },
    [editTitle, refresh],
  )

  const formatTime = (secs: number) => {
    const d = new Date(secs * 1000)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    if (isToday) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) return '昨天'
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  const renderItem = (s: SessionSummary) => {
    const isActive = s.id === activeSessionId
    const isEditing = s.id === editingId

    return (
      <div
        key={s.id}
        onClick={() => onSelect(s.id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 8px',
          margin: '0 4px',
          borderRadius: 6,
          cursor: 'pointer',
          background: isActive ? 'var(--item-hover-bg)' : 'transparent',
          position: 'relative',
          transition: 'background 0.1s ease-out',
        }}
      >
        {isActive && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 2,
              height: 14,
              background: 'var(--item-text)',
              borderRadius: 1,
            }}
          />
        )}
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            flexShrink: 0,
            background: s.is_streaming ? 'var(--status-success)' : 'var(--item-meta)',
            opacity: s.is_streaming ? 1 : 0.3,
            animation: s.is_streaming ? 'rec-pulse 1.5s ease-in-out infinite' : undefined,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          {isEditing ? (
            <input
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={() => handleRenameSubmit(s.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit(s.id)
                if (e.key === 'Escape') setEditingId(null)
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                background: 'var(--queue-bg)',
                color: 'var(--item-text)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--font-medium)',
                padding: '1px 4px',
                borderRadius: 3,
              }}
            />
          ) : (
            <div
              onDoubleClick={() => handleDoubleClick(s.id, s.title)}
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--font-medium)',
                color: 'var(--item-text)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {s.title || (
                <span style={{ color: 'var(--item-meta)', fontStyle: 'italic' }}>新对话</span>
              )}
            </div>
          )}
          <div
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--item-meta)',
              marginTop: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {formatTime(s.updated_at)}
            {s.linked_entry && (
              <span> · {s.linked_entry.split('/').pop()?.replace('.md', '')}</span>
            )}
          </div>
        </div>
        <span
          onClick={(e) => handleDelete(e, s.id)}
          style={{
            fontSize: '0.6875rem',
            color: 'var(--item-meta)',
            cursor: 'pointer',
            opacity: 0,
            padding: '0 2px',
            transition: 'opacity 0.1s',
          }}
          className="session-delete-btn"
        >
          ×
        </span>
      </div>
    )
  }

  return (
    <div
      style={{
        width: 200,
        borderRight: '0.5px solid var(--queue-border)',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--queue-bg)',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <style>{`
        .session-delete-btn { opacity: 0 !important; }
        div:hover > .session-delete-btn { opacity: 0.6 !important; }
        .session-delete-btn:hover { opacity: 1 !important; }
      `}</style>

      <div
        onClick={onNewSession}
        style={{
          margin: '6px 4px',
          padding: '5px 8px',
          borderRadius: 6,
          border: '0.5px dashed var(--queue-border)',
          fontSize: '0.6875rem',
          color: 'var(--item-meta)',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'border-color 0.15s ease, color 0.15s ease',
        }}
      >
        + 新建会话
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {streaming.length > 0 && (
          <>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--font-semibold)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--item-meta)',
                padding: '8px 12px 4px',
                transform: 'scale(0.85)',
                transformOrigin: 'left center',
              }}
            >
              输出中
            </div>
            {streaming.map(renderItem)}
          </>
        )}

        {streaming.length > 0 && done.length > 0 && (
          <div style={{ borderTop: '0.5px solid var(--queue-border)', margin: '4px 12px' }} />
        )}

        {done.length > 0 && (
          <>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--font-semibold)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--item-meta)',
                padding: '8px 12px 4px',
                transform: 'scale(0.85)',
                transformOrigin: 'left center',
              }}
            >
              已完成
            </div>
            {done.map(renderItem)}
          </>
        )}

        {sessions.length === 0 && (
          <div
            style={{
              padding: '24px 12px',
              textAlign: 'center',
              fontSize: 'var(--text-xs)',
              color: 'var(--item-meta)',
              opacity: 0.5,
            }}
          >
            暂无会话
          </div>
        )}
      </div>
    </div>
  )
}
