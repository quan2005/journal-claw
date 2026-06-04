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

function rows(block: JournalBlock): string[][] {
  return block.body.format === 'rows' ? block.body.rows : []
}

export function AudienceFitBlock({ block }: { block: JournalBlock }) {
  return (
    <section
      className="journal-block journal-block-table"
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
      className="journal-block journal-block-pairs"
      aria-label={block.title ?? 'Myth and fact'}
    >
      {block.title && <div className="journal-block-section-title">{block.title}</div>}
      {rows(block).map(([myth, fact, reason], index) => (
        <article key={`${myth}-${index}`} className="journal-block-pair">
          <div>
            <div className="journal-block-kicker">Myth</div>
            <p>{myth}</p>
          </div>
          <div>
            <div className="journal-block-kicker">Fact</div>
            <p>{fact}</p>
            {reason && <span>{reason}</span>}
          </div>
        </article>
      ))}
    </section>
  )
}

export function ManifestoBlock({ block }: { block: JournalBlock }) {
  return (
    <section
      className="journal-block journal-block-manifesto"
      aria-label={block.title ?? 'Manifesto'}
    >
      {block.title && <div className="journal-block-section-title">{block.title}</div>}
      {rows(block).map(([principle, detail], index) => (
        <div key={`${principle}-${index}`} className="journal-block-row">
          <span className="journal-block-row-marker">{String(index + 1).padStart(2, '0')}</span>
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
    <section className="journal-block journal-block-bridge">
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
