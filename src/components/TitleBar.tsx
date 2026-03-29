import { ThemeToggle } from './ThemeToggle'

type Theme = 'light' | 'dark' | 'system'

interface TitleBarProps {
  theme: Theme
  onThemeChange: (theme: Theme) => void
}

export function TitleBar({ theme, onThemeChange }: TitleBarProps) {
  return (
    <div
      data-tauri-drag-region
      style={{
        height: 36,
        background: 'var(--bg)',
        flexShrink: 0,
        paddingLeft: 70,
        paddingRight: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
      }}
    >
      <ThemeToggle theme={theme} onChange={onThemeChange} />
    </div>
  )
}
