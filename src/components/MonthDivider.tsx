// src/components/MonthDivider.tsx

interface MonthDividerProps {
  label: string // format: "2605" → display as "2026年5月"
}

const MONTH_NAMES: Record<string, string> = {
  '01': '1月', '02': '2月', '03': '3月', '04': '4月',
  '05': '5月', '06': '6月', '07': '7月', '08': '8月',
  '09': '9月', '10': '10月', '11': '11月', '12': '12月',
}

export function MonthDivider({ label }: MonthDividerProps) {
  // label format: "2605" → "2026年5月"
  const year = `20${label.slice(0, 2)}`
  const monthNum = label.slice(2)
  const month = MONTH_NAMES[monthNum] ?? `${parseInt(monthNum, 10)}月`
  const display = `${year}年${month}`

  return (
    <div
      style={{
        padding: '14px 8px 6px',
        fontSize: '0.6875rem',
        fontWeight: 600,
        color: 'var(--text-tertiary, #5c5852)',
        letterSpacing: '0.04em',
      }}
    >
      {display}
    </div>
  )
}
