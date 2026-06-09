import type { ReactNode } from 'react'
import { Table } from './display'

export type ActionStatus = 'open' | 'doing' | 'blocked' | 'done' | string

export function StatusBadge({
  status,
  tone = 'neutral',
}: {
  status: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
}) {
  return <span className={`mdx-status-badge mdx-status-badge--${tone}`}>{status}</span>
}

export interface DecisionOption {
  label: string
  tradeoff?: string
}

export function DecisionRecord({
  question,
  decision,
  owner,
  due,
  options = [],
  rationale,
}: {
  question: string
  decision: string
  owner?: string
  due?: string
  options?: DecisionOption[]
  rationale?: string
}) {
  return (
    <section className="mdx-decision-record mdx-specialized-prose">
      <div className="mdx-decision-question">{question}</div>
      <div className="mdx-decision-answer">{decision}</div>
      {(owner || due) && (
        <div className="mdx-decision-meta">
          {owner && <span>负责人: {owner}</span>}
          {due && <span>截止: {due}</span>}
        </div>
      )}
      {options.length > 0 && (
        <div className="mdx-decision-options">
          {options.map((option) => (
            <div key={option.label} className="mdx-decision-option">
              <strong>{option.label}</strong>
              {option.tradeoff && <span>{option.tradeoff}</span>}
            </div>
          ))}
        </div>
      )}
      {rationale && <p className="mdx-decision-rationale">{rationale}</p>}
    </section>
  )
}

export function ComparisonMatrix({
  columns,
  rows,
}: {
  columns: string[]
  rows: { label: string; values: string[] }[]
}) {
  return (
    <Table
      headers={['对象', ...columns]}
      rows={rows.map((row) => [row.label, ...columns.map((_, index) => row.values[index] ?? '')])}
    />
  )
}

export function RACI({
  rows,
}: {
  rows: {
    work: string
    responsible?: string
    accountable?: string
    consulted?: string
    informed?: string
  }[]
}) {
  return (
    <Table
      headers={['事项', 'R', 'A', 'C', 'I']}
      rows={rows.map((row) => [
        row.work,
        row.responsible ?? '',
        row.accountable ?? '',
        row.consulted ?? '',
        row.informed ?? '',
      ])}
    />
  )
}

export function MilestoneTimeline({
  items,
}: {
  items: { time: string; title: string; desc?: string }[]
}) {
  return (
    <div className="mdx-semantic-timeline mdx-specialized-content">
      {items.map((item) => (
        <div key={`${item.time}-${item.title}`} className="mdx-semantic-timeline-item">
          <span>{item.time}</span>
          <strong>{item.title}</strong>
          {item.desc && <p>{item.desc}</p>}
        </div>
      ))}
    </div>
  )
}

function SemanticCard({
  className,
  title,
  meta,
  children,
}: {
  className: string
  title: string
  meta?: string
  children: ReactNode
}) {
  return (
    <aside className={`mdx-semantic-card mdx-specialized-prose ${className}`}>
      <div className="mdx-semantic-card-title">{title}</div>
      {meta && <div className="mdx-semantic-card-meta">{meta}</div>}
      <div className="mdx-semantic-card-body">{children}</div>
    </aside>
  )
}

export function InsightCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SemanticCard className="mdx-insight-card" title={title}>
      {children}
    </SemanticCard>
  )
}
