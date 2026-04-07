import { useState, useEffect } from 'react'
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

const kindEmoji: Record<string, string> = {
  audio: '\uD83C\uDFA4',
  text: '\uD83D\uDCC4',
  markdown: '\uD83D\uDCDD',
  pdf: '\uD83D\uDCC4',
  docx: '\uD83D\uDCC4',
  image: '\uD83D\uDDBC\uFE0F',
  other: '\uD83D\uDCC1',
}

function AudioWaveform({ level }: { level: number }) {
  // 9 bars with symmetric envelope — tallest in the center
  const envelope = Array.from({ length: 64 }, (_, i) => {
    const x = (i / 63) * Math.PI
    return 0.15 + 0.85 * Math.sin(x)
  })
  const minH = 3
  const maxH = 22
  const clampedLevel = Math.min(1, Math.max(0, level))

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2.5,
      height: maxH,
      flex: 1,
    }}>
      {envelope.map((scale, i) => {
        const h = minH + (maxH - minH) * clampedLevel * scale
        return (
          <span
            key={i}
            style={{
              width: 3,
              height: h,
              borderRadius: 2,
              background: 'var(--record-btn)',
              opacity: 0.9,
              transition: 'transform 0.08s cubic-bezier(0.16, 1, 0.3, 1)',
              flexShrink: 0,
            }}
          />
        )
      })}
    </span>
  )
}

function formatElapsed(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function StatusIndicator({ item, onDismiss, onRetry }: { item: QueueItem; onDismiss: () => void; onRetry: () => void }) {
  const { t } = useTranslation()
  if (item.status === 'converting') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--item-meta)', fontSize: 'var(--text-xs)', opacity: 0.8 }}>
        <Spinner size={10} borderWidth={1.5} />
        {t('converting')}
      </span>
    )
  }
  if (item.status === 'queued') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--item-meta)', fontSize: 'var(--text-xs)', opacity: 0.7 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--item-meta)', opacity: 0.4 }} />
        {t('queued')}
      </span>
    )
  }
  if (item.status === 'processing') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ai-pill-active-text)', fontSize: 'var(--text-xs)', opacity: 0.8 }}>
        <Spinner size={10} borderWidth={1.5} />
        {t('processingItem')}
      </span>
    )
  }
  if (item.status === 'failed') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ color: '#ff453a', fontSize: 'var(--text-xs)' }}>{t('failed')}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onRetry() }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '0 3px',
            color: 'var(--item-meta)', fontSize: 'var(--text-xs)', lineHeight: 1,
          }}
          title={t('retryTooltip')}
        >
          {t('retryLabel')}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss() }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px',
            color: 'var(--item-meta)', fontSize: 'var(--text-sm)', lineHeight: 1,
          }}
          title={t('closeTooltip')}
        >
          ×
        </button>
      </span>
    )
  }
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ai-pill-text)', fontSize: 'var(--text-xs)', opacity: 0.7 }}>
      <span style={{ fontSize: 'var(--text-sm)' }}>✓</span>
      {t('done')}
    </span>
  )
}

export function ProcessingQueue({ items, onDismiss, onCancel, onRetry, activeLogPath, onSetActiveLogPath }: ProcessingQueueProps) {
  const { t } = useTranslation()
  const [confirmingPath, setConfirmingPath] = useState<string | null>(null)

  useEffect(() => {
    if (confirmingPath && !items.some(i => i.path === confirmingPath)) {
      setConfirmingPath(null)
    }
  }, [items, confirmingPath])

  if (items.length === 0) return null

  const activeItem = activeLogPath ? items.find(i => i.path === activeLogPath) : null

  return (
    <>
      <div style={{
        background: 'var(--queue-bg)',
        borderTop: '1px solid var(--queue-border)',
        borderRadius: '8px 8px 0 0',
        maxHeight: 160,
        overflowY: 'auto',
        boxShadow: '0 -2px 12px var(--queue-shadow)',
      }}>
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1

          // ── Recording row ──────────────────────────────────
          if (item.status === 'recording') {
            return (
              <div
                key={item.path}
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
                <span style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--record-btn)',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  <span style={{
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: 'var(--record-btn)',
                    flexShrink: 0,
                    animation: 'ai-breathe 1.2s ease-in-out infinite',
                  }} />
                  {t('recordingStatus')}
                </span>
                {/* Real-time audio waveform — centered, dominant */}
                <AudioWaveform level={(item.audioLevel ?? 0) * 6} />
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--record-btn)',
                  flexShrink: 0,
                }}>
                  {formatElapsed(item.elapsedSecs ?? 0)}
                </span>
              </div>
            )
          }

          // ── Normal queue row ───────────────────────────────
          const emoji = kindEmoji[fileKindFromName(item.filename)] ?? '\uD83D\uDCC1'
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
              onClick={isClickable && !isConfirming ? () => onSetActiveLogPath(item.path) : undefined}
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
              <span style={{ fontSize: 'var(--text-sm)', flexShrink: 0, opacity: 0.7 }}>{emoji}</span>
              <span style={{
                flex: 1,
                fontSize: 'var(--text-xs)',
                color: item.status === 'failed' ? '#ff453a' : 'var(--item-meta)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 0,
              }}>
                {item.filename}
              </span>

              {isConfirming ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--item-meta)', opacity: 0.7 }}>{t('confirmCancel')}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmingPath(null); onCancel(item) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 3px', fontSize: 'var(--text-xs)', color: '#ff453a' }}
                  >
                    {t('confirm')}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmingPath(null) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 3px', fontSize: 'var(--text-xs)', color: 'var(--item-meta)', opacity: 0.6 }}
                  >
                    {t('back')}
                  </button>
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <StatusIndicator item={item} onDismiss={() => onDismiss(item.path)} onRetry={() => onRetry(item)} />
                  {isCancellable && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmingPath(item.path) }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px',
                        color: 'var(--item-meta)', fontSize: 'var(--text-sm)', lineHeight: 1, flexShrink: 0,
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
