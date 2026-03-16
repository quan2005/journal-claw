import { useState, useEffect } from 'react'
import type { RecordingItem, TranscriptionProgress } from '../types'
import { getTranscript, retryTranscription } from '../lib/tauri'

interface DetailPanelProps {
  item: RecordingItem
  transcriptionState: TranscriptionProgress | undefined
  onClose: () => void
}

export function DetailPanel({ item, transcriptionState, onClose }: DetailPanelProps) {
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setText(null)
    setLoading(true)
    getTranscript(item.filename).then(t => {
      setText(t?.text ?? null)
      setLoading(false)
    })
  }, [item.filename])

  useEffect(() => {
    if (transcriptionState === 'completed') {
      getTranscript(item.filename).then(t => setText(t?.text ?? null))
    }
  }, [transcriptionState, item.filename])

  const status = transcriptionState || item.transcript_status || undefined

  return (
    <div style={{
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg)',
    }}>
      {/* Header — matches TitleBar height */}
      <div
        data-tauri-drag-region
        style={{
          height: 36,
          background: 'var(--titlebar-bg)',
          borderBottom: '1px solid var(--divider)',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 16,
          paddingRight: 12,
          flexShrink: 0,
          gap: 8,
        }}
      >
        <span style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--item-text)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          转写内容
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--item-meta)',
            cursor: 'pointer',
            width: 22,
            height: 22,
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="1" y1="1" x2="11" y2="11" />
            <line x1="11" y1="1" x2="1" y2="11" />
          </svg>
        </button>
      </div>

      {/* Recording info */}
      <div style={{
        padding: '12px 16px 8px',
        borderBottom: '1px solid var(--divider)',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 13, color: 'var(--item-text)', fontWeight: 500 }}>
          {item.display_name}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {(status === 'uploading' || status === 'transcribing') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--item-meta)' }}>
            <div style={{
              width: 14,
              height: 14,
              border: '2px solid var(--item-meta)',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 13 }}>
              {status === 'uploading' ? '上传中...' : '转写中...'}
            </span>
          </div>
        )}

        {status === 'failed' && text === null && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--item-meta)', marginBottom: 10 }}>转写失败</p>
            <button
              onClick={() => retryTranscription(item.filename)}
              style={{
                fontSize: 12,
                color: 'var(--record-btn)',
                background: 'none',
                border: '1px solid var(--record-btn)',
                borderRadius: 5,
                padding: '4px 10px',
                cursor: 'pointer',
              }}
            >
              重试
            </button>
          </div>
        )}

        {text && (
          <p style={{
            fontSize: 14,
            color: 'var(--item-text)',
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            margin: 0,
          }}>
            {text}
          </p>
        )}

        {!status && loading && (
          <span style={{ fontSize: 13, color: 'var(--item-meta)' }}>加载中...</span>
        )}

        {!status && !loading && text === null && (
          <span style={{ fontSize: 13, color: 'var(--item-meta)' }}>暂无转写内容</span>
        )}
      </div>
    </div>
  )
}
