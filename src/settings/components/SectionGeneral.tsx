import { useState, useEffect } from 'react'
import { ArrowRight, FileCode2, FolderOpen, LoaderCircle } from 'lucide-react'
import {
  getWorkspacePath,
  setWorkspacePath,
  pickFolder,
  scanLegacyDirectiveFiles,
} from '../../lib/tauri'
import {
  applyDirectiveMigrationPreview,
  previewDirectiveMigration,
  type DirectiveMigrationApplyResult,
  type DirectiveMigrationPreview,
} from '../../lib/directiveMigration'
import SkeletonRow from './SkeletonRow'
import { useTranslation } from '../../contexts/I18nContext'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
type MigrationStatus = 'idle' | 'scanning' | 'preview' | 'applying' | 'done' | 'error'

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
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus>('scanning')
  const [candidateCount, setCandidateCount] = useState(0)
  const [migrationPreview, setMigrationPreview] = useState<DirectiveMigrationPreview | null>(null)
  const [migrationResult, setMigrationResult] = useState<DirectiveMigrationApplyResult | null>(null)
  const [migrationError, setMigrationError] = useState('')

  useEffect(() => {
    getWorkspacePath().then((path) => {
      setWorkspacePathState(path)
      setPersistedWorkspacePath(path)
      setLoading(false)
    })
    scanLegacyDirectiveFiles()
      .then((files) => {
        setCandidateCount(files.length)
        setMigrationStatus('idle')
      })
      .catch((error) => {
        console.error('[settings/general] legacy syntax scan failed', error)
        setMigrationStatus('error')
        setMigrationError(String(error))
      })
  }, [])

  const handlePickFolder = async () => {
    const picked = await pickFolder()
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

  const handlePreviewMigration = async () => {
    setMigrationStatus('scanning')
    setMigrationError('')
    setMigrationResult(null)
    try {
      const preview = await previewDirectiveMigration()
      setMigrationPreview(preview)
      setCandidateCount(preview.candidates.length)
      setMigrationStatus('preview')
    } catch (error) {
      console.error('[settings/general] migration preview failed', error)
      setMigrationStatus('error')
      setMigrationError(String(error))
    }
  }

  const handleApplyMigration = async () => {
    if (!migrationPreview || migrationPreview.valid.length === 0) return
    setMigrationStatus('applying')
    setMigrationError('')
    try {
      const result = await applyDirectiveMigrationPreview(migrationPreview)
      setMigrationResult(result)
      setCandidateCount(result.failed.length)
      setMigrationStatus('done')
    } catch (error) {
      console.error('[settings/general] migration apply failed', error)
      setMigrationStatus('error')
      setMigrationError(String(error))
    }
  }

  const migrationStatusText =
    migrationStatus === 'scanning'
      ? t('legacyMigrationScanning')
      : migrationStatus === 'applying'
        ? t('legacyMigrationApplying')
        : migrationStatus === 'preview' && migrationPreview
          ? t('legacyMigrationPreviewResult', {
              valid: migrationPreview.valid.length,
              failed: migrationPreview.failed.length,
            })
          : migrationStatus === 'done' && migrationResult
            ? t('legacyMigrationDone', {
                converted: migrationResult.converted.length,
                failed: migrationResult.failed.length,
              })
            : candidateCount === 0
              ? t('legacyMigrationNone')
              : t('legacyMigrationCandidates', { count: candidateCount })

  const backupPath = migrationResult?.converted[0]?.backup_path
    ? migrationResult.converted[0].backup_path.replace(/\/[^/]+$/, '')
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

          <div
            style={{
              maxWidth: 820,
              marginTop: 32,
              paddingTop: 28,
              borderTop: '1px solid var(--divider)',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'start',
                gap: 24,
              }}
            >
              <div style={{ flex: '1 1 440px', minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: 'var(--item-text)',
                  }}
                >
                  <FileCode2 size={16} strokeWidth={1.6} />
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{t('legacyMigrationTitle')}</span>
                </div>
                <div style={{ ...subtitleStyle, marginTop: 6 }}>
                  {t('legacyMigrationDescription')}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 12,
                    lineHeight: 1.5,
                    color:
                      migrationStatus === 'error'
                        ? 'var(--status-warning)'
                        : 'var(--duration-text)',
                  }}
                >
                  {migrationStatus === 'error' ? migrationError : migrationStatusText}
                </div>
                {backupPath && (
                  <div style={{ ...hintStyle, overflowWrap: 'anywhere' }}>
                    {t('legacyMigrationBackup', { path: backupPath })}
                  </div>
                )}
                {migrationPreview && migrationPreview.failed.length > 0 && (
                  <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
                    {migrationPreview.failed.map((failure) => (
                      <div
                        key={failure.path}
                        style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--item-meta)' }}
                      >
                        <span style={{ color: 'var(--item-text)' }}>{failure.relativePath}</span>
                        {' · '}
                        {failure.error}
                      </div>
                    ))}
                  </div>
                )}
                {migrationResult && migrationResult.failed.length > 0 && (
                  <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
                    {migrationResult.failed.map((failure) => (
                      <div
                        key={failure.path}
                        style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--item-meta)' }}
                      >
                        {failure.path} · {failure.error}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={handlePreviewMigration}
                  disabled={migrationStatus === 'scanning' || migrationStatus === 'applying'}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--divider)',
                    borderRadius: 6,
                    padding: '7px 12px',
                    fontSize: 13,
                    color: 'var(--item-meta)',
                    cursor:
                      migrationStatus === 'scanning' || migrationStatus === 'applying'
                        ? 'not-allowed'
                        : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {migrationStatus === 'scanning' ? (
                    <LoaderCircle size={14} strokeWidth={1.6} />
                  ) : (
                    <FileCode2 size={14} strokeWidth={1.6} />
                  )}
                  {t('legacyMigrationPreview')}
                </button>
                {migrationStatus === 'preview' &&
                  migrationPreview &&
                  migrationPreview.valid.length > 0 && (
                    <button
                      onClick={handleApplyMigration}
                      style={{
                        background: 'var(--record-btn)',
                        border: 'none',
                        borderRadius: 6,
                        padding: '7px 12px',
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--record-btn-icon)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t('legacyMigrationApply', { count: migrationPreview.valid.length })}
                      <ArrowRight size={14} strokeWidth={1.8} />
                    </button>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
