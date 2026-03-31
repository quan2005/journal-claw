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
        {view === 'soul' ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(90,154,106,0.08)',
            border: '0.5px solid rgba(90,154,106,0.2)',
            borderRadius: 5, padding: '3px 10px',
            fontSize: 11, color: 'var(--soul-color, #5a9a6a)',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M12 2a7 7 0 0 1 7 7c0 4-3 6-4 8H9c-1-2-4-4-4-8a7 7 0 0 1 7-7z"/>
              <path d="M9 21h6M10 17h4"/>
            </svg>
            Agent 灵魂
          </div>
        ) : view === 'settings' ? (
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
          title={soulActive ? '返回 (Esc)' : 'Agent 灵魂 (⌘P)'}
          style={{
            background: soulActive ? 'rgba(90,154,106,0.12)' : 'none',
            border: 'none', cursor: 'pointer',
            color: soulActive ? 'var(--soul-color, #5a9a6a)' : 'var(--item-meta)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 24, height: 24, padding: 0, borderRadius: 4, lineHeight: 1,
            opacity: soulActive ? 1 : 0.6,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M12 2a7 7 0 0 1 7 7c0 4-3 6-4 8H9c-1-2-4-4-4-8a7 7 0 0 1 7-7z"/>
            <path d="M9 21h6M10 17h4"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
