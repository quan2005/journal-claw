import { useState, useEffect } from 'react'
import { FolderOpen } from 'lucide-react'
import { selectRuntimeClient } from '../../lib/runtimeClient'
import { pickHostFolder } from '../../lib/hostBridge'

const getWorkspacePath = () => selectRuntimeClient().invoke<string>('get_workspace_path')
const setWorkspacePath = (path: string) =>
  selectRuntimeClient().invoke<void>('set_workspace_path', { path })
import SkeletonRow from './SkeletonRow'
import { useTranslation } from '../../contexts/I18nContext'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const sectionStyle: React.CSSProperties = {
  padding: '34px 40px 44px',
  borderBottom: '1px solid var(--divider)',
}
const sectionHeaderStyle: React.CSSProperties = {
  marginBottom: 22,
}
const eyebrowStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--month-label)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: 6,
  fontWeight: 500,
}
const subtitleStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.6,
  color: 'var(--item-meta)',
  maxWidth: 560,
}
const labelStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--item-meta)',
  marginBottom: 5,
  display: 'block',
}
const hintStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--duration-text)',
  marginTop: 4,
  lineHeight: 1.5,
}
const inputStyle: React.CSSProperties = {
  flex: 1,
  background: 'var(--bg)',
  border: '1px solid var(--divider)',
  borderRadius: 6,
  padding: '7px 10px',
  fontSize: 14,
  color: 'var(--item-text)',
  fontFamily: 'ui-monospace, monospace',
  outline: 'none',
  minWidth: 0,
}

export default function SectionGeneral() {
  const { t } = useTranslation()
  const [workspacePath, setWorkspacePathState] = useState('')
  const [persistedWorkspacePath, setPersistedWorkspacePath] = useState('')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getWorkspacePath().then((path) => {
      setWorkspacePathState(path)
      setPersistedWorkspacePath(path)
      setLoading(false)
    })
  }, [])

  const handlePickFolder = async () => {
    const picked = await pickHostFolder()
    if (picked) {
      setWorkspacePathState(picked)
      setSaveStatus('idle')
    }
  }

  const handleSave = async () => {
    setSaveStatus('saving')
    try {
      await setWorkspacePath(workspacePath)
      setPersistedWorkspacePath(workspacePath)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus((current) => (current === 'saved' ? 'idle' : current)), 2000)
    } catch (error) {
      console.error('[settings/general] save failed', error)
      setSaveStatus('error')
    }
  }

  const hasUnsavedChanges = workspacePath !== persistedWorkspacePath
  const canSave = workspacePath.trim().length > 0 && hasUnsavedChanges && saveStatus !== 'saving'
  const saveHint =
    saveStatus === 'saving'
      ? t('savingDots')
      : saveStatus === 'saved'
        ? t('saved')
        : saveStatus === 'error'
          ? t('saveFailedMsg')
          : hasUnsavedChanges
            ? t('unsavedChanges')
            : ''

  return (
    <div style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <div style={eyebrowStyle}>{t('general')}</div>
        <div style={subtitleStyle}>{t('generalSubtitle')}</div>
      </div>

      {loading ? (
        <>
          <SkeletonRow height={11} width={80} mb={5} />
          <SkeletonRow height={32} mb={4} />
          <SkeletonRow height={10} width={120} mb={16} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <SkeletonRow height={30} width={60} mb={0} />
          </div>
        </>
      ) : (
        <div style={{ animation: 'section-fadein 160ms ease-out both' }}>
          <div
            style={{
              background: 'var(--detail-case-bg)',
              border: '1px solid var(--divider)',
              borderRadius: 8,
              padding: 18,
              maxWidth: 820,
            }}
          >
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--item-text)' }}>
                {t('workspaceFolder')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--duration-text)', marginTop: 4 }}>
                {t('workspaceSaveHint')}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>{t('workspacePath')}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={inputStyle}
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={workspacePath}
                  title={workspacePath}
                  onChange={(e) => {
                    setWorkspacePathState(e.target.value)
                    setSaveStatus('idle')
                  }}
                  placeholder="/Users/you/Documents/journal"
                />
                <button
                  onClick={handlePickFolder}
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--divider)',
                    borderRadius: 6,
                    padding: '0 12px',
                    fontSize: 13,
                    color: 'var(--item-meta)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <FolderOpen size={14} strokeWidth={1.6} />
                  {t('browse')}
                </button>
              </div>
              <div style={hintStyle}>{t('workspaceDesc')}</div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                borderTop: '1px solid var(--divider)',
                paddingTop: 14,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color:
                    saveStatus === 'error'
                      ? 'var(--status-warning)'
                      : saveStatus === 'saved'
                        ? 'var(--status-success)'
                        : 'var(--duration-text)',
                  minHeight: 16,
                }}
              >
                {saveHint}
              </span>
              <button
                onClick={handleSave}
                disabled={!canSave}
                style={{
                  background: canSave ? 'var(--record-btn)' : 'var(--divider)',
                  border: 'none',
                  borderRadius: 6,
                  padding: '7px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: canSave ? 'var(--record-btn-icon)' : 'var(--duration-text)',
                  cursor: canSave ? 'pointer' : 'not-allowed',
                }}
              >
                {saveStatus === 'saving' ? t('savingDots') : t('saveBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
