import { useState, useEffect } from 'react'
import { listSkills, openSkillsDir } from '../../lib/tauri'
import type { SkillInfo } from '../../lib/tauri'
import { useTranslation } from '../../contexts/I18nContext'

const sectionStyle: React.CSSProperties = {
  padding: '28px 28px 180px',
  borderBottom: '1px solid var(--divider)',
}

export default function SectionPlugins() {
  const { t } = useTranslation()
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listSkills()
      .then(setSkills)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const projectSkills = skills.filter((s) => s.scope === 'project')
  const globalSkills = skills.filter((s) => s.scope === 'global')

  return (
    <div style={sectionStyle}>
      <div
        style={{
          fontSize: 13,
          color: 'var(--month-label)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 16,
          fontWeight: 500,
        }}
      >
        {t('pluginsSection')}
      </div>

      {loading ? null : skills.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--duration-text)' }}>
          <div style={{ fontSize: 13, marginBottom: 6 }}>{t('noSkillsFound')}</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>{t('noSkillsHint')}</div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            animation: 'section-fadein 160ms ease-out both',
          }}
        >
          {projectSkills.length > 0 && (
            <SkillGroup
              label={t('pluginScopeProject')}
              skills={projectSkills}
              onOpenDir={() => openSkillsDir('project')}
            />
          )}
          {globalSkills.length > 0 && (
            <SkillGroup
              label={t('pluginScopeGlobal')}
              skills={globalSkills}
              onOpenDir={() => openSkillsDir('global')}
            />
          )}
        </div>
      )}
    </div>
  )
}

function SkillGroup({
  label,
  skills,
  onOpenDir,
}: {
  label: string
  skills: SkillInfo[]
  onOpenDir: () => void
}) {
  const { t } = useTranslation()
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: 'var(--duration-text)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </div>
        <button
          onClick={onOpenDir}
          style={{
            fontSize: 11,
            padding: '3px 10px',
            borderRadius: 5,
            border: '1px solid var(--divider)',
            background: 'transparent',
            color: 'var(--item-meta)',
            cursor: 'pointer',
          }}
        >
          {t('openSkillDir')}
        </button>
      </div>
      <div
        style={{
          background: 'var(--detail-case-bg)',
          border: '1px solid var(--divider)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {skills.map((skill, i) => (
          <div
            key={skill.id}
            style={{
              padding: '12px 14px',
              borderTop: i > 0 ? '1px solid var(--divider)' : undefined,
            }}
          >
            <div style={{ fontSize: 13, color: 'var(--item-text)', marginBottom: 2 }}>
              {skill.name}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--duration-text)',
                lineHeight: 1.4,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {skill.description}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
