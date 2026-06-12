import { useCallback, useRef, type KeyboardEvent } from 'react'
import { Book, Lightbulb, Heart, Archive, RefreshCw, Zap, Settings } from 'lucide-react'
import type { Category } from '../contexts/UIContext'
import '../styles/nav-rail.css'

interface NavRailProps {
  activeCategory: Category
  onCategoryChange: (category: Category) => void
  onSettingsClick: () => void
}

interface NavItem {
  id: Category
  label: string
  icon: typeof Book
}

const CONTENT_ITEMS: NavItem[] = [
  { id: 'journal', label: '日志', icon: Book },
  { id: 'ideas', label: '想法', icon: Lightbulb },
  { id: 'memory', label: '记忆', icon: Heart },
  { id: 'topics', label: '专题', icon: Archive },
]

const TOOL_ITEMS: NavItem[] = [
  { id: 'automation', label: '自动化', icon: RefreshCw },
  { id: 'skills', label: '技能', icon: Zap },
]

const ALL_ITEMS = [...CONTENT_ITEMS, ...TOOL_ITEMS]

export function NavRail({ activeCategory, onCategoryChange, onSettingsClick }: NavRailProps) {
  const navRef = useRef<HTMLElement>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      const buttons = navRef.current?.querySelectorAll<HTMLButtonElement>(
        '.nav-rail__btn[data-category]',
      )
      if (!buttons?.length) return

      const currentIndex = ALL_ITEMS.findIndex((item) => item.id === activeCategory)
      let nextIndex = -1

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        nextIndex = (currentIndex + 1) % ALL_ITEMS.length
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        nextIndex = (currentIndex - 1 + ALL_ITEMS.length) % ALL_ITEMS.length
      }

      if (nextIndex >= 0) {
        onCategoryChange(ALL_ITEMS[nextIndex].id)
        buttons[nextIndex]?.focus()
      }
    },
    [activeCategory, onCategoryChange],
  )

  const renderButton = (item: NavItem) => {
    const isActive = activeCategory === item.id
    return (
      <button
        key={item.id}
        type="button"
        className={`nav-rail__btn${isActive ? ' is-active' : ''}`}
        aria-label={item.label}
        aria-current={isActive ? 'page' : undefined}
        data-tooltip={item.label}
        data-category={item.id}
        onClick={() => onCategoryChange(item.id)}
      >
        <item.icon size={18} strokeWidth={1.6} />
      </button>
    )
  }

  return (
    <nav
      ref={navRef}
      className="nav-rail"
      role="navigation"
      aria-label="分类导航"
      onKeyDown={handleKeyDown}
    >
      {CONTENT_ITEMS.map(renderButton)}
      <div className="nav-rail__divider" role="separator" />
      {TOOL_ITEMS.map(renderButton)}
      <div className="nav-rail__spacer" />
      <button
        type="button"
        className="nav-rail__btn"
        aria-label="设置"
        data-tooltip="设置"
        onClick={onSettingsClick}
      >
        <Settings size={18} strokeWidth={1.6} />
      </button>
    </nav>
  )
}
