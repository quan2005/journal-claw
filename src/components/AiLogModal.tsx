import { useEffect, useRef } from 'react'
import type { QueueItem } from '../types'
import { Spinner } from './Spinner'

interface AiLogModalProps {
  item: QueueItem
  onClose: () => void
  onCancel: () => void
}

export function AiLogModal({ item, onClose, onCancel }: AiLogModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

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
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 100,
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
          background: 'var(--queue-bg)',
          border: '0.5px solid var(--queue-border)',
          borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          zIndex: 101,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          maxHeight: '70vh',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 16px',
          borderBottom: '0.5px solid var(--queue-border)',
          flexShrink: 0,
        }}>
          {isActive && <Spinner size={12} borderWidth={1.5} />}
          <span style={{ flex: 1, fontSize: 11, color: 'var(--item-meta)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.filename}
          </span>
          <span style={{
            fontSize: 9,
            color: item.status === 'failed' ? '#ff453a'
              : item.status === 'completed' ? 'var(--ai-pill-text)'
              : 'var(--ai-pill-active-text)',
            opacity: 0.8,
          }}>
            {item.status === 'queued' ? '排队中'
              : item.status === 'processing' ? '处理中'
              : item.status === 'completed' ? '已完成'
              : '失败'}
          </span>
          <button
            onClick={onClose}
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
            fontSize: 10,
            lineHeight: 1.6,
            color: 'var(--item-meta)',
          }}
        >
          {item.logs.length === 0 ? (
            <span style={{ opacity: 0.4 }}>等待输出...</span>
          ) : (
            item.logs.map((line, i) => (
              <div
                key={i}
                style={{
                  color: line.startsWith('[error]') ? '#ff453a' : 'var(--item-meta)',
                  wordBreak: 'break-all',
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
              onClick={onCancel}
              style={{
                background: 'none',
                border: '0.5px solid var(--queue-border)',
                borderRadius: 5,
                padding: '4px 12px',
                fontSize: 10,
                color: '#ff453a',
                cursor: 'pointer',
              }}
            >
              停止处理
            </button>
          </div>
        )}
      </div>
    </>
  )
}
