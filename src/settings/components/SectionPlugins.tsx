import { useState, useEffect, useCallback } from 'react'
import {
  listSkills,
  openSkillsDir,
  getGlobalSkillsEnabled,
  setGlobalSkillsEnabled,
} from '../../lib/tauri'
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
  const [globalEnabled, setGlobalEnabled] = useState(false)

  const loadSkills = useCallback(() => {
    listSkills().then(setSkills).catch(console.error)
  }, [])

  useEffect(() => {
    Promise.all([listSkills(), getGlobalSkillsEnabled()])
      .then(([s, enabled]) => {
        setSkills(s)
        setGlobalEnabled(enabled)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleToggleGlobal = useCallback(async () => {
    const next = !globalEnabled
    setGlobalEnabled(next)
    await setGlobalSkillsEnabled(next)
    loadSkills()
  }, [globalEnabled, loadSkills])

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

      {loading ? null : (
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

          {/* Global skills: toggle + list */}
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
                {t('pluginScopeGlobal')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => openSkillsDir('global')}
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
                <button
                  onClick={handleToggleGlobal}
                  style={{
                    width: 40,
                    height: 22,
                    borderRadius: 11,
                    border: 'none',
                    cursor: 'pointer',
                    background: globalEnabled ? 'var(--record-btn)' : 'var(--divider)',
                    position: 'relative',
                    flexShrink: 0,
                    padding: 0,
                    transition: 'background 200ms ease-out',
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: '#fff',
                      position: 'absolute',
                      top: 2,
                      left: globalEnabled ? 20 : 2,
                      transition: 'left 200ms ease-out',
                    }}
                  />
                </button>
              </div>
            </div>
            {globalEnabled && globalSkills.length > 0 && (
              <div
                style={{
                  background: 'var(--detail-case-bg)',
                  border: '1px solid var(--divider)',
                  borderRadius: 8,
                  overflow: 'hidden',
                }}
              >
                {globalSkills.map((skill, i) => (
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
            )}
          </div>

          {skills.length === 0 && !globalEnabled && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--duration-text)' }}>
              <div style={{ fontSize: 13, marginBottom: 6 }}>{t('noSkillsFound')}</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>{t('noSkillsHint')}</div>
            </div>
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
