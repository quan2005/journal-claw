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
    <div className="automation-template-grid">
      {templates.map((template) => {
        const selected = selectedTemplateId === template.id
        return (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelect(template)}
            className={`automation-template-card${selected ? ' is-selected' : ''}`}
          >
            <div className="automation-template-title">{template.title}</div>
            <div className="automation-template-desc">{template.description}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              <span className="automation-pill automation-pill-accent">{template.category}</span>
              <span className="automation-pill">{scheduleLabel(template.default_schedule)}</span>
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
