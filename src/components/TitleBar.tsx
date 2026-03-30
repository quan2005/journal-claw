import type { Theme } from '../types'
import { ThemeToggle } from './ThemeToggle'
import { AiStatusPill } from './AiStatusPill'

interface TitleBarProps {
  theme: Theme
  onThemeChange: (theme: Theme) => void
  isProcessing: boolean
  processingFilename?: string
  onLogClick?: () => void
  view: 'journal' | 'settings'
  onToggleSettings: () => void
}

export function TitleBar({ theme, onThemeChange, isProcessing, processingFilename, onLogClick, view, onToggleSettings }: TitleBarProps) {
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
      {/* Left: empty */}
      <div />

      {/* Center: title or AI status */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {view === 'settings'
          ? <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--item-text)' }}>设置</span>
          : <AiStatusPill isProcessing={isProcessing} processingFilename={processingFilename} onLogClick={onLogClick} />
        }
      </div>

      {/* Right: theme toggle + settings toggle button (always visible) */}
      <div style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: 8 }}>
        {view === 'journal' && <ThemeToggle theme={theme} onChange={onThemeChange} />}
        <button
          onClick={onToggleSettings}
          title={view === 'settings' ? '返回 (Esc)' : '设置 (⌘,)'}
          style={{
            background: view === 'settings' ? 'rgba(200,147,58,0.12)' : 'none',
            border: 'none', cursor: 'pointer',
            color: view === 'settings' ? 'var(--record-btn)' : 'var(--item-meta)',
            fontSize: 15, padding: '2px 4px',
            borderRadius: 4, lineHeight: 1,
            opacity: view === 'settings' ? 1 : 0.7,
          }}
        >⚙</button>
      </div>
    </div>
  )
}
