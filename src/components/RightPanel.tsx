import type { ReactNode } from 'react'
import { useTranslation } from '../contexts/I18nContext'

export type RightPanelTab = 'ideas' | 'chat' | 'history'

interface RightPanelProps {
  activeTab: RightPanelTab
  onTabChange: (tab: RightPanelTab) => void
  ideasContent: ReactNode
  chatContent: ReactNode
  historyContent: ReactNode
  chatInputBar?: ReactNode // rendered below chat content, fixed at bottom, only for chat tab
}

export function RightPanel({
  activeTab,
  onTabChange,
  ideasContent,
  chatContent,
  historyContent,
  chatInputBar,
}: RightPanelProps) {
  const { t } = useTranslation()

  const btnStyle = (tab: RightPanelTab): React.CSSProperties => ({
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    fontSize: 'var(--text-sm)',
    fontWeight: activeTab === tab ? 'var(--font-semibold)' : 'var(--font-normal)',
    padding: 0,
    height: 34,
    color: activeTab === tab ? 'var(--segment-active-text)' : 'var(--segment-text)',
    background: 'transparent',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    letterSpacing: '0.03em',
    border: 'none',
    borderBottom:
      activeTab === tab ? '2px solid var(--segment-active-text)' : '2px solid transparent',
    transition: 'color 0.15s ease-out',
  })

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--divider)',
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        <button style={btnStyle('ideas')} onClick={() => onTabChange('ideas')}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          {t('ideas')}
        </button>
        <button style={btnStyle('chat')} onClick={() => onTabChange('chat')}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {t('chat')}
        </button>
        <button style={btnStyle('history')} onClick={() => onTabChange('history')}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {t('history')}
        </button>
      </div>

      {/* Tab content */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {activeTab === 'ideas' && ideasContent}
        {activeTab === 'chat' && (
          <>
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
          </>
        )}
        {activeTab === 'history' && historyContent}
      </div>
    </div>
  )
}
