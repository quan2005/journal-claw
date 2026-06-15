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
  Star,
} from 'lucide-react'
import {
  listSkills,
  openSkillsDir,
  openSkillDir,
  setSkillEnabled,
  setGlobalSkillEnabled,
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

type TabKey = 'builtin' | 'project' | 'global' | 'favorites'

const TABS: { key: TabKey; label: string; icon?: string }[] = [
  { key: 'favorites', label: '收藏', icon: '⭐' },
  { key: 'builtin', label: '内置', icon: '🔒' },
  { key: 'project', label: '项目', icon: '📦' },
  { key: 'global', label: '全局', icon: '🌐' },
]

// ── Favorites persistence (localStorage) ─────────────────
const FAVORITES_KEY = 'skills-favorites'
function loadFavorites(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]')
  } catch {
    return []
  }
}
function saveFavorites(ids: string[]) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids))
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
  onInvoke,
  showToggle,
  isFavorite,
  onToggleFavorite,
}: {
  s: SkillInfo
  on: boolean
  toggle: () => void
  onOpen: () => void
  onInvoke: () => void
  showToggle: boolean
  isFavorite: boolean
  onToggleFavorite: () => void
}) {
  const Icon = skillIcon(s.dir_name)
  const isShadowed = !!s.shadowed_by
  return (
    <div
      onClick={onOpen}
      className={`skills-card${on ? '' : ' is-disabled'}${isShadowed ? ' is-shadowed' : ''}`}
    >
      {/* header */}
      <div className="skills-card-header">
        <div className="skills-card-icon">
          <Icon size={19} />
        </div>
        <div className="skills-card-meta">
          <div className="skills-card-meta-row">
            <span className="skills-card-id">{s.dir_name}</span>
            <span className={`skills-card-scope scope-${s.scope}`}>
              {s.scope === 'builtin' ? '内置' : s.scope === 'global' ? '全局' : '项目'}
            </span>
          </div>
          <div className="skills-card-name">{s.name}</div>
        </div>
        <button
          type="button"
          className={`skills-card-star${isFavorite ? ' is-active' : ''}`}
          title={isFavorite ? '取消收藏' : '收藏'}
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite()
          }}
        >
          <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
        <button
          type="button"
          className="skills-card-invoke"
          title="临时使用此技能"
          onClick={(e) => {
            e.stopPropagation()
            onInvoke()
          }}
        >
          /
        </button>
        {showToggle && !isShadowed && (
          <Switch
            on={on}
            onClick={(e) => {
              e.stopPropagation()
              toggle()
            }}
          />
        )}
      </div>

      {/* shadowed notice */}
      {isShadowed && (
        <p className="skills-card-shadowed">已被高优先级技能覆盖</p>
      )}

      {/* description */}
      {!isShadowed && s.description && <p className="skills-card-desc">{s.description}</p>}

      {/* footer: trigger chips */}
      {!isShadowed && s.triggers.length > 0 && (
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
            <span className={`skills-card-scope scope-${s.scope}`}>
              {s.scope === 'builtin' ? '内置' : s.scope === 'global' ? '全局' : '项目'}
            </span>
            <span style={{ flex: 1 }} />
            <span className={`skills-drawer-status${on ? ' is-on' : ' is-off'}`}>
              {on ? '已启用' : '已停用'}
            </span>
            {s.scope !== 'builtin' && (
              <Switch
                on={on}
                onClick={(e) => {
                  e.stopPropagation()
                  toggle()
                }}
              />
            )}
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
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [tab, setTab] = useState<TabKey>('favorites')
  const [favorites, setFavorites] = useState<string[]>(loadFavorites)

  useEffect(() => {
    listSkills()
      .then(setSkills)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const toggle = (skill: SkillInfo) => {
    const next = !skill.enabled
    if (skill.scope === 'global') {
      setGlobalSkillEnabled(skill.id, next).catch(console.error)
    } else {
      setSkillEnabled(skill.id, next).catch(console.error)
    }
    setSkills((prev) =>
      prev.map((s) => (s.id === skill.id ? { ...s, enabled: next } : s)),
    )
  }

  const toggleFavorite = (skillId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(skillId)
        ? prev.filter((id) => id !== skillId)
        : [...prev, skillId]
      saveFavorites(next)
      return next
    })
  }

  const invokeOnce = (skill: SkillInfo) => {
    // Dispatch event so ChatPanel fills input with /skillName and opens slash menu
    window.dispatchEvent(
      new CustomEvent('skill-slash-invoke', { detail: { name: skill.dir_name } }),
    )
  }

  const list = useMemo(() => {
    let filtered = skills
    // Tab filter
    switch (tab) {
      case 'builtin':
        filtered = skills.filter((s) => s.scope === 'builtin')
        break
      case 'project':
        filtered = skills.filter((s) => s.scope === 'project')
        break
      case 'global':
        filtered = skills.filter((s) => s.scope === 'global')
        break
      case 'favorites':
        filtered = skills.filter((s) => favorites.includes(s.id))
        break
    }
    // Search filter
    if (q.trim()) {
      const needle = q.trim().toLowerCase()
      filtered = filtered.filter((s) =>
        (s.dir_name + s.name + s.description).toLowerCase().includes(needle),
      )
    }
    return filtered
  }, [skills, tab, q, favorites])

  const enabledCount = skills.filter((s) => s.enabled).length

  if (loading) {
    return <div className="skills-workbench-loading">加载中…</div>
  }

  return (
    <section className="skills-workbench">
      <div className="skills-workbench-inner">
        {/* header */}
        <div className="skills-workbench-header">
          <div className="skills-workbench-header-left">
            <span className="skills-workbench-eyebrow">AGENT SKILLS</span>
            <h1 className="skills-workbench-title">技能</h1>
            <p className="skills-workbench-summary">
              三层技能架构：内置技能始终生效，项目技能可切换，全局技能按需启用。
            </p>
          </div>
          <div className="skills-workbench-header-right">
            <StatCard
              cells={[
                { n: enabledCount, l: '已启用' },
                { n: skills.filter((s) => s.scope === 'builtin').length, l: '内置' },
                { n: favorites.length, l: '收藏' },
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

        {/* tabs + search row */}
        <div className="skills-workbench-toolbar">
          <div className="skills-tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`skills-tab${tab === t.key ? ' is-active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.icon && <span className="skills-tab-icon">{t.icon}</span>}
                {t.label}
              </button>
            ))}
          </div>
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

        {/* grid */}
        {list.length > 0 ? (
          <div className="skills-workbench-grid">
            {list.map((s) => (
              <SkillCard
                key={s.id}
                s={s}
                on={s.scope === 'builtin' ? true : s.enabled}
                toggle={() => toggle(s)}
                onOpen={() => setOpenId(s.id)}
                onInvoke={() => invokeOnce(s)}
                showToggle={s.scope !== 'builtin'}
                isFavorite={favorites.includes(s.id)}
                onToggleFavorite={() => toggleFavorite(s.id)}
              />
            ))}
          </div>
        ) : (
          <div className="skills-workbench-empty">
            <div className="skills-workbench-empty-icon">+</div>
            <div className="skills-workbench-empty-title">
              {tab === 'favorites'
                ? '暂无收藏'
                : skills.length === 0
                  ? '未发现技能'
                  : '没有匹配的技能'}
            </div>
            <div className="skills-workbench-empty-subtitle">
              {tab === 'favorites'
                ? '点击技能卡片上的 ⭐ 收藏常用技能'
                : skills.length === 0
                  ? '内置技能将随应用更新自动添加'
                  : '尝试调整搜索关键词'}
            </div>
          </div>
        )}
      </div>

      {/* Drawer */}
      {openId &&
        (() => {
          const s = skills.find((k) => k.id === openId)
          if (!s) return null
          return (
            <SkillDrawer
              s={s}
              on={s.enabled}
              toggle={() => toggle(s)}
              onClose={() => setOpenId(null)}
            />
          )
        })()}
    </section>
  )
}
