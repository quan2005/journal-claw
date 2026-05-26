// ── ProsCons ────────────────────────────────────────────

export function ProsCons({ children }: { children: React.ReactNode }) {
  return <div className="mdx-pros-cons">{children}</div>
}

export function Pros({ children }: { children: React.ReactNode }) {
  return <div className="mdx-pros"><h4>Pros</h4><ul>{children}</ul></div>
}

export function Cons({ children }: { children: React.ReactNode }) {
  return <div className="mdx-cons"><h4>Cons</h4><ul>{children}</ul></div>
}

// ── Stat ────────────────────────────────────────────────

export function Stat({
  label,
  value,
  trend,
  suffix,
}: {
  label: string
  value: string | number
  trend?: 'up' | 'down'
  suffix?: string
}) {
  return (
    <div className="mdx-stat">
      <div className="mdx-stat-value">
        {value}
        {suffix && <small>{suffix}</small>}
        {trend && (
          <span className={`mdx-stat-trend mdx-stat-trend--${trend}`}>
            {trend === 'up' ? '↑' : '↓'}
          </span>
        )}
      </div>
      <div className="mdx-stat-label">{label}</div>
    </div>
  )
}

export function StatGroup({ children }: { children: React.ReactNode }) {
  return <div className="mdx-stat-group">{children}</div>
}

// ── Table ───────────────────────────────────────────────

export function Table({
  headers,
  rows,
}: {
  headers: string[]
  rows: string[][]
}) {
  return (
    <div className="mdx-table-wrap">
      <table className="mdx-table">
        <thead>
          <tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Timeline ────────────────────────────────────────────

export function Timeline({
  items,
}: {
  items: { time: string; title: string; desc?: string }[]
}) {
  return (
    <div className="mdx-timeline">
      {items.map((item, i) => (
        <div key={i} className="mdx-timeline-item">
          <div className="mdx-timeline-time">{item.time}</div>
          <div className="mdx-timeline-title">{item.title}</div>
          {item.desc && <div className="mdx-timeline-desc">{item.desc}</div>}
        </div>
      ))}
    </div>
  )
}

// ── TagList ─────────────────────────────────────────────

export function TagList({ tags }: { tags: string[] }) {
  return (
    <div className="mdx-tag-list">
      {tags.map((tag, i) => <span key={i} className="mdx-tag">{tag}</span>)}
    </div>
  )
}

// ── Progress ────────────────────────────────────────────

export function Progress({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className="mdx-progress">
      {label && <div className="mdx-progress-label">{label} &mdash; {pct}%</div>}
      <div className="mdx-progress-bar">
        <div className="mdx-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── Avatar ──────────────────────────────────────────────

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

export function Avatar({
  name,
  size,
}: {
  name: string
  size?: 'sm' | 'md' | 'lg'
}) {
  return (
    <span className={`mdx-avatar${size && size !== 'md' ? ` mdx-avatar--${size}` : ''}`}>
      {initials(name)}
    </span>
  )
}

export function AvatarGroup({ children }: { children: React.ReactNode }) {
  return <div className="mdx-avatar-group">{children}</div>
}
