import type { AutomationRoutine, AutomationRunStatus } from '../types'

export function AutomationRoutineList({
  routines,
  selectedId,
  onSelect,
}: {
  routines: AutomationRoutine[]
  selectedId: string | null
  onSelect: (routine: AutomationRoutine) => void
}) {
  if (routines.length === 0) {
    return (
      <div
        style={{
          padding: 14,
          border: '1px solid var(--divider)',
          borderRadius: 8,
          color: 'var(--item-meta)',
          fontSize: 13,
        }}
      >
        还没有自动化
      </div>
    )
  }

  return (
    <div style={{ border: '1px solid var(--divider)', borderRadius: 8, overflow: 'auto' }}>
      {routines.map((routine, index) => (
        <button
          key={routine.id}
          type="button"
          onClick={() => onSelect(routine)}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(170px, 1.2fr) minmax(120px, 0.8fr) 72px 92px',
            gap: 12,
            alignItems: 'center',
            width: '100%',
            minWidth: 520,
            minHeight: 58,
            padding: '11px 12px',
            border: 0,
            borderBottom: index === routines.length - 1 ? 0 : '1px solid var(--divider)',
            background:
              selectedId === routine.id
                ? 'color-mix(in srgb, var(--record-btn) 5%, var(--detail-case-bg))'
                : 'var(--detail-case-bg)',
            color: 'var(--item-text)',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 500 }}>{routine.title}</span>
            <span
              style={{
                display: 'block',
                marginTop: 3,
                color: 'var(--duration-text)',
                fontSize: 12,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {routine.template_id ? `模板：${routine.template_id}` : '自定义 Agent'}
            </span>
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 500 }}>{scheduleLabel(routine)}</span>
            <span
              style={{
                display: 'block',
                marginTop: 3,
                color: 'var(--duration-text)',
                fontSize: 12,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {scopeLabel(routine)}
            </span>
          </span>
          <span
            style={{
              color: routine.enabled ? 'var(--status-success)' : 'var(--duration-text)',
              fontSize: 12,
            }}
          >
            {routine.enabled ? '已启用' : '暂停'}
          </span>
          <span style={{ color: 'var(--item-meta)', fontSize: 12 }}>
            {routine.last_run ? runLabel(routine.last_run.status) : '尚未运行'}
          </span>
        </button>
      ))}
    </div>
  )
}

function scheduleLabel(routine: AutomationRoutine) {
  const schedule = routine.schedule
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

function scopeLabel(routine: AutomationRoutine) {
  switch (routine.scope.kind) {
    case 'relative':
      return routine.scope.range
    case 'recent_days':
      return `最近 ${routine.scope.days} 天`
    case 'month':
      return routine.scope.year_month
    case 'tags':
      return routine.scope.tags.join(', ')
    case 'identities':
      return `${routine.scope.identity_ids.length} 个画像`
    case 'keyword':
      return routine.scope.query
    case 'workspace':
      return '全库'
  }
}

function runLabel(status: AutomationRunStatus) {
  switch (status) {
    case 'queued':
      return '排队中'
    case 'running':
      return '运行中'
    case 'succeeded':
      return '上次成功'
    case 'failed':
      return '上次失败'
    case 'skipped':
      return '上次跳过'
  }
}
