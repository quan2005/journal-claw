import type { JournalBlock } from '../../lib/journalLayout'

const labels: Record<string, string> = {
  note: 'Note',
  tip: 'Tip',
  info: 'Info',
  warning: 'Warning',
  danger: 'Danger',
}

export function CalloutBlock({ block }: { block: JournalBlock }) {
  const tone = block.modifier ?? 'note'
  const rows = block.body.format === 'rows' ? block.body.rows : []
  const content = rows.map((row) => row.join(' | ')).join('\n')

  return (
    <aside className={`journal-block journal-block-callout journal-block-callout-${tone}`}>
      <div className="journal-block-callout-title">{block.title ?? labels[tone] ?? 'Note'}</div>
      <div className="journal-block-callout-body">{content}</div>
    </aside>
  )
}
