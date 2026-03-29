import type { QueueItem } from '../types'
import { fileKindFromName } from '../lib/fileKind'
import { Spinner } from './Spinner'

interface ProcessingQueueProps {
  items: QueueItem[]
  onDismiss: (path: string) => void
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

function StatusIndicator({ item, onDismiss }: { item: QueueItem; onDismiss: () => void }) {
  if (item.status === 'queued') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--item-meta)', fontSize: 10 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--item-meta)', opacity: 0.5 }} />
        排队中
      </span>
    )
  }
  if (item.status === 'processing') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ai-pill-active-text)', fontSize: 10 }}>
        <Spinner size={10} borderWidth={1.5} />
        处理中
      </span>
    )
  }
  if (item.status === 'failed') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ color: '#ff453a', fontSize: 10 }}>失败</span>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss() }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px',
            color: 'var(--item-meta)', fontSize: 12, lineHeight: 1,
          }}
          title="关闭"
        >
          ×
        </button>
      </span>
    )
  }
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ai-pill-text)', fontSize: 10 }}>
      <span style={{ fontSize: 11 }}>✓</span>
      完成
    </span>
  )
}

export function ProcessingQueue({ items, onDismiss }: ProcessingQueueProps) {
  if (items.length === 0) return null

  return (
    <div style={{
      background: 'var(--queue-bg)',
      borderTop: '1px solid var(--queue-border)',
      borderRadius: '8px 8px 0 0',
      maxHeight: 180,
      overflowY: 'auto',
      boxShadow: '0 -2px 12px var(--queue-shadow)',
    }}>
      {items.map((item, idx) => {
        const emoji = kindEmoji[fileKindFromName(item.filename)] ?? '\uD83D\uDCC1'
        const isLast = idx === items.length - 1
        const animStyle: React.CSSProperties =
          item.status === 'completed'
            ? { animation: 'queue-fade-out 0.3s ease-out forwards' }
            : { animation: 'queue-enter 0.2s ease-out' }

        return (
          <div
            key={item.path}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              height: 36,
              padding: '0 20px',
              borderBottom: isLast ? 'none' : '0.5px solid var(--queue-border)',
              ...animStyle,
            }}
          >
            <span style={{ fontSize: 13, flexShrink: 0 }}>{emoji}</span>
            <span style={{
              flex: 1,
              fontSize: 11,
              color: item.status === 'failed' ? '#ff453a' : 'var(--item-text)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
            }}>
              {item.filename}
            </span>
            <StatusIndicator item={item} onDismiss={() => onDismiss(item.path)} />
          </div>
        )
      })}
    </div>
  )
}
