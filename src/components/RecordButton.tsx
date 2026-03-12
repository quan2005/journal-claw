import type { RecorderStatus } from '../hooks/useRecorder'

interface RecordButtonProps {
  status: RecorderStatus
  onClick: () => void
}

export function RecordButton({ status, onClick }: RecordButtonProps) {
  const isRecording = status === 'recording'
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 120,
      flexShrink: 0,
      borderTop: '1px solid var(--divider)',
      background: 'var(--bg)',
    }}>
      <button
        onClick={onClick}
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'var(--record-btn)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // Pulse animation only while idle; no animation while recording
          animation: isRecording ? 'none' : 'pulse 2.4s ease-in-out infinite',
          outline: 'none',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
      >
        {isRecording ? (
          <div style={{ width: 24, height: 24, borderRadius: 5, background: '#fff' }} />
        ) : (
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#fff' }} />
        )}
      </button>
    </div>
  )
}
