import { useTranslation } from '../contexts/I18nContext'

interface MonthDividerProps {
  yearMonth: string // "202603" or "2603"
}

export function MonthDivider({ yearMonth }: MonthDividerProps) {
  const { s, lang } = useTranslation()
  // Support both 4-digit (2603) and 6-digit (202603) formats
  const isShort = yearMonth.length === 4
  const year = isShort ? 2000 + parseInt(yearMonth.slice(0, 2)) : parseInt(yearMonth.slice(0, 4))
  const month = parseInt(isShort ? yearMonth.slice(2, 4) : yearMonth.slice(4, 6))
  const monthName = s.monthNames[month - 1] ?? String(month)
  const label = lang === 'zh' ? `${year}年${month}月` : `${monthName} ${year}`

  return (
    <div style={{ paddingTop: 24, paddingBottom: 0 }}>
      <div
        style={{
          padding: '0 20px 10px',
          fontSize: 'var(--text-md)',
          fontWeight: 'var(--font-semibold)',
          color: 'var(--item-text)',
        }}
      >
        {label}
      </div>
      <div style={{ height: 1, background: 'var(--divider)', margin: '0 0' }} />
    </div>
  )
}
