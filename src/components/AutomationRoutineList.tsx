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
      <div className="automation-card automation-empty automation-empty-state">
        <span className="automation-empty-icon">+</span>
        <span>
          <span className="automation-row-title">还没有自动化</span>
          <span className="automation-row-meta">从模板创建一个，或从空白计划开始。</span>
        </span>
      </div>
    )
  }

  return (
    <div className="automation-card automation-routine-list">
      {routines.map((routine) => (
        <button
          key={routine.id}
          type="button"
          onClick={() => onSelect(routine)}
          className={`automation-routine-row${selectedId === routine.id ? ' is-selected' : ''}`}
          aria-label={`自动化：${routine.title}，${scheduleLabel(routine)}`}
        >
          <span style={{ minWidth: 0 }}>
            <span className="automation-row-title">{routine.title}</span>
            <span className="automation-row-meta">
              {routine.template_id ? `模板：${routine.template_id}` : '自定义 Agent'}
            </span>
          </span>
          <span style={{ minWidth: 0 }}>
            <span className="automation-row-title">{scheduleLabel(routine)}</span>
            <span className="automation-row-meta">{scopeLabel(routine)}</span>
          </span>
          <span className={`automation-pill${routine.enabled ? ' automation-pill-success' : ''}`}>
            {routine.enabled ? '已启用' : '暂停'}
          </span>
          <span className="automation-row-meta">
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
