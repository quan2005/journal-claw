import { useState, useRef, useEffect, useCallback } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import clipboard from 'tauri-plugin-clipboard-api'
import { fileKindFromName } from '../lib/fileKind'
import { useTranslation } from '../contexts/I18nContext'
import { SlashCommandMenu } from './SlashCommandMenu'
import { AtMentionMenu } from './AtMentionMenu'

interface Attachment {
  path: string
  filename: string
  kind: string
}

interface ConversationInputProps {
  sessionId?: string | null
  onSend: (text: string) => Promise<boolean>
  onCancel: () => void
  isStreaming: boolean
  placeholder?: string
  initialInput?: string
}

export function ConversationInput({
  sessionId,
  onSend,
  onCancel,
  isStreaming,
  placeholder,
  initialInput,
}: ConversationInputProps) {
  const { t } = useTranslation()
  const [input, setInput] = useState(initialInput ?? '')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [slashOpen, setSlashOpen] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const [atOpen, setAtOpen] = useState(false)
  const [atQuery, setAtQuery] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus on mount and session change
  useEffect(() => {
    inputRef.current?.focus()
  }, [sessionId])

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 120) + 'px'
    }
  }, [input])

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

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text) return
    const fileRefs = attachments.map((a) => `@${a.path}`).join('\n')
    const parts = [fileRefs, text].filter(Boolean)
    setInput('')
    setAttachments([])
    const success = await onSend(parts.join('\n\n'))
    if (!success) {
      setInput(text)
    }
  }, [input, attachments, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Only let menus handle navigation keys, not Enter (menus handle Enter via window listener)
      if ((slashOpen || atOpen) && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) return
      if (atOpen && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return
      if (e.key === 'Enter' && !e.shiftKey && !slashOpen && !atOpen) {
        e.preventDefault()
        handleSend()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        if (isStreaming) onCancel()
      }
    },
    [handleSend, isStreaming, onCancel, slashOpen, atOpen],
  )

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInput(val)

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
    setInput(`/${skillName} `)
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [])

  const handleAtSelect = useCallback(
    (path: string) => {
      setAtOpen(false)
      // Replace the @... portion with @path
      const el = inputRef.current
      const cursorPos = el?.selectionStart ?? input.length
      const textBeforeCursor = input.slice(0, cursorPos)
      const lastAt = textBeforeCursor.lastIndexOf('@')
      if (lastAt >= 0) {
        const before = input.slice(0, lastAt)
        const after = input.slice(cursorPos)
        setInput(`${before}@${path} ${after}`)
      } else {
        setInput(input + `@${path} `)
      }
      setTimeout(() => inputRef.current?.focus(), 0)
    },
    [input],
  )

  const handleAddFile = useCallback(async () => {
    const selected = await open({ multiple: true })
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
    [addFiles],
  )

  const hasAttachments = attachments.length > 0

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      style={{
        padding: '8px 16px 12px',
        flexShrink: 0,
        position: 'relative',
      }}
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

      {/* Unified input container */}
      <div
        style={{
          border: focused
            ? '0.5px solid var(--record-btn)'
            : '0.5px solid var(--dialog-inset-border)',
          borderRadius: 12,
          background: dragOver ? 'var(--item-hover-bg)' : 'var(--dialog-inset-bg)',
          overflow: 'hidden',
          transition:
            'border-color 0.15s ease-out, background 0.15s ease-out, box-shadow 0.15s ease-out',
          boxShadow: focused ? 'inset 0 1px 3px rgba(0,0,0,0.2)' : 'none',
        }}
      >
        {/* Attachments */}
        {hasAttachments && (
          <div
            style={{
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              padding: '8px 12px 0',
            }}
          >
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
                  style={{
                    maxWidth: 120,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {att.filename}
                </span>
                <span
                  onClick={() => removeAttachment(att.path)}
                  style={{
                    color: 'var(--item-meta)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-xs)',
                    marginLeft: 2,
                  }}
                >
                  ×
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={inputRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder ?? t('conversationInputPlaceholder')}
          rows={1}
          style={{
            display: 'block',
            width: '100%',
            resize: 'none',
            border: 'none',
            borderRadius: 0,
            padding: '10px 12px 4px',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-body)',
            background: 'transparent',
            color: 'var(--item-text)',
            outline: 'none',
            lineHeight: 1.5,
            maxHeight: 120,
            overflow: 'auto',
          }}
        />

        {/* Bottom toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 8px 6px',
          }}
        >
          <button
            onClick={handleAddFile}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--item-meta)',
              fontSize: 'var(--text-md)',
              cursor: 'pointer',
              padding: '2px 4px',
              lineHeight: 1,
              borderRadius: 4,
            }}
            title="Add file"
          >
            +
          </button>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
                  transition: 'border-color 0.15s ease-out',
                }}
              >
                {t('conversationStop')}
              </button>
            )}
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              style={{
                background: input.trim() ? 'var(--record-btn)' : 'var(--dialog-kbd-bg)',
                border: 'none',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 'var(--text-xs)',
                color: input.trim() ? 'var(--record-btn-icon)' : 'var(--item-meta)',
                cursor: input.trim() ? 'pointer' : 'default',
                transition: 'background 0.15s ease-out, color 0.15s ease-out',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {t('conversationSend')}
              <kbd
                style={{
                  fontSize: '0.5625rem',
                  opacity: 0.6,
                  fontFamily: 'var(--font-body)',
                }}
              >
                ↵
              </kbd>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
