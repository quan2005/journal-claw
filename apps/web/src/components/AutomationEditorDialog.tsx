import { useMemo, useState, type ReactNode } from 'react'
import type {
  AutomationRoutine,
  AutomationSchedule,
  AutomationScope,
  AutomationTemplate,
  CreateRoutineRequest,
  UpdateRoutineRequest,
} from '../types'

export function AutomationEditorDialog({
  templates,
  routine,
  initialTemplate,
  onClose,
  onCreate,
  onUpdate,
}: {
  templates: AutomationTemplate[]
  routine: AutomationRoutine | null
  initialTemplate: AutomationTemplate | null
  onClose: () => void
  onCreate: (request: CreateRoutineRequest) => Promise<void>
  onUpdate: (id: string, patch: UpdateRoutineRequest) => Promise<void>
}) {
  const seed = routine ?? templateToDraft(initialTemplate ?? templates[0] ?? null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    routine?.template_id ?? initialTemplate?.id ?? templates[0]?.id ?? null,
  )
  const [title, setTitle] = useState(seed.title)
  const [prompt, setPrompt] = useState(seed.prompt)
  const [scheduleBase, setScheduleBase] = useState(seed.schedule)
  const [time, setTime] = useState(scheduleTime(seed.schedule))
  const [enabled, setEnabled] = useState(seed.enabled)
  const [scopeText, setScopeText] = useState(scopeLabel(seed.scope))
  const [saving, setSaving] = useState(false)

  const selectedTemplate = useMemo(
    () =>
      selectedTemplateId ? templates.find((template) => template.id === selectedTemplateId) : null,
    [selectedTemplateId, templates],
  )

  const applyTemplate = (template: AutomationTemplate | null) => {
    if (routine) {
      return
    }
    setSelectedTemplateId(template?.id ?? null)
    const next = templateToDraft(template)
    setTitle(next.title)
    setPrompt(next.prompt)
    setScheduleBase(next.schedule)
    setTime(scheduleTime(next.schedule))
    setEnabled(next.enabled)
    setScopeText(scopeLabel(next.scope))
  }

  const save = async () => {
    if (!title.trim() || !prompt.trim()) {
      return
    }
    setSaving(true)
    try {
      const schedule = scheduleWithTime(scheduleBase, time)
      const scope = scopeFromText(scopeText)
      if (routine) {
        await onUpdate(routine.id, { title, prompt, schedule, scope, enabled })
      } else {
        await onCreate({
          title,
          template_id: selectedTemplateId,
          prompt,
          schedule,
          scope,
          enabled,
        })
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="automation-workbench automation-dialog-backdrop"
    >
      <div className="automation-dialog">
        <div className="automation-dialog-header">
          <h2 className="automation-dialog-title">{routine ? '编辑自动化' : '新建自动化'}</h2>
        </div>
        <div className="automation-dialog-body">
          <div className="automation-dialog-sidebar">
            <div className="automation-label">模板</div>
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => applyTemplate(template)}
                className={`automation-dialog-template${
                  template.id === selectedTemplate?.id ? ' is-selected' : ''
                }`}
              >
                <strong>{template.title}</strong>
                <div className="automation-row-meta">{template.description}</div>
              </button>
            ))}
            {!routine && (
              <button
                type="button"
                onClick={() => applyTemplate(null)}
                className={`automation-dialog-template${selectedTemplateId === null ? ' is-selected' : ''}`}
              >
                <strong>空白创建</strong>
                <div className="automation-row-meta">从空 prompt 创建自定义 Agent。</div>
              </button>
            )}
          </div>
          <div className="automation-dialog-main">
            <Field label="名称">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="automation-input"
              />
            </Field>
            <Field label="时间">
              <input
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="automation-input"
              />
            </Field>
            <Field label="输入范围">
              <input
                value={scopeText}
                onChange={(event) => setScopeText(event.target.value)}
                className="automation-input"
              />
            </Field>
            <Field label="Prompt">
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="automation-input automation-textarea"
              />
            </Field>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: 'var(--automation-text-muted)',
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
              />
              启用这个自动化
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button onClick={onClose} className="automation-button">
                取消
              </button>
              <button
                onClick={save}
                disabled={saving || !title.trim() || !prompt.trim()}
                className="automation-button automation-button-primary"
                style={{ opacity: saving || !title.trim() || !prompt.trim() ? 0.55 : 1 }}
              >
                {saving ? '保存中' : '保存自动化'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function templateToDraft(template: AutomationTemplate | null): AutomationRoutine {
  return {
    id: '',
    title: template?.title ?? '自定义 Agent',
    template_id: template?.id ?? null,
    prompt: template?.default_prompt ?? '',
    schedule: template?.default_schedule ?? {
      kind: 'daily',
      time: '08:00',
      timezone: 'Asia/Hong_Kong',
    },
    scope: template?.default_scope ?? { kind: 'workspace' },
    enabled: true,
    full_agent_access: true,
    created_at: '',
    updated_at: '',
    last_run: null,
  }
}

function scheduleTime(schedule: AutomationSchedule) {
  return schedule.time
}

function scheduleWithTime(schedule: AutomationSchedule, time: string): AutomationSchedule {
  switch (schedule.kind) {
    case 'daily':
      return { ...schedule, time }
    case 'weekdays':
      return { ...schedule, time }
    case 'weekly':
      return { ...schedule, time }
    case 'monthly':
      return { ...schedule, time }
  }
}

function scopeLabel(scope: AutomationScope) {
  switch (scope.kind) {
    case 'relative':
      return scope.range
    case 'recent_days':
      return `recent:${scope.days}`
    case 'month':
      return scope.year_month
    case 'tags':
      return scope.tags.join(',')
    case 'identities':
      return scope.identity_ids.join(',')
    case 'keyword':
      return scope.query
    case 'workspace':
      return 'workspace'
  }
}

function scopeFromText(text: string): AutomationScope {
  const value = text.trim()
  if (value === 'workspace') {
    return { kind: 'workspace' }
  }
  if (value.startsWith('recent:')) {
    const days = Number(value.slice('recent:'.length))
    return { kind: 'recent_days', days: Number.isFinite(days) && days > 0 ? days : 7 }
  }
  switch (value) {
    case 'today':
    case 'yesterday':
    case 'this_week':
    case 'last_week':
    case 'this_month':
    case 'last_month':
      return { kind: 'relative', range: value }
    default:
      return { kind: 'keyword', query: value }
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="automation-field">
      <span className="automation-label">{label}</span>
      {children}
    </label>
  )
}
