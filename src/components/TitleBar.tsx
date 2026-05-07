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
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onOpenChat?: () => void
}

export function TitleBar({
  theme,
  onThemeChange,
  isProcessing,
  processingFilename,
  view,
  sidebarOpen,
  onToggleSidebar,
  onOpenChat,
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
          <AiStatusPill
            isProcessing={isProcessing}
            processingFilename={processingFilename}
            onClick={onOpenChat}
          />
        )}
      </div>

      {/* Right: theme toggle + sidebar toggle */}
      <div style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: 8 }}>
        {view !== 'settings' && <ThemeToggle theme={theme} onChange={onThemeChange} />}
        {view !== 'settings' && (
          <button
            onClick={onToggleSidebar}
            title={t('sidebarToggle')}
            style={{
              background: sidebarOpen ? 'rgba(200,147,58,0.12)' : 'none',
              border: 'none',
              cursor: 'pointer',
              color: sidebarOpen ? 'var(--record-btn)' : 'var(--item-meta)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              padding: 0,
              borderRadius: 4,
              lineHeight: 1,
              opacity: sidebarOpen ? 1 : 0.6,
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
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 3v18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
