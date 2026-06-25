import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { JournalBlock } from '../../lib/journalLayout'

function fields(block: JournalBlock): Record<string, string> {
  return block.body.format === 'fields' ? block.body.fields : {}
}

function rows(block: JournalBlock): string[][] {
  return block.body.format === 'rows' ? block.body.rows : []
}

function InlineMarkdown({ value }: { value: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      allowedElements={['p', 'strong', 'em', 'del', 'code', 'a', 'br']}
      unwrapDisallowed
    >
      {value}
    </ReactMarkdown>
  )
}

function ChecklistMarkIcon() {
  return (
    <svg
      className="journal-block-check-icon"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path className="journal-block-check-icon-check" d="M9 11l3 3L22 4" />
      <path
        className="journal-block-check-icon-box"
        d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"
      />
    </svg>
  )
}

export function FaqBlock({ block }: { block: JournalBlock }) {
  return (
    <section
      className="journal-block journal-block-prose journal-block-faq"
      aria-label={block.title ?? 'FAQ'}
    >
      {block.title && <div className="journal-block-section-title">{block.title}</div>}
      {rows(block).map(([question, answer], index) => (
        <details key={`${question}-${index}`} className="journal-block-faq-item">
          <summary>{question}</summary>
          <p>{answer}</p>
        </details>
      ))}
    </section>
  )
}

export function CtaBlock({ block }: { block: JournalBlock }) {
  const data = fields(block)
  return (
    <section className="journal-block journal-block-prose journal-block-cta">
      <h2>{data.title}</h2>
      {data.description && <p>{data.description}</p>}
      {data.action && <div className="journal-block-meta">{data.action}</div>}
    </section>
  )
}

export function ChecklistBlock({ block }: { block: JournalBlock }) {
  return (
    <section
      className="journal-block journal-block-prose journal-block-checklist"
      aria-label={block.title ?? 'Checklist'}
    >
      {block.title && <div className="journal-block-section-title">{block.title}</div>}
      <ul className="journal-block-checklist-list">
        {rows(block).map(([item, state = 'todo'], index) => {
          const normalizedState = state === 'checked' ? 'done' : state
          return (
            <li
              key={`${item}-${index}`}
              className="journal-block-checklist-item"
              data-state={normalizedState}
            >
              <span className="journal-block-check-marker" aria-hidden="true">
                <ChecklistMarkIcon />
              </span>
              <span className="journal-block-checklist-text">{item}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function CasesBlock({ block }: { block: JournalBlock }) {
  return <RowsCardBlock block={block} ariaLabel="Cases" />
}

export function SummaryBlock({ block }: { block: JournalBlock }) {
  const data = fields(block)
  return (
    <section className="journal-block journal-block-prose journal-block-summary">
      <h2>{data.title}</h2>
      {data.body && <InlineMarkdown value={data.body} />}
    </section>
  )
}

export function ToolboxBlock({ block }: { block: JournalBlock }) {
  return <RowsCardBlock block={block} ariaLabel="Toolbox" />
}

function RowsCardBlock({ block, ariaLabel }: { block: JournalBlock; ariaLabel: string }) {
  return (
    <section
      className="journal-block journal-block-content journal-block-row-cards"
      aria-label={block.title ?? ariaLabel}
    >
      {block.title && <div className="journal-block-section-title">{block.title}</div>}
      <div className="journal-block-card-grid">
        {rows(block).map((row, index) => (
          <article key={`${row[0]}-${index}`} className="journal-layout-card">
            <h3>{row[0]}</h3>
            {row.slice(1).map((cell, cellIndex) => (
              <p key={cellIndex}>{cell}</p>
            ))}
          </article>
        ))}
      </div>
    </section>
  )
}
