import { useState, useEffect, useCallback } from 'react'
import { listSkills, getDisabledSkills, setDisabledSkills } from '../../lib/tauri'
import type { SkillInfo } from '../../lib/tauri'
import { useTranslation } from '../../contexts/I18nContext'

const sectionStyle: React.CSSProperties = { padding: '28px 28px 180px', borderBottom: '1px solid var(--divider)' }

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      style={{
        width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
        background: enabled ? 'var(--record-btn)' : 'var(--divider)',
        position: 'relative', flexShrink: 0, padding: 0,
        transition: 'background 200ms ease-out',
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 2,
        left: enabled ? 20 : 2,
        transition: 'left 200ms ease-out',
      }} />
    </button>
  )
}

export default function SectionPlugins() {
  const { t } = useTranslation()
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [disabled, setDisabled] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([listSkills(), getDisabledSkills()])
      .then(([s, d]) => {
        setSkills(s)
        setDisabled(new Set(d))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const toggle = useCallback(async (id: string) => {
    const next = new Set(disabled)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setDisabled(next)
    await setDisabledSkills([...next]).catch(console.error)
  }, [disabled])

  const setAll = useCallback(async (disableAll: boolean) => {
    const next = disableAll ? new Set(skills.map(s => s.id)) : new Set<string>()
    setDisabled(next)
    await setDisabledSkills([...next]).catch(console.error)
  }, [skills])

  const projectSkills = skills.filter(s => s.scope === 'project')
  const globalSkills = skills.filter(s => s.scope === 'global')

  return (
    <div style={sectionStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>
          {t('pluginsSection')}
        </div>
        {skills.length > 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setAll(false)} style={bulkBtnStyle}>{t('enableAll')}</button>
            <button onClick={() => setAll(true)} style={bulkBtnStyle}>{t('disableAll')}</button>
          </div>
        )}
      </div>

      {loading ? null : skills.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--duration-text)' }}>
          <div style={{ fontSize: 13, marginBottom: 6 }}>{t('noSkillsFound')}</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>{t('noSkillsHint')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'section-fadein 160ms ease-out both' }}>
          {projectSkills.length > 0 && (
            <SkillGroup label={t('pluginScopeProject')} skills={projectSkills} disabled={disabled} onToggle={toggle} />
          )}
          {globalSkills.length > 0 && (
            <SkillGroup label={t('pluginScopeGlobal')} skills={globalSkills} disabled={disabled} onToggle={toggle} />
          )}
        </div>
      )}
    </div>
  )
}

const bulkBtnStyle: React.CSSProperties = {
  fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '1px solid var(--divider)',
  background: 'transparent', color: 'var(--item-meta)', cursor: 'pointer',
}

function SkillGroup({ label, skills, disabled, onToggle }: {
  label: string
  skills: SkillInfo[]
  disabled: Set<string>
  onToggle: (id: string) => void
}) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--duration-text)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ background: 'var(--detail-case-bg)', border: '1px solid var(--divider)', borderRadius: 8, overflow: 'hidden' }}>
        {skills.map((skill, i) => (
          <div key={skill.id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px',
            borderTop: i > 0 ? '1px solid var(--divider)' : undefined,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: 'var(--item-text)', marginBottom: 2 }}>{skill.name}</div>
              <div style={{ fontSize: 11, color: 'var(--duration-text)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{skill.description}</div>
            </div>
            <Toggle enabled={!disabled.has(skill.id)} onChange={() => onToggle(skill.id)} />
          </div>
        ))}
      </div>
    </div>
  )
}
