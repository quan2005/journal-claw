import type { Theme } from '../types'
import { ThemeToggle } from './ThemeToggle'
import { AiStatusPill } from './AiStatusPill'

interface TitleBarProps {
  theme: Theme
  onThemeChange: (theme: Theme) => void
  isProcessing: boolean
  processingFilename?: string
}

export function TitleBar({ theme, onThemeChange, isProcessing, processingFilename }: TitleBarProps) {
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
      {/* Left: spacer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      </div>

      {/* Center: AI status pill */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <AiStatusPill isProcessing={isProcessing} processingFilename={processingFilename} />
      </div>

      {/* Right: theme toggle */}
      <div style={{ justifySelf: 'end' }}>
        <ThemeToggle theme={theme} onChange={onThemeChange} />
      </div>
    </div>
  )
}
