import { memo, useCallback, useEffect, useRef, useState } from 'react'
import {
  Settings2,
  Cpu,
  Mic,
  ShieldCheck,
  Timer,
  Puzzle,
  Blocks,
  Info,
  type LucideIcon,
} from 'lucide-react'
import SectionGeneral from './components/SectionGeneral'
import SectionAiEngine from './components/SectionAiEngine'
import SectionVoice from './components/SectionVoice'
import SectionPermissions from './components/SectionPermissions'
import SectionAutomation from './components/SectionAutomation'
import SectionIM from './components/SectionFeishu'
import SectionPlugins from './components/SectionPlugins'
import SectionAbout from './components/SectionAbout'
import { ALL_NAV_IDS, SECTION_TOP_GUTTER, type NavId, resolveActiveNav } from './navigation'
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

interface SettingsContentProps {
  registerSectionRef: (id: NavId, el: HTMLElement | null) => void
}

const navIconStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

const SettingsContent = memo(function SettingsContent({
  registerSectionRef,
}: SettingsContentProps) {
  return (
    <>
      <section id="general" ref={(el) => registerSectionRef('general', el)}>
        <SectionGeneral />
      </section>
      <section id="ai" ref={(el) => registerSectionRef('ai', el)}>
        <SectionAiEngine />
      </section>
      <section id="voice" ref={(el) => registerSectionRef('voice', el)}>
        <SectionVoice />
      </section>
      <section id="permissions" ref={(el) => registerSectionRef('permissions', el)}>
        <SectionPermissions />
      </section>
      <section id="automation" ref={(el) => registerSectionRef('automation', el)}>
        <SectionAutomation />
      </section>
      <section id="plugins" ref={(el) => registerSectionRef('plugins', el)}>
        <SectionPlugins />
      </section>
      <section id="im" ref={(el) => registerSectionRef('im', el)}>
        <SectionIM />
      </section>
      <section
        id="about"
        ref={(el) => registerSectionRef('about', el)}
        style={{ paddingBottom: 40 }}
      >
        <SectionAbout />
      </section>
    </>
  )
})

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
    { id: 'plugins', label: t('plugins'), icon: Puzzle },
    { id: 'im', label: t('thirdPartyTools'), icon: Blocks },
    { id: 'about', label: t('about'), icon: Info },
  ]
  const [activeNav, setActiveNav] = useState<NavId>('general')
  const scrollRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Partial<Record<NavId, HTMLElement>>>({})
  const sectionTopsRef = useRef<Partial<Record<NavId, number>>>({})
  const activeNavRef = useRef<NavId>('general')
  const scrollSpyFrameRef = useRef<number | null>(null)
  const navigationFrameRef = useRef<number | null>(null)
  const isProgrammaticScrollRef = useRef(false)

  const registerSectionRef = useCallback((id: NavId, el: HTMLElement | null) => {
    if (el) {
      sectionRefs.current[id] = el
      return
    }

    delete sectionRefs.current[id]
    delete sectionTopsRef.current[id]
  }, [])

  const refreshSectionTops = useCallback(() => {
    const nextTops: Partial<Record<NavId, number>> = {}

    for (const id of ALL_NAV_IDS) {
      const section = sectionRefs.current[id]
      if (section) {
        nextTops[id] = section.offsetTop
      }
    }

    sectionTopsRef.current = nextTops
  }, [])

  const syncActiveNav = useCallback(() => {
    if (isProgrammaticScrollRef.current) return

    const scroll = scrollRef.current
    if (!scroll) return

    const nextActive = resolveActiveNav(sectionTopsRef.current, scroll.scrollTop)
    if (nextActive !== activeNavRef.current) {
      activeNavRef.current = nextActive
      setActiveNav(nextActive)
    }
  }, [])

  const scheduleActiveNavSync = useCallback(() => {
    if (scrollSpyFrameRef.current !== null) return

    scrollSpyFrameRef.current = window.requestAnimationFrame(() => {
      scrollSpyFrameRef.current = null
      syncActiveNav()
    })
  }, [syncActiveNav])

  const cancelNavigationAnimation = useCallback(() => {
    if (navigationFrameRef.current !== null) {
      window.cancelAnimationFrame(navigationFrameRef.current)
      navigationFrameRef.current = null
    }
    isProgrammaticScrollRef.current = false
  }, [])

  useEffect(() => {
    activeNavRef.current = activeNav
  }, [activeNav])

  useEffect(() => {
    const scroll = scrollRef.current
    if (!scroll) return

    refreshSectionTops()
    scheduleActiveNavSync()

    const handleScroll = () => {
      scheduleActiveNavSync()
    }

    const handleWheel = () => {
      if (isProgrammaticScrollRef.current) {
        cancelNavigationAnimation()
      }
    }

    const handleResize = () => {
      refreshSectionTops()
      scheduleActiveNavSync()
    }

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            refreshSectionTops()
            scheduleActiveNavSync()
          })

    if (resizeObserver) {
      for (const id of ALL_NAV_IDS) {
        const section = sectionRefs.current[id]
        if (section) {
          resizeObserver.observe(section)
        }
      }
      resizeObserver.observe(scroll)
    }

    scroll.addEventListener('scroll', handleScroll, { passive: true })
    scroll.addEventListener('wheel', handleWheel, { passive: true })
    window.addEventListener('resize', handleResize)

    return () => {
      resizeObserver?.disconnect()
      scroll.removeEventListener('scroll', handleScroll)
      scroll.removeEventListener('wheel', handleWheel)
      window.removeEventListener('resize', handleResize)
      cancelNavigationAnimation()
      if (scrollSpyFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollSpyFrameRef.current)
        scrollSpyFrameRef.current = null
      }
    }
  }, [cancelNavigationAnimation, refreshSectionTops, scheduleActiveNavSync])

  const jumpTo = (id: NavId) => {
    const scroll = scrollRef.current
    const rawTargetTop = sectionTopsRef.current[id]
    if (!scroll || typeof rawTargetTop !== 'number') return

    const targetTop = Math.max(0, rawTargetTop - SECTION_TOP_GUTTER)

    cancelNavigationAnimation()
    activeNavRef.current = id
    setActiveNav(id)

    const startTop = scroll.scrollTop
    const distance = targetTop - startTop
    if (Math.abs(distance) < 2) {
      scroll.scrollTop = targetTop
      scheduleActiveNavSync()
      return
    }

    const duration = Math.min(220, Math.max(140, Math.abs(distance) * 0.18))
    const startTime = performance.now()
    isProgrammaticScrollRef.current = true

    const step = (now: number) => {
      const currentScroll = scrollRef.current
      if (!currentScroll) {
        cancelNavigationAnimation()
        return
      }

      const progress = Math.min(1, (now - startTime) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      currentScroll.scrollTop = startTop + distance * eased

      if (progress < 1) {
        navigationFrameRef.current = window.requestAnimationFrame(step)
        return
      }

      currentScroll.scrollTop = targetTop
      navigationFrameRef.current = null
      isProgrammaticScrollRef.current = false
      scheduleActiveNavSync()
    }

    navigationFrameRef.current = window.requestAnimationFrame(step)
  }

  // Jump to initial section when requested (e.g. from "About" menu)
  useEffect(() => {
    if (!initialSection || !ALL_NAV_IDS.includes(initialSection as NavId)) return
    // Wait for section refs to be measured
    const frame = requestAnimationFrame(() => {
      refreshSectionTops()
      jumpTo(initialSection as NavId)
      onSectionConsumed?.()
    })
    return () => cancelAnimationFrame(frame)
  }, [initialSection]) // eslint-disable-line react-hooks/exhaustive-deps

  const DISABLED_NAVS: ReadonlySet<NavId> = new Set(['im'])

  const navBtnStyle = (id: NavId): React.CSSProperties => ({
    width: '100%',
    display: 'grid',
    gridTemplateColumns: '16px minmax(0, 1fr)',
    alignItems: 'center',
    columnGap: 10,
    padding: '8px 10px',
    borderRadius: 8,
    border: 'none',
    cursor: DISABLED_NAVS.has(id) ? 'default' : 'pointer',
    fontSize: 14,
    fontWeight: 500,
    textAlign: 'left',
    background: DISABLED_NAVS.has(id)
      ? 'transparent'
      : activeNav === id
        ? 'rgba(200,147,58,0.12)'
        : 'transparent',
    color: DISABLED_NAVS.has(id)
      ? 'var(--item-meta)'
      : activeNav === id
        ? 'var(--record-btn)'
        : 'var(--item-meta)',
    opacity: DISABLED_NAVS.has(id) ? 0.35 : 1,
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
          width: 148,
          flexShrink: 0,
          background: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--divider)',
          padding: '12px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => {
              if (!DISABLED_NAVS.has(id)) jumpTo(id)
            }}
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
              style={{
                width: '100%',
                display: 'grid',
                gridTemplateColumns: '16px minmax(0, 1fr)',
                alignItems: 'center',
                columnGap: 10,
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
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </span>
              <span style={{ minWidth: 0 }}>{t('back')}</span>
            </button>
          </>
        )}
      </nav>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        <SettingsContent registerSectionRef={registerSectionRef} />
      </div>
    </div>
  )
}
