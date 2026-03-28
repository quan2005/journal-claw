import { useState, useEffect, useRef, useCallback } from 'react'
import type { RecordingItem, TranscriptionProgress } from '../types'
import { getTranscript, retryTranscription } from '../lib/tauri'
import { Spinner } from './Spinner'
import { formatDuration } from '../lib/format'

interface DetailSheetProps {
  item: RecordingItem
  transcriptionState: TranscriptionProgress | undefined
  onClose: () => void
}

function getDateParts(displayName: string) {
  const dayMatch = displayName.match(/\d{4}-\d{2}-(\d{2})/)
  const timeMatch = displayName.match(/(\d{2}:\d{2})$/)
  return {
    day: dayMatch?.[1] ?? '',
    time: timeMatch?.[1] ?? '',
  }
}

export function DetailSheet({ item, transcriptionState, onClose }: DetailSheetProps) {
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const prevCompletedRef = useRef(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef<number | null>(null)
  const dragCurrentOffset = useRef(0)

  useEffect(() => {
    setText(null)
    setLoading(true)
    prevCompletedRef.current = false
    getTranscript(item.filename).then(t => {
      setText(t?.text ?? null)
      setLoading(false)
    })
  }, [item.filename])

  useEffect(() => {
    if (transcriptionState === 'completed' && !prevCompletedRef.current) {
      prevCompletedRef.current = true
      getTranscript(item.filename).then(t => setText(t?.text ?? null))
    }
    if (transcriptionState !== 'completed') {
      prevCompletedRef.current = false
    }
  }, [transcriptionState, item.filename])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    dragStartY.current = e.clientY
    dragCurrentOffset.current = 0

    const onMove = (ev: MouseEvent) => {
      if (dragStartY.current === null) return
      const offset = Math.max(0, ev.clientY - dragStartY.current)
      dragCurrentOffset.current = offset
      if (sheetRef.current) {
        sheetRef.current.style.transform = `translateY(${offset}px)`
        sheetRef.current.style.transition = 'none'
      }
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (dragCurrentOffset.current > 80) {
        onClose()
      } else {
        if (sheetRef.current) {
          sheetRef.current.style.transition = 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)'
          sheetRef.current.style.transform = 'translateY(0)'
        }
      }
      dragStartY.current = null
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [onClose])

  const status = transcriptionState || item.transcript_status || undefined
  const { day, time } = getDateParts(item.display_name)
  const duration = formatDuration(item.duration_secs)

  return (
    <div
      data-testid="sheet-overlay"
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--sheet-overlay)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        zIndex: 100,
      }}
    >
      <div
        ref={sheetRef}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--sheet-bg)',
          borderRadius: '16px 16px 0 0',
          maxHeight: 'min(85vh, 600px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transform: 'translateY(0)',
          transition: 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        <div
          onMouseDown={handleDragStart}
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '12px 0 8px',
            cursor: 'grab',
            flexShrink: 0,
          }}
        >
          <div style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: 'var(--sheet-handle)',
          }} />
        </div>

        <div style={{
          padding: '4px 20px 16px',
          borderBottom: '1px solid var(--divider)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'baseline',
          gap: 12,
        }}>
          <span style={{
            fontSize: 32,
            fontWeight: 300,
            color: 'var(--date-number)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
          }}>
            {day}
          </span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--item-text)' }}>
              {item.display_name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--item-meta)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
              {time} · {duration}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 24px' }}>
          {(status === 'uploading' || status === 'transcribing') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--item-meta)' }}>
              <Spinner size={14} />
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
              lineHeight: 1.75,
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
    </div>
  )
}
