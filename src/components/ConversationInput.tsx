import { useState, useRef, useEffect, useCallback } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import clipboard from 'tauri-plugin-clipboard-api'
import { fileKindFromName } from '../lib/fileKind'
import { getTranscript, retryTranscription } from '../lib/tauri'
import { useTranslation } from '../contexts/I18nContext'
import { SlashCommandMenu } from './SlashCommandMenu'
import type { SlashCommand } from '../lib/slashCommands'
import { Spinner } from './Spinner'

type AttachmentStatus = 'ready' | 'transcribing' | 'transcribed'

interface Attachment {
  path: string
  filename: string
  kind: string
  status: AttachmentStatus
  transcriptText?: string
}

interface ConversationInputProps {
  onSend: (text: string) => void
  onCancel: () => void
  isStreaming: boolean
  placeholder?: string
  initialInput?: string
}

const AUDIO_EXTS = new Set(['m4a', 'wav', 'mp3', 'aac', 'ogg', 'flac'])

function isAudioFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return AUDIO_EXTS.has(ext)
}

export function ConversationInput({
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
  const [dragOver, setDragOver] = useState(false)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const pendingMessages = useRef<string[]>([])

  // Auto-focus
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 120) + 'px'
    }
  }, [input])

  // Transcribe audio attachments
  useEffect(() => {
    for (const att of attachments) {
      if (att.kind === 'audio' && att.status === 'ready') {
        setAttachments((prev) =>
          prev.map((a) => (a.path === att.path ? { ...a, status: 'transcribing' as const } : a)),
        )
        // Check for existing transcript, then trigger if needed
        getTranscript(att.path)
          .then((transcript) => {
            if (transcript?.status === 'completed' && transcript.text) {
              setAttachments((prev) =>
                prev.map((a) =>
                  a.path === att.path
                    ? { ...a, status: 'transcribed' as const, transcriptText: transcript.text }
                    : a,
                ),
              )
              flushPending()
            } else {
              retryTranscription(att.path).catch(() => {})
              // Poll for completion
              const interval = setInterval(async () => {
                try {
                  const t = await getTranscript(att.path)
                  if (t?.status === 'completed' && t.text) {
                    clearInterval(interval)
                    setAttachments((prev) =>
                      prev.map((a) =>
                        a.path === att.path
                          ? { ...a, status: 'transcribed' as const, transcriptText: t.text }
                          : a,
                      ),
                    )
                    flushPending()
                  }
                } catch {
                  /* ignore */
                }
              }, 2000)
              // Cleanup after 5 min
              setTimeout(() => clearInterval(interval), 300_000)
            }
          })
          .catch(() => {})
      }
    }
  }, [attachments.map((a) => `${a.path}:${a.status}`).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  const flushPending = useCallback(() => {
    // Check if all audio attachments are transcribed
    setAttachments((currentAtts) => {
      const allTranscribed = currentAtts
        .filter((a) => a.kind === 'audio')
        .every((a) => a.status === 'transcribed')
      if (allTranscribed && pendingMessages.current.length > 0) {
        const msgs = pendingMessages.current.splice(0)
        const transcripts = currentAtts
          .filter((a) => a.transcriptText)
          .map((a) => `[音频转写: ${a.filename}]\n${a.transcriptText}\n[/音频转写]`)
          .join('\n\n')
        const combined = transcripts ? `${transcripts}\n\n${msgs.join('\n\n')}` : msgs.join('\n\n')
        onSend(combined)
      }
      return currentAtts
    })
  }, [onSend])

  const addFiles = useCallback((paths: string[]) => {
    const newAtts: Attachment[] = paths.map((p) => {
      const filename = p.split('/').pop() ?? p
      const kind = isAudioFile(filename) ? 'audio' : fileKindFromName(filename)
      return { path: p, filename, kind, status: 'ready' as const }
    })
    setAttachments((prev) => [...prev, ...newAtts])
  }, [])

  const removeAttachment = useCallback(
    (path: string) => {
      setAttachments((prev) => {
        const updated = prev.filter((a) => a.path !== path)
        // If no more audio pending, flush any queued messages
        const hasTranscribing = updated.some(
          (a) => a.kind === 'audio' && a.status !== 'transcribed',
        )
        if (!hasTranscribing && pendingMessages.current.length > 0) {
          const msgs = pendingMessages.current.splice(0)
          msgs.forEach((m) => onSend(m))
        }
        return updated
      })
    },
    [onSend],
  )

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text) return
    setInput('')

    const hasTranscribing = attachments.some(
      (a) => a.kind === 'audio' && a.status !== 'transcribed',
    )

    if (hasTranscribing) {
      // Queue message for later
      pendingMessages.current.push(text)
      return
    }

    // Build message with any transcribed attachments
    const transcripts = attachments
      .filter((a) => a.transcriptText)
      .map((a) => `[音频转写: ${a.filename}]\n${a.transcriptText}\n[/音频转写]`)
      .join('\n\n')

    const nonAudioAtts = attachments.filter((a) => a.kind !== 'audio')
    const fileRefs = nonAudioAtts.map((a) => `[附件: ${a.filename}]`).join('\n')

    const parts = [transcripts, fileRefs, text].filter(Boolean)
    onSend(parts.join('\n\n'))
    setAttachments([])
  }, [input, attachments, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (slashOpen) return // Let SlashCommandMenu handle keys
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        if (isStreaming) onCancel()
      }
    },
    [handleSend, isStreaming, onCancel, slashOpen],
  )

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInput(val)
    if (val.startsWith('/') && !val.includes(' ') && val.length > 0) {
      setSlashOpen(true)
      setSlashQuery(val.slice(1))
    } else {
      setSlashOpen(false)
    }
  }, [])

  const handleSlashSelect = useCallback(
    (cmd: SlashCommand) => {
      setSlashOpen(false)
      setInput('')
      onSend(cmd.promptTemplate)
    },
    [onSend],
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
      // Try to read files from clipboard
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

      {/* Unified input container — #9 内凹质感 */}
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
                  background:
                    att.status === 'transcribed' ? 'var(--status-success-bg)' : 'var(--queue-bg)',
                  border:
                    att.status === 'transcribed'
                      ? '0.5px solid var(--status-success)'
                      : '0.5px solid var(--queue-border)',
                  borderRadius: 6,
                  padding: '3px 8px',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--item-text)',
                }}
              >
                {att.status === 'transcribing' && <Spinner size={10} borderWidth={1.5} />}
                {att.status === 'transcribed' && (
                  <span style={{ color: 'var(--status-success)', fontSize: 'var(--text-xs)' }}>
                    ✓
                  </span>
                )}
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
