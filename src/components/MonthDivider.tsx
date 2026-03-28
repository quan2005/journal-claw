interface MonthDividerProps {
  yearMonth: string  // "202603"
}

export function MonthDivider({ yearMonth }: MonthDividerProps) {
  const year = yearMonth.slice(0, 4)
  const month = Number(yearMonth.slice(4, 6))
  return (
    <div style={{ paddingTop: 24, paddingBottom: 0 }}>
      <div style={{
        padding: '0 20px 10px',
        fontSize: 16,
        fontWeight: 600,
        color: 'var(--item-text)',
      }}>
        {year}年{month}月
      </div>
      <div style={{ height: 1, background: 'var(--divider)', margin: '0 0' }} />
    </div>
  )
}
