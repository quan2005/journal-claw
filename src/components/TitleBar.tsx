import { formatTimer } from '../lib/format'
import type { RecorderStatus } from '../hooks/useRecorder'

interface TitleBarProps {
  status: RecorderStatus
  elapsedSecs: number
}

export function TitleBar({ status, elapsedSecs }: TitleBarProps) {
  return (
    <div
      data-tauri-drag-region
      style={{
        height: 36,
        background: 'var(--titlebar-bg)',
        borderBottom: '1px solid var(--divider)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        // 70px left padding to clear the macOS traffic-light buttons
        paddingLeft: 70,
        paddingRight: 16,
      }}
    >
      {status === 'idle' ? (
        <span style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--item-meta)',
        }}>
          DayNote
        </span>
      ) : (
        <span style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--record-btn)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          <span style={{ animation: 'blink 1s ease-in-out infinite' }}>●</span>
          {formatTimer(elapsedSecs)}
        </span>
      )}
    </div>
  )
}
