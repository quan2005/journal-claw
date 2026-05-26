export function Section({ children }: { children: React.ReactNode }) {
  return <section>{children}</section>
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>
}

export function Label({ children }: { children: React.ReactNode }) {
  return <span>{children}</span>
}

export function Divider({ label }: { label?: string }) {
  return label ? <div>{label}</div> : <hr />
}
