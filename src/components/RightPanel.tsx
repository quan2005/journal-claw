import { type ReactNode } from 'react'

interface RightPanelProps {
  chatContent: ReactNode
  chatInputBar?: ReactNode
}

export function RightPanel({
  chatContent,
  chatInputBar,
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
        }}
      >
        {chatContent}
      </div>
      {chatInputBar}
    </div>
  )
}
