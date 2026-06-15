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
  Lock,
  Package,
  Globe,
  SquareSlash,
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

type TabKey = 'favorites' | 'builtin' | 'project' | 'global'

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
    <span className={`sk-trigger-chip${isCmd ? ' is-cmd' : ''}`}>
      {trig.kind === 'slash' && <ChevronRight size={12} />}
      {trig.kind === 'auto' && <Bolt size={12} />}
      {trig.kind === 'drop' && <Paperclip size={12} />}
      {trig.kind === 'menu' && <MousePointerClick size={12} />}
      {trig.label}
    </span>
  )
}

// ── Scope chip ────────────────────────────────────────────
function ScopeChip({ scope }: { scope: string }) {
  const Icon = scope === 'builtin' ? Lock : scope === 'global' ? Globe : Package
  const label = scope === 'builtin' ? '内置' : scope === 'global' ? '全局' : '项目'
  return (
    <span className={`sk-scope-chip scope-${scope}`}>
      <Icon size={11} />
      {label}
    </span>
  )
}

// ── Small toggle switch ───────────────────────────────────
function Switch({ on, onClick }: { on: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={`sk-switch${on ? ' is-on' : ''}`}
    >
      <span className="sk-switch-knob" />
    </button>
  )
}

// ── Star button ───────────────────────────────────────────
function StarBtn({ on, onClick }: { on: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      aria-label={on ? '取消收藏' : '收藏'}
      onClick={onClick}
      className={`sk-star-btn${on ? ' is-active' : ''}`}
    >
      <Star size={15} fill={on ? 'currentColor' : 'none'} />
    </button>
  )
}

// ── Slash invoke button ───────────────────────────────────
function SlashBtn({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      aria-label="斜杠命令"
      title="运行技能"
      onClick={onClick}
      className="sk-slash-btn"
    >
      <SquareSlash size={15} />
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
  isFavorite,
  onToggleFavorite,
}: {
  s: SkillInfo
  on: boolean
  toggle: () => void
  onOpen: () => void
  onInvoke: () => void
  isFavorite: boolean
  onToggleFavorite: () => void
}) {
  const Icon = skillIcon(s.dir_name)
  const isShadowed = !!s.shadowed_by
  return (
    <div
      onClick={onOpen}
      className={`sk-card${on ? '' : ' is-disabled'}${isShadowed ? ' is-shadowed' : ''}`}
    >
      {/* header */}
      <div className="sk-card-header">
        <div className="sk-card-icon-box">
          <Icon size={19} />
        </div>
        <div className="sk-card-meta">
          <div className="sk-card-meta-row">
            <span className="sk-card-id">{s.dir_name}</span>
            <ScopeChip scope={s.scope} />
          </div>
          <div className="sk-card-title">{s.name}</div>
        </div>
        <div className="sk-card-actions" onClick={(e) => e.stopPropagation()}>
          <StarBtn on={isFavorite} onClick={(e) => { e.stopPropagation(); onToggleFavorite() }} />
          <SlashBtn onClick={(e) => { e.stopPropagation(); onInvoke() }} />
          {s.scope === 'builtin' ? (
            <span className="sk-card-builtin-badge">
              <Lock size={12} />常驻
            </span>
          ) : !isShadowed ? (
            <Switch on={on} onClick={(e) => { e.stopPropagation(); toggle() }} />
          ) : null}
        </div>
      </div>

      {/* shadowed notice */}
      {isShadowed && (
        <p className="sk-card-shadowed">已被高优先级技能覆盖</p>
      )}

      {/* description */}
      {!isShadowed && s.description && (
        <p className="sk-card-desc">{s.description}</p>
      )}

      {/* footer: trigger chips */}
      {!isShadowed && s.triggers.length > 0 && (
        <div className="sk-card-footer">
          {s.triggers.map((t, i) => (
            <TriggerChip key={i} trig={t} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Skill detail drawer ───────────────────────────────────
function SkillDrawer({
  s,
  on,
  fav,
  toggle,
  onFav,
  onClose,
}: {
  s: SkillInfo
  on: boolean
  fav: boolean
  toggle: () => void
  onFav: () => void
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
    setTimeout(onClose, 240)
  }

  const Icon = skillIcon(s.dir_name)

  return (
    <div
      onClick={close}
      className={`sk-drawer-backdrop${show ? ' is-show' : ''}`}
    >
      <div onClick={(e) => e.stopPropagation()} className={`sk-drawer${show ? ' is-show' : ''}`}>
        {/* header */}
        <div className="sk-drawer-header">
          <div className="sk-drawer-header-top">
            <div className="sk-drawer-icon-box">
              <Icon size={22} />
            </div>
            <div className="sk-drawer-title-area">
              <div className="sk-drawer-id">{s.dir_name}</div>
              <div className="sk-drawer-title">{s.name}</div>
            </div>
            <StarBtn on={fav} onClick={(e) => { e.stopPropagation(); onFav() }} />
            <button type="button" aria-label="关闭" onClick={close} className="sk-drawer-close">
              <X size={18} />
            </button>
          </div>
          {/* meta row */}
          <div className="sk-drawer-meta-row">
            <ScopeChip scope={s.scope} />
            <span style={{ flex: 1 }} />
            {s.scope === 'builtin' ? (
              <span className="sk-drawer-builtin-label">
                <Lock size={14} />常驻 · 不可停用
              </span>
            ) : (
              <>
                <span className={`sk-drawer-status${on ? ' is-on' : ''}`}>
                  {on ? '已启用' : '已停用'}
                </span>
                <Switch on={on} onClick={(e) => { e.stopPropagation(); toggle() }} />
              </>
            )}
          </div>
        </div>

        {/* scroll body */}
        <div className="sk-drawer-body">
          {s.description && (
            <div className="sk-drawer-section">
              <div className="sk-drawer-section-title">说明</div>
              <p className="sk-drawer-section-text">{s.description}</p>
            </div>
          )}

          {s.triggers.length > 0 && (
            <div className="sk-drawer-section">
              <div className="sk-drawer-section-title">触发方式</div>
              <div className="sk-drawer-triggers">
                {s.triggers.map((t, i) => (
                  <TriggerChip key={i} trig={t} />
                ))}
              </div>
            </div>
          )}

          {s.output && (
            <div className="sk-drawer-section">
              <div className="sk-drawer-section-title">产出</div>
              <p className="sk-drawer-section-text">{s.output}</p>
            </div>
          )}

          {s.loads.length > 0 && (
            <div className="sk-drawer-section">
              <div className="sk-drawer-section-title">
                加载的规则 · {s.loads.length}
              </div>
              <div className="sk-drawer-loads">
                {s.loads.map((f, i) => (
                  <div key={i} className="sk-drawer-file-chip">
                    <FileText size={14} />
                    {f.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="sk-drawer-footer">
          <button
            type="button"
            onClick={() => openSkillDir(s.scope, s.dir_name)}
            className="sk-btn-ghost"
          >
            <FileText size={15} />
            查看 SKILL.md
          </button>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            onClick={() => openSkillDir(s.scope, s.dir_name)}
            className="sk-btn-secondary"
          >
            <Pencil size={15} />
            编辑技能
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
    window.dispatchEvent(
      new CustomEvent('skill-slash-invoke', { detail: { name: skill.dir_name } }),
    )
  }

  const tabs: { key: TabKey; label: string; icon: typeof Zap; count: number }[] = useMemo(() => [
    { key: 'favorites', label: '收藏', icon: Star, count: favorites.length },
    { key: 'builtin', label: '内置', icon: Lock, count: skills.filter((s) => s.scope === 'builtin').length },
    { key: 'project', label: '项目', icon: Package, count: skills.filter((s) => s.scope === 'project').length },
    { key: 'global', label: '全局', icon: Globe, count: skills.filter((s) => s.scope === 'global').length },
  ], [skills, favorites])

  const list = useMemo(() => {
    let filtered = skills
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
    if (q.trim()) {
      const needle = q.trim().toLowerCase()
      filtered = filtered.filter((s) =>
        (s.dir_name + s.name + s.description).toLowerCase().includes(needle),
      )
    }
    return filtered
  }, [skills, tab, q, favorites])

  if (loading) {
    return <div className="sk-loading">加载中…</div>
  }

  return (
    <section className="sk-page">
      <div className="sk-page-inner">
        {/* ── header ───────────────────────────────── */}
        <div className="sk-header">
          <span className="sk-eyebrow">AGENT SKILLS</span>
          <h1 className="sk-title">技能</h1>
          <p className="sk-subtitle">
            管理触发 AI 行为的技能。每个技能定义触发方式、加载的规则与产出 —— 启用后即可在对话中被调用。
          </p>
        </div>

        {/* ── filter row ───────────────────────────── */}
        <div className="sk-filter-row">
          {tabs.map((t) => {
            const TabIcon = t.icon
            const active = tab === t.key
            return (
              <button
                key={t.key}
                type="button"
                className={`sk-tab-pill${active ? ' is-active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                <TabIcon size={13} />
                {t.label}
                <span className="sk-tab-count">{t.count}</span>
              </button>
            )
          })}
          <span className="sk-filter-spacer" />
          <div className="sk-search">
            <Search size={15} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索技能…"
            />
          </div>
          <span className="sk-filter-divider" />
          <button type="button" className="sk-btn-ghost" onClick={() => openSkillsDir('project')}>
            <FolderOpen size={15} />
            打开目录
          </button>
          <button type="button" className="sk-btn-primary" onClick={() => openSkillsDir('project')}>
            <Plus size={15} />
            新建技能
          </button>
        </div>

        {/* ── grid ─────────────────────────────────── */}
        {list.length > 0 ? (
          <div className="sk-grid">
            {list.map((s) => (
              <SkillCard
                key={s.id}
                s={s}
                on={s.scope === 'builtin' ? true : s.enabled}
                toggle={() => toggle(s)}
                onOpen={() => setOpenId(s.id)}
                onInvoke={() => invokeOnce(s)}
                isFavorite={favorites.includes(s.id)}
                onToggleFavorite={() => toggleFavorite(s.id)}
              />
            ))}
          </div>
        ) : (
          <div className="sk-empty">
            <div className="sk-empty-text">
              {tab === 'favorites'
                ? '暂无收藏 — 点击技能卡片上的 ⭐ 收藏常用技能'
                : skills.length === 0
                  ? '未发现技能'
                  : '没有匹配的技能'}
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
              fav={favorites.includes(s.id)}
              toggle={() => toggle(s)}
              onFav={() => toggleFavorite(s.id)}
              onClose={() => setOpenId(null)}
            />
          )
        })()}
    </section>
  )
}
