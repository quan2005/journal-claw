import type { CSSProperties } from 'react'
import type { AutomationTemplate } from '../types'

export function AutomationTemplateGrid({
  templates,
  selectedTemplateId,
  onSelect,
}: {
  templates: AutomationTemplate[]
  selectedTemplateId: string | null
  onSelect: (template: AutomationTemplate) => void
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
        gap: 10,
      }}
    >
      {templates.map((template) => {
        const selected = selectedTemplateId === template.id
        return (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelect(template)}
            style={{
              minHeight: 116,
              padding: 13,
              border: `1px solid ${
                selected
                  ? 'color-mix(in srgb, var(--record-btn) 42%, var(--divider))'
                  : 'var(--divider)'
              }`,
              borderRadius: 8,
              background: selected
                ? 'color-mix(in srgb, var(--record-btn) 6%, var(--detail-case-bg))'
                : 'var(--detail-case-bg)',
              color: 'var(--item-text)',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600 }}>{template.title}</div>
            <div
              style={{ marginTop: 7, color: 'var(--item-meta)', fontSize: 12, lineHeight: 1.45 }}
            >
              {template.description}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              <span style={chipStyle('gold')}>{template.category}</span>
              <span style={chipStyle()}>{scheduleLabel(template.default_schedule)}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function scheduleLabel(schedule: AutomationTemplate['default_schedule']) {
  switch (schedule.kind) {
    case 'daily':
      return `每天 ${schedule.time}`
    case 'weekdays':
      return `工作日 ${schedule.time}`
    case 'weekly':
      return `每周 ${schedule.time}`
    case 'monthly':
      return `每月 ${schedule.day} 日`
  }
}

function chipStyle(tone?: 'gold'): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    height: 22,
    padding: '0 8px',
    borderRadius: 5,
    border: tone === 'gold' ? '1px solid rgba(200,147,59,0.32)' : '1px solid var(--divider)',
    color: tone === 'gold' ? 'var(--record-btn)' : 'var(--item-meta)',
    background: tone === 'gold' ? 'rgba(200,147,59,0.1)' : 'rgba(255,255,255,0.02)',
    fontSize: 11,
    whiteSpace: 'nowrap',
  }
}
