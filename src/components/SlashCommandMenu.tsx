import { useState, useEffect, useCallback } from 'react'
import { filterCommands, type SlashCommand } from '../lib/slashCommands'
import { useTranslation } from '../contexts/I18nContext'

interface SlashCommandMenuProps {
  query: string
  onSelect: (cmd: SlashCommand) => void
  onClose: () => void
}

export function SlashCommandMenu({ query, onSelect, onClose }: SlashCommandMenuProps) {
  const { t } = useTranslation()
  const commands = filterCommands(query)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % commands.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + commands.length) % commands.length)
      } else if (e.key === 'Enter' && commands.length > 0) {
        e.preventDefault()
        onSelect(commands[activeIndex])
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    },
    [commands, activeIndex, onSelect, onClose],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [handleKeyDown])

  if (commands.length === 0) return null

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
      }}
    >
      {commands.map((cmd, i) => (
        <div
          key={cmd.name}
          onClick={() => onSelect(cmd)}
          onMouseEnter={() => setActiveIndex(i)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 12px',
            cursor: 'pointer',
            background: i === activeIndex ? 'var(--item-hover-bg)' : 'transparent',
            transition: 'background 0.1s ease-out',
          }}
        >
          <span style={{ fontSize: 'var(--text-sm)', width: 20, textAlign: 'center' }}>
            {cmd.icon}
          </span>
          <span
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--item-text)',
              fontWeight: 'var(--font-medium)',
            }}
          >
            /{cmd.name}
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--item-meta)', flex: 1 }}>
            {(t as unknown as (key: string) => string)(cmd.descriptionKey)}
          </span>
          {i === activeIndex && (
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--item-meta)',
                opacity: 0.5,
                fontFamily: 'var(--font-mono)',
              }}
            >
              ↵
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
