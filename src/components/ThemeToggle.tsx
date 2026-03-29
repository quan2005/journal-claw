type Theme = 'light' | 'dark' | 'system'

interface ThemeToggleProps {
  theme: Theme
  onChange: (theme: Theme) => void
}

const SEGMENTS: { value: Theme; icon: string }[] = [
  { value: 'light', icon: '☀️' },
  { value: 'dark',  icon: '🌙' },
  { value: 'system', icon: '🖥️' },
]

export function ThemeToggle({ theme, onChange }: ThemeToggleProps) {
  return (
    <div
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
          key={seg.value}
          onClick={() => onChange(seg.value)}
          style={{
            width: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            cursor: 'pointer',
            border: 'none',
            borderRight: i < SEGMENTS.length - 1 ? '1px solid var(--divider)' : 'none',
            background: theme === seg.value ? 'var(--item-selected-bg)' : 'transparent',
            opacity: theme === seg.value ? 1 : 0.45,
            padding: 0,
          }}
          title={seg.value}
        >
          {seg.icon}
        </button>
      ))}
    </div>
  )
}
