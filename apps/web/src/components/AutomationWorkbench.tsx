import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useAutomation } from '../hooks/useAutomation'
import type { AutomationRoutine, AutomationTemplate } from '../types'
import { AutomationEditorDialog } from './AutomationEditorDialog'
import { AutomationRoutineList } from './AutomationRoutineList'
import { AutomationTemplateGrid } from './AutomationTemplateGrid'
import { useTranslation } from '../contexts/I18nContext'

export function AutomationWorkbench({
  onOpenConversation: _onOpenConversation,
}: {
  onOpenConversation: (sessionId: string) => void
}) {
  const automation = useAutomation()
  const { t } = useTranslation()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingRoutine, setEditingRoutine] = useState<AutomationRoutine | null>(null)
  const [draftTemplate, setDraftTemplate] = useState<AutomationTemplate | null>(null)
  const [creating, setCreating] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string>('全部')

  const selectedRoutine = useMemo(
    () =>
      automation.routines.find((routine) => routine.id === selectedId) ??
      automation.routines[0] ??
      null,
    [automation.routines, selectedId],
  )
  useEffect(() => {
    if (!selectedRoutine && selectedId) {
      setSelectedId(null)
    }
  }, [selectedId, selectedRoutine])

  const pausedCount = automation.counts.total - automation.counts.enabled
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    counts.set('全部', automation.templates.length)
    for (const template of automation.templates) {
      counts.set(template.category, (counts.get(template.category) ?? 0) + 1)
    }
    return Array.from(counts.entries())
  }, [automation.templates])

  const visibleTemplates = useMemo(
    () =>
      activeCategory === '全部'
        ? automation.templates
        : automation.templates.filter((template) => template.category === activeCategory),
    [activeCategory, automation.templates],
  )

  const handleCreate = () => {
    const template = automation.templates[0] ?? null
    setDraftTemplate(template)
    setCreating(true)
  }

  const handleTemplateCreate = (template: AutomationTemplate) => {
    setDraftTemplate(template)
    setCreating(true)
  }

  return (
    <div className="automation-workbench">
      <header className="automation-header">
        <div>
          <div className="automation-eyebrow">SCHEDULED AGENT SESSIONS</div>
          <h2 className="automation-title">自动化</h2>
          <div className="automation-summary">
            计划周期性 Agent 会话，用于总结、维护、研究和自定义工作流。
          </div>
        </div>
        <div className="automation-header-actions">
          <div className="automation-stats" aria-label="自动化统计">
            <span aria-label={`${automation.counts.enabled} 已启用`}>
              <strong>{automation.counts.enabled}</strong> 已启用
            </span>
            <span aria-label={`${pausedCount} 已暂停`}>
              <strong>{pausedCount}</strong> 已暂停
            </span>
            <span aria-label={`${automation.templates.length} 模板`}>
              <strong>{automation.templates.length}</strong> 模板
            </span>
          </div>
          <button className="automation-button automation-button-primary" onClick={handleCreate}>
            <Plus aria-hidden="true" size={17} strokeWidth={1.8} />
            <span>新建自动化</span>
          </button>
        </div>
      </header>

      <div className="automation-body">
        {automation.error && <div className="automation-alert">{automation.error}</div>}

        <div className="automation-stack">
          <section>
            <h3 className="automation-section-title">你的自动化</h3>
            <AutomationRoutineList
              routines={automation.routines}
              selectedId={selectedRoutine?.id ?? null}
              onSelect={(routine) => {
                setSelectedId(routine.id)
                void automation.loadRuns(routine.id)
                setEditingRoutine(routine)
              }}
            />
          </section>

          <section className="automation-template-section">
            <div className="automation-template-section-head">
              <div>
                <h3 className="automation-section-title">模板</h3>
                <div className="automation-summary">
                  高质量模板和自定义 Agent 入口在同一个自动化流程里。
                </div>
              </div>
              <div className="automation-template-count">
                {t('automationTemplateCount', {
                  shown: visibleTemplates.length,
                  total: automation.templates.length,
                })}
              </div>
            </div>
            <div className="automation-tabs" aria-label="模板分类">
              {categoryCounts.map(([category, count]) => (
                <button
                  key={category}
                  type="button"
                  className={`automation-tab${activeCategory === category ? ' is-active' : ''}`}
                  onClick={() => setActiveCategory(category)}
                >
                  {category} <span>{count}</span>
                </button>
              ))}
            </div>
            <AutomationTemplateGrid
              templates={visibleTemplates}
              selectedTemplateId={draftTemplate?.id ?? null}
              onSelect={handleTemplateCreate}
            />
          </section>
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
