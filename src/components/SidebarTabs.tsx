import { useTranslation } from '../contexts/I18nContext'

export type SidebarTab = 'journal' | 'identity'

interface SidebarTabsProps {
  active: SidebarTab
  onChange: (tab: SidebarTab) => void
}

export function SidebarTabs({ active, onChange }: SidebarTabsProps) {
  const { t } = useTranslation()
  const isActive = (tab: SidebarTab) => active === tab

  const btnStyle = (tab: SidebarTab): React.CSSProperties => ({
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    fontSize: 'var(--text-sm)',
    fontWeight: isActive(tab) ? 'var(--font-semibold)' : 'var(--font-normal)',
    padding: 0,
    height: 38,
    color: isActive(tab) ? 'var(--segment-active-text)' : 'var(--segment-text)',
    background: 'transparent',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    letterSpacing: '0.03em',
    border: 'none',
    borderBottom: isActive(tab) ? '2px solid var(--segment-active-text)' : '2px solid transparent',
    transition: 'color 0.15s, border-color 0.15s, font-weight 0.15s',
  })

  return (
    <div style={{
      display: 'flex',
      margin: 0,
      background: 'transparent',
      borderBottom: '1px solid var(--divider)',
      padding: 0,
      flexShrink: 0,
    }}>
      <button style={btnStyle('identity')} onClick={() => onChange('identity')}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
        {t('profiles')}
      </button>
      <div style={{ width: 1, alignSelf: 'stretch', margin: '10px 0', background: 'var(--divider)' }} />
      <button style={btnStyle('journal')} onClick={() => onChange('journal')}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        {t('journal')}
      </button>
    </div>
  )
}
