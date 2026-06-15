import { useEffect, useMemo, useState } from 'react'
import {
  Search,
  Plus,
  FolderOpen,
  X,
  ChevronRight,
  Bolt,
  Paperclip,
  MousePointerClick,
  Zap,
  FileText,
  Pencil,
} from 'lucide-react'
import {
  listSkills,
  openSkillsDir,
  openSkillDir,
  setSkillEnabled,
  getGlobalSkillsEnabled,
  setGlobalSkillsEnabled,
  type SkillInfo,
  type SkillTrigger,
} from '../lib/tauri'

// Map a skill's dir_name to a lucide icon. Falls back to Zap.
const ICON_BY_NAME: Record<string, typeof Zap> = {
  journal: FileText,
  lint: FileText,
}
function skillIcon(name: string) {
  return ICON_BY_NAME[name] ?? Zap
}

// ── Trigger chip ──────────────────────────────────────────
function TriggerChip({ trig }: { trig: SkillTrigger }) {
  const isCmd = trig.kind === 'slash'
  return (
    <span className={`skills-trigger-chip${isCmd ? ' is-cmd' : ''}`}>
      {trig.kind === 'slash' && <ChevronRight size={12} />}
      {trig.kind === 'auto' && <Bolt size={12} />}
      {trig.kind === 'drop' && <Paperclip size={12} />}
      {trig.kind === 'menu' && <MousePointerClick size={12} />}
      {trig.label}
    </span>
  )
}

// ── Switch (per-skill toggle) ─────────────────────────────
function Switch({ on, onClick }: { on: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={`skills-switch${on ? ' is-on' : ''}`}
    >
      <span className="skills-switch-knob" />
    </button>
  )
}

// ── Skill card ────────────────────────────────────────────
function SkillCard({
  s,
  on,
  toggle,
  onOpen,
}: {
  s: SkillInfo
  on: boolean
  toggle: () => void
  onOpen: () => void
}) {
  const Icon = skillIcon(s.dir_name)
  return (
    <div
      onClick={onOpen}
      className={`skills-card${on ? '' : ' is-disabled'}`}
    >
      {/* header */}
      <div className="skills-card-header">
        <div className="skills-card-icon">
          <Icon size={19} />
        </div>
        <div className="skills-card-meta">
          <div className="skills-card-meta-row">
            <span className="skills-card-id">{s.dir_name}</span>
            <span className={`skills-card-scope${s.scope === 'global' ? ' is-global' : ''}`}>
              {s.scope === 'global' ? '全局' : '项目'}
            </span>
          </div>
          <div className="skills-card-name">{s.name}</div>
        </div>
        <Switch
          on={on}
          onClick={(e) => {
            e.stopPropagation()
            toggle()
          }}
        />
      </div>

      {/* description */}
      {s.description && <p className="skills-card-desc">{s.description}</p>}

      {/* footer: trigger chips */}
      {s.triggers.length > 0 && (
        <div className="skills-card-triggers">
          {s.triggers.map((t, i) => (
            <TriggerChip key={i} trig={t} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────
function StatCard({ cells }: { cells: { n: number; l: string }[] }) {
  return (
    <div className="skills-stats">
      {cells.map((c, i) => (
        <div key={i} className="skills-stats-cell">
          <span className="skills-stats-number">{c.n}</span>
          <span className="skills-stats-label">{c.l}</span>
        </div>
      ))}
    </div>
  )
}

// ── Skill detail drawer ───────────────────────────────────
function SkillDrawer({
  s,
  on,
  toggle,
  onClose,
}: {
  s: SkillInfo
  on: boolean
  toggle: () => void
  onClose: () => void
}) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 16)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const close = () => {
    setShow(false)
    setTimeout(onClose, 200)
  }

  const Icon = skillIcon(s.dir_name)

  return (
    <div
      onClick={close}
      className={`skills-drawer-backdrop${show ? ' is-show' : ''}`}
    >
      <div onClick={(e) => e.stopPropagation()} className="skills-drawer">
        {/* header */}
        <div className="skills-drawer-header">
          <div className="skills-drawer-header-top">
            <div className="skills-drawer-icon">
              <Icon size={22} />
            </div>
            <div className="skills-drawer-title-area">
              <div className="skills-drawer-id">{s.dir_name}</div>
              <div className="skills-drawer-name">{s.name}</div>
            </div>
            <button type="button" aria-label="关闭" onClick={close} className="skills-drawer-close">
              <X size={18} />
            </button>
          </div>
          {/* meta row */}
          <div className="skills-drawer-meta-row">
            <span className={`skills-card-scope${s.scope === 'global' ? ' is-global' : ''}`}>
              {s.scope === 'global' ? '全局' : '项目'}
            </span>
            <span style={{ flex: 1 }} />
            <span className={`skills-drawer-status${on ? ' is-on' : ' is-off'}`}>
              {on ? '已启用' : '已停用'}
            </span>
            <Switch
              on={on}
              onClick={(e) => {
                e.stopPropagation()
                toggle()
              }}
            />
          </div>
        </div>

        {/* scroll body */}
        <div className="skills-drawer-body">
          {s.description && (
            <div className="skills-drawer-section">
              <div className="skills-drawer-section-title">说明</div>
              <p className="skills-drawer-section-text">{s.description}</p>
            </div>
          )}

          {s.triggers.length > 0 && (
            <div className="skills-drawer-section">
              <div className="skills-drawer-section-title">触发方式</div>
              <div className="skills-drawer-triggers">
                {s.triggers.map((t, i) => (
                  <TriggerChip key={i} trig={t} />
                ))}
              </div>
            </div>
          )}

          {s.output && (
            <div className="skills-drawer-section">
              <div className="skills-drawer-section-title">产出</div>
              <p className="skills-drawer-section-text-sm">{s.output}</p>
            </div>
          )}

          {s.loads.length > 0 && (
            <div className="skills-drawer-section">
              <div className="skills-drawer-section-title">
                加载的规则 · {s.loads.length}
              </div>
              <div className="skills-drawer-loads">
                {s.loads.map((f, i) => (
                  <div key={i} className="skills-drawer-file-chip">
                    <FileText size={14} className="skills-drawer-file-chip-icon" />
                    {f.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="skills-drawer-footer">
          <button
            type="button"
            onClick={() => openSkillDir(s.scope, s.dir_name)}
            className="skills-workbench-button"
          >
            <Pencil size={15} />
            编辑技能
          </button>
          <span className="skills-drawer-footer-spacer" />
          <button
            type="button"
            onClick={() => openSkillDir(s.scope, s.dir_name)}
            className="skills-workbench-button"
          >
            <FileText size={15} />
            查看 SKILL.md
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Skills page ───────────────────────────────────────────
export default function SkillsWorkbench() {
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [globalEnabled, setGlobalEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([listSkills(), getGlobalSkillsEnabled()])
      .then(([s, enabled]) => {
        setSkills(s)
        setGlobalEnabled(enabled)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const toggle = (id: string) => {
    setSkills((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s
        const next = !s.enabled
        setSkillEnabled(id, next).catch(console.error)
        return { ...s, enabled: next }
      }),
    )
  }

  const toggleGlobal = () => {
    const next = !globalEnabled
    setGlobalEnabled(next)
    setGlobalSkillsEnabled(next)
      .then(() => listSkills().then(setSkills).catch(console.error))
      .catch(console.error)
  }

  const list = useMemo(() => {
    if (!q.trim()) return skills
    const needle = q.trim().toLowerCase()
    return skills.filter((s) =>
      (s.dir_name + s.name + s.description).toLowerCase().includes(needle),
    )
  }, [skills, q])

  const enabledCount = skills.filter((s) => s.enabled).length
  const globalCount = skills.filter((s) => s.scope === 'global').length
  const slashCount = skills.filter((s) => s.triggers.some((t) => t.kind === 'slash')).length

  if (loading) {
    return <div className="skills-workbench-loading">加载中…</div>
  }

  return (
    <section className="skills-workbench">
      <div className="skills-workbench-inner">
        {/* ── header ───────────────────────────────── */}
        <div className="skills-workbench-header">
          <div className="skills-workbench-header-left">
            <span className="skills-workbench-eyebrow">AGENT SKILLS</span>
            <h1 className="skills-workbench-title">技能</h1>
            <p className="skills-workbench-summary">
              管理触发 AI 行为的技能。每个技能定义触发方式、加载的规则与产出 ——
              启用后即可在对话中被调用。
            </p>
          </div>
          <div className="skills-workbench-header-right">
            <StatCard
              cells={[
                { n: enabledCount, l: '已启用' },
                { n: globalCount, l: '全局' },
                { n: slashCount, l: '斜杠命令' },
              ]}
            />
            <div className="skills-workbench-actions">
              <button
                type="button"
                onClick={() => openSkillsDir('project')}
                className="skills-workbench-button"
              >
                <FolderOpen size={15} />
                打开目录
              </button>
              <button
                type="button"
                onClick={() => openSkillsDir('project')}
                className="skills-workbench-button-primary"
              >
                <Plus size={15} />
                新建技能
              </button>
            </div>
          </div>
        </div>

        {/* ── global toggle + search row ───────────── */}
        <div className="skills-workbench-toolbar">
          <span className="skills-workbench-toolbar-label">全局技能</span>
          <Switch
            on={globalEnabled}
            onClick={(e) => {
              e.stopPropagation()
              toggleGlobal()
            }}
          />
          <span className="skills-workbench-toolbar-spacer" />
          <div className="skills-workbench-search">
            <Search size={15} className="skills-workbench-search-icon" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索技能…"
              className="skills-workbench-search-input"
            />
          </div>
        </div>

        {/* ── grid ─────────────────────────────────── */}
        {list.length ? (
          <div className="skills-workbench-grid">
            {list.map((s) => (
              <SkillCard
                key={s.id}
                s={s}
                on={s.enabled}
                toggle={() => toggle(s.id)}
                onOpen={() => setOpenId(s.id)}
              />
            ))}
          </div>
        ) : (
          <div className="skills-workbench-empty">
            <div className="skills-workbench-empty-icon">+</div>
            <div className="skills-workbench-empty-title">
              {skills.length === 0
                ? '未发现技能'
                : '没有匹配的技能'}
            </div>
            <div className="skills-workbench-empty-subtitle">
              {skills.length === 0
                ? '在项目 .claude/skills/ 或全局 ~/.claude/skills/ 目录中添加技能'
                : '尝试调整搜索关键词'}
            </div>
          </div>
        )}
      </div>
      {openId &&
        (() => {
          const s = skills.find((k) => k.id === openId)
          if (!s) return null
          return (
            <SkillDrawer
              s={s}
              on={s.enabled}
              toggle={() => toggle(s.id)}
              onClose={() => setOpenId(null)}
            />
          )
        })()}
    </section>
  )
}
