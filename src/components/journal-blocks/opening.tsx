import { Fragment } from 'react'
import type { JournalBlock } from '../../lib/journalLayout'

function rows(block: JournalBlock): string[][] {
  return block.body.format === 'rows' ? block.body.rows : []
}

function jsonObject(block: JournalBlock): Record<string, unknown> {
  return block.body.format === 'json_object' ? block.body.value : {}
}

function stringValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function TextWithBreaks({ value }: { value: string }) {
  const parts = value.split(/<br\s*\/?>/gi)
  if (parts.length === 1) return <>{value}</>

  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 && <br />}
          {part}
        </Fragment>
      ))}
    </>
  )
}

export function CardsBlock({ block }: { block: JournalBlock }) {
  return (
    <section
      className="journal-block journal-block-content journal-block-cards"
      aria-label={block.title ?? 'Cards'}
    >
      {block.title && <div className="journal-block-section-title">{block.title}</div>}
      <div className="journal-block-card-grid">
        {rows(block).map(([title, description, meta, variant], index) => (
          <article
            key={`${title}-${index}`}
            className={`journal-layout-card ${variant === 'accent' ? 'journal-layout-card-accent' : ''}`}
          >
            <h3>{title}</h3>
            {description && (
              <p>
                <TextWithBreaks value={description} />
              </p>
            )}
            {meta && (
              <div className="journal-block-meta">
                <TextWithBreaks value={meta} />
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}

export function TocBlock({ block }: { block: JournalBlock }) {
  return (
    <nav
      className="journal-block journal-block-content journal-block-toc"
      aria-label={block.title ?? 'Contents'}
    >
      {block.title && <div className="journal-block-section-title">{block.title}</div>}
      {rows(block).map(([label, title, description], index) => (
        <div key={`${label}-${title}-${index}`} className="journal-block-row journal-block-toc-row">
          <span className="journal-block-marker journal-block-row-marker" aria-hidden="true">
            {label}
          </span>
          <div>
            <h3>{title}</h3>
            {description && <p>{description}</p>}
          </div>
        </div>
      ))}
    </nav>
  )
}

export function HeroBlock({ block }: { block: JournalBlock }) {
  const data = jsonObject(block)
  const title = stringValue(data.title)
  const kicker = stringValue(data.eyebrow) || stringValue(data.kicker)
  const lead = stringValue(data.subtitle) || stringValue(data.lead)
  const meta = stringValue(data.meta)

  return (
    <section className="journal-block journal-block-hero">
      {kicker && (
        <div className="journal-block-hero-kicker">{kicker}</div>
      )}
      <h1 className="journal-block-hero-title">
        <TextWithBreaks value={title} />
      </h1>
      {lead && <p className="journal-block-hero-lead">{lead}</p>}
      {meta && <p className="journal-block-hero-meta">{meta}</p>}
    </section>
  )
}
