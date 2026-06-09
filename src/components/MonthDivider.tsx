// src/components/MonthDivider.tsx

interface MonthDividerProps {
  label: string // format: "2605" → display as "2026年5月"
  collapsed?: boolean
  onToggle?: () => void
}

const MONTH_NAMES: Record<string, string> = {
  '01': '1月',
  '02': '2月',
  '03': '3月',
  '04': '4月',
  '05': '5月',
  '06': '6月',
  '07': '7月',
  '08': '8月',
  '09': '9月',
  '10': '10月',
  '11': '11月',
  '12': '12月',
}

export function MonthDivider({ label, collapsed = false, onToggle }: MonthDividerProps) {
  // label format: "2605" → "2026年5月"
  const year = `20${label.slice(0, 2)}`
  const monthNum = label.slice(2)
  const month = MONTH_NAMES[monthNum] ?? `${parseInt(monthNum, 10)}月`
  const display = `${year}年${month}`
  const content = (
    <>
      {onToggle && (
        <span
          className="tree-month-collapse-icon"
          style={{
            width: 12,
            height: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 4,
            color: 'var(--duration-text)',
            transform: collapsed ? 'rotate(-90deg)' : 'none',
            transition: 'transform 0.15s var(--ease-out), color 0.15s var(--ease-out)',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            width="11"
            height="11"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      )}
      <span
        className="tree-month-label"
        style={{
          color: 'var(--text-tertiary, #5c5852)',
          transition: 'color 0.15s var(--ease-out)',
        }}
      >
        {display}
      </span>
    </>
  )

  if (onToggle) {
    return (
      <button
        type="button"
        className="tree-month-header"
        aria-label={`${collapsed ? '展开' : '折叠'}${display}`}
        aria-expanded={!collapsed}
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          padding: '14px 8px 6px',
          border: 'none',
          background: 'transparent',
          appearance: 'none',
          cursor: 'pointer',
          userSelect: 'none' as const,
          fontFamily: 'inherit',
          fontSize: '0.6875rem',
          fontWeight: 600,
          lineHeight: 1.2,
          letterSpacing: '0.04em',
          textAlign: 'left' as const,
        }}
      >
        {content}
      </button>
    )
  }

  return (
    <div
      className="tree-month-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '14px 8px 6px',
        fontSize: '0.6875rem',
        fontWeight: 600,
        lineHeight: 1.2,
        letterSpacing: '0.04em',
      }}
    >
      {content}
    </div>
  )
}
