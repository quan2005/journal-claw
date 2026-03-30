import { useEffect, useRef, useState } from 'react'
import { Settings2, Cpu, Mic, BookOpen, Puzzle, Info } from 'lucide-react'
import SectionGeneral from './components/SectionGeneral'
import SectionAiEngine from './components/SectionAiEngine'
import SectionVoice from './components/SectionVoice'
import SectionGuide from './components/SectionGuide'
import SectionPlugins from './components/SectionPlugins'
import SectionAbout from './components/SectionAbout'

type NavId = 'general' | 'ai' | 'voice' | 'guide' | 'plugins' | 'about'

type NavItem = { id: NavId; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }

const NAV_ITEMS: NavItem[] = [
  { id: 'general',  label: '通用',    icon: Settings2 },
  { id: 'ai',       label: 'AI 引擎', icon: Cpu },
  { id: 'voice',    label: '语音转写', icon: Mic },
  { id: 'guide',    label: '工作引导', icon: BookOpen },
  { id: 'plugins',  label: '技能插件', icon: Puzzle },
]

export function SettingsPanel() {
  const [activeNav, setActiveNav] = useState<NavId>('general')
  const scrollRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Partial<Record<NavId, HTMLElement>>>({})

  useEffect(() => {
    const scroll = scrollRef.current
    if (!scroll) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveNav(entry.target.id as NavId)
          }
        }
      },
      { root: scroll, threshold: 0.4 }
    )
    Object.values(sectionRefs.current).forEach(el => el && observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const jumpTo = (id: NavId) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth' })
  }

  const setRef = (id: NavId) => (el: HTMLElement | null) => {
    if (el) sectionRefs.current[id] = el
  }

  const navBtnStyle = (id: NavId): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '7px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
    fontSize: 12, textAlign: 'left', width: '100%',
    background: activeNav === id ? 'rgba(200,147,58,0.12)' : 'transparent',
    color: activeNav === id ? 'var(--record-btn)' : 'var(--item-meta)',
  })

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg)', color: 'var(--item-text)', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif' }}>
      {/* Left nav */}
      <nav style={{
        width: 140, flexShrink: 0,
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--divider)',
        padding: '12px 8px',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => jumpTo(id)} style={navBtnStyle(id)}>
            <span style={{ width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={14} strokeWidth={1.5} />
            </span>
            {label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={() => jumpTo('about')} style={navBtnStyle('about')}>
          <span style={{ width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Info size={14} strokeWidth={1.5} />
          </span>
          关于
        </button>
      </nav>

      {/* Right scroll area */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto' }}>
        <section id="general" ref={setRef('general')}><SectionGeneral /></section>
        <section id="ai"      ref={setRef('ai')}><SectionAiEngine /></section>
        <section id="voice"   ref={setRef('voice')}><SectionVoice /></section>
        <section id="guide"   ref={setRef('guide')}><SectionGuide /></section>
        <section id="plugins" ref={setRef('plugins')}><SectionPlugins /></section>
        <section id="about"   ref={setRef('about')} style={{ paddingBottom: 40 }}><SectionAbout /></section>
      </div>
    </div>
  )
}
