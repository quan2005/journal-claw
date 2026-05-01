import { useState, useRef, useEffect, useCallback } from 'react'
import type { SessionMode, ConversationMessage, MessageBlock, WebSearchResultItem } from '../types'
import { useConversation } from '../hooks/useConversation'
import { useTranslation } from '../contexts/I18nContext'
import { Spinner } from './Spinner'
import { MarkdownRenderer } from './MarkdownRenderer'
import { useSmoothStream } from '../hooks/useSmoothStream'
import { ConversationInput } from './ConversationInput'
import { openFile } from '../lib/tauri'
import { SessionList, SESSION_LIST_WIDTH } from './SessionList'
import { FileAttachments } from './FileAttachments'

// Per-tool SVG path data (24x24 viewBox, stroke-based)
const TOOL_ICON_PATHS: Record<string, string> = {
  bash: '', // rendered as ">_" text, not SVG
  read: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  write: 'M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z',
  edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  glob: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z M9 17l2-2 M14 12a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  grep: 'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M21 21l-4.35-4.35',
  mkdir:
    'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z M12 11v6 M9 14h6',
  move: 'M5 12h14 M12 5l7 7-7 7',
  copy: 'M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  remove: 'M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  stat: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 16v-4 M12 8h.01',
  load_skill: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
}
const ANIM_DURATION = 200

interface ConversationDialogProps {
  mode: SessionMode
  context?: string
  contextFiles?: string[]
  initialInput?: string
  initialSessionId?: string
  initialStreaming?: boolean
  initialUserMessage?: string
  visible: boolean
  onClose: () => void
  onSessionCreated?: (sessionId: string) => void
}

export function ConversationDialog({
  mode,
  context,
  contextFiles,
  initialInput,
  initialSessionId,
  initialStreaming,
  initialUserMessage,
  visible,
  onClose,
  onSessionCreated,
}: ConversationDialogProps) {
  const { t } = useTranslation()
  const {
    sessionId,
    title: sessionTitle,
    messages,
    isStreaming,
    usage,
    stats,
    create,
    send,
    retry,
    cancel,
    load,
    editAndResend,
    pendingQueue,
    removePendingItem,
  } = useConversation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const userScrolledUp = useRef(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('conv-sidebar-width')
    return saved ? Math.max(180, Math.min(360, parseInt(saved, 10))) : SESSION_LIST_WIDTH
  })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const draggingRef = useRef(false)
  const initialized = useRef(false)
  const [prefillText, setPrefillText] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)

  // Create or load session on first mount
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      if (initialSessionId) {
        load(initialSessionId, initialStreaming, initialUserMessage)
      } else {
        create(mode, context, contextFiles)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Notify parent when a real session is created (deferred to first send)
  useEffect(() => {
    if (sessionId && !initialSessionId) {
      onSessionCreated?.(sessionId)
    }
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Track if user has scrolled up
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    userScrolledUp.current = distanceFromBottom > 60
    setShowScrollBtn(distanceFromBottom > 60)
  }, [])

  // Auto-scroll only if user hasn't scrolled up and no text is selected
  useEffect(() => {
    if (!visible) return
    const sel = document.getSelection()
    if (sel && sel.type === 'Range') return
    const el = scrollRef.current
    if (el && !userScrolledUp.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages, visible])

  // Client-side elapsed timer for streaming display
  useEffect(() => {
    if (!isStreaming) return
    setElapsed(0)
    const start = Date.now()
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [isStreaming])

  // Close just notifies parent; animation is driven by visible prop change
  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      userScrolledUp.current = false
      setShowScrollBtn(false)
    }
  }, [])

  const handleSidebarDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      draggingRef.current = true
      const startX = e.clientX
      const startW = sidebarWidth
      let lastW = startW
      const onMove = (ev: MouseEvent) => {
        lastW = Math.max(180, Math.min(360, startW + ev.clientX - startX))
        setSidebarWidth(lastW)
      }
      const onUp = () => {
        draggingRef.current = false
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        localStorage.setItem('conv-sidebar-width', String(lastW))
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [sidebarWidth],
  )

  const handleNewSession = useCallback(() => {
    create(mode, context, contextFiles)
  }, [create, mode, context, contextFiles])

  // ESC to close, ⌘N to new session — capture phase + stopPropagation 确保对话框优先级最高
  useEffect(() => {
    if (!visible) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        handleClose()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        e.stopPropagation()
        handleNewSession()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        scrollToBottom()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        e.stopPropagation()
        const searchInput = document.querySelector<HTMLInputElement>('.conv-session-search')
        searchInput?.focus()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        e.stopPropagation()
        setSidebarCollapsed((prev) => !prev)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [visible, handleClose, handleNewSession, scrollToBottom])

  const handleSelectSession = useCallback(
    (id: string, streaming: boolean) => {
      if (id === sessionId) return
      load(id, streaming)
      requestAnimationFrame(() => {
        const el = scrollRef.current
        if (el) el.scrollTop = 0
        userScrolledUp.current = false
        setShowScrollBtn(false)
      })
    },
    [sessionId, load],
  )

  // Animation phase: mounted keeps z-index up during exit, show drives CSS transitions
  const [mounted, setMounted] = useState(visible)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (visible) {
      setMounted(true)
      // Next frame: trigger enter transition
      requestAnimationFrame(() => requestAnimationFrame(() => setShow(true)))
    } else {
      setShow(false)
      const timer = setTimeout(() => setMounted(false), ANIM_DURATION)
      return () => clearTimeout(timer)
    }
  }, [visible])

  return (
    <>
      {/* Backdrop — 始终在 DOM 中，用 transition 控制显隐 */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: show ? 'blur(4px)' : 'blur(0px)',
          WebkitBackdropFilter: show ? 'blur(4px)' : 'blur(0px)',
          zIndex: mounted ? 100 : -1,
          opacity: show ? 1 : 0,
          pointerEvents: show ? 'auto' : 'none',
          transition: `opacity ${ANIM_DURATION}ms ease-out, backdrop-filter ${ANIM_DURATION}ms ease-out, -webkit-backdrop-filter ${ANIM_DURATION}ms ease-out`,
        }}
      />
      {/* Dialog — 始终在 DOM 中，用 transition 控制显隐，避免 blur 跳变 */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          width: 'min(960px, calc(100vw - 80px))',
          maxWidth: 'calc(100vw - 80px)',
          height: 'min(82vh, calc(100vh - 80px))',
          background: 'rgba(var(--dialog-glass-rgb, 28,28,30), 0.78)',
          backdropFilter: 'blur(20px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.2)',
          border: '1px solid var(--dialog-glass-border)',
          borderRadius: 16,
          boxShadow: 'var(--dialog-shadow)',
          zIndex: mounted ? 101 : -1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          opacity: show ? 1 : 0,
          transform: show ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -48%) scale(0.95)',
          pointerEvents: show ? 'auto' : 'none',
          transition: `opacity ${ANIM_DURATION}ms ease-out, transform ${ANIM_DURATION}ms ease-out`,
        }}
      >
        {/* Header bar */}
        <div
          style={{
            height: 36,
            flexShrink: 0,
            display: 'flex',
            borderBottom: '0.5px solid var(--dialog-glass-divider)',
          }}
        >
          <div
            style={{
              width: sidebarCollapsed ? 0 : sidebarWidth,
              flexShrink: 0,
              background: 'var(--dialog-sidebar-bg)',
              borderRight: sidebarCollapsed ? 'none' : '1px solid var(--dialog-glass-divider)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: sidebarCollapsed ? 0 : '0 8px 0 12px',
              overflow: 'hidden',
              transition: 'width 200ms ease-out',
            }}
          >
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--font-semibold)',
                color: 'var(--item-text)',
                opacity: 0.7,
              }}
            >
              {t('sessionTitle')}
            </span>
            <button
              onClick={handleNewSession}
              title="⌘N"
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--item-meta)',
                fontSize: 'var(--text-sm)',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.15s ease-out',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--item-text)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--item-meta)'
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
              <button
                onClick={() => setSidebarCollapsed((prev) => !prev)}
                title="⌘B"
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--item-meta)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'color 0.15s ease-out',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--item-text)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--item-meta)'
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 3v18" />
                </svg>
              </button>
              {isStreaming && (
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--status-success)',
                    flexShrink: 0,
                    animation: 'rec-pulse 1.5s ease-in-out infinite',
                  }}
                />
              )}
              {sessionTitle ? (
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 'var(--font-medium)',
                    color: 'var(--item-text)',
                    opacity: 0.6,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {sessionTitle}
                </span>
              ) : (
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--item-meta)',
                    opacity: 0.5,
                  }}
                >
                  {mode === 'chat' ? t('conversationChat') : t('conversationAgent')}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <kbd
                  style={{
                    fontSize: '0.5625rem',
                    color: 'var(--item-meta)',
                    opacity: 0.35,
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  ⌘K {t('search')}
                </kbd>
                <kbd
                  style={{
                    fontSize: '0.5625rem',
                    color: 'var(--item-meta)',
                    opacity: 0.35,
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  esc {t('close')}
                </kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Body: split layout */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <SessionList
            activeSessionId={sessionId}
            onSelect={handleSelectSession}
            width={sidebarWidth}
            collapsed={sidebarCollapsed}
          />

          {/* Drag handle */}
          {!sidebarCollapsed && (
            <div
              onMouseDown={handleSidebarDragStart}
              onDoubleClick={() => {
                setSidebarWidth(SESSION_LIST_WIDTH)
                localStorage.setItem('conv-sidebar-width', String(SESSION_LIST_WIDTH))
              }}
              style={{
                width: 6,
                cursor: 'col-resize',
                flexShrink: 0,
                position: 'relative',
              }}
            >
              <div
                className="drag-handle-line"
                style={{
                  position: 'absolute',
                  left: 2,
                  top: '20%',
                  bottom: '20%',
                  width: 2,
                  borderRadius: 1,
                  background: 'transparent',
                  transition: 'background 0.15s ease-out',
                }}
              />
              <style>{`
              div:hover > .drag-handle-line { background: var(--dialog-glass-divider) !important; }
              div:active > .drag-handle-line { background: var(--record-btn) !important; }
            `}</style>
            </div>
          )}

          {/* Right: conversation */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
              position: 'relative',
            }}
          >
            {/* Messages */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {messages.length === 0 && (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                  }}
                >
                  <span
                    style={{
                      fontSize: 'var(--text-md)',
                      color: 'var(--item-meta)',
                      opacity: 0.35,
                    }}
                  >
                    {mode === 'chat' ? t('conversationChat') : t('conversationAgent')}
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--item-meta)',
                      opacity: 0.3,
                    }}
                  >
                    {mode === 'chat' ? t('conversationChatHint') : t('conversationAgentHint')}
                  </span>
                  <div
                    style={{
                      display: 'flex',
                      gap: 16,
                      marginTop: 8,
                      fontSize: '0.5625rem',
                      color: 'var(--item-meta)',
                      opacity: 0.25,
                    }}
                  >
                    <span>/ {t('slashCommand')}</span>
                    <span>@ {t('atMention')}</span>
                    <span>⌘N {t('sessionNewChat')}</span>
                  </div>
                </div>
              )}

              {(() => {
                // Group consecutive assistant messages into runs
                const result: React.ReactNode[] = []
                let i = 0
                while (i < messages.length) {
                  const msg = messages[i]
                  if (msg.role === 'user') {
                    const idx = i
                    result.push(
                      <MessageBubble
                        key={idx}
                        message={msg}
                        index={idx}
                        isStreaming={isStreaming}
                        onEditAndResend={editAndResend}
                      />,
                    )
                    i++
                  } else {
                    // Collect consecutive assistant messages
                    const run: ConversationMessage[] = []
                    const startIdx = i
                    while (i < messages.length && messages[i].role === 'assistant') {
                      run.push(messages[i])
                      i++
                    }
                    const isLastRun = i === messages.length
                    const isLastRunStreaming = isStreaming && isLastRun
                    const hideLastActions = isLastRun && !isStreaming && stats != null
                    result.push(
                      <AssistantRun
                        key={`run-${startIdx}`}
                        messages={run}
                        isStreaming={isLastRunStreaming}
                        onRetry={retry}
                        onContinue={() => send('请继续')}
                        hideActions={hideLastActions}
                      />,
                    )
                  }
                }
                return result
              })()}

              {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
                  <Spinner size={12} borderWidth={1.5} />
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--item-meta)',
                      opacity: 0.6,
                    }}
                  >
                    {t('conversationThinking')}
                  </span>
                </div>
              )}

              {/* Session-level stats — left-aligned */}
              {isStreaming && (elapsed > 0 || usage.input > 0 || usage.output > 0) ? (
                <div
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--item-meta)',
                    opacity: 0.35,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <StreamingStats elapsed={elapsed} usage={usage} bare />
                  <AnimatedEllipsis />
                </div>
              ) : !isStreaming &&
                stats &&
                (stats.elapsed_secs > 0 ||
                  stats.total_input_tokens + stats.total_output_tokens > 0) ? (
                <SessionStatsLine
                  stats={stats}
                  lastContent={(() => {
                    for (let j = messages.length - 1; j >= 0; j--) {
                      const m = messages[j]
                      if (m.role === 'assistant') {
                        const textBlock = m.blocks?.filter((b) => b.type === 'text').pop()
                        if (textBlock?.type === 'text' && textBlock.content)
                          return textBlock.content
                        if (m.content) return m.content
                      }
                    }
                    return ''
                  })()}
                />
              ) : null}
            </div>

            {/* Scroll to bottom button */}
            {messages.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  padding: '0 0 4px',
                  opacity: showScrollBtn ? 1 : 0,
                  transform: showScrollBtn ? 'translateY(0)' : 'translateY(4px)',
                  transition: 'opacity 150ms ease-out, transform 150ms ease-out',
                  pointerEvents: showScrollBtn ? 'auto' : 'none',
                }}
              >
                <button
                  onClick={scrollToBottom}
                  style={{
                    background: 'var(--dialog-kbd-bg)',
                    border: '0.5px solid var(--dialog-glass-divider)',
                    borderRadius: 12,
                    padding: '3px 12px',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--item-meta)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'background 0.15s ease-out, color 0.15s ease-out',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--item-hover-bg)'
                    e.currentTarget.style.color = 'var(--item-text)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--dialog-kbd-bg)'
                    e.currentTarget.style.color = 'var(--item-meta)'
                  }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                  {t('scrollToBottom')}
                </button>
              </div>
            )}

            {/* Pending queue — messages waiting to be sent */}
            {pendingQueue.length > 0 && (
              <div
                style={{ padding: '0 24px 6px', display: 'flex', flexDirection: 'column', gap: 4 }}
              >
                {pendingQueue.map((text, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      alignItems: 'flex-start',
                      gap: 4,
                    }}
                  >
                    <span
                      onClick={() => {
                        const removed = removePendingItem(i)
                        if (removed) setPrefillText(removed)
                      }}
                      style={{
                        flexShrink: 0,
                        marginTop: 7,
                        cursor: 'pointer',
                        color: 'var(--item-meta)',
                        fontSize: 12,
                        lineHeight: 1,
                        opacity: 0.5,
                      }}
                      title={t('cancel')}
                    >
                      ×
                    </span>
                    <div
                      style={{
                        maxWidth: '85%',
                        padding: '8px 12px',
                        borderRadius: '10px 10px 2px 10px',
                        background: 'var(--item-text)',
                        color: 'var(--bg)',
                        fontSize: 'var(--text-sm)',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        opacity: 0.5,
                      }}
                    >
                      {text}
                    </div>
                  </div>
                ))}
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--item-meta)',
                    textAlign: 'right',
                    opacity: 0.6,
                  }}
                >
                  {t('pendingQueueHint')}
                </div>
              </div>
            )}

            {/* Input */}
            <ConversationInput
              sessionId={sessionId}
              onSend={send}
              onCancel={cancel}
              isStreaming={isStreaming}
              initialInput={initialInput}
              prefillText={prefillText}
              onPrefillConsumed={() => setPrefillText(null)}
            />
          </div>
        </div>
      </div>
    </>
  )
}

function MessageBubble({
  message,
  index,
  isStreaming,
  onEditAndResend,
}: {
  message: ConversationMessage
  index: number
  isStreaming: boolean
  onEditAndResend: (index: number, text: string) => void
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(message.content)
  const [hovered, setHovered] = useState(false)
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing && textareaRef.current) {
      const ta = textareaRef.current
      ta.focus()
      ta.style.height = 'auto'
      ta.style.height = ta.scrollHeight + 'px'
    }
  }, [editing])

  const handleCopy = () => {
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
    navigator.clipboard.writeText(message.content)
  }

  const handleResend = () => {
    if (isStreaming) return
    onEditAndResend(index, message.content)
  }

  const handleEditConfirm = () => {
    const trimmed = editText.trim()
    if (!trimmed || isStreaming) return
    setEditing(false)
    onEditAndResend(index, trimmed)
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <div style={{ width: '100%', position: 'relative' }}>
          <textarea
            ref={textareaRef}
            value={editText}
            onChange={(e) => {
              setEditText(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = e.target.scrollHeight + 'px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleEditConfirm()
              }
              if (e.key === 'Escape') {
                setEditing(false)
                setEditText(message.content)
              }
            }}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '8px 12px',
              borderRadius: '10px 10px 2px 10px',
              background: 'var(--item-text)',
              color: 'var(--bg)',
              fontSize: 'var(--text-sm)',
              lineHeight: 1.6,
              border: '2px solid var(--record-btn)',
              outline: 'none',
              resize: 'none',
              overflow: 'hidden',
              fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 4 }}>
            <button
              onClick={() => {
                setEditing(false)
                setEditText(message.content)
              }}
              style={{
                background: 'none',
                border: '1px solid var(--divider)',
                borderRadius: 4,
                padding: '2px 10px',
                fontSize: 12,
                color: 'var(--item-meta)',
                cursor: 'pointer',
              }}
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleEditConfirm}
              style={{
                background: 'var(--record-btn)',
                border: 'none',
                borderRadius: 4,
                padding: '2px 10px',
                fontSize: 12,
                color: 'var(--bg)',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              {t('submit')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ position: 'relative', maxWidth: '85%' }}>
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '10px 10px 2px 10px',
            background: 'var(--item-text)',
            color: 'var(--bg)',
            fontSize: 'var(--text-sm)',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          <UserContent text={message.content} />
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: -16,
            right: 4,
            display: 'flex',
            gap: 2,
            opacity: hovered ? 1 : 0,
            transition: 'opacity 120ms ease-out',
            zIndex: 1,
          }}
        >
          <ActionBtn title={t('copy')} onClick={handleCopy}>
            {copied ? (
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--status-success)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </ActionBtn>
          <ActionBtn
            title={t('edit')}
            onClick={() => {
              setEditText(message.content)
              setEditing(true)
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            </svg>
          </ActionBtn>
          <ActionBtn title={t('resend')} onClick={handleResend} disabled={isStreaming}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </ActionBtn>
        </div>
      </div>
    </div>
  )
}

function UserContent({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, i) => {
        if (line.startsWith('@/') || line.startsWith('@~')) {
          const path = line.slice(1)
          const filename = path.split('/').pop() ?? path
          return (
            <div
              key={i}
              onClick={() => openFile(path).catch(() => {})}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 4,
                background: 'rgba(255,255,255,0.15)',
                cursor: 'pointer',
                fontSize: 'var(--text-xs)',
                marginBottom: 2,
              }}
              title={path}
            >
              {filename}
            </div>
          )
        }
        return (
          <span key={i}>
            {line}
            {i < lines.length - 1 && '\n'}
          </span>
        )
      })}
    </>
  )
}

function ActionBtn({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'none',
        border: 'none',
        padding: '2px 4px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: 'var(--item-meta)',
        opacity: disabled ? 0.3 : 0.6,
        display: 'flex',
        alignItems: 'center',
        borderRadius: 3,
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.opacity = '1'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = disabled ? '0.3' : '0.6'
      }}
    >
      {children}
    </button>
  )
}

function AssistantActions({ content }: { content: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const [hovered, setHovered] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ minHeight: 20, display: 'flex', alignItems: 'center', gap: 6 }}
    >
      <div
        style={{
          display: 'flex',
          gap: 2,
          opacity: hovered ? 1 : 0,
          transition: 'opacity 120ms ease-out',
        }}
      >
        <ActionBtn title={t('copy')} onClick={handleCopy}>
          {copied ? (
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--status-success)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </ActionBtn>
      </div>
    </div>
  )
}

function AssistantRun({
  messages,
  isStreaming,
  onRetry,
  onContinue,
  hideActions,
}: {
  messages: ConversationMessage[]
  isStreaming?: boolean
  onRetry?: () => void
  onContinue?: () => void
  hideActions?: boolean
}) {
  // Start expanded while streaming; auto-collapse when streaming ends
  const [expanded, setExpanded] = useState(!!isStreaming)
  const wasStreamingRef = useRef(!!isStreaming)
  useEffect(() => {
    if (isStreaming) {
      wasStreamingRef.current = true
      setExpanded(true)
    } else if (wasStreamingRef.current) {
      wasStreamingRef.current = false
      setExpanded(false)
    }
  }, [isStreaming])

  // Collect all blocks across all messages in this run
  const allBlocks: MessageBlock[] = messages.flatMap((m) => m.blocks ?? [])
  const nonTextBlocks = allBlocks.filter(
    (b) => b.type !== 'text' && b.type !== 'error' && b.type !== 'truncated',
  )
  const textBlocks = allBlocks.filter((b) => b.type === 'text')
  const errorOrTruncBlocks = allBlocks.filter((b) => b.type === 'error' || b.type === 'truncated')
  const lastTextBlock = textBlocks[textBlocks.length - 1]
  const hasNonText = nonTextBlocks.length > 0

  const iconSequence = nonTextBlocks.map((b) => {
    if (b.type === 'thinking') return 'thinking'
    if (b.type === 'tool') return b.name || 'tool'
    if (b.type === 'web_search') return 'web_search'
    if (b.type === 'subtask') return 'subtask'
    return 'gear'
  })

  const toolCount = nonTextBlocks.filter(
    (b) => b.type === 'tool' || b.type === 'web_search' || b.type === 'subtask',
  ).length
  const intermediateTextCount = textBlocks.length > 1 ? textBlocks.length - 1 : 0

  // During streaming, show all blocks from all messages
  if (isStreaming) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
        {allBlocks.map((block: MessageBlock, i: number) => (
          <BlockRenderer
            key={i}
            block={block}
            streaming
            onRetry={onRetry}
            onContinue={onContinue}
          />
        ))}
        <FileAttachments blocks={allBlocks} />
      </div>
    )
  }

  // No non-text blocks: just render text (+ error/truncated)
  if (!hasNonText) {
    const lastContent = textBlocks
      .filter((b) => b.type === 'text' && b.content)
      .map((b) => b.content)
      .join('\n')
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
        {textBlocks.map((block: MessageBlock, i: number) => (
          <BlockRenderer key={i} block={block} onRetry={onRetry} onContinue={onContinue} />
        ))}
        {errorOrTruncBlocks.map((block: MessageBlock, i: number) => (
          <BlockRenderer key={`et-${i}`} block={block} onRetry={onRetry} onContinue={onContinue} />
        ))}
        {!hideActions && <AssistantActions content={lastContent} />}
      </div>
    )
  }

  // Collapsed: summary + last text only (+ error/truncated always visible)
  if (!expanded) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
        <CollapsedToolSummary
          icons={iconSequence}
          toolCount={toolCount}
          msgCount={intermediateTextCount}
          onExpand={() => setExpanded(true)}
        />
        {lastTextBlock?.type === 'text' && lastTextBlock.content && (
          <div
            style={{
              maxWidth: '100%',
              fontSize: 'var(--text-sm)',
              lineHeight: 1.6,
              wordBreak: 'break-word',
            }}
          >
            <MarkdownRenderer content={lastTextBlock.content} />
          </div>
        )}
        <FileAttachments blocks={allBlocks} />
        {errorOrTruncBlocks.map((block: MessageBlock, i: number) => (
          <BlockRenderer key={`et-${i}`} block={block} onRetry={onRetry} onContinue={onContinue} />
        ))}
        {!hideActions && <AssistantActions content={lastTextBlock?.content ?? ''} />}
      </div>
    )
  }

  // Expanded: summary (togglable) + all blocks
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
      <CollapsedToolSummary
        icons={iconSequence}
        toolCount={toolCount}
        msgCount={intermediateTextCount}
        expanded
        onExpand={() => setExpanded(false)}
      />
      {allBlocks.map((block: MessageBlock, i: number) => (
        <BlockRenderer key={i} block={block} onRetry={onRetry} onContinue={onContinue} />
      ))}
      <FileAttachments blocks={allBlocks} />
      {!hideActions && <AssistantActions content={lastTextBlock?.content ?? ''} />}
    </div>
  )
}

function CollapsedToolSummary({
  icons,
  toolCount,
  msgCount,
  expanded,
  onExpand,
}: {
  icons: string[]
  toolCount: number
  msgCount: number
  expanded?: boolean
  onExpand: () => void
}) {
  // Global aggregation: thinking×2 edit×4 read×7 (preserves first-seen order)
  const seen = new Map<string, number>()
  for (const ic of icons) {
    seen.set(ic, (seen.get(ic) ?? 0) + 1)
  }

  const summary = `${msgCount} message${msgCount !== 1 ? 's' : ''}, ${toolCount} tool${toolCount !== 1 ? 's' : ''}`

  return (
    <div
      onClick={onExpand}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'none',
        fontSize: 'var(--text-xs)',
        color: 'var(--item-meta)',
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      <svg
        style={{
          width: 10,
          height: 10,
          flexShrink: 0,
          opacity: 0.4,
          transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 150ms ease-out',
        }}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
      <span style={{ opacity: 0.4, flexShrink: 0 }}>{summary}</span>
      {[...seen.entries()].map(([ic, count], i) => (
        <span
          key={i}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 1, opacity: 0.5 }}
        >
          <ToolIcon name={ic} />
          {count > 1 && <span style={{ fontSize: '0.6rem' }}>×{count}</span>}
        </span>
      ))}
    </div>
  )
}

function ToolIcon({ name }: { name: string }) {
  if (name === 'thinking') {
    return (
      <svg
        style={{ width: 12, height: 12, flexShrink: 0 }}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
        <path d="M9 21h6" />
        <path d="M10 17v4" />
        <path d="M14 17v4" />
      </svg>
    )
  }
  if (name === 'web_search') {
    return (
      <svg
        style={{ width: 12, height: 12, flexShrink: 0 }}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    )
  }
  if (name === 'subtask') {
    return (
      <svg
        style={{ width: 12, height: 12, flexShrink: 0 }}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="18" cy="18" r="3" />
        <circle cx="6" cy="6" r="3" />
        <path d="M6 9v2c0 1.1.9 2 2 2h8c1.1 0 2 .9 2 2v3" />
      </svg>
    )
  }
  if (name === 'bash') {
    return (
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', flexShrink: 0 }}>
        {'>_'}
      </span>
    )
  }
  const iconPath = TOOL_ICON_PATHS[name]
  return (
    <svg
      style={{ width: 12, height: 12, flexShrink: 0 }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPath ? (
        iconPath.split(' M').map((seg, j) => <path key={j} d={j === 0 ? seg : 'M' + seg} />)
      ) : (
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      )}
    </svg>
  )
}

function ErrorBlock({
  error,
  onRetry,
}: {
  error: { code: string; message: string; retryable: boolean }
  onRetry?: () => void
}) {
  const { t } = useTranslation()
  const isAuth = error.code === 'auth_error'
  const borderColor = isAuth ? 'var(--status-danger)' : 'var(--record-btn)'

  return (
    <div
      style={{
        maxWidth: '100%',
        borderRadius: 8,
        border: `0.5px solid ${borderColor}`,
        background: 'var(--dialog-inset-bg)',
        padding: '8px 12px',
        fontSize: 'var(--text-xs)',
        color: 'var(--item-text)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <span style={{ opacity: 0.8, lineHeight: 1.5 }}>{error.message}</span>
      <div style={{ display: 'flex', gap: 8 }}>
        {error.retryable && onRetry && (
          <button
            onClick={onRetry}
            style={{
              background: 'var(--record-btn)',
              border: 'none',
              borderRadius: 5,
              padding: '3px 10px',
              fontSize: 'var(--text-xs)',
              color: 'var(--record-btn-icon)',
              cursor: 'pointer',
            }}
          >
            {t('retry')}
          </button>
        )}
        {isAuth && (
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open-settings', { detail: 'ai-engine' }))
            }}
            style={{
              background: 'none',
              border: `0.5px solid ${borderColor}`,
              borderRadius: 5,
              padding: '3px 10px',
              fontSize: 'var(--text-xs)',
              color: 'var(--status-danger)',
              cursor: 'pointer',
            }}
          >
            {t('goToSettings')}
          </button>
        )}
      </div>
    </div>
  )
}

function TruncatedBlock({ onContinue }: { onContinue?: () => void }) {
  return (
    <div
      style={{
        maxWidth: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 0',
        fontSize: 'var(--text-xs)',
        color: 'var(--item-meta)',
      }}
    >
      <div style={{ flex: 1, height: '0.5px', background: 'var(--dialog-inset-border)' }} />
      <span>回复已截断</span>
      {onContinue && (
        <button
          onClick={onContinue}
          style={{
            background: 'none',
            border: '0.5px solid var(--dialog-inset-border)',
            borderRadius: 5,
            padding: '2px 8px',
            fontSize: 'var(--text-xs)',
            color: 'var(--record-btn)',
            cursor: 'pointer',
          }}
        >
          继续生成
        </button>
      )}
      <div style={{ flex: 1, height: '0.5px', background: 'var(--dialog-inset-border)' }} />
    </div>
  )
}

function StreamingStats({
  elapsed,
  usage,
  bare,
}: {
  elapsed: number
  usage: { input: number; output: number }
  bare?: boolean
}) {
  const parts: string[] = []
  if (elapsed > 0) {
    const m = Math.floor(elapsed / 60)
    const s = elapsed % 60
    parts.push(m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`)
  }
  const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`)
  if (usage.input > 0 || usage.output > 0) {
    parts.push(`↑${fmt(usage.input)} ↓${fmt(usage.output)}`)
  }
  if (parts.length === 0) return null
  const text = parts.join(' · ')
  if (bare) return <>{text}</>
  return <span style={{ marginLeft: 6, opacity: 0.5 }}>({text})</span>
}

function AnimatedEllipsis() {
  return (
    <span style={{ letterSpacing: 1 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            animation: `ellipsis-fade 1.2s ${i * 0.2}s ease-in-out infinite`,
            opacity: 0.3,
          }}
        >
          ·
        </span>
      ))}
      <style>{`@keyframes ellipsis-fade { 0%,100% { opacity: 0.2; } 50% { opacity: 0.8; } }`}</style>
    </span>
  )
}

function SessionStatsLine({
  stats,
  lastContent,
}: {
  stats: { elapsed_secs: number; total_input_tokens: number; total_output_tokens: number }
  lastContent: string
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const elapsed = Math.round(stats.elapsed_secs)
  const usage = { input: stats.total_input_tokens, output: stats.total_output_tokens }

  const handleCopy = () => {
    navigator.clipboard.writeText(lastContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      style={{
        fontSize: 'var(--text-xs)',
        color: 'var(--item-meta)',
        opacity: 0.35,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <StreamingStats elapsed={elapsed} usage={usage} bare />
      <button
        onClick={handleCopy}
        title={t('copy')}
        style={{
          background: 'none',
          border: 'none',
          padding: '1px 2px',
          cursor: 'pointer',
          color: 'inherit',
          opacity: copied ? 1 : 0.7,
          display: 'flex',
          alignItems: 'center',
          transition: 'opacity 120ms ease-out',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = copied ? '1' : '0.7'
        }}
      >
        {copied ? (
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
    </div>
  )
}

function LoopWarningBlock({ message }: { message: string }) {
  return (
    <div
      style={{
        maxWidth: '100%',
        borderRadius: 8,
        border: '0.5px solid color-mix(in srgb, var(--status-warning) 30%, transparent)',
        background: 'var(--status-warning-bg)',
        padding: '8px 12px',
        fontSize: 'var(--text-xs)',
        color: 'var(--status-warning)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        lineHeight: 1.5,
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span>{message}</span>
    </div>
  )
}

function SmoothTextBlock({ content }: { content: string }) {
  const smoothed = useSmoothStream(content)
  return (
    <div
      style={{
        maxWidth: '100%',
        fontSize: 'var(--text-sm)',
        lineHeight: 1.6,
        wordBreak: 'break-word',
      }}
    >
      <MarkdownRenderer content={smoothed} />
    </div>
  )
}

function BlockRenderer({
  block,
  streaming,
  onRetry,
  onContinue,
}: {
  block: MessageBlock
  streaming?: boolean
  onRetry?: () => void
  onContinue?: () => void
}) {
  switch (block.type) {
    case 'text':
      if (!block.content) return null
      if (streaming) return <SmoothTextBlock content={block.content} />
      return (
        <div
          style={{
            maxWidth: '100%',
            fontSize: 'var(--text-sm)',
            lineHeight: 1.6,
            wordBreak: 'break-word',
          }}
        >
          <MarkdownRenderer content={block.content} />
        </div>
      )
    case 'thinking':
      return <ThinkingBlock thinking={block.content} />
    case 'tool':
      return <ToolBlock tool={block} />
    case 'web_search':
      return <WebSearchBlock query={block.query} results={block.results} />
    case 'subtask':
      return <SubtaskBlock subtask={block} />
    case 'error':
      return <ErrorBlock error={block} onRetry={onRetry} />
    case 'loop_warning':
      return <LoopWarningBlock message={block.message} />
    case 'truncated':
      return <TruncatedBlock onContinue={onContinue} />
    default:
      return null
  }
}

function ToolBlock({
  tool,
}: {
  tool: { name: string; label: string; output?: string; isError?: boolean }
}) {
  const [expanded, setExpanded] = useState(false)

  const iconPath = TOOL_ICON_PATHS[tool.name]

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        maxWidth: '100%',
        borderRadius: 6,
        background: 'none',
        fontSize: 'var(--text-xs)',
        fontFamily: 'var(--font-mono)',
        color: tool.isError ? 'var(--status-danger)' : 'var(--item-meta)',
        cursor: 'pointer',
        userSelect: 'none',
        border: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          minWidth: 0,
        }}
      >
        {tool.name === 'bash' ? (
          <span style={{ flexShrink: 0, opacity: 0.5 }}>{'>_'}</span>
        ) : (
          <svg
            style={{ flexShrink: 0, opacity: 0.5, width: 12, height: 12 }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {iconPath ? (
              iconPath.split(' M').map((seg, j) => <path key={j} d={j === 0 ? seg : 'M' + seg} />)
            ) : (
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            )}
          </svg>
        )}
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {tool.label}
        </span>
        <svg
          style={{
            flexShrink: 0,
            opacity: 0.4,
            width: 10,
            height: 10,
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease-out',
          }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
      {expanded && tool.output && (
        <div
          style={{
            padding: '0 0 4px',
            opacity: 0.7,
            maxHeight: 200,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            borderTop: '0.5px solid var(--queue-border)',
            paddingTop: 4,
          }}
        >
          {tool.output}
        </div>
      )}
    </div>
  )
}

function SubtaskBlock({
  subtask,
}: {
  subtask: {
    toolUseId: string
    prompt: string
    summary?: string
    isError?: boolean
    isRunning?: boolean
  }
}) {
  const [expanded, setExpanded] = useState(false)
  const promptPreview =
    subtask.prompt.slice(0, 80).replace(/\n/g, ' ') + (subtask.prompt.length > 80 ? '...' : '')

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        maxWidth: '100%',
        borderRadius: 6,
        background: 'none',
        fontSize: 'var(--text-xs)',
        fontFamily: 'var(--font-mono)',
        color: subtask.isError ? 'var(--status-danger)' : 'var(--item-meta)',
        cursor: 'pointer',
        userSelect: 'none',
        border: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          minWidth: 0,
        }}
      >
        {subtask.isRunning ? (
          <Spinner size={12} borderWidth={1.5} />
        ) : subtask.isError ? (
          <svg
            style={{ flexShrink: 0, width: 12, height: 12 }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--status-danger)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg
            style={{ flexShrink: 0, width: 12, height: 12 }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--status-success)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {promptPreview}
        </span>
        {subtask.summary && (
          <svg
            style={{
              flexShrink: 0,
              opacity: 0.4,
              width: 10,
              height: 10,
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 150ms ease-out',
            }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        )}
      </div>
      {expanded && subtask.summary && (
        <div
          style={{
            padding: '4px 0 4px 18px',
            opacity: 0.8,
            maxHeight: 300,
            overflow: 'auto',
            wordBreak: 'break-word',
            borderTop: '0.5px solid var(--queue-border)',
            marginTop: 4,
            lineHeight: 1.55,
            fontSize: 'var(--text-xs)',
            fontFamily: 'var(--font-body)',
          }}
        >
          <MarkdownRenderer content={subtask.summary} />
        </div>
      )}
    </div>
  )
}

function WebSearchBlock({ query, results }: { query: string; results: WebSearchResultItem[] }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const label = query ? t('sessionWebSearchQuery').replace('{query}', query) : t('sessionWebSearch')

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        maxWidth: '100%',
        background: 'none',
        fontSize: 'var(--text-xs)',
        color: 'var(--item-meta)',
        cursor: 'pointer',
        userSelect: 'none',
        border: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          minWidth: 0,
        }}
      >
        <svg
          style={{ flexShrink: 0, opacity: 0.5, width: 12, height: 12 }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
          {results.length > 0 && (
            <span style={{ opacity: 0.5, marginLeft: 6 }}>({results.length})</span>
          )}
        </span>
        <svg
          style={{
            flexShrink: 0,
            opacity: 0.4,
            width: 10,
            height: 10,
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease-out',
          }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
      {expanded && results.length > 0 && (
        <div
          style={{
            marginTop: 6,
            borderTop: '0.5px solid var(--queue-border)',
            paddingTop: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {results.map((r, i) => (
            <div key={i} style={{ lineHeight: 1.5 }}>
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(r.url, '_blank')
                }}
                style={{
                  color: 'var(--md-link)',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  fontStyle: 'normal',
                }}
              >
                {r.title || r.url}
              </span>
              {r.page_age && (
                <span style={{ opacity: 0.4, marginLeft: 6, fontSize: '0.65rem' }}>
                  {r.page_age}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ThinkingBlock({ thinking }: { thinking: string }) {
  const [expanded, setExpanded] = useState(false)
  const trimmed = thinking.trim()
  const summary = trimmed.slice(0, 120).replace(/\n/g, ' ') + (trimmed.length > 120 ? '…' : '')

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        maxWidth: '100%',
        background: 'none',
        fontSize: 'var(--text-xs)',
        color: 'var(--item-meta)',
        cursor: 'pointer',
        userSelect: 'none',
        border: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          minWidth: 0,
        }}
      >
        <svg
          style={{ flexShrink: 0, opacity: 0.5, width: 12, height: 12 }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
          <path d="M9 21h6" />
          <path d="M10 17v4" />
          <path d="M14 17v4" />
        </svg>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontStyle: 'italic',
          }}
        >
          {summary}
        </span>
        <svg
          style={{
            flexShrink: 0,
            opacity: 0.4,
            width: 10,
            height: 10,
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease-out',
          }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
      {expanded && (
        <div
          style={{
            padding: '0 0 4px',
            opacity: 0.7,
            maxHeight: 300,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            borderTop: '0.5px solid var(--queue-border)',
            paddingTop: 4,
            fontStyle: 'italic',
            lineHeight: 1.55,
          }}
        >
          {trimmed}
        </div>
      )}
    </div>
  )
}
