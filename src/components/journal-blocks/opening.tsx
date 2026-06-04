import type { JournalBlock } from '../../lib/journalLayout'

function fields(block: JournalBlock): Record<string, string> {
  return block.body.format === 'fields' ? block.body.fields : {}
}

function rows(block: JournalBlock): string[][] {
  return block.body.format === 'rows' ? block.body.rows : []
}

export function HeroBlock({ block }: { block: JournalBlock }) {
  const data = fields(block)
  return (
    <section className="journal-block journal-block-hero">
      {data.eyebrow && <div className="journal-block-kicker">{data.eyebrow}</div>}
      <h1>{data.title}</h1>
      {data.subtitle && <p>{data.subtitle}</p>}
      {data.meta && <div className="journal-block-meta">{data.meta}</div>}
    </section>
  )
}

export function CardsBlock({ block }: { block: JournalBlock }) {
  return (
    <section className="journal-block journal-block-cards" aria-label={block.title ?? 'Cards'}>
      {block.title && <div className="journal-block-section-title">{block.title}</div>}
      <div className="journal-block-card-grid">
        {rows(block).map(([title, description, meta, variant], index) => (
          <article
            key={`${title}-${index}`}
            className={`journal-layout-card ${variant === 'accent' ? 'journal-layout-card-accent' : ''}`}
          >
            <h3>{title}</h3>
            {description && <p>{description}</p>}
            {meta && <div className="journal-block-meta">{meta}</div>}
          </article>
        ))}
      </div>
    </section>
  )
}

export function TocBlock({ block }: { block: JournalBlock }) {
  return (
    <nav className="journal-block journal-block-toc" aria-label={block.title ?? 'Contents'}>
      {block.title && <div className="journal-block-section-title">{block.title}</div>}
      {rows(block).map(([label, title, description], index) => (
        <div key={`${label}-${title}-${index}`} className="journal-block-row">
          <span className="journal-block-row-marker">{label}</span>
          <div>
            <h3>{title}</h3>
            {description && <p>{description}</p>}
          </div>
        </div>
      ))}
    </nav>
  )
}

export function PartBlock({ block }: { block: JournalBlock }) {
  const data = fields(block)
  return (
    <section className="journal-block journal-block-part">
      {data.label && <div className="journal-block-kicker">{data.label}</div>}
      <h2>{data.title}</h2>
      {data.subtitle && <p>{data.subtitle}</p>}
    </section>
  )
}

export function LabelTitleBlock({ block }: { block: JournalBlock }) {
  const data = fields(block)
  return (
    <section className="journal-block journal-block-label-title">
      {data.label && <div className="journal-block-kicker">{data.label}</div>}
      <h2>{data.title}</h2>
      {data.subtitle && <p>{data.subtitle}</p>}
    </section>
  )
}
