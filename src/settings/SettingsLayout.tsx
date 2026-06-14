import { useEffect, useRef, useState } from 'react'
import {
  Settings2,
  Cpu,
  Mic,
  ShieldCheck,
  Timer,
  Blocks,
  Info,
  ChevronLeft,
  type LucideIcon,
} from 'lucide-react'
import SectionGeneral from './components/SectionGeneral'
import SectionAiEngine from './components/SectionAiEngine'
import SectionVoice from './components/SectionVoice'
import SectionPermissions from './components/SectionPermissions'
import SectionAutomation from './components/SectionAutomation'
import SectionIM from './components/SectionFeishu'
import SectionAbout from './components/SectionAbout'
import { ALL_NAV_IDS, type NavId } from './navigation'
import { useTranslation } from '../contexts/I18nContext'

interface SettingsLayoutProps {
  height: string
  initialSection?: string
  onSectionConsumed?: () => void
  onClose?: () => void
}

type NavItem = {
  id: NavId
  label: string
  icon: LucideIcon | React.FC<{ size?: number; strokeWidth?: number }>
}

const navIconStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

const DISABLED_NAVS: ReadonlySet<NavId> = new Set(['im'])

function isNavId(value?: string): value is NavId {
  return !!value && ALL_NAV_IDS.includes(value as NavId)
}

function renderActiveSection(id: NavId) {
  switch (id) {
    case 'general':
      return <SectionGeneral />
    case 'ai':
      return <SectionAiEngine />
    case 'voice':
      return <SectionVoice />
    case 'permissions':
      return <SectionPermissions />
    case 'automation':
      return <SectionAutomation />
    case 'im':
      return <SectionIM />
    case 'about':
      return <SectionAbout />
  }
}

export function SettingsLayout({
  height,
  initialSection,
  onSectionConsumed,
  onClose,
}: SettingsLayoutProps) {
  const { t } = useTranslation()
  const NAV_ITEMS: NavItem[] = [
    { id: 'general', label: t('general'), icon: Settings2 },

    { id: 'ai', label: t('aiEngine'), icon: Cpu },
    { id: 'voice', label: t('voice'), icon: Mic },
    { id: 'permissions', label: t('permissions'), icon: ShieldCheck },
    { id: 'automation', label: t('automation'), icon: Timer },
    { id: 'im', label: t('thirdPartyTools'), icon: Blocks },
    { id: 'about', label: t('about'), icon: Info },
  ]
  const [activeNav, setActiveNav] = useState<NavId>(() =>
    isNavId(initialSection) ? initialSection : 'general',
  )
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isNavId(initialSection)) return
    setActiveNav(initialSection)
    onSectionConsumed?.()
  }, [initialSection, onSectionConsumed])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [activeNav])

  const navBtnStyle = (id: NavId): React.CSSProperties => ({
    width: '100%',
    display: 'grid',
    gridTemplateColumns: '16px minmax(0, 1fr)',
    alignItems: 'center',
    columnGap: 10,
    minHeight: 34,
    padding: '8px 10px',
    borderRadius: 8,
    border: 'none',
    cursor: DISABLED_NAVS.has(id) ? 'default' : 'pointer',
    fontSize: 14,
    fontWeight: 500,
    textAlign: 'left',
    background:
      activeNav === id ? 'color-mix(in srgb, var(--record-btn) 14%, transparent)' : 'transparent',
    color: activeNav === id ? 'var(--record-btn)' : 'var(--item-meta)',
    opacity: DISABLED_NAVS.has(id) && activeNav !== id ? 0.35 : 1,
  })

  return (
    <div
      className="settings-root"
      style={{
        display: 'flex',
        height,
        background: 'var(--bg)',
        color: 'var(--item-text)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
      }}
    >
      <nav
        style={{
          width: 184,
          flexShrink: 0,
          background: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--divider)',
          padding: '16px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          minHeight: 0,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
        }}
      >
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`settings-nav-${id}`}
            type="button"
            onClick={() => {
              if (!DISABLED_NAVS.has(id)) setActiveNav(id)
            }}
            aria-current={activeNav === id ? 'page' : undefined}
            aria-disabled={DISABLED_NAVS.has(id)}
            style={navBtnStyle(id)}
          >
            <span style={navIconStyle}>
              <Icon size={14} strokeWidth={1.5} />
            </span>
            <span style={{ minWidth: 0 }}>{label}</span>
          </button>
        ))}
        {onClose && (
          <>
            <div style={{ flex: 1 }} />
            <button
              onClick={onClose}
              type="button"
              style={{
                width: '100%',
                display: 'grid',
                gridTemplateColumns: '16px minmax(0, 1fr)',
                alignItems: 'center',
                columnGap: 10,
                minHeight: 34,
                padding: '8px 10px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
                textAlign: 'left',
                background: 'transparent',
                color: 'var(--item-meta)',
              }}
            >
              <span style={navIconStyle}>
                <ChevronLeft size={14} strokeWidth={1.5} />
              </span>
              <span style={{ minWidth: 0 }}>{t('back')}</span>
            </button>
          </>
        )}
      </nav>

      <div ref={scrollRef} className="settings-scroll">
        <div className="settings-content-shell">
          <section
            key={activeNav}
            id={activeNav}
            className="settings-active-panel"
            aria-labelledby={`settings-nav-${activeNav}`}
          >
            {renderActiveSection(activeNav)}
          </section>
        </div>
      </div>
    </div>
  )
}
