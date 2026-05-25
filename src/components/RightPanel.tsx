import { type ReactNode } from 'react'
import { HistoryFloatingButton } from './HistoryFloatingButton'

interface RightPanelProps {
  chatContent: ReactNode
  chatInputBar?: ReactNode
  activeSessionId?: string | null
  onHistorySelect?: (id: string) => void
}

export function RightPanel({
  chatContent,
  chatInputBar,
  activeSessionId,
  onHistorySelect,
}: RightPanelProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {onHistorySelect && (
          <HistoryFloatingButton
            activeSessionId={activeSessionId ?? null}
            onSelect={onHistorySelect}
          />
        )}
        {chatContent}
      </div>
      {chatInputBar}
    </div>
  )
}
