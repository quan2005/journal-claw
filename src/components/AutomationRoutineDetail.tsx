import type { CSSProperties } from 'react'
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
  if (!routine) {
    return (
      <aside style={panelStyle}>
        <div style={{ padding: 16, color: 'var(--item-meta)', fontSize: 13 }}>
          选择一个自动化查看详情
        </div>
      </aside>
    )
  }

  const latest = runs[0]

  return (
    <aside style={panelStyle}>
      <div style={{ padding: 16, borderBottom: '1px solid var(--divider)' }}>
        <h3 style={{ margin: 0, fontSize: 17 }}>{routine.title}</h3>
        <div style={{ marginTop: 8, color: 'var(--item-meta)', fontSize: 12 }}>
          完整 Agent 权限 · 自动执行 · 保留 manifest
        </div>
      </div>
      <div style={blockStyle}>
        <div style={labelStyle}>Prompt</div>
        <div
          style={{
            padding: 12,
            border: '1px solid var(--divider)',
            borderRadius: 8,
            color: 'var(--item-meta)',
            fontSize: 12,
            lineHeight: 1.58,
            whiteSpace: 'pre-wrap',
          }}
        >
          {routine.prompt}
        </div>
      </div>
      <div style={blockStyle}>
        <div style={labelStyle}>上次运行</div>
        {latest?.manifest ? (
          <div style={{ display: 'grid', gap: 8, color: 'var(--item-meta)', fontSize: 12 }}>
            <ManifestRow label="Summary" value={latest.manifest.summary} />
            <ManifestRow
              label="Changed"
              value={latest.manifest.files_changed.join(', ') || '无文件变更'}
            />
            <ManifestRow label="Session" value={latest.manifest.conversation_id} />
          </div>
        ) : (
          <div style={{ color: 'var(--duration-text)', fontSize: 12 }}>
            {routine.last_run?.error ?? '尚无 manifest'}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 16 }}>
        <button style={primaryStyle} onClick={() => onRun(routine)}>
          立即运行
        </button>
        <button style={secondaryStyle} onClick={() => onEdit(routine)}>
          编辑
        </button>
        {routine.enabled ? (
          <button style={secondaryStyle} onClick={() => onPause(routine)}>
            暂停
          </button>
        ) : (
          <button style={secondaryStyle} onClick={() => onResume(routine)}>
            启用
          </button>
        )}
        {latest?.conversation_id && (
          <button
            style={secondaryStyle}
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
    <div style={{ display: 'grid', gridTemplateColumns: '82px minmax(0, 1fr)', gap: 10 }}>
      <strong style={{ color: 'var(--duration-text)', fontWeight: 500 }}>{label}</strong>
      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{value}</span>
    </div>
  )
}

const panelStyle: CSSProperties = {
  border: '1px solid var(--divider)',
  borderRadius: 8,
  background: 'var(--detail-case-bg)',
}

const blockStyle: CSSProperties = {
  padding: 16,
  borderBottom: '1px solid var(--divider)',
}

const labelStyle: CSSProperties = {
  marginBottom: 8,
  color: 'var(--duration-text)',
  fontSize: 11,
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
