import { Sun, Moon, Monitor, type LucideIcon } from 'lucide-react'
import type { Theme } from '../types'

interface ThemeToggleProps {
  theme: Theme
  onChange: (theme: Theme) => void
}

const SEGMENTS: { value: Theme; icon: LucideIcon }[] = [
  { value: 'light',  icon: Sun },
  { value: 'dark',   icon: Moon },
  { value: 'system', icon: Monitor },
]

export function ThemeToggle({ theme, onChange }: ThemeToggleProps) {
  return (
    <div
      role="group"
      aria-label="Theme"
      style={{
        display: 'flex',
        border: '1px solid var(--divider)',
        borderRadius: 6,
        overflow: 'hidden',
        height: 22,
      }}
    >
      {SEGMENTS.map((seg, i) => (
        <button
          type="button"
          key={seg.value}
          aria-pressed={theme === seg.value}
          onClick={() => onChange(seg.value)}
          style={{
            width: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            border: 'none',
            borderRight: i < SEGMENTS.length - 1 ? '1px solid var(--divider)' : 'none',
            background: theme === seg.value ? 'var(--item-selected-bg)' : 'transparent',
            color: theme === seg.value ? 'var(--item-text)' : 'var(--item-meta)',
            padding: 0,
          }}
          title={seg.value}
        >
          <seg.icon size={12} strokeWidth={1.5} />
        </button>
      ))}
    </div>
  )
}
