import {
  useState,
  useRef,
  useEffect,
  useCallback,
  memo,
  lazy,
  Suspense,
  type ReactNode,
} from 'react'
import type { ConversationMessage, MessageBlock, WebSearchResultItem, Attachment } from '../types'
import type { SessionStats } from '../lib/tauri'
import { useTranslation } from '../contexts/I18nContext'
import { useToast } from '../contexts/ToastContext'
import { Spinner } from './Spinner'
import { SandboxPreview } from './SandboxPreview'
const MarkdownRenderer = lazy(() =>
  import('./MarkdownRenderer').then((m) => ({ default: m.MarkdownRenderer })),
)
/** Suspense boundary wrapper so lazy MarkdownRenderer doesn't crash mid-tree (AC-16). */
function LazyMD({ content }: { content: string }) {
  return (
    <Suspense fallback={null}>
      <MarkdownRenderer content={content} />
    </Suspense>
  )
}
import { useSmoothStream } from '../hooks/useSmoothStream'
import { importText, openFile } from '../lib/tauri'
import { FileAttachments } from './FileAttachments'
import type { ImageAttachment } from '../lib/tauri'
import { fileKindFromName } from '../lib/fileKind'
import { dispatchJournalFileOpen } from '../lib/fileNavigation'
import clipboard from 'tauri-plugin-clipboard-api'
import { hostOpenDialog } from '../lib/hostBridge'
import { SlashCommandMenu } from './SlashCommandMenu'
import { AtMentionMenu } from './AtMentionMenu'

interface ImageAtt {
  media_type: string
  data: string
  preview: string
}
import { TOOL_ICON_PATHS } from './ToolIcons'

const CHAT_PANEL_HIGHLIGHT_RING =
  'inset 0 0 0 1px color-mix(in srgb, var(--record-btn) 22%, transparent)'
const CHAT_PANEL_DANGER_RING =
  'inset 0 0 0 1px color-mix(in srgb, var(--status-danger) 22%, transparent)'
const CHAT_PANEL_WARNING_RING =
  'inset 0 0 0 1px color-mix(in srgb, var(--status-warning) 22%, transparent)'
const LONG_TEXT_ATTACHMENT_THRESHOLD = 300

export interface ChatPanelProps {
  messages: ConversationMessage[]
  isStreaming: boolean
  usage: { input: number; output: number }
  stats: SessionStats | null
  pendingQueue: string[]
  sessionId?: string | null
  initialInput?: string
  onSend: (text: string, images?: ImageAttachment[]) => void
  onCancel: () => void
  onRetry: () => void
  onEditAndResend: (index: number, text: string) => void
  onRemovePendingItem: (index: number) => string | undefined
  onContinue: () => void
  historyControl?: ReactNode
}

export function ChatPanel({
  messages,
  isStreaming,
  usage,
  stats,
  pendingQueue,
  sessionId,
  initialInput,
  onSend,
  onCancel,
  onRetry,
  onEditAndResend,
  onRemovePendingItem,
  onContinue,
  historyControl,
}: ChatPanelProps) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const scrollRef = useRef<HTMLDivElement>(null)
  const userScrolledUp = useRef(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  // Input bar state
  const [inputValue, setInputValue] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [imageAttachments, setImageAttachments] = useState<ImageAtt[]>([])
  const [focused, setFocused] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [slashOpen, setSlashOpen] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const [atOpen, setAtOpen] = useState(false)
  const [atQuery, setAtQuery] = useState('')
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

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
    const sel = document.getSelection()
    if (sel && sel.type === 'Range') return
    const el = scrollRef.current
    if (el && !userScrolledUp.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages])

  // Client-side elapsed timer for streaming display
  useEffect(() => {
    if (!isStreaming) return
    setElapsed(0)
    const start = Date.now()
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [isStreaming])

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      userScrolledUp.current = false
      setShowScrollBtn(false)
    }
  }, [])

  const lastConsumedRef = useRef<string | undefined>(undefined)

  // Listen for chat-append-text custom events — any component can append @path to current input
  useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as CustomEvent<string>).detail
      if (!text) return
      setInputValue((prev) => {
        const trimmed = prev.trimEnd()
        return trimmed ? `${trimmed} ${text}` : text
      })
      setTimeout(() => {
        const el = inputRef.current
        if (el) {
          el.focus()
          el.setSelectionRange(el.value.length, el.value.length)
        }
      }, 50)
    }
    window.addEventListener('chat-append-text', handler)
    return () => window.removeEventListener('chat-append-text', handler)
  }, [])

  // Sync external initialInput into the textarea — only when it changes to a new value
  useEffect(() => {
    if (initialInput && initialInput !== lastConsumedRef.current) {
      lastConsumedRef.current = initialInput
      setInputValue(initialInput)
      setTimeout(() => {
        const el = inputRef.current
        if (el) {
          el.focus()
          el.setSelectionRange(el.value.length, el.value.length)
          el.style.height = 'auto'
          el.style.height = Math.min(el.scrollHeight, 160) + 'px'
        }
      }, 0)
    }
  }, [initialInput])

  // Auto-focus on mount and session change — skip if user has text selected
  useEffect(() => {
    const sel = document.getSelection()
    if (sel && sel.type === 'Range') return
    inputRef.current?.focus()
  }, [sessionId])

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 160) + 'px'
    }
  }, [inputValue])

  const addFiles = useCallback((paths: string[]) => {
    const newAtts: Attachment[] = paths.map((p) => {
      const filename = p.split('/').pop() ?? p
      const kind = fileKindFromName(filename)
      return { path: p, filename, kind }
    })
    setAttachments((prev) => [...prev, ...newAtts])
  }, [])

  const removeAttachment = useCallback((path: string) => {
    setAttachments((prev) => prev.filter((a) => a.path !== path))
  }, [])

  const removeImage = useCallback((idx: number) => {
    setImageAttachments((prev) => prev.filter((_, i) => i !== idx))
  }, [])

  const handleSend = useCallback(() => {
    const text = inputValue.trim()
    if (!text && attachments.length === 0 && imageAttachments.length === 0) return
    const fileRefs = attachments.map((a) => `@${a.path}`).join('\n')
    const parts = [fileRefs, text].filter(Boolean)
    const payload = parts.join('\n\n')
    const imgs =
      imageAttachments.length > 0
        ? imageAttachments.map(({ media_type, data }) => ({ media_type, data }))
        : undefined
    setInputValue('')
    setAttachments([])
    setImageAttachments([])
    onSend(payload || '请看图片', imgs)
  }, [inputValue, attachments, imageAttachments, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((slashOpen || atOpen) && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) return
      if (atOpen && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return
      if (e.key === 'Enter' && !e.shiftKey && !slashOpen && !atOpen) {
        e.preventDefault()
        handleSend()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        if (isStreaming) {
          onCancel()
        } else {
          setInputValue('')
          setAttachments([])
          setImageAttachments([])
        }
      }
    },
    [handleSend, isStreaming, onCancel, slashOpen, atOpen],
  )

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInputValue(val)

    // Slash command detection: starts with / and no space yet
    if (val.startsWith('/') && !val.includes(' ') && val.length > 0) {
      setSlashOpen(true)
      setSlashQuery(val.slice(1))
      setAtOpen(false)
    } else {
      setSlashOpen(false)
    }

    // @ mention detection: only trigger when @ appears at start or after whitespace
    const cursorPos = e.target.selectionStart ?? val.length
    const textBeforeCursor = val.slice(0, cursorPos)
    const lastAt = textBeforeCursor.lastIndexOf('@')
    if (
      lastAt >= 0 &&
      (lastAt === 0 || /\s/.test(textBeforeCursor[lastAt - 1])) &&
      !textBeforeCursor.slice(lastAt).includes(' ')
    ) {
      setAtOpen(true)
      setAtQuery(textBeforeCursor.slice(lastAt + 1))
      setSlashOpen(false)
    } else {
      setAtOpen(false)
      setAtQuery('')
    }
  }, [])

  const handleSlashSelect = useCallback((skillName: string) => {
    setSlashOpen(false)
    setInputValue(`/${skillName} `)
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [])

  // Listen for skill-slash-invoke from SkillsWorkbench "/" button
  useEffect(() => {
    const handler = (e: Event) => {
      const { name } = (e as CustomEvent).detail
      setInputValue(`/${name}`)
      setSlashOpen(true)
      setSlashQuery(name)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
    window.addEventListener('skill-slash-invoke', handler)
    return () => window.removeEventListener('skill-slash-invoke', handler)
  }, [])

  const handleAtSelect = useCallback(
    (path: string) => {
      setAtOpen(false)
      const el = inputRef.current
      const cursorPos = el?.selectionStart ?? inputValue.length
      const textBeforeCursor = inputValue.slice(0, cursorPos)
      const lastAt = textBeforeCursor.lastIndexOf('@')
      if (lastAt >= 0) {
        const before = inputValue.slice(0, lastAt)
        const after = inputValue.slice(cursorPos)
        setInputValue(`${before}@${path} ${after}`)
      } else {
        setInputValue(inputValue + `@${path} `)
      }
      setTimeout(() => {
        const sel = document.getSelection()
        if (sel && sel.type === 'Range') return
        inputRef.current?.focus()
      }, 0)
    },
    [inputValue],
  )

  const handleAddFile = useCallback(async () => {
    const selected = await hostOpenDialog({ multiple: true })
    if (selected) {
      const paths = Array.isArray(selected) ? selected : [selected]
      addFiles(paths.filter((p): p is string => typeof p === 'string'))
    }
  }, [addFiles])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        addFiles(files.map((f) => (f as File & { path?: string }).path ?? f.name))
      }
    },
    [addFiles],
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (items) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          if (item.type.startsWith('image/')) {
            e.preventDefault()
            const blob = item.getAsFile()
            if (!blob) return
            const reader = new FileReader()
            reader.onload = () => {
              const dataUrl = reader.result as string
              const [header, b64] = dataUrl.split(',')
              const mediaType = header.match(/data:(.*?);/)?.[1] ?? 'image/png'
              setImageAttachments((prev) => [
                ...prev,
                { media_type: mediaType, data: b64, preview: dataUrl },
              ])
            }
            reader.readAsDataURL(blob)
            return
          }
        }
      }

      const rawText =
        e.clipboardData?.getData('text/plain') || e.clipboardData?.getData('text') || ''
      if (rawText.length > LONG_TEXT_ATTACHMENT_THRESHOLD) {
        e.preventDefault()
        const importPastedText = () =>
          importText(rawText)
            .then((result) => addFiles([result.path]))
            .catch((err) => {
              console.error('[paste-import]', err)
              showToast('warning', t('submitFailed'))
            })

        clipboard
          .readFiles()
          .then((files) => {
            if (files && files.length > 0) {
              addFiles(files)
            } else {
              importPastedText()
            }
          })
          .catch(() => {
            importPastedText()
          })
        return
      }

      clipboard
        .readFiles()
        .then((files) => {
          if (files && files.length > 0) {
            e.preventDefault()
            addFiles(files)
          }
        })
        .catch(() => {})
    },
    [addFiles, showToast, t],
  )

  const canSend =
    inputValue.trim().length > 0 || attachments.length > 0 || imageAttachments.length > 0

  return (
    <>
      {/* History control — anchored to top-left of the chat area */}
      {historyControl}
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
              {t('conversationAgent')}
            </span>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--item-meta)',
                opacity: 0.3,
              }}
            >
              {t('conversationAgentHint')}
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
                  onEditAndResend={onEditAndResend}
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
                  onRetry={onRetry}
                  onContinue={onContinue}
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
          (stats.elapsed_secs > 0 || stats.total_input_tokens + stats.total_output_tokens > 0) ? (
          <SessionStatsLine
            stats={stats}
            lastContent={(() => {
              for (let j = messages.length - 1; j >= 0; j--) {
                const m = messages[j]
                if (m.role === 'assistant') {
                  const textBlock = m.blocks?.filter((b) => b.type === 'text').pop()
                  if (textBlock?.type === 'text' && textBlock.content) return textBlock.content
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
        <div style={{ padding: '0 24px 6px', display: 'flex', flexDirection: 'column', gap: 4 }}>
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
                  const removed = onRemovePendingItem(i)
                  if (removed) {
                    setInputValue((prev) => (prev ? prev + '\n' + removed : removed))
                  }
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
                  borderRadius: '8px 8px 2px 8px',
                  background: 'var(--chat-user-bg)',
                  color: 'var(--chat-user-text)',
                  border: '0.5px solid var(--chat-user-border)',
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

      {/* Input bar */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{ padding: '8px 24px 12px', flexShrink: 0, position: 'relative' }}
      >
        {slashOpen && (
          <SlashCommandMenu
            query={slashQuery}
            onSelect={handleSlashSelect}
            onClose={() => setSlashOpen(false)}
          />
        )}

        {atOpen && (
          <AtMentionMenu
            query={atQuery}
            onSelect={handleAtSelect}
            onClose={() => {
              setAtOpen(false)
              setAtQuery('')
            }}
          />
        )}

        {/* Fused container */}
        <div
          style={{
            border: dragOver
              ? '1.5px dashed var(--record-btn)'
              : focused
                ? '1px solid var(--record-btn)'
                : '1px solid var(--dialog-inset-border)',
            borderRadius: 12,
            background: dragOver ? 'var(--item-hover-bg)' : 'var(--detail-case-bg)',
            backgroundClip: 'padding-box',
            boxShadow: focused || dragOver ? CHAT_PANEL_HIGHLIGHT_RING : 'none',
            padding: '8px 12px 4px',
            transition:
              'border-color 0.15s ease-out, background 0.15s ease-out, box-shadow 0.15s ease-out',
            overflow: 'hidden',
          }}
        >
          {dragOver && (
            <div
              style={{
                textAlign: 'center',
                fontSize: 11,
                color: 'var(--record-btn)',
                opacity: 0.6,
                padding: '4px 0',
              }}
            >
              {t('dropToAddFiles')}
            </div>
          )}

          {/* Attachment chips */}
          {attachments.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 6 }}>
              {attachments.map((att) => (
                <div
                  key={att.path}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'var(--queue-bg)',
                    border: '0.5px solid var(--queue-border)',
                    borderRadius: 6,
                    padding: '3px 8px',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--item-text)',
                  }}
                >
                  <span
                    onClick={() =>
                      openFile(att.path).catch(() => showToast('warning', t('openFileFailed')))
                    }
                    style={{
                      maxWidth: 120,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                    }}
                    title={att.path}
                  >
                    {att.filename}
                  </span>
                  <span
                    onClick={() => removeAttachment(att.path)}
                    style={{
                      color: 'var(--item-meta)',
                      cursor: 'pointer',
                      marginLeft: 2,
                    }}
                  >
                    ×
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Image thumbnails */}
          {imageAttachments.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 6 }}>
              {imageAttachments.map((img, idx) => (
                <div
                  key={idx}
                  style={{
                    position: 'relative',
                    width: 44,
                    height: 44,
                    borderRadius: 6,
                    overflow: 'hidden',
                    border: '0.5px solid var(--queue-border)',
                  }}
                >
                  <img
                    src={img.preview}
                    alt=""
                    onClick={() => setPreviewSrc(img.preview)}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      cursor: 'pointer',
                    }}
                  />
                  <span
                    onClick={() => removeImage(idx)}
                    style={{
                      position: 'absolute',
                      top: 1,
                      right: 1,
                      background: 'rgba(0,0,0,0.5)',
                      color: '#fff',
                      borderRadius: '50%',
                      width: 14,
                      height: 14,
                      fontSize: 10,
                      lineHeight: '14px',
                      textAlign: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    ×
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Full-width textarea */}
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={t('conversationInputPlaceholder')}
            rows={1}
            style={{
              display: 'block',
              width: '100%',
              resize: 'none',
              border: 'none',
              borderRadius: 0,
              padding: '4px 0',
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-body)',
              background: 'transparent',
              color: 'var(--item-text)',
              outline: 'none',
              lineHeight: 1.5,
              maxHeight: 160,
              overflow: 'auto',
            }}
          />

          {/* Toolbar row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 0',
            }}
          >
            <button
              onClick={handleAddFile}
              style={{
                background: 'none',
                border: 'none',
                color: dragOver ? 'var(--record-btn)' : 'var(--item-meta)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.15s ease-out',
              }}
              title={t('addFile')}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {isStreaming && (
                <button
                  onClick={onCancel}
                  style={{
                    background: 'none',
                    border: '0.5px solid var(--queue-border)',
                    borderRadius: 6,
                    padding: '4px 10px',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--status-danger)',
                    cursor: 'pointer',
                  }}
                >
                  {t('conversationStop')}
                </button>
              )}

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={!canSend}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: canSend ? 'pointer' : 'default',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: canSend ? 1 : 0.3,
                  color: canSend ? 'var(--record-btn)' : 'var(--item-meta)',
                  transition: 'opacity 200ms ease-out, color 150ms ease-out',
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
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Image lightbox */}
        {previewSrc && (
          <div
            onClick={() => setPreviewSrc(null)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(0,0,0,0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'zoom-out',
            }}
          >
            <img
              src={previewSrc}
              alt=""
              style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 8 }}
            />
          </div>
        )}
      </div>
    </>
  )
}

const MessageBubble = memo(function MessageBubble({
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
              borderRadius: '8px 8px 2px 8px',
              background: 'var(--chat-user-bg)',
              color: 'var(--chat-user-text)',
              fontSize: 'var(--text-sm)',
              lineHeight: 1.6,
              border: '1px solid var(--record-btn)',
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
                color: 'var(--record-btn-icon)',
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
            borderRadius: '8px 8px 2px 8px',
            background: 'var(--chat-user-bg)',
            color: 'var(--chat-user-text)',
            border: '0.5px solid var(--chat-user-border)',
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
})

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
              onClick={() => dispatchJournalFileOpen(path)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 4,
                background: 'var(--chat-user-chip-bg)',
                border: '0.5px solid var(--chat-user-border)',
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

const AssistantRun = memo(function AssistantRun({
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
            <LazyMD content={lastTextBlock.content} />
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
})

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
        border: `1px solid ${borderColor}`,
        background: 'var(--dialog-inset-bg)',
        backgroundClip: 'padding-box',
        boxShadow: isAuth ? CHAT_PANEL_DANGER_RING : CHAT_PANEL_HIGHLIGHT_RING,
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
        border: '1px solid color-mix(in srgb, var(--status-warning) 30%, transparent)',
        background: 'var(--status-warning-bg)',
        backgroundClip: 'padding-box',
        boxShadow: CHAT_PANEL_WARNING_RING,
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
      <LazyMD content={smoothed} />
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
          <LazyMD content={block.content} />
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
    case 'artifact':
      return <ArtifactBlock artifact={block} streaming={streaming} />
    default:
      return null
  }
}

const ArtifactBlock = memo(function ArtifactBlock({
  artifact,
  streaming,
}: {
  artifact: { artifactType: string; title: string; content: string; isStreaming: boolean }
  streaming?: boolean
}) {
  const [expanded, setExpanded] = useState(true)
  const { t } = useTranslation()

  const isStreaming = artifact.isStreaming || streaming

  // Only html artifacts get sandbox preview; others render as code
  if (artifact.artifactType !== 'html') {
    return (
      <div
        style={{
          margin: '8px 0',
          borderRadius: 8,
          border: '1px solid var(--divider)',
          overflow: 'hidden',
        }}
      >
        <div
          onClick={() => setExpanded(!expanded)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            cursor: 'pointer',
            userSelect: 'none',
            fontSize: 'var(--text-xs)',
            color: 'var(--item-meta)',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span style={{ fontWeight: 500 }}>{artifact.title || 'Artifact'}</span>
          <span style={{ opacity: 0.5 }}>{artifact.artifactType}</span>
          {isStreaming && <Spinner size={10} />}
          <span style={{ marginLeft: 'auto', opacity: 0.4 }}>{expanded ? '▾' : '▸'}</span>
        </div>
        {expanded && (
          <pre
            style={{
              margin: 0,
              padding: '12px',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              maxHeight: 300,
              overflow: 'auto',
              borderTop: '1px solid var(--divider)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            <code>{artifact.content || ' '}</code>
          </pre>
        )}
      </div>
    )
  }

  return (
    <div
      style={{
        margin: '8px 0',
        borderRadius: 8,
        border: '1px solid var(--divider)',
        overflow: 'hidden',
      }}
    >
      {/* Header bar */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          cursor: 'pointer',
          userSelect: 'none',
          fontSize: 'var(--text-xs)',
          color: 'var(--item-meta)',
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
        <span style={{ fontWeight: 500 }}>{artifact.title || t('artifact_preview')}</span>
        {isStreaming && <Spinner size={10} />}
        <span style={{ marginLeft: 'auto', opacity: 0.4 }}>{expanded ? '▾' : '▸'}</span>
      </div>

      {/* Preview body */}
      {expanded && (
        <div
          style={{
            minHeight: 150,
            maxHeight: 400,
            overflow: 'auto',
            borderTop: '1px solid var(--divider)',
          }}
        >
          {artifact.content ? (
            <SandboxPreview html={artifact.content} title={artifact.title} />
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 150,
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-xs)',
              }}
            >
              <Spinner size={16} />
            </div>
          )}
        </div>
      )}
    </div>
  )
})

const ToolBlock = memo(function ToolBlock({
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
})

function SubtaskBlock({
  subtask,
}: {
  subtask: {
    toolUseId: string
    prompt: string
    summary?: string
    isError?: boolean
    isRunning?: boolean
    tools?: { name: string; label: string; output?: string; isError?: boolean }[]
  }
}) {
  const [expanded, setExpanded] = useState(false)
  const promptPreview =
    subtask.prompt.slice(0, 60).replace(/\n/g, ' ') + (subtask.prompt.length > 60 ? '…' : '')

  // Aggregate tool counts for header
  const toolCounts = new Map<string, number>()
  if (subtask.tools) {
    for (const t of subtask.tools) {
      toolCounts.set(t.name, (toolCounts.get(t.name) ?? 0) + 1)
    }
  }
  const totalTools = subtask.tools?.length ?? 0

  return (
    <div
      style={{
        maxWidth: '100%',
        fontSize: 'var(--text-xs)',
        fontFamily: 'var(--font-mono)',
        userSelect: 'none',
      }}
    >
      {/* Header — same level as other tool blocks */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          color: subtask.isError ? 'var(--status-danger)' : 'var(--item-meta)',
        }}
      >
        {subtask.isRunning ? (
          <Spinner size={11} borderWidth={1.5} />
        ) : subtask.isError ? (
          <svg
            style={{ width: 11, height: 11, flexShrink: 0 }}
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
          <ToolIcon name="subtask" />
        )}
        <span style={{ opacity: 0.4, flexShrink: 0 }}>
          {subtask.isRunning
            ? 'task 运行中'
            : totalTools > 0
              ? `task, ${totalTools} tool${totalTools !== 1 ? 's' : ''}`
              : 'task'}
        </span>
        {[...toolCounts.entries()].map(([tool, count], i) => (
          <span
            key={i}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 1, opacity: 0.5 }}
          >
            <ToolIcon name={tool} />
            {count > 1 && <span style={{ fontSize: '0.6rem' }}>×{count}</span>}
          </span>
        ))}
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
      {/* Prompt preview (collapsed) */}
      {!expanded && (
        <div
          style={{
            marginTop: 2,
            paddingLeft: 17,
            color: 'var(--item-meta)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 'var(--text-xs)',
          }}
        >
          {promptPreview}
        </div>
      )}
      {/* Expanded: nested content with left border */}
      {expanded && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            marginTop: 4,
            marginLeft: 5,
            borderLeft: '1.5px solid var(--queue-border)',
            paddingLeft: 12,
            userSelect: 'text',
            cursor: 'auto',
          }}
        >
          <div
            style={{
              fontSize: 'var(--text-xs)',
              marginBottom: 4,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: 'var(--item-meta)',
            }}
          >
            {subtask.prompt}
          </div>
          {subtask.tools && subtask.tools.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 4 }}>
              {subtask.tools.map((tool, i) => (
                <ToolBlock key={i} tool={tool} />
              ))}
            </div>
          )}
          {subtask.summary && (
            <div
              style={{
                opacity: 0.8,
                maxHeight: 400,
                overflow: 'auto',
                wordBreak: 'break-word',
                lineHeight: 1.55,
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-body)',
              }}
            >
              <LazyMD content={subtask.summary} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const WebSearchBlock = memo(function WebSearchBlock({
  query,
  results,
}: {
  query: string
  results: WebSearchResultItem[]
}) {
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
})

const ThinkingBlock = memo(function ThinkingBlock({ thinking }: { thinking: string }) {
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
})
