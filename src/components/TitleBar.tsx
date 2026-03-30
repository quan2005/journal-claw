import type { Theme } from '../types'
import { ThemeToggle } from './ThemeToggle'
import { AiStatusPill } from './AiStatusPill'

interface TitleBarProps {
  theme: Theme
  onThemeChange: (theme: Theme) => void
  isProcessing: boolean
  processingFilename?: string
  view: 'journal' | 'settings'
  onOpenSettings: () => void
  onCloseSettings: () => void
}

export function TitleBar({ theme, onThemeChange, isProcessing, processingFilename, view, onOpenSettings, onCloseSettings }: TitleBarProps) {
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
      }}
    >
      {/* Left: back button when in settings */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {view === 'settings' && (
          <button
            onClick={onCloseSettings}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--item-meta)', fontSize: 12, padding: '2px 6px',
              borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            ‹ 返回
          </button>
        )}
      </div>

      {/* Center: title or AI status */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {view === 'settings'
          ? <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--item-text)' }}>设置</span>
          : <AiStatusPill isProcessing={isProcessing} processingFilename={processingFilename} />
        }
      </div>

      {/* Right: settings icon or theme toggle */}
      <div style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: 8 }}>
        {view === 'journal' && (
          <>
            <ThemeToggle theme={theme} onChange={onThemeChange} />
            <button
              onClick={onOpenSettings}
              title="设置 (⌘,)"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--item-meta)', fontSize: 15, padding: '2px 4px',
                borderRadius: 4, lineHeight: 1, opacity: 0.7,
              }}
            >⚙</button>
          </>
        )}
      </div>
    </div>
  )
}
