import { useState, useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import type { QueueItem } from '../types'
import { fileKindFromName } from '../lib/fileKind'
import { Spinner } from './Spinner'
import { useTranslation } from '../contexts/I18nContext'

interface ProcessingQueueProps {
  items: QueueItem[]
  onDismiss: (id: string) => void
  onCancel: (item: QueueItem) => void
  onRetry: (item: QueueItem) => void
  onOpenConversation?: (item: QueueItem) => void
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

function StatusIndicator({
  item,
  phase,
  onDismiss,
  onRetry,
}: {
  item: QueueItem
  phase?: string
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
        {phase || t('processingItem')}
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
  onOpenConversation,
}: ProcessingQueueProps) {
  const { t } = useTranslation()
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [phases, setPhases] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    if (confirmingId && !items.some((i) => i.id === confirmingId)) {
      setConfirmingId(null)
    }
  }, [items, confirmingId])

  useEffect(() => {
    const unlisten = listen<{ material_path: string; level: string; message: string }>(
      'ai-log',
      (event) => {
        if (event.payload.level === 'phase') {
          setPhases((prev) => {
            const next = new Map(prev)
            next.set(event.payload.material_path, event.payload.message)
            return next
          })
        }
      },
    )
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [])

  useEffect(() => {
    const activePaths = new Set(items.filter((i) => i.status === 'processing').map((i) => i.path))
    setPhases((prev) => {
      let changed = false
      const next = new Map(prev)
      for (const key of next.keys()) {
        if (!activePaths.has(key)) {
          next.delete(key)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [items])

  if (items.length === 0) return null

  return (
    <div
      style={{
        background: 'var(--queue-bg)',
        borderTop: '0.5px solid var(--queue-border)',
        borderRadius: '8px 8px 0 0',
        maxHeight: 160,
        overflowY: 'auto',
        boxShadow: '0 -2px 12px var(--queue-shadow)',
      }}
    >
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1

        // ── Normal queue row ───────────────────────────────
        const kind = fileKindFromName(item.filename)
        const animStyle: React.CSSProperties =
          item.status === 'completed'
            ? { animation: 'queue-fade-out 0.3s ease-out forwards' }
            : { animation: 'queue-enter 0.2s ease-out' }
        const isClickable = item.status === 'processing' || item.status === 'failed'
        const isCancellable = item.status === 'queued' || item.status === 'processing'
        const isConfirming = confirmingId === item.id

        return (
          <div
            key={item.id}
            onClick={
              isClickable && !isConfirming && onOpenConversation
                ? () => onOpenConversation(item)
                : undefined
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
              {item.status === 'failed' && (item.structured_error || item.error) && (
                <span
                  style={{
                    marginLeft: 6,
                    opacity: 0.75,
                    fontWeight: 'normal',
                  }}
                >
                  —{' '}
                  {item.structured_error?.user_action ||
                    item.structured_error?.message ||
                    item.error}
                </span>
              )}
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
                    setConfirmingId(null)
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
                    setConfirmingId(null)
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
                  phase={phases.get(item.path)}
                  onDismiss={() => onDismiss(item.id)}
                  onRetry={() => onRetry(item)}
                />
                {isCancellable && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmingId(item.id)
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
  )
}
