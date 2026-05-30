import { useEffect, useMemo, useState } from 'react'
import { useAutomation } from '../hooks/useAutomation'
import type { AutomationRoutine, AutomationTemplate } from '../types'
import { AutomationEditorDialog } from './AutomationEditorDialog'
import { AutomationRoutineDetail } from './AutomationRoutineDetail'
import { AutomationRoutineList } from './AutomationRoutineList'

export function AutomationWorkbench({
  onOpenConversation,
}: {
  onOpenConversation: (sessionId: string) => void
}) {
  const automation = useAutomation()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingRoutine, setEditingRoutine] = useState<AutomationRoutine | null>(null)
  const [draftTemplate, setDraftTemplate] = useState<AutomationTemplate | null>(null)
  const [creating, setCreating] = useState(false)

  const selectedRoutine = useMemo(
    () =>
      automation.routines.find((routine) => routine.id === selectedId) ??
      automation.routines[0] ??
      null,
    [automation.routines, selectedId],
  )
  const selectedRoutineId = selectedRoutine?.id ?? null
  const loadRuns = automation.loadRuns

  useEffect(() => {
    if (!selectedRoutineId) {
      return
    }
    setSelectedId(selectedRoutineId)
    void loadRuns(selectedRoutineId)
  }, [loadRuns, selectedRoutineId])

  const selectedRuns = selectedRoutine ? (automation.runsByRoutine[selectedRoutine.id] ?? []) : []

  const handleCreate = () => {
    const template = automation.templates[0] ?? null
    setDraftTemplate(template)
    setCreating(true)
  }

  const handleRun = async (routine: AutomationRoutine) => {
    await automation.runNow(routine.id)
  }

  return (
    <div className="automation-workbench">
      <header className="automation-header">
        <div>
          <div className="automation-eyebrow">Scheduled routines</div>
          <h2 className="automation-title">自动化</h2>
          <div className="automation-summary">
            {automation.counts.total === 0
              ? '还没有自动化任务'
              : `${automation.counts.enabled} 个启用 · ${automation.counts.total} 个任务${
                  automation.counts.failed > 0 ? ` · ${automation.counts.failed} 个失败需查看` : ''
                }`}
          </div>
        </div>
        <button className="automation-button automation-button-primary" onClick={handleCreate}>
          新建自动化
        </button>
      </header>

      <div className="automation-body">
        {automation.error && <div className="automation-alert">{automation.error}</div>}

        <div className="automation-grid">
          <div style={{ minWidth: 0 }}>
            <h3 className="automation-section-title">自动化任务</h3>
            <AutomationRoutineList
              routines={automation.routines}
              selectedId={selectedRoutine?.id ?? null}
              onSelect={(routine) => {
                setSelectedId(routine.id)
                void automation.loadRuns(routine.id)
              }}
            />
          </div>

          <AutomationRoutineDetail
            routine={selectedRoutine}
            runs={selectedRuns}
            onRun={handleRun}
            onEdit={(routine) => setEditingRoutine(routine)}
            onPause={(routine) => automation.pause(routine.id)}
            onResume={(routine) => automation.resume(routine.id)}
            onOpenConversation={onOpenConversation}
          />
        </div>
      </div>
      {(editingRoutine || creating) && (
        <AutomationEditorDialog
          templates={automation.templates}
          routine={editingRoutine}
          initialTemplate={draftTemplate}
          onClose={() => {
            setEditingRoutine(null)
            setDraftTemplate(null)
            setCreating(false)
          }}
          onCreate={async (request) => {
            const routine = await automation.create(request)
            setSelectedId(routine.id)
          }}
          onUpdate={async (id, patch) => {
            const routine = await automation.update(id, patch)
            setSelectedId(routine.id)
          }}
        />
      )}
    </div>
  )
}
