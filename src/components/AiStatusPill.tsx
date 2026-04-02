import { useState, useEffect, useRef } from 'react'

interface AiStatusPillProps {
  isProcessing: boolean
  processingFilename?: string
  onLogClick?: () => void
}

export function AiStatusPill({ isProcessing, processingFilename, onLogClick }: AiStatusPillProps) {
  // Track visual state separately to implement 2s linger after processing ends
  const [showActive, setShowActive] = useState(false)
  const [lingerName, setLingerName] = useState<string | undefined>(undefined)
  const wasProcessing = useRef(false)

  useEffect(() => {
    if (isProcessing) {
      wasProcessing.current = true
      setShowActive(true)
      setLingerName(processingFilename)
      return
    }
    // Processing just ended — linger for 2s before reverting
    if (wasProcessing.current) {
      wasProcessing.current = false
      const t = setTimeout(() => {
        setShowActive(false)
        setLingerName(undefined)
      }, 2000)
      return () => clearTimeout(t)
    }
  }, [isProcessing, processingFilename])

  const active = showActive

  return (
    <div
      onClick={active && onLogClick ? onLogClick : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: active ? 'var(--ai-pill-active-bg)' : 'var(--ai-pill-bg)',
        border: `0.5px solid ${active ? 'var(--ai-pill-active-border)' : 'var(--ai-pill-border)'}`,
        borderRadius: 20,
        padding: '3px 11px',
        fontSize: 13,
        color: active ? 'var(--ai-pill-active-text)' : 'var(--ai-pill-text)',
        letterSpacing: '0.05em',
        userSelect: 'none',
        transition: 'background 0.3s, color 0.3s, border-color 0.3s',
        WebkitAppRegion: 'no-drag',
        cursor: active && onLogClick ? 'pointer' : 'default',
      } as React.CSSProperties}
    >
      <div
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: active ? 'var(--ai-pill-active-text)' : 'var(--ai-pill-dot)',
          animation: 'ai-breathe 2s ease-in-out infinite',
          flexShrink: 0,
        }}
      />
      <span style={{
        maxWidth: 180,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {active
          ? lingerName ? `${lingerName} · 整理中` : '整理中…'
          : '谨迹待命中'}
      </span>
    </div>
  )
}
