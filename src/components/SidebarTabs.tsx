export type SidebarTab = 'journal' | 'identity'

interface SidebarTabsProps {
  active: SidebarTab
  onChange: (tab: SidebarTab) => void
}

export function SidebarTabs({ active, onChange }: SidebarTabsProps) {
  const btnStyle = (tab: SidebarTab): React.CSSProperties => ({
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    fontSize: 11,
    fontWeight: 500,
    padding: '5px 0',
    borderRadius: 4,
    color: active === tab ? 'var(--segment-active-text)' : 'var(--segment-text)',
    background: active === tab ? 'var(--segment-active-bg)' : 'transparent',
    cursor: 'pointer',
    fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
    letterSpacing: '0.03em',
    border: 'none',
    transition: 'color 0.15s, background 0.15s',
  })

  return (
    <div style={{
      display: 'flex',
      margin: '10px 12px 4px',
      background: 'var(--segment-bg)',
      borderRadius: 6,
      padding: 2,
      flexShrink: 0,
    }}>
      <button style={btnStyle('journal')} onClick={() => onChange('journal')}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        日志
      </button>
      <button style={btnStyle('identity')} onClick={() => onChange('identity')}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
        人设
      </button>
    </div>
  )
}
