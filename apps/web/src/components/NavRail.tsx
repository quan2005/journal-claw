import { useCallback, useRef, type KeyboardEvent } from 'react'
import { ScrollText, Lightbulb, Users, Archive, Bot, Zap, Settings } from 'lucide-react'
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
  icon: typeof ScrollText
}

// 全屏类（不需要侧栏）
const FULLSCREEN_ITEMS: NavItem[] = [
  { id: 'ideas', label: '想法', icon: Lightbulb },
  { id: 'automation', label: '自动化', icon: Bot },
  { id: 'skills', label: '技能', icon: Zap },
]

// 列表类（需要侧栏）
const LIST_ITEMS: NavItem[] = [
  { id: 'topics', label: '专题', icon: Archive },
  { id: 'identity', label: '画像', icon: Users },
  { id: 'journal', label: '流水', icon: ScrollText },
]

const ALL_ITEMS = [...FULLSCREEN_ITEMS, ...LIST_ITEMS]

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
      {FULLSCREEN_ITEMS.map(renderButton)}
      <div className="nav-rail__divider" role="separator" />
      {LIST_ITEMS.map(renderButton)}
      <div className="nav-rail__spacer" />
      <button
        type="button"
        className="nav-rail__btn"
        aria-label="设置"
        data-tooltip="设置 ⌘,"
        onClick={onSettingsClick}
      >
        <Settings size={18} strokeWidth={1.6} />
      </button>
    </nav>
  )
}
