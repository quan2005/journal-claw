import type { JournalBlock } from '../../lib/journalLayout'

function fields(block: JournalBlock): Record<string, string> {
  return block.body.format === 'fields' ? block.body.fields : {}
}

function rows(block: JournalBlock): string[][] {
  return block.body.format === 'rows' ? block.body.rows : []
}

export function AuthorCardBlock({ block }: { block: JournalBlock }) {
  const data = fields(block)
  return (
    <section className="journal-block journal-block-person-card">
      <div className="journal-block-avatar">{data.name?.slice(0, 1).toUpperCase()}</div>
      <div>
        <h3>{data.name}</h3>
        {data.role && <div className="journal-block-meta">{data.role}</div>}
        {data.bio && <p>{data.bio}</p>}
      </div>
    </section>
  )
}

export function SubscribeBlock({ block }: { block: JournalBlock }) {
  const data = fields(block)
  return (
    <section className="journal-block journal-block-subscribe">
      <h2>{data.title}</h2>
      {data.description && <p>{data.description}</p>}
    </section>
  )
}

export function PeopleBlock({ block }: { block: JournalBlock }) {
  return (
    <section className="journal-block journal-block-row-cards" aria-label={block.title ?? 'People'}>
      {block.title && <div className="journal-block-section-title">{block.title}</div>}
      <div className="journal-block-card-grid">
        {rows(block).map(([name, role, note], index) => (
          <article key={`${name}-${index}`} className="journal-layout-card">
            <h3>{name}</h3>
            {role && <div className="journal-block-meta">{role}</div>}
            {note && <p>{note}</p>}
          </article>
        ))}
      </div>
    </section>
  )
}

export function SeriesBlock({ block }: { block: JournalBlock }) {
  return (
    <section className="journal-block journal-block-series" aria-label={block.title ?? 'Series'}>
      {block.title && <div className="journal-block-section-title">{block.title}</div>}
      {rows(block).map(([title, status, path], index) => (
        <div key={`${title}-${index}`} className="journal-block-row">
          <span className="journal-block-row-marker">{String(index + 1).padStart(2, '0')}</span>
          <div>
            <h3>{title}</h3>
            <p>{[status, path].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
      ))}
    </section>
  )
}
