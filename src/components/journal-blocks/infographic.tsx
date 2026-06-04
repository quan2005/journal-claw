import type { JournalBlock } from '../../lib/journalLayout'

function rows(block: JournalBlock): string[][] {
  return block.body.format === 'rows' ? block.body.rows : []
}

export function MetricsBlock({ block }: { block: JournalBlock }) {
  return (
    <section className="journal-block journal-block-metrics" aria-label={block.title ?? 'Metrics'}>
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
    <section className="journal-block journal-block-steps" aria-label={block.title ?? 'Steps'}>
      {block.title && <div className="journal-block-section-title">{block.title}</div>}
      {rows(block).map(([title, description, meta], index) => (
        <div key={`${title}-${index}`} className="journal-block-step">
          <div className="journal-block-step-index">{String(index + 1).padStart(2, '0')}</div>
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
  return (
    <section
      className="journal-block journal-block-timeline"
      aria-label={block.title ?? 'Timeline'}
    >
      {block.title && <div className="journal-block-section-title">{block.title}</div>}
      {rows(block).map(([time, title, description], index) => (
        <div key={`${time}-${title}-${index}`} className="journal-block-timeline-item">
          <time>{time}</time>
          <div>
            <h3>{title}</h3>
            {description && <p>{description}</p>}
          </div>
        </div>
      ))}
    </section>
  )
}

export function CompareBlock({ block }: { block: JournalBlock }) {
  return (
    <section className="journal-block journal-block-table" aria-label={block.title ?? 'Compare'}>
      {block.title && <div className="journal-block-section-title">{block.title}</div>}
      <div className="journal-block-table-grid journal-block-table-grid-3">
        {rows(block).map(([item, left, right], index) => (
          <div key={`${item}-${index}`} className="journal-block-table-row">
            <strong>{item}</strong>
            <span>{left}</span>
            <span>{right}</span>
          </div>
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
