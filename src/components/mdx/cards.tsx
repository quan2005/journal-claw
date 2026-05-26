export function Cards({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

export function Card({ title, description: _description }: { image?: string; title: string; description?: string }) {
  return <div><h3>{title}</h3></div>
}

export function Options({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

export function Option({ letter, title, description: _description }: { letter: string; title: string; description?: string }) {
  return <div>{letter}: {title}</div>
}

export function Kanban({ columns }: { columns: { title: string; items: { text: string; tags?: string[] }[] }[] }) {
  return <div>{columns.map((c, i) => <div key={i}>{c.title}</div>)}</div>
}

export function Checklist({ items }: { items: { text: string; checked?: boolean }[] }) {
  return <ul>{items.map((item, i) => <li key={i}>{item.checked ? '✓' : '○'} {item.text}</li>)}</ul>
}

export function Counter({ count, label }: { count: number; label: string }) {
  return <div>{count} {label}</div>
}

export function RatingBar({ score, max = 5, label: _label }: { score: number; max?: number; label?: string }) {
  return <div>{'★'.repeat(Math.round(score))}{'☆'.repeat(max - Math.round(score))}</div>
}
