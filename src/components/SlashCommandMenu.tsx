import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchSkills, filterSkills, type SkillItem } from '../lib/slashCommands'

interface SlashCommandMenuProps {
  query: string
  onSelect: (skillName: string) => void
  onClose: () => void
}

export function SlashCommandMenu({ query, onSelect, onClose }: SlashCommandMenuProps) {
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchSkills().then(setSkills)
  }, [])

  const filtered = filterSkills(skills, query)

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const item = list.children[activeIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % (filtered.length || 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + (filtered.length || 1)) % (filtered.length || 1))
      } else if (e.key === 'Enter' && filtered.length > 0) {
        e.preventDefault()
        onSelect(filtered[activeIndex].name)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    },
    [filtered, activeIndex, onSelect, onClose],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [handleKeyDown])

  if (filtered.length === 0) return null

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        right: 0,
        marginBottom: 4,
        background: 'var(--queue-bg)',
        border: '0.5px solid var(--queue-border)',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 -4px 16px var(--context-menu-shadow)',
        zIndex: 10,
        maxHeight: 280,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div ref={listRef} style={{ overflowY: 'auto', flex: 1 }}>
        {filtered.map((skill, i) => (
          <div
            key={skill.name}
            onClick={() => onSelect(skill.name)}
            onMouseEnter={() => setActiveIndex(i)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 12px',
              cursor: 'pointer',
              background: i === activeIndex ? 'var(--item-hover-bg)' : 'transparent',
              transition: 'background 0.1s ease-out',
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--item-meta)',
                opacity: 0.6,
                width: 16,
                textAlign: 'center',
                flexShrink: 0,
              }}
            >
              ⚡
            </span>
            <span
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--item-text)',
                fontWeight: 'var(--font-medium)',
                flexShrink: 0,
              }}
            >
              /{skill.name}
            </span>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--item-meta)',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
              }}
            >
              {skill.description}
            </span>
            {i === activeIndex && (
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--item-meta)',
                  opacity: 0.5,
                  fontFamily: 'var(--font-mono)',
                  flexShrink: 0,
                }}
              >
                ↵
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
