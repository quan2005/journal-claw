export function ProsCons({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

export function Stat({ label: _label, value, trend: _trend, suffix: _suffix }: { label: string; value: string | number; trend?: 'up' | 'down'; suffix?: string }) {
  return <div>{value}</div>
}

export function StatGroup({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

export function Table({ headers, rows: _rows }: { headers: string[]; rows: string[][] }) {
  return <table><thead><tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead></table>
}

export function Timeline({ items }: { items: { time: string; title: string; desc?: string }[] }) {
  return <div>{items.map((item, i) => <div key={i}>{item.title}</div>)}</div>
}

export function TagList({ tags }: { tags: string[] }) {
  return <div>{tags.join(', ')}</div>
}

export function Progress({ value, label: _label }: { value: number; label?: string }) {
  return <div>{value}%</div>
}

export function Avatar({ name, size: _size }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  return <span>{name[0]}</span>
}

export function AvatarGroup({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}
