import { useEffect, useMemo, useState } from 'react'
import { useAutomation } from '../hooks/useAutomation'
import type { AutomationRoutine, AutomationTemplate } from '../types'
import { AutomationEditorDialog } from './AutomationEditorDialog'
import { AutomationRoutineDetail } from './AutomationRoutineDetail'
import { AutomationRoutineList } from './AutomationRoutineList'
import { AutomationTemplateGrid } from './AutomationTemplateGrid'

export function AutomationWorkbench({
  onOpenConversation,
}: {
  onOpenConversation: (sessionId: string) => void
}) {
  const automation = useAutomation()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [editingRoutine, setEditingRoutine] = useState<AutomationRoutine | null>(null)
  const [draftTemplate, setDraftTemplate] = useState<AutomationTemplate | null>(null)

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

  const handleTemplateSelect = (template: AutomationTemplate) => {
    setSelectedTemplateId(template.id)
    setDraftTemplate(template)
  }

  const handleRun = async (routine: AutomationRoutine) => {
    await automation.runNow(routine.id)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        height: '100%',
        background: 'var(--bg)',
      }}
    >
      <header style={{ padding: '26px 30px 18px', borderBottom: '1px solid var(--divider)' }}>
        <div style={{ color: 'var(--month-label)', fontSize: 12, marginBottom: 5 }}>
          Automation Workbench
        </div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>自动化工作台</h2>
      </header>

      <div style={{ overflow: 'auto', padding: '20px 30px 28px' }}>
        <section
          style={{ paddingBottom: 22, borderBottom: '1px solid var(--divider)', marginBottom: 22 }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
              gap: 10,
            }}
          >
            <Metric label="启用中" value={automation.counts.enabled} />
            <Metric label="全部自动化" value={automation.counts.total} />
            <Metric label="需查看失败" value={automation.counts.failed} />
          </div>
        </section>

        {automation.error && (
          <div
            style={{
              marginBottom: 18,
              padding: 12,
              border:
                '1px solid color-mix(in srgb, var(--recording-red, #ff3b30) 42%, var(--divider))',
              borderRadius: 8,
              color: 'var(--item-text)',
              background:
                'color-mix(in srgb, var(--recording-red, #ff3b30) 6%, var(--detail-case-bg))',
              fontSize: 13,
            }}
          >
            {automation.error}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
            gap: 22,
            alignItems: 'start',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <SectionTitle title="模板入口" subtitle="Template" />
            <AutomationTemplateGrid
              templates={automation.templates}
              selectedTemplateId={selectedTemplateId}
              onSelect={handleTemplateSelect}
            />

            <div style={{ height: 22 }} />
            <SectionTitle title="Routine 列表" subtitle="Kernel" />
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
      {(editingRoutine || draftTemplate) && (
        <AutomationEditorDialog
          templates={automation.templates}
          routine={editingRoutine}
          initialTemplate={draftTemplate}
          onClose={() => {
            setEditingRoutine(null)
            setDraftTemplate(null)
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        minHeight: 74,
        padding: 12,
        border: '1px solid var(--divider)',
        borderRadius: 8,
        background: 'var(--detail-case-bg)',
      }}
    >
      <div style={{ color: 'var(--duration-text)', fontSize: 12 }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 22, fontWeight: 600 }}>{value}</div>
    </div>
  )
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 12,
      }}
    >
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{title}</h3>
      <span style={{ color: 'var(--duration-text)', fontSize: 12 }}>{subtitle}</span>
    </div>
  )
}
