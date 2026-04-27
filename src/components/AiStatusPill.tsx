import { useState, useEffect, useRef } from 'react'
import { useTranslation } from '../contexts/I18nContext'

type PillState = 'idle' | 'active' | 'failed'

interface AiStatusPillProps {
  isProcessing: boolean
  processingFilename?: string
  lastError?: string
  onClick?: () => void
}

export function AiStatusPill({
  isProcessing,
  processingFilename,
  lastError,
  onClick,
}: AiStatusPillProps) {
  const { t } = useTranslation()
  const [pillState, setPillState] = useState<PillState>('idle')
  const [lingerName, setLingerName] = useState<string | undefined>(undefined)
  const [errorMsg, setErrorMsg] = useState<string | undefined>(undefined)
  const wasProcessing = useRef(false)
  const prevError = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (isProcessing) {
      wasProcessing.current = true
      setPillState('active')
      setLingerName(processingFilename)
      return
    }
    if (lastError && lastError !== prevError.current) {
      prevError.current = lastError
      wasProcessing.current = false
      setPillState('failed')
      setErrorMsg(lastError.length > 40 ? lastError.slice(0, 40) + '…' : lastError)
      const timer = setTimeout(() => {
        setPillState('idle')
        setErrorMsg(undefined)
      }, 5000)
      return () => clearTimeout(timer)
    }
    if (wasProcessing.current) {
      wasProcessing.current = false
      const timer = setTimeout(() => {
        setPillState('idle')
        setLingerName(undefined)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isProcessing, processingFilename, lastError])

  const isFailed = pillState === 'failed'
  const isActive = pillState === 'active'

  const bg = isFailed
    ? 'color-mix(in srgb, var(--status-danger) 12%, var(--ai-pill-bg))'
    : isActive
      ? 'var(--ai-pill-active-bg)'
      : 'var(--ai-pill-bg)'
  const borderColor = isFailed
    ? 'var(--status-danger)'
    : isActive
      ? 'var(--ai-pill-active-border)'
      : 'var(--ai-pill-border)'
  const textColor = isFailed
    ? 'var(--status-danger)'
    : isActive
      ? 'var(--ai-pill-active-text)'
      : 'var(--ai-pill-text)'
  const dotColor = isFailed
    ? 'var(--status-danger)'
    : isActive
      ? 'var(--ai-pill-active-text)'
      : 'var(--ai-pill-dot)'
  const dotAnimation = isFailed ? 'none' : 'ai-breathe 2s ease-in-out infinite'

  return (
    <div
      onClick={onClick}
      style={
        {
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: bg,
          border: `0.5px solid ${borderColor}`,
          borderRadius: 20,
          padding: '3px 11px',
          fontSize: 'var(--text-sm)',
          color: textColor,
          letterSpacing: '0.05em',
          userSelect: 'none',
          transition: 'background 0.3s, color 0.3s, opacity 0.3s, border-color 0.3s',
          WebkitAppRegion: 'no-drag',
          cursor: 'pointer',
          animation: isFailed ? 'ai-shake 400ms ease-out' : 'none',
        } as React.CSSProperties
      }
    >
      <div
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: dotColor,
          animation: dotAnimation,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          maxWidth: 180,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {isFailed
          ? (errorMsg ?? '处理失败')
          : isActive
            ? lingerName
              ? t('processingNamed', { name: lingerName })
              : t('processing')
            : t('aiReady')}
      </span>
      {pillState === 'idle' && (
        <span
          style={{
            fontSize: 10,
            opacity: 0.45,
            letterSpacing: '0.02em',
          }}
        >
          ⌘K
        </span>
      )}
    </div>
  )
}
