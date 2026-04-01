import type { Theme } from '../types'
import { ThemeToggle } from './ThemeToggle'
import { AiStatusPill } from './AiStatusPill'

interface TitleBarProps {
  theme: Theme
  onThemeChange: (theme: Theme) => void
  isProcessing: boolean
  processingFilename?: string
  onLogClick?: () => void
  view: 'journal' | 'settings' | 'soul'
  onToggleSoul: () => void
}

export function TitleBar({ theme, onThemeChange, isProcessing, processingFilename, onLogClick, view, onToggleSoul }: TitleBarProps) {
  const soulActive = view === 'soul'

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
        {view === 'settings' ? (
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--item-text)' }}>设置</span>
        ) : (
          <AiStatusPill isProcessing={isProcessing} processingFilename={processingFilename} onLogClick={onLogClick} />
        )}
      </div>

      {/* Right: theme toggle (journal only) + soul button */}
      <div style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: 8 }}>
        {view === 'journal' && <ThemeToggle theme={theme} onChange={onThemeChange} />}
        <button
          onClick={onToggleSoul}
          title={soulActive ? '返回 (Esc)' : '谨迹灵魂 (⌘P)'}
          style={{
            background: soulActive ? 'rgba(90,154,106,0.12)' : 'none',
            border: 'none', cursor: 'pointer',
            color: soulActive ? 'var(--soul-color, #5a9a6a)' : 'var(--item-meta)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 24, height: 24, padding: 0, borderRadius: 4, lineHeight: 1,
            opacity: soulActive ? 1 : 0.6,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4"/>
            <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 12 0"/>
            <path d="M12 12a2 2 0 0 0-2 2c0 2 1 4 1 6"/>
            <path d="M8.5 16.5c-.3 2-.1 4 .5 6"/>
            <path d="M14 13.5c0 1.5-.5 3-1 5.5"/>
            <path d="M17.5 15c-.5 2-1 4-1.5 6"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
