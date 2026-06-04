import type { JournalBlock } from '../../lib/journalLayout'

export function FaqBlock({ block }: { block: JournalBlock }) {
  const rows = block.body.format === 'rows' ? block.body.rows : []
  return (
    <section className="journal-block journal-block-faq" aria-label={block.title ?? 'FAQ'}>
      {block.title && <div className="journal-block-section-title">{block.title}</div>}
      {rows.map(([question, answer], index) => (
        <details key={`${question}-${index}`} className="journal-block-faq-item">
          <summary>{question}</summary>
          <p>{answer}</p>
        </details>
      ))}
    </section>
  )
}
