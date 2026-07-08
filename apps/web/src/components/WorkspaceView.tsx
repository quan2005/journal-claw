import { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import {
  FilePlus,
  FolderPlus,
  Upload,
  ChevronDown,
  Plus,
  Pin,
  Paperclip,
  Mic,
  Send,
  MessageSquare,
  RotateCcw,
  Clock,
  Trash2,
  Wrench,
} from 'lucide-react'
import { FileTypeIcon } from './FileTypeIcon'
import { fileTypeIconKindFromName } from '../lib/fileTypeIconKind'
import { useTopics } from '../hooks/useTopics'
import { selectRuntimeClient } from '../lib/runtimeClient'
import type { TopicEntry, SessionSummary } from '../lib/apiTypes'

const conversationList = () => selectRuntimeClient().invoke<SessionSummary[]>('conversation_list')
const conversationDelete = (sessionId: string) =>
  selectRuntimeClient().invoke<void>('conversation_delete', { sessionId })
import { MarkdownRenderer } from './MarkdownRenderer'
import { useTranslation } from '../contexts/I18nContext'
import type { ConversationMessage } from '../types'
import type { ConversationSlice } from './UnifiedChatShell'
import '../styles/workspace.css'

// ── Types ────────────────────────────────────────────────────────────────────

interface WorkspaceRecentItem {
  id: string
  name: string
  path: string
  subtitle: string
  contributorInitial: string
  contributorColor: string
  viewedAt: Date
}

interface WorkspaceViewProps {
  /** Called when a "Recently Viewed" row is clicked with a real topic path. */
  onOpenRecent?: (path: string) => void
}

export type WorkspaceChatShellProps = Omit<ConversationSlice, 'onContinue'> & {
  /** Creates a new empty chat session. */
  onNewChat?: () => void
  /** Switches to an existing chat session by id. */
  onSelectSession?: (id: string) => void
  /** Active session id, used to highlight the current item in the history dropdown. */
  activeSessionId?: string | null
}

// ── Mock data ────────────────────────────────────────────────────────────────

const MOCK_RECENT: WorkspaceRecentItem[] = [
  {
    id: '1',
    name: 'SKILL.md',
    path: 'System/Skills/deep-research-pro',
    subtitle: 'System/Skills/deep-research-pro',
    contributorInitial: '闫',
    contributorColor: 'var(--record-btn)',
    viewedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
  },
  {
    id: '2',
    name: '快速开始.html',
    path: '2rmvs4t2',
    subtitle: '2rmvs4t2',
    contributorInitial: '闫',
    contributorColor: 'var(--record-btn)',
    viewedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
  },
  {
    id: '3',
    name: '快速开始.md',
    path: '2rmvs4t2',
    subtitle: '2rmvs4t2',
    contributorInitial: '闫',
    contributorColor: 'var(--record-btn)',
    viewedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
  },
  {
    id: '4',
    name: '操作技巧与快捷键.md',
    path: '帮助文档',
    subtitle: '帮助文档',
    contributorInitial: '闫',
    contributorColor: 'var(--record-btn)',
    viewedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
  },
  {
    id: '5',
    name: '把思维模型变成 Skill.md',
    path: '帮助文档/更多玩法',
    subtitle: '帮助文档/更多玩法',
    contributorInitial: '闫',
    contributorColor: 'var(--record-btn)',
    viewedAt: new Date(Date.now() - 51 * 24 * 60 * 60 * 1000),
  },
  {
    id: '6',
    name: 'AGENTS.md',
    path: 'System',
    subtitle: 'System',
    contributorInitial: '闫',
    contributorColor: 'var(--record-btn)',
    viewedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
  },
  {
    id: '7',
    name: '产品理念.html',
    path: '帮助文档',
    subtitle: '帮助文档',
    contributorInitial: '闫',
    contributorColor: 'var(--record-btn)',
    viewedAt: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000),
  },
  {
    id: '8',
    name: 'Momo 使用指南.md',
    path: '帮助文档',
    subtitle: '帮助文档',
    contributorInitial: '闫',
    contributorColor: 'var(--record-btn)',
    viewedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
  },
  {
    id: '9',
    name: '系统架构.md',
    path: 'System',
    subtitle: 'System',
    contributorInitial: '闫',
    contributorColor: 'var(--record-btn)',
    viewedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
  },
  {
    id: '10',
    name: '设计规范.html',
    path: 'System',
    subtitle: 'System',
    contributorInitial: '闫',
    contributorColor: 'var(--record-btn)',
    viewedAt: new Date(Date.now() - 110 * 24 * 60 * 60 * 1000),
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(date: Date): string {
  const now = Date.now()
  const diff = now - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days} days ago`
  if (hours > 0) return `${hours} hours ago`
  if (minutes > 0) return `${minutes} minutes ago`
  return 'just now'
}

function placeholderAction(name: string) {
  window.dispatchEvent(
    new CustomEvent('show-toast', {
      detail: { type: 'info', message: `${name} placeholder — not wired to backend` },
    }),
  )
}

function buildRecentItems(
  dirs: Map<string, { entries: TopicEntry[]; expanded: boolean; loading: boolean }>,
): WorkspaceRecentItem[] {
  const real: WorkspaceRecentItem[] = []
  const seen = new Set<string>()

  function walk(entries: TopicEntry[]) {
    for (const entry of entries) {
      if (entry.is_dir) {
        const child = dirs.get(entry.path)
        if (child) walk(child.entries)
        continue
      }
      if (seen.has(entry.path)) continue
      seen.add(entry.path)
      real.push({
        id: entry.path,
        name: entry.name,
        path: entry.path,
        subtitle: entry.path.includes('/')
          ? entry.path.split('/').slice(0, -1).join('/')
          : 'Topics',
        contributorInitial: entry.name.slice(0, 1).toUpperCase() || '?',
        contributorColor: 'var(--record-btn)',
        viewedAt: new Date((entry.mtime_secs ?? 0) * 1000),
      })
    }
  }

  const root = dirs.get('')
  if (root) walk(root.entries)
  real.sort((a, b) => b.viewedAt.getTime() - a.viewedAt.getTime())

  if (real.length >= 5) return real.slice(0, 10)

  const combined = [...real]
  for (const mock of MOCK_RECENT) {
    if (combined.length >= 10) break
    if (!seen.has(mock.path)) combined.push(mock)
  }
  return combined
}

// ── Center view ──────────────────────────────────────────────────────────────

export function WorkspaceView({ onOpenRecent }: WorkspaceViewProps) {
  const { dirs } = useTopics()
  const recentItems = useMemo(() => buildRecentItems(dirs), [dirs])

  return (
    <div className="workspace-view">
      <div className="workspace-view__scroll">
        <div className="workspace-view__inner">
          <QuickStart />
          <RecentlyViewed items={recentItems} onOpenRecent={onOpenRecent} />
        </div>
      </div>
    </div>
  )
}

function QuickStart() {
  const cards = [
    { id: 'new-file', icon: FilePlus, label: 'New File' },
    { id: 'new-folder', icon: FolderPlus, label: 'New Folder' },
    { id: 'import', icon: Upload, label: 'Import' },
  ]

  return (
    <section className="workspace-quickstart">
      <h2 className="workspace-section-title">Quick Start</h2>
      <div className="workspace-quickstart__cards">
        {cards.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            className="workspace-card"
            onClick={() => placeholderAction(label)}
            aria-label={label}
          >
            <span className="workspace-card__icon">
              <Icon size={18} strokeWidth={1.6} />
            </span>
            <span className="workspace-card__label">{label}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function RecentlyViewed({
  items,
  onOpenRecent,
}: {
  items: WorkspaceRecentItem[]
  onOpenRecent?: (path: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = useMemo(() => (expanded ? items : items.slice(0, 5)), [expanded, items])

  const handleRowClick = useCallback(
    (item: WorkspaceRecentItem) => {
      if (onOpenRecent) {
        onOpenRecent(item.path)
      } else {
        placeholderAction(`Open ${item.name}`)
      }
    },
    [onOpenRecent],
  )

  return (
    <section>
      <h2 className="workspace-section-title">Recently Viewed</h2>
      <div className="workspace-recent" role="table" aria-label="Recently viewed files">
        <div className="workspace-recent__header" role="row">
          <span role="columnheader">Name</span>
          <span role="columnheader">Contributors</span>
          <span role="columnheader" style={{ textAlign: 'right' }}>
            Viewed
          </span>
        </div>
        {visible.map((item) => (
          <div
            key={item.id}
            className="workspace-recent__row"
            role="row"
            tabIndex={0}
            onClick={() => handleRowClick(item)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleRowClick(item)
              }
            }}
          >
            <div className="workspace-recent__name" role="cell">
              <FileTypeIcon kind={fileTypeIconKindFromName(item.name)} size={18} />
              <div className="workspace-recent__name-text">
                <span className="workspace-recent__title">{item.name}</span>
                <span className="workspace-recent__subtitle">{item.subtitle}</span>
              </div>
            </div>
            <div role="cell">
              <span
                className="workspace-recent__contributor"
                style={{ background: item.contributorColor }}
                aria-label={`Contributor ${item.contributorInitial}`}
              >
                {item.contributorInitial}
              </span>
            </div>
            <div className="workspace-recent__viewed" role="cell">
              {relativeTime(item.viewedAt)}
            </div>
          </div>
        ))}
        <button
          type="button"
          className="workspace-recent__more"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
        >
          {expanded ? 'Show less' : 'Show more'}
          <ChevronDown
            size={14}
            strokeWidth={1.6}
            style={{
              transform: expanded ? 'rotate(180deg)' : undefined,
              transition: 'transform 0.15s ease-out',
            }}
          />
        </button>
      </div>
    </section>
  )
}

// ── Session dropdown (history + new chat) ────────────────────────────────────

function SessionDropdown({
  activeSessionId,
  onNewChat,
  onSelectSession,
}: {
  activeSessionId?: string | null
  onNewChat?: () => void
  onSelectSession?: (id: string) => void
}) {
  const { t } = useTranslation()
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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
    const off = selectRuntimeClient().subscribe<{
      session_id: string
      event: string
      data: string
    }>('conversation-stream', ({ session_id, event: evt, data }) => {
      if (evt === 'title') {
        setSessions((prev) => prev.map((s) => (s.id === session_id ? { ...s, title: data } : s)))
      }
      if (evt === 'done') {
        refresh()
      }
    })
    return () => {
      off()
    }
  }, [refresh])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (!containerRef.current) return
      if (containerRef.current.contains(e.target as Node)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const visible = sessions
    .filter((s) => s.message_count > 0 || s.id === activeSessionId)
    .sort((a, b) => b.updated_at - a.updated_at)

  const filtered = searchQuery.trim()
    ? visible.filter((s) => s.title?.toLowerCase().includes(searchQuery.toLowerCase()))
    : visible

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

  const formatTime = (secs: number) => {
    const d = new Date(secs * 1000)
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000
    const yesterdayStart = todayStart - 86400
    const weekStart = todayStart - (now.getDay() || 7) * 86400
    if (d.getTime() / 1000 >= todayStart)
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    if (d.getTime() / 1000 >= yesterdayStart) return t('timeYesterday')
    if (d.getTime() / 1000 >= weekStart) {
      const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      return days[d.getDay()]
    }
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  return (
    <div className="workspace-session-dropdown" ref={containerRef}>
      <button
        type="button"
        className="workspace-session-dropdown__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="New Chat"
      >
        <MessageSquare size={16} strokeWidth={1.6} style={{ color: 'var(--record-btn)' }} />
        <span>New Chat</span>
        <ChevronDown
          size={14}
          strokeWidth={1.6}
          style={{
            transform: open ? 'rotate(180deg)' : undefined,
            transition: 'transform 0.15s ease-out',
          }}
        />
      </button>

      {open && (
        <div className="workspace-session-dropdown__menu" role="menu">
          <button
            type="button"
            className="workspace-session-dropdown__item workspace-session-dropdown__item--new"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onNewChat?.()
            }}
          >
            <Plus size={14} strokeWidth={1.6} />
            <span>New Chat</span>
          </button>

          <div className="workspace-session-dropdown__search">
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
            />
          </div>

          <div className="workspace-session-dropdown__list">
            {filtered.length === 0 ? (
              <div className="workspace-session-dropdown__empty">{t('sessionEmpty')}</div>
            ) : (
              filtered.map((s) => {
                const isActive = s.id === activeSessionId
                return (
                  <div
                    key={s.id}
                    className={`workspace-session-dropdown__item${isActive ? ' is-active' : ''}`}
                    role="menuitem"
                    onClick={() => {
                      setOpen(false)
                      onSelectSession?.(s.id)
                    }}
                  >
                    <Clock size={14} strokeWidth={1.6} />
                    <div className="workspace-session-dropdown__meta">
                      <span className="workspace-session-dropdown__title">
                        {s.title || (
                          <span style={{ opacity: 0.5, fontStyle: 'italic' }}>
                            {t('sessionNewChat')}
                          </span>
                        )}
                      </span>
                      <span className="workspace-session-dropdown__subtitle">
                        {formatTime(s.updated_at)}
                        {s.message_count > 0 && <span> · {s.message_count} 条消息</span>}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="workspace-session-dropdown__delete"
                      title={confirmDeleteId === s.id ? t('confirmDelete') : undefined}
                      onClick={(e) => handleDelete(e, s.id)}
                    >
                      {confirmDeleteId === s.id ? '!' : <Trash2 size={12} strokeWidth={1.6} />}
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Right-panel chat shell ───────────────────────────────────────────────────

export function WorkspaceChatShell({
  sessionId,
  messages,
  isStreaming,
  usage,
  stats,
  pendingQueue,
  initialInput,
  onSend,
  onCancel,
  onRetry,
  onNewChat,
  onSelectSession,
  activeSessionId,
}: WorkspaceChatShellProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastInitialInputRef = useRef<string | undefined>(undefined)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Sync external initialInput into the textarea.
  useEffect(() => {
    if (initialInput && initialInput !== lastInitialInputRef.current) {
      lastInitialInputRef.current = initialInput
      setInput(initialInput)
      setTimeout(() => {
        const el = textareaRef.current
        if (!el) return
        el.focus()
        el.setSelectionRange(el.value.length, el.value.length)
        el.style.height = 'auto'
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`
      }, 0)
    }
  }, [initialInput])

  // Auto-focus on session change.
  useEffect(() => {
    const sel = document.getSelection()
    if (sel && sel.type === 'Range') return
    textareaRef.current?.focus()
  }, [sessionId])

  // Auto-resize textarea.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input])

  // Auto-scroll to bottom on new messages / streaming.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, isStreaming, pendingQueue])

  // Listen for chat-append-text custom events.
  useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as CustomEvent<string>).detail
      if (!text) return
      setInput((prev) => {
        const trimmed = prev.trimEnd()
        return trimmed ? `${trimmed} ${text}` : text
      })
      setTimeout(() => {
        const el = textareaRef.current
        if (!el) return
        el.focus()
        el.setSelectionRange(el.value.length, el.value.length)
      }, 50)
    }
    window.addEventListener('chat-append-text', handler)
    return () => window.removeEventListener('chat-append-text', handler)
  }, [])

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text) return
    setInput('')
    onSend(text)
  }, [input, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (isStreaming) {
          onCancel()
        } else {
          handleSend()
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        if (isStreaming) {
          onCancel()
        } else {
          setInput('')
        }
      }
    },
    [handleSend, isStreaming, onCancel],
  )

  const canSend = input.trim().length > 0 && !isStreaming
  const showEmpty = messages.length === 0 && pendingQueue.length === 0 && !isStreaming

  return (
    <div className="workspace-chat">
      <div className="workspace-chat__header">
        <SessionDropdown
          activeSessionId={activeSessionId ?? sessionId}
          onNewChat={onNewChat}
          onSelectSession={onSelectSession}
        />
        <div className="workspace-chat__actions">
          <button type="button" aria-label="Create new chat" onClick={onNewChat}>
            <Plus size={16} strokeWidth={1.6} />
          </button>
          <button type="button" aria-label="Pin">
            <Pin size={16} strokeWidth={1.6} />
          </button>
        </div>
      </div>

      <div className="workspace-chat__body" ref={scrollRef}>
        {showEmpty ? (
          <div className="workspace-chat__greeting">闫戍&apos;s momo</div>
        ) : (
          <div className="workspace-chat__messages" aria-live="polite">
            {messages.map((msg, idx) => (
              <ChatMessage
                key={`${sessionId ?? 'new'}-${idx}`}
                message={msg}
                isLast={idx === messages.length - 1}
                onRetry={onRetry}
              />
            ))}
            {pendingQueue.length > 0 && (
              <div className="workspace-chat__pending">
                {pendingQueue.map((item, idx) => (
                  <span key={idx} className="workspace-chat__pending-item">
                    {item}
                  </span>
                ))}
              </div>
            )}
            {isStreaming && <div className="workspace-chat__streaming" />}
            {usage.input + usage.output > 0 && (
              <div className="workspace-chat__usage">
                {usage.input}↑ {usage.output}↓
                {stats?.elapsed_secs ? ` · ${stats.elapsed_secs}s` : ''}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="workspace-chat__composer">
        <div className="workspace-chat__input-box">
          <textarea
            ref={textareaRef}
            className="workspace-chat__textarea"
            rows={1}
            placeholder="Ask me anything"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
          />
          <div className="workspace-chat__toolbar">
            <div className="workspace-chat__toolbar-left">
              <button
                type="button"
                aria-label="Attach file"
                onClick={() => placeholderAction('Attach file')}
              >
                <Paperclip size={16} strokeWidth={1.6} />
              </button>
            </div>
            <div className="workspace-chat__toolbar-right">
              <button
                type="button"
                aria-label="Voice input"
                onClick={() => placeholderAction('Voice input')}
              >
                <Mic size={16} strokeWidth={1.6} />
              </button>
              {isStreaming ? (
                <button
                  type="button"
                  className="workspace-chat__send workspace-chat__send--cancel"
                  aria-label="Cancel"
                  onClick={onCancel}
                >
                  <span className="workspace-chat__stop-square" />
                </button>
              ) : (
                <button
                  type="button"
                  className="workspace-chat__send"
                  aria-label="Send"
                  disabled={!canSend}
                  onClick={handleSend}
                >
                  <Send size={14} strokeWidth={1.8} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChatMessage({
  message,
  isLast,
  onRetry,
}: {
  message: ConversationMessage
  isLast: boolean
  onRetry?: () => void
}) {
  const isUser = message.role === 'user'
  return (
    <div className={`workspace-chat__message-row workspace-chat__message-row--${message.role}`}>
      <div className={`workspace-chat__message workspace-chat__message--${message.role}`}>
        {isUser ? (
          <div className="workspace-chat__message-text">{message.content}</div>
        ) : (
          <div className="workspace-chat__message-md">
            <MarkdownRenderer content={message.content} className="md-content md-content--chat" />
          </div>
        )}
        {message.thinking && (
          <details className="workspace-chat__thinking">
            <summary>Thinking</summary>
            <pre>{message.thinking}</pre>
          </details>
        )}
        {message.tools && message.tools.length > 0 && (
          <div className="workspace-chat__tools">
            {message.tools.map((tool, idx) => (
              <ToolCapsule key={idx} tool={tool} />
            ))}
          </div>
        )}
      </div>
      {!isUser && isLast && onRetry && (
        <button
          type="button"
          className="workspace-chat__retry"
          aria-label="Retry"
          onClick={onRetry}
        >
          <RotateCcw size={12} strokeWidth={1.6} />
        </button>
      )}
    </div>
  )
}

function ToolCapsule({
  tool,
}: {
  tool: { name: string; label: string; output?: string; isError?: boolean }
}) {
  const [expanded, setExpanded] = useState(false)
  const hasOutput = !!tool.output
  return (
    <div
      className="workspace-chat__tool"
      data-error={tool.isError || undefined}
      data-expandable={hasOutput || undefined}
      data-expanded={expanded || undefined}
    >
      <button
        type="button"
        className="workspace-chat__tool-summary"
        onClick={() => hasOutput && setExpanded((v) => !v)}
        disabled={!hasOutput}
        aria-expanded={expanded}
      >
        <span className="workspace-chat__tool-icon">
          <Wrench size={12} strokeWidth={1.6} />
        </span>
        <span className="workspace-chat__tool-name">{tool.name}</span>
        <span className="workspace-chat__tool-label">{tool.label}</span>
        {hasOutput && (
          <ChevronDown
            size={12}
            strokeWidth={1.6}
            className="workspace-chat__tool-chevron"
            style={{
              transform: expanded ? 'rotate(180deg)' : undefined,
              transition: 'transform 0.15s ease-out',
            }}
          />
        )}
      </button>
      {expanded && tool.output && <pre className="workspace-chat__tool-output">{tool.output}</pre>}
    </div>
  )
}
