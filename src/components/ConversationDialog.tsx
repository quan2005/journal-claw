import { useState, useRef, useEffect, useCallback } from 'react'
import { listen } from '@tauri-apps/api/event'
import type { SessionMode, ConversationMessage, AiLogLine, MessageBlock } from '../types'
import { useConversation } from '../hooks/useConversation'
import { useTranslation } from '../contexts/I18nContext'
import { Spinner } from './Spinner'
import { MarkdownRenderer } from './MarkdownRenderer'
import { ConversationInput } from './ConversationInput'
import { SessionList } from './SessionList'

const ANIM_DURATION = 180

interface ConversationDialogProps {
  mode: SessionMode
  context?: string
  contextFiles?: string[]
  initialInput?: string
  /** For observe mode: the material_path of the in-progress task */
  observePath?: string
  observeLogs?: string[]
  visible: boolean
  onClose: () => void
}

export function ConversationDialog({
  mode,
  context,
  contextFiles,
  initialInput,
  observePath,
  observeLogs,
  visible,
  onClose,
}: ConversationDialogProps) {
  const { t } = useTranslation()
  const {
    sessionId,
    messages,
    isStreaming,
    title: autoTitle,
    create,
    send,
    cancel,
    close,
    load,
  } = useConversation()
  const [logs, setLogs] = useState<string[]>(observeLogs ?? [])
  const scrollRef = useRef<HTMLDivElement>(null)
  const userScrolledUp = useRef(false)
  const initialized = useRef(false)

  // Create session on first mount
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      create(mode, context, contextFiles)
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
  }, [messages, logs, visible])

  // Observe mode: listen to ai-log events
  useEffect(() => {
    if (mode !== 'observe' || !observePath) return
    const unlisten = listen<AiLogLine>('ai-log', (event) => {
      if (event.payload.material_path === observePath) {
        setLogs((prev) => [...prev, event.payload.message])
      }
    })
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [mode, observePath])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  const handleSelectSession = useCallback(
    (id: string) => {
      if (id === sessionId) return
      load(id)
    },
    [sessionId, load],
  )

  const handleNewSession = useCallback(() => {
    close()
    create(mode, context, contextFiles)
  }, [close, create, mode, context, contextFiles])

  const headerTitle =
    autoTitle ??
    (mode === 'chat'
      ? context
        ? `${t('conversationChat')}：${context.slice(0, 30)}`
        : t('conversationChat')
      : mode === 'agent'
        ? t('conversationAgent')
        : t('conversationObserve'))

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 100,
          animation: `modal-backdrop-in ${ANIM_DURATION}ms ease-out both`,
        }}
      />
      {/* Dialog */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 720,
          maxWidth: 'calc(100vw - 48px)',
          height: '75vh',
          background: 'var(--queue-bg)',
          border: '0.5px solid var(--queue-border)',
          borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          zIndex: 101,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: `modal-panel-in ${ANIM_DURATION}ms ease-out both`,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            borderBottom: '0.5px solid var(--queue-border)',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              flex: 1,
              fontSize: 'var(--text-sm)',
              color: 'var(--item-text)',
              fontWeight: 'var(--font-medium)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {headerTitle}
          </span>
          {isStreaming && (
            <span
              style={{
                fontSize: '0.625rem',
                padding: '1px 6px',
                borderRadius: 100,
                border: '0.5px solid var(--status-success)',
                color: 'var(--status-success)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: 'var(--status-success)',
                }}
              />
              输出中
            </span>
          )}
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--item-meta)',
              opacity: 0.5,
            }}
          >
            ⌘K
          </span>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--item-meta)',
              fontSize: 'var(--text-md)',
              lineHeight: 1,
              padding: '0 2px',
            }}
          >
            ×
          </button>
        </div>

        {/* Body: split layout */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Left: session list */}
          <SessionList
            activeSessionId={sessionId}
            onSelect={handleSelectSession}
            onNewSession={handleNewSession}
          />

          {/* Right: conversation */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
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
              {/* Observe mode: show logs */}
              {mode === 'observe' && logs.length > 0 && (
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    lineHeight: 1.6,
                    color: 'var(--item-meta)',
                    borderBottom: '0.5px solid var(--queue-border)',
                    paddingBottom: 12,
                    marginBottom: 4,
                  }}
                >
                  {logs.map((line, i) => (
                    <div
                      key={i}
                      style={{
                        color: line.startsWith('[error]')
                          ? 'var(--status-danger)'
                          : 'var(--item-meta)',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {line}
                    </div>
                  ))}
                </div>
              )}

              {messages.length === 0 && mode !== 'observe' && (
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

              {messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} />
              ))}

              {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
                  <Spinner size={12} borderWidth={1.5} />
                  <span
                    style={{ fontSize: 'var(--text-xs)', color: 'var(--item-meta)', opacity: 0.6 }}
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

  // For user messages, render simple bubble
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

  // For assistant messages, render blocks in order
  const blocks = message.blocks
  if (blocks && blocks.length > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
        {blocks.map((block, i) => (
          <BlockRenderer key={i} block={block} />
        ))}
      </div>
    )
  }

  // Fallback: no blocks (legacy or empty)
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

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        maxWidth: '85%',
        padding: '4px 10px',
        borderRadius: 6,
        background: 'var(--segment-bg)',
        fontSize: 'var(--text-xs)',
        fontFamily: 'var(--font-mono)',
        color: tool.isError ? 'var(--status-danger)' : 'var(--item-meta)',
        cursor: 'pointer',
        userSelect: 'none',
        border: tool.isError ? '0.5px solid var(--status-danger)' : '0.5px solid transparent',
        transition: 'border-color 0.15s ease-out',
      }}
    >
      <span style={{ fontSize: '0.625rem', marginRight: 4 }}>{expanded ? '▾' : '▸'}</span>
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
  const summary = thinking.slice(0, 60).replace(/\n/g, ' ') + (thinking.length > 60 ? '…' : '')

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        maxWidth: '85%',
        padding: '4px 10px',
        borderRadius: 6,
        background: 'var(--segment-bg)',
        fontSize: 'var(--text-xs)',
        color: 'var(--item-meta)',
        cursor: 'pointer',
        userSelect: 'none',
        border: '0.5px solid transparent',
        fontStyle: 'italic',
      }}
    >
      <span style={{ fontSize: '0.625rem', marginRight: 4 }}>{expanded ? '▾' : '▸'}</span>
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
