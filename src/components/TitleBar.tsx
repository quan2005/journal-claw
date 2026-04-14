import type { Theme } from '../types'
import { ThemeToggle } from './ThemeToggle'
import { AiStatusPill } from './AiStatusPill'
import { useTranslation } from '../contexts/I18nContext'

interface TitleBarProps {
  theme: Theme
  onThemeChange: (theme: Theme) => void
  isProcessing: boolean
  processingFilename?: string
  view: 'journal' | 'settings'
  todoOpen: boolean
  todoCount: number
  onToggleTodo: () => void
}

export function TitleBar({
  theme,
  onThemeChange,
  isProcessing,
  processingFilename,
  view,
  todoOpen,
  todoCount,
  onToggleTodo,
}: TitleBarProps) {
  const { t } = useTranslation()
  return (
    <div
      data-tauri-drag-region
      style={{
        height: 38,
        background: 'var(--titlebar-bg)',
        flexShrink: 0,
        paddingLeft: 70,
        paddingRight: 16,
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        borderBottom: '0.5px solid var(--divider)',
        userSelect: 'none' as const,
      }}
    >
      {/* Left: empty */}
      <div />

      {/* Center: title or AI status */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {view === 'settings' ? (
          <span
            style={{
              fontSize: 'var(--text-md)',
              fontWeight: 'var(--font-medium)',
              color: 'var(--item-text)',
            }}
          >
            {t('settings')}
          </span>
        ) : (
          <AiStatusPill isProcessing={isProcessing} processingFilename={processingFilename} />
        )}
      </div>

      {/* Right: theme toggle + todo button */}
      <div style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: 8 }}>
        {view !== 'settings' && <ThemeToggle theme={theme} onChange={onThemeChange} />}
        {view !== 'settings' && (
          <button
            onClick={onToggleTodo}
            title={todoOpen ? t('todoTooltipClose') : t('todoTooltipOpen')}
            style={{
              background: todoOpen ? 'rgba(200,147,58,0.12)' : 'none',
              border: 'none',
              cursor: 'pointer',
              color: todoOpen ? 'var(--record-btn)' : 'var(--item-meta)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              padding: 0,
              borderRadius: 4,
              lineHeight: 1,
              opacity: todoOpen ? 1 : 0.6,
              position: 'relative' as const,
            }}
          >
            <svg
              width="14"
              height="14"
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
            {!todoOpen && todoCount > 0 && (
              <span
                style={{
                  position: 'absolute' as const,
                  top: -2,
                  right: -4,
                  background: 'var(--record-btn)',
                  color: 'var(--bg)',
                  fontSize: 9,
                  fontWeight: 'var(--font-semibold)' /* micro badge — below token scale */,
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {todoCount > 9 ? '9+' : todoCount}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
