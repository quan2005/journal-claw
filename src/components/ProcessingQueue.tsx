import { useState, useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import type { QueueItem } from '../types'
import { fileKindFromName } from '../lib/fileKind'
import { Spinner } from './Spinner'
import { AiLogModal } from './AiLogModal'
import { useTranslation } from '../contexts/I18nContext'

interface ProcessingQueueProps {
  items: QueueItem[]
  onDismiss: (path: string) => void
  onCancel: (item: QueueItem) => void
  onRetry: (item: QueueItem) => void
  activeLogPath: string | null
  onSetActiveLogPath: (path: string | null) => void
}

function KindIcon({ kind }: { kind: string }) {
  const s = { width: 13, height: 13, flexShrink: 0 as const, opacity: 0.55 }
  const stroke = 'var(--item-meta)'
  if (kind === 'audio')
    return (
      <svg
        {...s}
        viewBox="0 0 24 24"
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
      </svg>
    )
  if (kind === 'image')
    return (
      <svg
        {...s}
        viewBox="0 0 24 24"
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    )
  return (
    <svg
      {...s}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}

const ENVELOPE = Array.from({ length: 64 }, (_, i) => {
  const x = (i / 63) * Math.PI
  return 0.15 + 0.85 * Math.sin(x)
})
const MIN_H = 3
const MAX_H = 22

/** Listens to audio-level events directly and updates bars via DOM refs — zero React re-renders. */
function AudioWaveform() {
  const barsRef = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(() => {
    let unlisten: (() => void) | undefined
    listen<number>('audio-level', (event) => {
      const level = Math.min(1, Math.max(0, event.payload * 6))
      for (let i = 0; i < ENVELOPE.length; i++) {
        const bar = barsRef.current[i]
        if (bar) bar.style.height = `${MIN_H + (MAX_H - MIN_H) * level * ENVELOPE[i]}px`
      }
    }).then((fn) => {
      unlisten = fn
    })
    return () => {
      unlisten?.()
    }
  }, [])

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2.5,
        height: MAX_H,
        flex: 1,
      }}
    >
      {ENVELOPE.map((_, i) => (
        <span
          key={i}
          ref={(el) => {
            barsRef.current[i] = el
          }}
          style={{
            width: 3,
            height: MIN_H,
            borderRadius: 2,
            background: 'var(--record-btn)',
            opacity: 0.9,
            transition: 'height 0.08s cubic-bezier(0.16, 1, 0.3, 1)',
            flexShrink: 0,
          }}
        />
      ))}
    </span>
  )
}

function formatElapsed(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Self-contained recording row — manages its own elapsed timer via ref + DOM. */
function RecordingRow({ item, isLast }: { item: QueueItem; isLast: boolean }) {
  const { t } = useTranslation()
  const timerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const start = Date.now() - (item.elapsedSecs ?? 0) * 1000
    const fmt = (secs: number) => {
      const m = Math.floor(secs / 60)
      const s = secs % 60
      return `${m}:${String(s).padStart(2, '0')}`
    }
    const id = setInterval(() => {
      if (timerRef.current)
        timerRef.current.textContent = fmt(Math.floor((Date.now() - start) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [item.elapsedSecs])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: 36,
        padding: '0 20px',
        borderBottom: isLast ? 'none' : '0.5px solid var(--queue-border)',
        animation: 'queue-enter 0.2s ease-out',
      }}
    >
      <span
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--record-btn)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span
          style={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: 'var(--record-btn)',
            flexShrink: 0,
            animation: 'ai-breathe 1.2s ease-in-out infinite',
          }}
        />
        {t('recordingStatus')}
      </span>
      <AudioWaveform />
      <span
        ref={timerRef}
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          color: 'var(--record-btn)',
          flexShrink: 0,
        }}
      >
        {formatElapsed(item.elapsedSecs ?? 0)}
      </span>
    </div>
  )
}

function StatusIndicator({
  item,
  onDismiss,
  onRetry,
}: {
  item: QueueItem
  onDismiss: () => void
  onRetry: () => void
}) {
  const { t } = useTranslation()
  if (item.status === 'converting') {
    return (
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          color: 'var(--item-meta)',
          fontSize: 'var(--text-xs)',
          opacity: 0.8,
        }}
      >
        <Spinner size={10} borderWidth={1.5} />
        {t('converting')}
      </span>
    )
  }
  if (item.status === 'queued') {
    return (
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          color: 'var(--item-meta)',
          fontSize: 'var(--text-xs)',
          opacity: 0.7,
        }}
      >
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: 'var(--item-meta)',
            opacity: 0.4,
          }}
        />
        {t('queued')}
      </span>
    )
  }
  if (item.status === 'processing') {
    return (
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          color: 'var(--ai-pill-active-text)',
          fontSize: 'var(--text-xs)',
          opacity: 0.8,
        }}
      >
        <Spinner size={10} borderWidth={1.5} />
        {t('processingItem')}
      </span>
    )
  }
  if (item.status === 'failed') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ color: 'var(--status-danger)', fontSize: 'var(--text-xs)' }}>
          {t('failed')}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRetry()
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0 3px',
            color: 'var(--item-meta)',
            fontSize: 'var(--text-xs)',
            lineHeight: 1,
          }}
          title={t('retryTooltip')}
        >
          {t('retryLabel')}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDismiss()
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0 2px',
            color: 'var(--item-meta)',
            fontSize: 'var(--text-sm)',
            lineHeight: 1,
          }}
          title={t('closeTooltip')}
        >
          ×
        </button>
      </span>
    )
  }
  return (
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        color: 'var(--ai-pill-text)',
        fontSize: 'var(--text-xs)',
        opacity: 0.7,
      }}
    >
      <span style={{ fontSize: 'var(--text-sm)' }}>✓</span>
      {t('done')}
    </span>
  )
}

export function ProcessingQueue({
  items,
  onDismiss,
  onCancel,
  onRetry,
  activeLogPath,
  onSetActiveLogPath,
}: ProcessingQueueProps) {
  const { t } = useTranslation()
  const [confirmingPath, setConfirmingPath] = useState<string | null>(null)

  useEffect(() => {
    if (confirmingPath && !items.some((i) => i.path === confirmingPath)) {
      setConfirmingPath(null)
    }
  }, [items, confirmingPath])

  if (items.length === 0) return null

  const activeItem = activeLogPath ? items.find((i) => i.path === activeLogPath) : null

  return (
    <>
      <div
        style={{
          background: 'var(--queue-bg)',
          borderTop: '1px solid var(--queue-border)',
          borderRadius: '8px 8px 0 0',
          maxHeight: 160,
          overflowY: 'auto',
          boxShadow: '0 -2px 12px var(--queue-shadow)',
        }}
      >
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1

          // ── Recording row ──────────────────────────────────
          if (item.status === 'recording') {
            return <RecordingRow key={item.path} item={item} isLast={isLast} />
          }

          // ── Normal queue row ───────────────────────────────
          const kind = fileKindFromName(item.filename)
          const animStyle: React.CSSProperties =
            item.status === 'completed'
              ? { animation: 'queue-fade-out 0.3s ease-out forwards' }
              : { animation: 'queue-enter 0.2s ease-out' }
          const isClickable = item.status === 'processing' || item.status === 'failed'
          const isCancellable = item.status === 'queued' || item.status === 'processing'
          const isConfirming = confirmingPath === item.path

          return (
            <div
              key={item.path}
              onClick={
                isClickable && !isConfirming ? () => onSetActiveLogPath(item.path) : undefined
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                height: 32,
                padding: '0 20px',
                borderBottom: isLast ? 'none' : '0.5px solid var(--queue-border)',
                cursor: isClickable && !isConfirming ? 'pointer' : 'default',
                ...animStyle,
              }}
            >
              <KindIcon kind={kind} />
              <span
                style={{
                  flex: 1,
                  fontSize: 'var(--text-xs)',
                  color: item.status === 'failed' ? 'var(--status-danger)' : 'var(--item-meta)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0,
                }}
              >
                {item.filename}
              </span>

              {isConfirming ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span
                    style={{ fontSize: 'var(--text-xs)', color: 'var(--item-meta)', opacity: 0.7 }}
                  >
                    {t('confirmCancel')}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmingPath(null)
                      onCancel(item)
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0 3px',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--status-danger)',
                    }}
                  >
                    {t('confirm')}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmingPath(null)
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0 3px',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--item-meta)',
                      opacity: 0.6,
                    }}
                  >
                    {t('back')}
                  </button>
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <StatusIndicator
                    item={item}
                    onDismiss={() => onDismiss(item.path)}
                    onRetry={() => onRetry(item)}
                  />
                  {isCancellable && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmingPath(item.path)
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0 2px',
                        color: 'var(--item-meta)',
                        fontSize: 'var(--text-sm)',
                        lineHeight: 1,
                        flexShrink: 0,
                        opacity: 0.4,
                      }}
                      title={t('cancelTooltip')}
                    >
                      ×
                    </button>
                  )}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {activeItem && activeItem.status !== 'recording' && (
        <AiLogModal
          item={activeItem}
          onClose={() => onSetActiveLogPath(null)}
          onCancel={() => {
            onCancel(activeItem)
            onSetActiveLogPath(null)
          }}
        />
      )}
    </>
  )
}
