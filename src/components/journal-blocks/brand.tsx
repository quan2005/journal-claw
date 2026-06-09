import type { JournalBlock } from '../../lib/journalLayout'

function fields(block: JournalBlock): Record<string, string> {
  return block.body.format === 'fields' ? block.body.fields : {}
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
