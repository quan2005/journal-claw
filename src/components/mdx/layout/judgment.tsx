import { fieldsBlock, LayoutBlock, rowsBlock } from './blockFactory'

export function Verdict({
  title,
  summary,
  confidence,
  status,
  variant = 'default',
}: {
  title: string
  summary?: string
  confidence?: string
  status?: string
  variant?: 'default' | 'success' | 'warning' | 'danger'
}) {
  return (
    <LayoutBlock
      block={fieldsBlock('verdict', { title, summary, confidence, status }, { attrs: { variant } })}
    />
  )
}

export interface MythFactItem {
  myth: string
  fact: string
  reason?: string
}

export function MythFact({
  heading,
  title,
  items,
}: {
  heading?: string
  title?: string
  items: MythFactItem[]
}) {
  return (
    <LayoutBlock
      block={rowsBlock('myth-fact', items, ['myth', 'fact', 'reason'], { title: heading ?? title })}
    />
  )
}
