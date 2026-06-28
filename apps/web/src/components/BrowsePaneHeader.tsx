import type { ReactNode } from 'react'

interface BrowsePaneHeaderProps {
  /** Page-specific icon (orange identity point). */
  icon: ReactNode
  /** Page name label, e.g. 专题 / 画像 / Timeline. */
  label: string
}

/**
 * Compact single-row browse pane header (Plan A):
 * orange icon + page name on one line, ~30px tall, 1px bottom divider.
 * No Playfair display title, no description paragraph.
 */
export function BrowsePaneHeader({ icon, label }: BrowsePaneHeaderProps) {
  return (
    <header className="browse-pane-header">
      <span className="browse-pane-header__icon">{icon}</span>
      <span className="browse-pane-header__label">{label}</span>
    </header>
  )
}
