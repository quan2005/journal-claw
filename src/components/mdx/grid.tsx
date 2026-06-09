import { type ReactNode } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// Grid + Col — 12-column classic grid
// ═══════════════════════════════════════════════════════════════════════════

export interface GridProps {
  children: ReactNode
  className?: string
  /** Total columns (default: 12) */
  cols?: number
  /** Gap in px (default: 16) */
  gap?: number
  /** Row gap override */
  rowGap?: number
  /** Break below this viewport width: stack columns vertically */
  stackBelow?: number
}

export function Grid({ children, className, cols = 12, gap = 16, rowGap, stackBelow }: GridProps) {
  return (
    <div
      className={`mdx-grid ${className ?? ''}`}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: rowGap != null ? `${rowGap}px ${gap}px` : `${gap}px`,
        ...(stackBelow
          ? {
              ['--mdx-grid-stack']: `@media (max-width: ${stackBelow}px) { grid-template-columns: 1fr; }`,
            }
          : {}),
      }}
    >
      {children}
    </div>
  )
}

export interface ColProps {
  children?: ReactNode
  className?: string
  /** Columns to span (default: fill remaining space) */
  span?: number | 'auto' | 'fill'
  /** Offset from left in columns */
  offset?: number
}

export function Col({ children, className, span, offset }: ColProps) {
  return (
    <div
      className={`mdx-col ${className ?? ''}`}
      style={{
        ...(span != null && span !== 'fill'
          ? { gridColumn: `span ${span}` }
          : span === 'fill'
            ? { gridColumn: '1 / -1' }
            : {}),
        ...(offset ? { marginInlineStart: `${(offset / 12) * 100}%` } : {}),
      }}
    >
      {children}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Flow — flexbox wrap layout, elements flow naturally and break to next row
// ═══════════════════════════════════════════════════════════════════════════

export interface FlowProps {
  children: ReactNode
  className?: string
  /** Gap between items in px (default: 12) */
  gap?: number
  /** Horizontal alignment */
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'
  /** Vertical alignment */
  align?: 'start' | 'center' | 'end' | 'stretch'
}

const justifyMap: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
}

const alignMap: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
}

export function Flow({
  children,
  className,
  gap = 12,
  justify = 'start',
  align = 'center',
}: FlowProps) {
  return (
    <div
      className={`mdx-flow ${className ?? ''}`}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: `${gap}px`,
        justifyContent: justifyMap[justify],
        alignItems: alignMap[align],
      }}
    >
      {children}
    </div>
  )
}
