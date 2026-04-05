import { useEffect, useRef, useState, useCallback } from 'react'
import type { QueueItem } from '../types'
import { Spinner } from './Spinner'
import { useTranslation } from '../contexts/I18nContext'

const ANIM_DURATION = 180

interface AiLogModalProps {
  item: QueueItem
  onClose: () => void
  onCancel: () => void
}

export function AiLogModal({ item, onClose, onCancel }: AiLogModalProps) {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [closing, setClosing] = useState(false)

  const handleClose = useCallback(() => {
    setClosing(true)
    setTimeout(onClose, ANIM_DURATION)
  }, [onClose])

  // Auto-scroll to bottom as new lines arrive
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [item.logs])

  const isActive = item.status === 'processing' || item.status === 'queued'

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 100,
          animation: `${closing ? 'modal-backdrop-out' : 'modal-backdrop-in'} ${ANIM_DURATION}ms ease-out both`,
        }}
      />
      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 520,
          maxWidth: 'calc(100vw - 48px)',
          height: '70vh',
          background: 'var(--queue-bg)',
          border: '0.5px solid var(--queue-border)',
          borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          zIndex: 101,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: `${closing ? 'modal-panel-out' : 'modal-panel-in'} ${ANIM_DURATION}ms ease-out both`,
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 16px',
          borderBottom: '0.5px solid var(--queue-border)',
          flexShrink: 0,
          color: 'var(--item-meta)',
        }}>
          {isActive && <Spinner size={12} borderWidth={1.5} />}
          <span style={{ flex: 1, fontSize: 13, color: 'var(--item-meta)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.filename}
          </span>
          <span style={{
            fontSize: 11,
            color: item.status === 'failed' ? '#ff453a'
              : item.status === 'completed' ? 'var(--ai-pill-text)'
              : 'var(--ai-pill-active-text)',
            opacity: 0.8,
          }}>
            {item.status === 'failed' ? t('failedStatus')
              : item.status === 'completed' ? t('completedStatus')
              : null}
          </span>
          <button
            onClick={handleClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--item-meta)', fontSize: 16, lineHeight: 1, padding: '0 2px' }}
          >
            ×
          </button>
        </div>

        {/* Log lines */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '10px 16px',
            fontFamily: 'ui-monospace, "SF Mono", monospace',
            fontSize: 12,
            lineHeight: 1.6,
            color: 'var(--item-meta)',
          }}
        >
          {item.logs.length === 0 ? (
            item.error
              ? <span style={{ color: '#ff453a', whiteSpace: 'pre-wrap' }}>{item.error}</span>
              : <span style={{ opacity: 0.4 }}>{t('waitingOutput')}</span>
          ) : (
            item.logs.map((line, i) => (
              <div
                key={i}
                style={{
                  color: line.startsWith('[error]') ? '#ff453a' : 'var(--item-meta)',
                  whiteSpace: 'pre-wrap',
                  marginBottom: 1,
                }}
              >
                {line}
              </div>
            ))
          )}
        </div>

        {/* Footer — cancel button only when active */}
        {isActive && (
          <div style={{
            padding: '8px 16px',
            borderTop: '0.5px solid var(--queue-border)',
            display: 'flex',
            justifyContent: 'flex-end',
            flexShrink: 0,
          }}>
            <button
              onClick={() => {
                onCancel()
                handleClose()
              }}
              style={{
                background: 'none',
                border: '0.5px solid var(--queue-border)',
                borderRadius: 5,
                padding: '4px 12px',
                fontSize: 12,
                color: '#ff453a',
                cursor: 'pointer',
              }}
            >
              {t('stopProcessing')}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
