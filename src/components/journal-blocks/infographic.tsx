import type { JournalBlock } from '../../lib/journalLayout'

function rows(block: JournalBlock): string[][] {
  return block.body.format === 'rows' ? block.body.rows : []
}

export function MetricsBlock({ block }: { block: JournalBlock }) {
  return (
    <section
      className="journal-block journal-block-content journal-block-metrics"
      aria-label={block.title ?? 'Metrics'}
    >
      {block.title && <div className="journal-block-section-title">{block.title}</div>}
      <div className="journal-block-metric-grid">
        {rows(block).map(([label, value, description], index) => (
          <div key={`${label}-${index}`} className="journal-block-metric">
            <div className="journal-block-metric-value">{value}</div>
            <div className="journal-block-metric-label">{label}</div>
            {description && <div className="journal-block-metric-desc">{description}</div>}
          </div>
        ))}
      </div>
    </section>
  )
}

export function StepsBlock({ block }: { block: JournalBlock }) {
  return (
    <section
      className="journal-block journal-block-content journal-block-steps"
      aria-label={block.title ?? 'Steps'}
    >
      {block.title && <div className="journal-block-section-title">{block.title}</div>}
      {rows(block).map(([title, description, meta], index) => (
        <div key={`${title}-${index}`} className="journal-block-step">
          <div className="journal-block-marker journal-block-step-index" aria-hidden="true">
            {String(index + 1).padStart(2, '0')}
          </div>
          <div>
            <h3>{title}</h3>
            {description && <p>{description}</p>}
            {meta && <div className="journal-block-meta">{meta}</div>}
          </div>
        </div>
      ))}
    </section>
  )
}

export function TimelineBlock({ block }: { block: JournalBlock }) {
  const items = rows(block)
  return (
    <section
      className="journal-block journal-block-content journal-block-timeline"
      aria-label={block.title ?? 'Timeline'}
    >
      {block.title && <div className="journal-block-section-title">{block.title}</div>}
      <div className="journal-block-timeline-track">
        <div className="journal-block-timeline-axis" aria-hidden="true" />
        {items.map(([time, title, description], index) => (
          <div
            key={`${time}-${title}-${index}`}
            className={`journal-block-timeline-item ${
              index === 0 ? 'journal-block-timeline-item-active' : ''
            }`}
          >
            <div className="journal-block-timeline-node" aria-hidden="true" />
            <time className="journal-block-timeline-date">{time}</time>
            <div>
              <h3>{title}</h3>
              {description && <p>{description}</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function CompareBlock({ block }: { block: JournalBlock }) {
  return (
    <section
      className="journal-block journal-block-wide journal-block-compare"
      aria-label={block.title ?? 'Compare'}
    >
      {block.title && <div className="journal-block-section-title">{block.title}</div>}
      <div className="journal-block-compare-list">
        {rows(block).map(([item, left, right], index) => (
          <article key={`${item}-${index}`} className="journal-block-compare-row">
            <div className="journal-block-compare-side journal-block-compare-side-left">
              <div className="journal-block-kicker">{item}</div>
              <p>{left}</p>
            </div>
            <div className="journal-block-compare-vs" aria-hidden="true">
              VS
            </div>
            <div className="journal-block-compare-side journal-block-compare-side-right">
              <div className="journal-block-kicker">Recommended</div>
              <p>{right}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export function InfographicBlock({ block }: { block: JournalBlock }) {
  const fields = block.body.format === 'fields' ? block.body.fields : {}
  return (
    <section className="journal-block journal-block-infographic">
      {fields.value && <div className="journal-block-infographic-value">{fields.value}</div>}
      <h2>{fields.title}</h2>
      {fields.summary && <p>{fields.summary}</p>}
    </section>
  )
}
