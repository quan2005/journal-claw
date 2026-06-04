import type { JournalBlock } from '../../lib/journalLayout'

export function VerdictBlock({ block }: { block: JournalBlock }) {
  const fields = block.body.format === 'fields' ? block.body.fields : {}
  const variant = typeof block.attrs.variant === 'string' ? block.attrs.variant : 'default'
  return (
    <section className={`journal-block journal-block-verdict journal-block-verdict-${variant}`}>
      <div className="journal-block-kicker">{fields.status ?? block.title ?? 'Verdict'}</div>
      <h2>{fields.title}</h2>
      {fields.summary && <p>{fields.summary}</p>}
      {fields.confidence && (
        <div className="journal-block-meta">Confidence: {fields.confidence}</div>
      )}
    </section>
  )
}
