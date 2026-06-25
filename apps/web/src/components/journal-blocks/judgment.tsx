import type { JournalBlock } from '../../lib/journalLayout'

export function VerdictBlock({ block }: { block: JournalBlock }) {
  const fields = block.body.format === 'fields' ? block.body.fields : {}
  const variant = typeof block.attrs.variant === 'string' ? block.attrs.variant : 'default'
  return (
    <section
      className={`journal-block journal-block-prose journal-block-verdict journal-block-verdict-${variant}`}
    >
      <div className="journal-block-kicker">{fields.status ?? block.title ?? 'Verdict'}</div>
      <h2>{fields.title}</h2>
      {fields.summary && <p>{fields.summary}</p>}
      {fields.confidence && (
        <div className="journal-block-meta">Confidence: {fields.confidence}</div>
      )}
    </section>
  )
}

function rows(block: JournalBlock): string[][] {
  return block.body.format === 'rows' ? block.body.rows : []
}

export function MythFactBlock({ block }: { block: JournalBlock }) {
  return (
    <section
      className="journal-block journal-block-content journal-block-myth-fact"
      aria-label={block.title ?? 'Myth and fact'}
    >
      {block.title && <div className="journal-block-section-title">{block.title}</div>}
      {rows(block).map(([myth, fact, reason], index) => (
        <article key={`${myth}-${index}`} className="journal-block-myth-fact-row">
          <div className="journal-block-myth journal-block-myth-fact-side">
            <span className="journal-block-myth-mark" aria-hidden="true">
              ×
            </span>
            <div className="journal-block-myth-fact-copy">
              <div className="journal-block-myth-fact-heading">
                <div className="journal-block-kicker">Myth</div>
              </div>
              <p>{myth}</p>
            </div>
          </div>
          <div className="journal-block-fact journal-block-myth-fact-side">
            <span className="journal-block-fact-mark" aria-hidden="true">
              ✓
            </span>
            <div className="journal-block-myth-fact-copy">
              <div className="journal-block-myth-fact-heading">
                <div className="journal-block-kicker">Fact</div>
              </div>
              <p>{fact}</p>
              {reason && <span className="journal-block-fact-reason">{reason}</span>}
            </div>
          </div>
        </article>
      ))}
    </section>
  )
}
