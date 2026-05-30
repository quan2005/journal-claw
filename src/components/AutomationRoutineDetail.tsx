import { useState } from 'react'
import type { AutomationRoutine, AutomationRun } from '../types'

export function AutomationRoutineDetail({
  routine,
  runs,
  onRun,
  onEdit,
  onPause,
  onResume,
  onOpenConversation,
}: {
  routine: AutomationRoutine | null
  runs: AutomationRun[]
  onRun: (routine: AutomationRoutine) => void
  onEdit: (routine: AutomationRoutine) => void
  onPause: (routine: AutomationRoutine) => void
  onResume: (routine: AutomationRoutine) => void
  onOpenConversation: (sessionId: string) => void
}) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  if (!routine) {
    return (
      <aside className="automation-card automation-detail">
        <div className="automation-empty">选择一个自动化查看详情</div>
      </aside>
    )
  }

  const latest = runs[0]

  return (
    <aside className="automation-card automation-detail">
      <div className="automation-detail-header">
        <h3 className="automation-detail-title">{routine.title}</h3>
        <div className="automation-detail-meta">完整 Agent 权限 · 自动执行 · 保留 manifest</div>
      </div>

      <div className="automation-detail-block">
        <div className="automation-label">运行状态</div>
        <ManifestRow label="时间" value={scheduleLabel(routine)} />
        <ManifestRow label="范围" value={scopeLabel(routine)} />
        <ManifestRow
          label="上次"
          value={routine.last_run?.summary ?? routine.last_run?.error ?? '尚未运行'}
        />
      </div>

      {showAdvanced && (
        <>
          <div className="automation-detail-block">
            <div className="automation-label">Prompt</div>
            <div className="automation-pre">{routine.prompt}</div>
          </div>
          <div className="automation-detail-block">
            <div className="automation-label">运行记录</div>
            {latest?.manifest ? (
              <>
                <ManifestRow label="Summary" value={latest.manifest.summary} />
                <ManifestRow
                  label="Changed"
                  value={latest.manifest.files_changed.join(', ') || '无文件变更'}
                />
                <ManifestRow label="Session" value={latest.manifest.conversation_id} />
              </>
            ) : (
              <div className="automation-row-meta">
                {routine.last_run?.error ?? '尚无 manifest'}
              </div>
            )}
          </div>
        </>
      )}

      <div className="automation-actions">
        <button
          className="automation-button automation-button-primary"
          onClick={() => onRun(routine)}
        >
          立即运行
        </button>
        <button className="automation-button" onClick={() => onEdit(routine)}>
          编辑
        </button>
        {routine.enabled ? (
          <button className="automation-button" onClick={() => onPause(routine)}>
            暂停
          </button>
        ) : (
          <button className="automation-button" onClick={() => onResume(routine)}>
            启用
          </button>
        )}
        <button className="automation-button" onClick={() => setShowAdvanced((value) => !value)}>
          {showAdvanced ? '收起高级' : '高级'}
        </button>
        {latest?.conversation_id && (
          <button
            className="automation-button"
            onClick={() => onOpenConversation(latest.conversation_id!)}
          >
            会话
          </button>
        )}
      </div>
    </aside>
  )
}

function ManifestRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="automation-kv">
      <strong>{label}</strong>
      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{value}</span>
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
      return `每月 ${schedule.day} 日 ${schedule.time}`
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
