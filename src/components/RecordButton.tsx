import { useState, useEffect } from 'react'
import type { RecorderStatus } from '../hooks/useRecorder'

interface RecordButtonProps {
  status: RecorderStatus
  onClick: () => void
}

export function RecordButton({ status, onClick }: RecordButtonProps) {
  const isRecording = status === 'recording'
  const [jolting, setJolting] = useState(false)

  const [prevStatus, setPrevStatus] = useState(status)
  useEffect(() => {
    if (prevStatus === 'recording' && status === 'idle') {
      setJolting(true)
      const t = setTimeout(() => setJolting(false), 240)
      return () => clearTimeout(t)
    }
    setPrevStatus(status)
  }, [status, prevStatus])

  return (
    <button
      onClick={onClick}
      style={{
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: 'var(--record-btn)',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: jolting
          ? 'jolt 240ms ease-out forwards'
          : isRecording
            ? 'none'
            : 'pulse 2.4s ease-in-out infinite',
        outline: 'none',
        WebkitAppRegion: 'no-drag',
        zIndex: 10,
      } as React.CSSProperties}
      onMouseDown={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.92)'
      }}
      onMouseUp={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = ''
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = ''
      }}
    >
      {isRecording ? (
        <div style={{ width: 20, height: 20, borderRadius: 5, background: '#fff' }} />
      ) : (
        <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff' }} />
      )}
    </button>
  )
}
