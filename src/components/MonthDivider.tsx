interface MonthDividerProps {
  yearMonth: string  // "202603"
}

export function MonthDivider({ yearMonth }: MonthDividerProps) {
  const year = yearMonth.slice(0, 4)
  const month = yearMonth.slice(4, 6)
  return (
    <div style={{
      padding: '14px 20px 6px',
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: 'var(--month-label)',
    }}>
      {year} · {month}
    </div>
  )
}
