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

export function AudienceFitBlock({ block }: { block: JournalBlock }) {
  return (
    <section
      className="journal-block journal-block-wide journal-block-table"
      aria-label={block.title ?? 'Audience fit'}
    >
      {block.title && <div className="journal-block-section-title">{block.title}</div>}
      <div className="journal-block-table-grid journal-block-table-grid-3">
        {rows(block).map(([audience, fit, reason], index) => (
          <div key={`${audience}-${index}`} className="journal-block-table-row">
            <strong>{audience}</strong>
            <span>{fit}</span>
            <span>{reason}</span>
          </div>
        ))}
      </div>
    </section>
  )
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

export function ManifestoBlock({ block }: { block: JournalBlock }) {
  return (
    <section
      className="journal-block journal-block-content journal-block-manifesto"
      aria-label={block.title ?? 'Manifesto'}
    >
      {block.title && <div className="journal-block-section-title">{block.title}</div>}
      {rows(block).map(([principle, detail], index) => (
        <div
          key={`${principle}-${index}`}
          className="journal-block-row journal-block-manifesto-row"
        >
          <span className="journal-block-marker journal-block-row-marker" aria-hidden="true">
            {String(index + 1).padStart(2, '0')}
          </span>
          <div>
            <h3>{principle}</h3>
            {detail && <p>{detail}</p>}
          </div>
        </div>
      ))}
    </section>
  )
}

export function BridgeBlock({ block }: { block: JournalBlock }) {
  const fields = block.body.format === 'fields' ? block.body.fields : {}
  return (
    <section className="journal-block journal-block-content journal-block-bridge">
      <div className="journal-block-bridge-node">
        <div className="journal-block-kicker">From</div>
        <p>{fields.from}</p>
      </div>
      <div className="journal-block-bridge-arrow">→</div>
      <div className="journal-block-bridge-node">
        <div className="journal-block-kicker">To</div>
        <p>{fields.to}</p>
      </div>
      {fields.why && <div className="journal-block-bridge-why">{fields.why}</div>}
    </section>
  )
}
