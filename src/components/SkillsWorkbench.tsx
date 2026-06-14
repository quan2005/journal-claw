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
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 24,
        padding: '0 9px',
        borderRadius: 6,
        fontSize: 'var(--text-xs)',
        fontFamily: isCmd ? 'var(--font-mono)' : 'var(--font-body)',
        background: isCmd ? 'var(--detail-case-bg)' : 'var(--tag-bg)',
        color: isCmd ? 'var(--record-btn)' : 'var(--tag-text)',
        border: '1px solid ' + (isCmd ? 'transparent' : 'var(--divider)'),
        whiteSpace: 'nowrap',
      }}
    >
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
      style={{
        width: 38,
        height: 22,
        flexShrink: 0,
        borderRadius: 999,
        padding: 2,
        border: 'none',
        cursor: 'pointer',
        background: on ? 'var(--record-btn)' : 'var(--bg-tertiary)',
        display: 'inline-flex',
        alignItems: 'center',
        transition: 'background 160ms var(--ease-out)',
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          transform: on ? 'translateX(16px)' : 'translateX(0)',
          boxShadow: '0 1px 2px rgba(0,0,0,.25)',
          transition: 'transform 160ms var(--ease-out)',
        }}
      />
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
  const [hover, setHover] = useState(false)
  const Icon = skillIcon(s.dir_name)
  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: 20,
        borderRadius: 8,
        background: 'var(--detail-case-bg)',
        cursor: 'pointer',
        border: '1px solid ' + (hover ? 'var(--divider-hover)' : 'var(--detail-case-border)'),
        opacity: on ? 1 : 0.62,
        transition: 'border-color 160ms var(--ease-out), opacity 160ms ease',
      }}
    >
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 38,
            height: 38,
            flexShrink: 0,
            borderRadius: 6,
            background: 'var(--detail-case-bg)',
            color: 'var(--record-btn)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 0 0 0 1px var(--divider)',
          }}
        >
          <Icon size={19} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-base)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
              }}
            >
              {s.dir_name}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.04em',
                padding: '2px 7px',
                borderRadius: 6,
                color: s.scope === 'global' ? 'var(--record-btn)' : 'var(--text-tertiary)',
                background: s.scope === 'global' ? 'var(--detail-case-bg)' : 'var(--tag-bg)',
              }}
            >
              {s.scope === 'global' ? '全局' : '项目'}
            </span>
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginTop: 3 }}>
            {s.name}
          </div>
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
      {s.description && (
        <p
          style={{
            margin: '14px 0 0',
            fontSize: 'var(--text-sm)',
            lineHeight: 1.65,
            color: 'var(--text-secondary)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: 42,
          }}
        >
          {s.description}
        </p>
      )}

      {/* footer: trigger chips */}
      {s.triggers.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 16,
            flexWrap: 'wrap',
          }}
        >
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
    <div
      style={{
        display: 'flex',
        border: '1px solid var(--divider)',
        borderRadius: 8,
        background: 'var(--detail-case-bg)',
        overflow: 'hidden',
      }}
    >
      {cells.map((c, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            padding: '16px 24px',
            borderLeft: i ? '1px solid var(--divider)' : 'none',
          }}
        >
          <span
            style={{
              fontSize: 'var(--text-xl)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              lineHeight: 1,
            }}
          >
            {c.n}
          </span>
          <span
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
            }}
          >
            {c.l}
          </span>
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
    setTimeout(onClose, 240)
  }

  const Icon = skillIcon(s.dir_name)

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ padding: '20px 24px', borderTop: '1px solid var(--divider)' }}>
      <div
        style={{
          fontSize: 'var(--text-xs)',
          fontWeight: 600,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: 'var(--text-tertiary)',
          marginBottom: 12,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'rgba(10, 12, 16, 0.46)',
        opacity: show ? 1 : 0,
        transition: 'opacity 200ms var(--ease-out)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(660px, 94vw)',
          maxHeight: '86vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg)',
          border: '1px solid var(--divider)',
          borderRadius: 16,
          boxShadow: '0 28px 80px rgba(0,0,0,0.34)',
          overflow: 'hidden',
          transform: show ? 'scale(1)' : 'scale(0.96)',
          opacity: show ? 1 : 0,
          transition: 'transform 240ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease',
        }}
      >
        {/* header */}
        <div style={{ padding: '22px 24px 18px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                flexShrink: 0,
                borderRadius: 6,
                background: 'var(--detail-case-bg)',
                color: 'var(--record-btn)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'inset 0 0 0 1px var(--divider)',
              }}
            >
              <Icon size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-lg)',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                {s.dir_name}
              </div>
              <div
                style={{
                  fontSize: 'var(--text-base)',
                  color: 'var(--text-secondary)',
                  marginTop: 2,
                }}
              >
                {s.name}
              </div>
            </div>
            <button
              type="button"
              aria-label="关闭"
              onClick={close}
              style={{
                width: 30,
                height: 30,
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                borderRadius: 6,
                color: 'var(--text-tertiary)',
              }}
            >
              <X size={18} />
            </button>
          </div>
          {/* meta row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 7px',
                borderRadius: 6,
                color: s.scope === 'global' ? 'var(--record-btn)' : 'var(--text-tertiary)',
                background: s.scope === 'global' ? 'var(--detail-case-bg)' : 'var(--tag-bg)',
              }}
            >
              {s.scope === 'global' ? '全局' : '项目'}
            </span>
            <span style={{ flex: 1 }} />
            <span
              style={{
                fontSize: 'var(--text-sm)',
                color: on ? 'var(--record-btn)' : 'var(--text-tertiary)',
                fontWeight: 500,
              }}
            >
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
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {s.description && (
            <Section title="说明">
              <p
                style={{
                  margin: 0,
                  fontSize: 'var(--text-md)',
                  lineHeight: 1.7,
                  color: 'var(--text-secondary)',
                }}
              >
                {s.description}
              </p>
            </Section>
          )}

          {s.triggers.length > 0 && (
            <Section title="触发方式">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {s.triggers.map((t, i) => (
                  <TriggerChip key={i} trig={t} />
                ))}
              </div>
            </Section>
          )}

          {s.output && (
            <Section title="产出">
              <p
                style={{
                  margin: 0,
                  fontSize: 'var(--text-base)',
                  lineHeight: 1.6,
                  color: 'var(--text-secondary)',
                }}
              >
                {s.output}
              </p>
            </Section>
          )}

          {s.loads.length > 0 && (
            <Section title={`加载的规则 · ${s.loads.length}`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {s.loads.map((f, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 10px',
                      borderRadius: 6,
                      background: 'var(--detail-case-bg)',
                      border: '1px solid var(--divider)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--record-btn)',
                    }}
                  >
                    <FileText size={14} style={{ flexShrink: 0, opacity: 0.7 }} />
                    {f.name}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* footer */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            gap: 10,
            padding: '14px 24px',
            borderTop: '1px solid var(--divider)',
          }}
        >
          <button type="button" onClick={() => openSkillDir(s.scope, s.dir_name)} style={ghostBtn}>
            <Pencil size={15} />
            编辑技能
          </button>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={() => openSkillDir(s.scope, s.dir_name)} style={ghostBtn}>
            <FileText size={15} />
            查看 SKILL.md
          </button>
        </div>
      </div>
    </div>
  )
}

const ghostBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 32,
  padding: '0 12px',
  borderRadius: 6,
  border: '1px solid var(--divider)',
  background: 'transparent',
  color: 'var(--text-secondary)',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  cursor: 'pointer',
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
    return <div style={{ flex: 1, padding: 80, color: 'var(--text-tertiary)' }}>加载中…</div>
  }

  return (
    <section style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1640, margin: '0 auto', padding: '52px 56px 80px' }}>
        {/* ── header ───────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 32,
          }}
        >
          <div style={{ maxWidth: 560 }}>
            <span
              style={{
                display: 'inline-block',
                padding: '5px 12px',
                borderRadius: 999,
                marginBottom: 22,
                background: 'var(--detail-case-bg)',
                border: '1px solid var(--divider)',
                color: 'var(--record-btn)',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                letterSpacing: '0.14em',
              }}
            >
              AGENT SKILLS
            </span>
            <h1
              style={{
                margin: '0 0 18px',
                fontFamily: 'var(--font-body)',
                fontWeight: 800,
                fontSize: 'clamp(44px, 5vw, 60px)',
                lineHeight: 1.04,
                letterSpacing: '-0.01em',
                color: 'var(--record-btn)',
              }}
            >
              技能
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--text-md)',
                lineHeight: 1.7,
                color: 'var(--text-secondary)',
              }}
            >
              管理触发 AI 行为的技能。每个技能定义触发方式、加载的规则与产出 ——
              启用后即可在对话中被调用。
            </p>
          </div>
          <div
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 16 }}
          >
            <StatCard
              cells={[
                { n: enabledCount, l: '已启用' },
                { n: globalCount, l: '全局' },
                { n: slashCount, l: '斜杠命令' },
              ]}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => openSkillsDir('project')}
                style={{
                  ...ghostBtn,
                  height: 38,
                  padding: '0 14px',
                }}
              >
                <FolderOpen size={15} />
                打开目录
              </button>
              <button
                type="button"
                onClick={() => openSkillsDir('project')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 38,
                  padding: '0 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'var(--record-btn)',
                  color: 'var(--record-btn-icon)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Plus size={15} />
                新建技能
              </button>
            </div>
          </div>
        </div>

        {/* ── global toggle + search row ───────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            margin: '40px 0 24px',
            paddingBottom: 18,
            borderBottom: '1px solid var(--divider)',
          }}
        >
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            全局技能
          </span>
          <Switch
            on={globalEnabled}
            onClick={(e) => {
              e.stopPropagation()
              toggleGlobal()
            }}
          />
          <span style={{ flex: 1 }} />
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              width: 220,
              height: 32,
              padding: '0 10px',
              borderRadius: 6,
              border: '1px solid var(--divider)',
              background: 'var(--bg)',
            }}
          >
            <Search size={15} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索技能…"
              style={{
                flex: 1,
                minWidth: 0,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>

        {/* ── grid ─────────────────────────────────── */}
        {list.length ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))',
              gap: 18,
            }}
          >
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
          <div
            style={{
              padding: '64px 0',
              textAlign: 'center',
              color: 'var(--text-tertiary)',
              fontSize: 'var(--text-md)',
            }}
          >
            {skills.length === 0
              ? '未发现技能。在项目 .claude/skills/ 或全局 ~/.claude/skills/ 目录中添加技能。'
              : '没有匹配的技能。'}
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
