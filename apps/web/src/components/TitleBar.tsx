import type { Theme } from '../types'
import { ThemeToggle } from './ThemeToggle'
import { AiStatusPill } from './AiStatusPill'
import { useTranslation } from '../contexts/I18nContext'
import { Pin, PinOff } from 'lucide-react'
import type { CSSProperties } from 'react'

interface TitleBarProps {
  theme: Theme
  onThemeChange: (theme: Theme) => void
  isProcessing: boolean
  processingFilename?: string
  view: 'journal' | 'settings'
  onOpenChat?: () => void
  // Panel visibility controls (rendered beside ThemeToggle)
  rightPanelOpen: boolean
  rightPanelPinned: boolean
  onToggleRightPanelPin: () => void
}

// Shared icon-button style for the panel toggles + pin, visually consistent with
// the ThemeToggle segments (same height, divider, accent color).
const iconButtonStyle: CSSProperties = {
  width: 28,
  height: 22,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  border: '1px solid var(--divider)',
  borderRadius: 6,
  background: 'transparent',
  color: 'var(--item-meta)',
  padding: 0,
  lineHeight: 1,
  transition:
    'background-color 0.15s var(--ease-out), color 0.15s var(--ease-out), border-color 0.15s var(--ease-out)',
}

export function TitleBar({
  theme,
  onThemeChange,
  isProcessing,
  processingFilename,
  view,
  onOpenChat,
  rightPanelOpen,
  rightPanelPinned,
  onToggleRightPanelPin,
}: TitleBarProps) {
  const { t } = useTranslation()
  const PinIcon = rightPanelPinned ? PinOff : Pin
  const pinLabel = rightPanelPinned ? t('unpinRightPanel') : t('pinRightPanel')

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

      {/* Right: theme toggle + panel controls */}
      <div style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: 6 }}>
        {view !== 'settings' && (
          <>
            <ThemeToggle theme={theme} onChange={onThemeChange} />
            {/* Pin is meaningful only while the right panel is open */}
            <button
              type="button"
              aria-label={pinLabel}
              aria-pressed={rightPanelPinned}
              title={pinLabel}
              disabled={!rightPanelOpen}
              onClick={onToggleRightPanelPin}
              style={{
                ...iconButtonStyle,
                color: rightPanelPinned ? 'var(--record-btn)' : 'var(--item-meta)',
                opacity: rightPanelOpen ? 1 : 0.35,
                cursor: rightPanelOpen ? 'pointer' : 'default',
              }}
              onMouseEnter={(e) => {
                if (!rightPanelOpen) return
                e.currentTarget.style.background = 'var(--item-hover-bg)'
                e.currentTarget.style.borderColor = 'var(--divider-hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.borderColor = 'var(--divider)'
              }}
            >
              <PinIcon size={13} strokeWidth={1.6} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
