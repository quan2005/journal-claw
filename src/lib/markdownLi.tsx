import React from 'react'

const checkboxWrapStyle: React.CSSProperties = {
  flexShrink: 0,
  width: 20,
  display: 'inline-flex',
  justifyContent: 'center',
  marginTop: 7,
}
const bulletWrapStyle: React.CSSProperties = {
  flexShrink: 0,
  width: 20,
  display: 'inline-flex',
  justifyContent: 'center',
  marginTop: 12,
}
const bulletStyle: React.CSSProperties = {
  width: 4,
  height: 4,
  borderRadius: '50%',
  backgroundColor: 'var(--md-bullet)',
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span
      style={{
        width: 13,
        height: 13,
        borderRadius: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `1.5px solid ${checked ? 'var(--md-checkbox-checked)' : 'var(--md-checkbox-border)'}`,
        background: checked ? 'var(--md-checkbox-checked)' : 'transparent',
      }}
    >
      {checked && (
        <svg
          width="8"
          height="8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--bg)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </span>
  )
}

export function MarkdownLi({
  children,
  ...liProps
}: React.ComponentProps<'li'> & { ordered?: boolean; className?: string }) {
  const ordered = (liProps as { ordered?: boolean }).ordered
  if (ordered)
    return (
      <li style={{ fontSize: 'var(--text-md)', color: 'var(--md-text)', lineHeight: 1.75 }}>
        {children}
      </li>
    )

  const isTask = liProps.className?.includes('task-list-item')
  if (isTask) {
    const childArray = React.Children.toArray(children)
    const checkboxEl = childArray[0] as React.ReactElement<{ checked?: boolean }>
    const isChecked = checkboxEl?.props?.checked ?? false
    return (
      <li
        style={{
          fontSize: 'var(--text-md)',
          color: isChecked ? 'var(--md-checkbox-done-text)' : 'var(--md-text)',
          lineHeight: 1.75,
          display: 'flex',
          alignItems: 'flex-start',
          listStyle: 'none',
          textDecoration: isChecked ? 'line-through' : 'none',
        }}
      >
        <span style={checkboxWrapStyle}>
          <Checkbox checked={isChecked} />
        </span>
        <span style={{ flex: 1 }}>{childArray.slice(1)}</span>
      </li>
    )
  }

  return (
    <li
      style={{
        fontSize: 'var(--text-md)',
        color: 'var(--md-text)',
        lineHeight: 1.75,
        display: 'flex',
        alignItems: 'flex-start',
      }}
    >
      <span style={bulletWrapStyle}>
        <span style={bulletStyle} />
      </span>
      <span>{children}</span>
    </li>
  )
}
