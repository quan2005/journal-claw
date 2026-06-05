import type { JournalBlock } from '../../lib/journalLayout'

function fields(block: JournalBlock): Record<string, string> {
  return block.body.format === 'fields' ? block.body.fields : {}
}

function rows(block: JournalBlock): string[][] {
  return block.body.format === 'rows' ? block.body.rows : []
}

function personInitial(name: string): string {
  return name.trim().slice(0, 1).toUpperCase()
}

function splitRoleAndNote(roleRaw?: string, noteRaw?: string): { role: string; note: string } {
  const role = roleRaw?.trim() ?? ''
  const note = noteRaw?.trim() ?? ''
  if (note || !role.includes('·')) return { role, note }

  const [head, ...tail] = role.split('·')
  return {
    role: head.trim(),
    note: tail.join('·').trim(),
  }
}

export function AuthorCardBlock({ block }: { block: JournalBlock }) {
  const data = fields(block)
  return (
    <section className="journal-block journal-block-prose journal-block-author-card">
      <div className="journal-block-author-mark" aria-hidden="true">
        {data.name?.slice(0, 1).toUpperCase()}
      </div>
      <div className="journal-block-author-body">
        <h3 className="journal-block-author-name">{data.name}</h3>
        {data.role && <div className="journal-block-author-role">{data.role}</div>}
        {data.bio && <p className="journal-block-author-bio">{data.bio}</p>}
      </div>
    </section>
  )
}

export function SubscribeBlock({ block }: { block: JournalBlock }) {
  const data = fields(block)
  return (
    <section className="journal-block journal-block-prose journal-block-subscribe">
      <h2>{data.title}</h2>
      {data.description && <p>{data.description}</p>}
    </section>
  )
}

export function PeopleBlock({ block }: { block: JournalBlock }) {
  return (
    <section
      className="journal-block journal-block-content journal-block-people"
      aria-label={block.title ?? 'People'}
    >
      {block.title && <div className="journal-block-section-title">{block.title}</div>}
      <div className="journal-block-people-grid">
        {rows(block).map(([name, roleRaw, noteRaw], index) => {
          const { role, note } = splitRoleAndNote(roleRaw, noteRaw)
          const cardClassName = note
            ? 'journal-block-person-card'
            : 'journal-block-person-card journal-block-person-card--header-only'

          return (
            <article key={`${name}-${index}`} className={cardClassName}>
              <div className="journal-block-person-initial" aria-hidden="true">
                {personInitial(name)}
              </div>
              <div className="journal-block-person-heading">
                <h3 className="journal-block-person-name">{name}</h3>
                {role && <span className="journal-block-person-role">{role}</span>}
              </div>
              {note && <p className="journal-block-person-note">{note}</p>}
            </article>
          )
        })}
      </div>
    </section>
  )
}

export function SeriesBlock({ block }: { block: JournalBlock }) {
  return (
    <section
      className="journal-block journal-block-content journal-block-series"
      aria-label={block.title ?? 'Series'}
    >
      {block.title && <div className="journal-block-section-title">{block.title}</div>}
      {rows(block).map(([title, status, path], index) => (
        <div key={`${title}-${index}`} className="journal-block-row journal-block-series-row">
          <span className="journal-block-marker journal-block-row-marker" aria-hidden="true">
            {String(index + 1).padStart(2, '0')}
          </span>
          <div>
            <h3>{title}</h3>
            <p>{[status, path].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
      ))}
    </section>
  )
}
