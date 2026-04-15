import { useState, useRef, useEffect, useCallback } from 'react'
import type { SessionMode, ConversationMessage, MessageBlock } from '../types'
import { useConversation } from '../hooks/useConversation'
import { useTranslation } from '../contexts/I18nContext'
import { Spinner } from './Spinner'
import { MarkdownRenderer } from './MarkdownRenderer'
import { ConversationInput } from './ConversationInput'
import { SessionList } from './SessionList'

const ANIM_DURATION = 200

interface ConversationDialogProps {
  mode: SessionMode
  context?: string
  contextFiles?: string[]
  initialInput?: string
  initialSessionId?: string
  visible: boolean
  onClose: () => void
}

export function ConversationDialog({
  mode,
  context,
  contextFiles,
  initialInput,
  initialSessionId,
  visible,
  onClose,
}: ConversationDialogProps) {
  const { t } = useTranslation()
  const { sessionId, messages, isStreaming, create, send, cancel, close, load } = useConversation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const userScrolledUp = useRef(false)
  const initialized = useRef(false)

  // Create or load session on first mount
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      if (initialSessionId) {
        load(initialSessionId)
      } else {
        create(mode, context, contextFiles)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Track if user has scrolled up
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    userScrolledUp.current = distanceFromBottom > 60
  }, [])

  // Auto-scroll only if user hasn't scrolled up
  useEffect(() => {
    if (!visible) return
    const el = scrollRef.current
    if (el && !userScrolledUp.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages, visible])

  // Close just notifies parent; animation is driven by visible prop change
  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  const handleNewSession = useCallback(() => {
    close()
    create(mode, context, contextFiles)
  }, [close, create, mode, context, contextFiles])

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
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [visible, handleClose, handleNewSession])

  const handleSelectSession = useCallback(
    (id: string) => {
      if (id === sessionId) return
      load(id)
    },
    [sessionId, load],
  )

  const show = visible

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
          zIndex: show ? 100 : -1,
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
          width: 720,
          maxWidth: 'calc(100vw - 48px)',
          height: '75vh',
          background: 'rgba(var(--dialog-glass-rgb, 28,28,30), 0.78)',
          backdropFilter: 'blur(20px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.2)',
          border: '1px solid var(--dialog-glass-border)',
          borderRadius: 16,
          boxShadow: 'var(--dialog-shadow)',
          zIndex: show ? 101 : -1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          opacity: show ? 1 : 0,
          transform: show ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -48%) scale(0.95)',
          pointerEvents: show ? 'auto' : 'none',
          transition: `opacity ${ANIM_DURATION}ms ease-out, transform ${ANIM_DURATION}ms ease-out`,
        }}
      >
        {/* Thin header strip — split color matching left/right panels */}
        <div
          style={{
            height: 8,
            flexShrink: 0,
            display: 'flex',
          }}
        >
          <div style={{ width: 200, flexShrink: 0, background: 'var(--dialog-sidebar-bg)' }} />
          <div style={{ flex: 1 }} />
        </div>

        {/* Body: split layout */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <SessionList activeSessionId={sessionId} onSelect={handleSelectSession} />

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
            {/* Floating new session button */}
            <button
              onClick={handleNewSession}
              title="⌘N"
              style={{
                position: 'absolute',
                top: 8,
                right: 12,
                zIndex: 10,
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'var(--dialog-kbd-bg)',
                border: '0.5px solid var(--dialog-glass-divider)',
                cursor: 'pointer',
                color: 'var(--item-meta)',
                fontSize: 'var(--text-sm)',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
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
              +
            </button>
            {/* Messages */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {messages.length === 0 && (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--item-meta)',
                    opacity: 0.4,
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  {mode === 'chat' ? t('conversationChatHint') : t('conversationAgentHint')}
                </div>
              )}

              {messages.map((msg: ConversationMessage, i: number) => (
                <MessageBubble key={i} message={msg} />
              ))}

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
            </div>

            {/* Input */}
            <ConversationInput
              onSend={send}
              onCancel={cancel}
              isStreaming={isStreaming}
              initialInput={initialInput}
            />
          </div>
        </div>
      </div>
    </>
  )
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
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
          }}
        >
          {message.content}
        </div>
      </div>
    )
  }

  const blocks = message.blocks
  if (blocks && blocks.length > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
        {blocks.map((block: MessageBlock, i: number) => (
          <BlockRenderer key={i} block={block} />
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
      {message.thinking && <ThinkingBlock thinking={message.thinking} />}
      {message.content && (
        <div
          style={{
            maxWidth: '85%',
            padding: '4px 0',
            fontSize: 'var(--text-sm)',
            lineHeight: 1.6,
            wordBreak: 'break-word',
          }}
        >
          <MarkdownRenderer content={message.content} />
        </div>
      )}
      {message.tools?.map((tool, i) => (
        <ToolBlock key={i} tool={tool} />
      ))}
    </div>
  )
}

function BlockRenderer({ block }: { block: MessageBlock }) {
  switch (block.type) {
    case 'text':
      return block.content ? (
        <div
          style={{
            maxWidth: '85%',
            padding: '4px 0',
            fontSize: 'var(--text-sm)',
            lineHeight: 1.6,
            wordBreak: 'break-word',
          }}
        >
          <MarkdownRenderer content={block.content} />
        </div>
      ) : null
    case 'thinking':
      return <ThinkingBlock thinking={block.content} />
    case 'tool':
      return <ToolBlock tool={block} />
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
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        maxWidth: '85%',
        padding: '4px 10px',
        borderRadius: 6,
        background: hovered ? 'var(--item-hover-bg)' : 'var(--segment-bg)',
        fontSize: 'var(--text-xs)',
        fontFamily: 'var(--font-mono)',
        color: tool.isError ? 'var(--status-danger)' : 'var(--item-meta)',
        cursor: 'pointer',
        userSelect: 'none',
        border: tool.isError ? '0.5px solid var(--status-danger)' : '0.5px solid transparent',
        transition: 'background 0.15s ease-out, border-color 0.15s ease-out',
      }}
    >
      <span style={{ fontSize: 'var(--text-xs)', marginRight: 4 }}>{expanded ? '▾' : '▸'}</span>
      {tool.label}
      {expanded && tool.output && (
        <div
          style={{
            marginTop: 4,
            opacity: 0.7,
            maxHeight: 120,
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

function ThinkingBlock({ thinking }: { thinking: string }) {
  const [expanded, setExpanded] = useState(false)
  const [hovered, setHovered] = useState(false)
  const summary = thinking.slice(0, 60).replace(/\n/g, ' ') + (thinking.length > 60 ? '…' : '')

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        maxWidth: '85%',
        padding: '4px 10px',
        borderRadius: 6,
        background: hovered ? 'var(--item-hover-bg)' : 'var(--segment-bg)',
        fontSize: 'var(--text-xs)',
        color: 'var(--item-meta)',
        cursor: 'pointer',
        userSelect: 'none',
        border: '0.5px solid transparent',
        fontStyle: 'italic',
        transition: 'background 0.15s ease-out',
      }}
    >
      <span style={{ fontSize: 'var(--text-xs)', marginRight: 4 }}>{expanded ? '▾' : '▸'}</span>
      {expanded ? (
        <span
          style={{
            display: 'inline-block',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 200,
            overflow: 'auto',
            lineHeight: 1.55,
            fontStyle: 'italic',
          }}
        >
          {thinking}
        </span>
      ) : (
        <span>{summary}</span>
      )}
    </div>
  )
}
