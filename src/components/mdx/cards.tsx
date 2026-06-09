// ── Cards / Card ────────────────────────────────────────

export function Cards({ children }: { children: React.ReactNode }) {
  return <div className="mdx-cards">{children}</div>
}

export function Card({
  image,
  title,
  description,
  variant = 'default',
}: {
  image?: string
  title: string
  description?: string
  variant?: 'default' | 'subtle' | 'elevated'
}) {
  const cls = variant === 'default' ? 'mdx-card' : `mdx-card mdx-card--${variant}`
  return (
    <div className={cls}>
      {image && <div className="mdx-card-image">{image}</div>}
      <div className="mdx-card-body">
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
    </div>
  )
}

// ── Stack — vertical spacing ──────────────────────────

export function Stack({ children, gap = 4 }: { children: React.ReactNode; gap?: number }) {
  return (
    <div
      className="mdx-stack"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: `var(--space-${gap})`,
      }}
    >
      {children}
    </div>
  )
}

// ── Kanban ──────────────────────────────────────────────

export function Kanban({
  columns,
}: {
  columns: { title: string; items: { text: string; tags?: string[] }[] }[]
}) {
  return (
    <div className="mdx-kanban">
      {columns.map((col, ci) => (
        <div key={ci} className="mdx-kanban-column">
          <div className="mdx-kanban-column-title">{col.title}</div>
          {col.items.map((item, ii) => (
            <div key={ii} className="mdx-kanban-item">
              {item.text}
              {item.tags && item.tags.length > 0 && (
                <div className="mdx-tag-list">
                  {item.tags.map((t, ti) => (
                    <span key={ti} className="mdx-tag">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Checklist ───────────────────────────────────────────

export function Checklist({ items }: { items: { text: string; checked?: boolean }[] }) {
  return (
    <ul className="mdx-checklist">
      {items.map((item, i) => (
        <li key={i} className="mdx-checklist-item">
          <span
            className={`mdx-checklist-marker ${item.checked ? 'mdx-checklist-marker--checked' : 'mdx-checklist-marker--unchecked'}`}
          >
            {item.checked ? '✓' : '○'}
          </span>
          <span>{item.text}</span>
        </li>
      ))}
    </ul>
  )
}

// ── Counter ─────────────────────────────────────────────

export function Counter({ count, label }: { count: number; label: string }) {
  return (
    <div className="mdx-counter">
      <span className="mdx-counter-count">{count}</span>
      <span className="mdx-counter-label">{label}</span>
    </div>
  )
}

// ── RatingBar ───────────────────────────────────────────

export function RatingBar({
  score,
  max = 5,
  label,
}: {
  score: number
  max?: number
  label?: string
}) {
  const clamped = Math.max(0, Math.min(score, max))
  const filled = Math.round(clamped)
  return (
    <div className="mdx-rating">
      <div className="mdx-rating-stars">
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className={`mdx-rating-star ${i < filled ? 'mdx-rating-star--filled' : 'mdx-rating-star--empty'}`}
          >
            {i < filled ? '★' : '☆'}
          </span>
        ))}
      </div>
      {label && <span className="mdx-rating-label">{label}</span>}
    </div>
  )
}
