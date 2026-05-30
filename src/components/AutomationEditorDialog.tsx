import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
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
  const seed = routine ?? templateToDraft(initialTemplate ?? templates[0])
  const [title, setTitle] = useState(seed.title)
  const [prompt, setPrompt] = useState(seed.prompt)
  const [time, setTime] = useState(scheduleTime(seed.schedule))
  const [enabled, setEnabled] = useState(seed.enabled)
  const [scopeText, setScopeText] = useState(scopeLabel(seed.scope))
  const [saving, setSaving] = useState(false)

  const selectedTemplate = useMemo(
    () =>
      templates.find((template) => template.id === (routine?.template_id ?? initialTemplate?.id)) ??
      templates[0],
    [initialTemplate?.id, routine?.template_id, templates],
  )

  const save = async () => {
    if (!title.trim() || !prompt.trim()) {
      return
    }
    setSaving(true)
    try {
      const schedule = scheduleWithTime(seed.schedule, time)
      const scope = scopeFromText(scopeText)
      if (routine) {
        await onUpdate(routine.id, { title, prompt, schedule, scope, enabled })
      } else {
        await onCreate({
          title,
          template_id: selectedTemplate?.id ?? null,
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
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
      }}
    >
      <div
        style={{
          width: 'min(940px, calc(100vw - 56px))',
          maxHeight: 'calc(100vh - 56px)',
          overflow: 'hidden',
          border: '1px solid var(--divider)',
          borderRadius: 8,
          background: 'var(--bg)',
        }}
      >
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--divider)' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{routine ? '编辑自动化' : '新建自动化'}</h2>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 280px) minmax(0, 1fr)',
            minHeight: 500,
          }}
        >
          <div
            style={{
              padding: 14,
              borderRight: '1px solid var(--divider)',
              background: 'var(--sidebar-bg)',
              overflow: 'auto',
            }}
          >
            <div style={{ marginBottom: 8, color: 'var(--duration-text)', fontSize: 11 }}>模板</div>
            {templates.map((template) => (
              <div
                key={template.id}
                style={{
                  padding: 11,
                  borderRadius: 8,
                  background:
                    template.id === selectedTemplate?.id
                      ? 'var(--record-highlight)'
                      : 'transparent',
                  color:
                    template.id === selectedTemplate?.id ? 'var(--item-text)' : 'var(--item-meta)',
                }}
              >
                <strong>{template.title}</strong>
                <div style={{ marginTop: 3, color: 'var(--duration-text)', fontSize: 12 }}>
                  {template.description}
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '18px 20px', overflow: 'auto' }}>
            <Field label="名称">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="时间">
              <input
                value={time}
                onChange={(event) => setTime(event.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="输入范围">
              <input
                value={scopeText}
                onChange={(event) => setScopeText(event.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="Prompt">
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                style={{ ...inputStyle, height: 160, paddingTop: 10, resize: 'vertical' }}
              />
            </Field>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: 'var(--item-meta)',
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
              <button onClick={onClose} style={secondaryStyle}>
                取消
              </button>
              <button
                onClick={save}
                disabled={saving || !title.trim() || !prompt.trim()}
                style={{
                  ...primaryStyle,
                  opacity: saving || !title.trim() || !prompt.trim() ? 0.55 : 1,
                }}
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

function templateToDraft(template: AutomationTemplate): AutomationRoutine {
  return {
    id: '',
    title: template.title,
    template_id: template.id,
    prompt: template.default_prompt,
    schedule: template.default_schedule,
    scope: template.default_scope,
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
    <label style={{ display: 'block', marginBottom: 14 }}>
      <span
        style={{ display: 'block', marginBottom: 6, color: 'var(--duration-text)', fontSize: 11 }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 34,
  padding: '0 10px',
  border: '1px solid var(--divider)',
  borderRadius: 6,
  background: 'var(--detail-case-bg)',
  color: 'var(--item-text)',
  fontSize: 13,
  fontFamily: 'var(--font-body)',
}

const primaryStyle: CSSProperties = {
  minHeight: 32,
  padding: '0 14px',
  border: 0,
  borderRadius: 6,
  background: 'var(--record-btn)',
  color: 'var(--record-btn-icon)',
  fontWeight: 600,
}

const secondaryStyle: CSSProperties = {
  minHeight: 30,
  padding: '0 11px',
  border: '1px solid var(--divider)',
  borderRadius: 6,
  background: 'transparent',
  color: 'var(--item-meta)',
}
