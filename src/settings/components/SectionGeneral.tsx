import { useState, useEffect } from 'react'
import { getWorkspacePath, setWorkspacePath, pickFolder } from '../../lib/tauri'
import SkeletonRow from './SkeletonRow'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const sectionStyle: React.CSSProperties = { padding: '28px 28px 180px', borderBottom: '1px solid var(--divider)' }
const labelStyle: React.CSSProperties = { fontSize: 11, color: 'var(--item-meta)', marginBottom: 5, display: 'block' }
const hintStyle: React.CSSProperties = { fontSize: 10, color: 'var(--duration-text)', marginTop: 4, lineHeight: 1.5 }
const inputStyle: React.CSSProperties = {
  flex: 1, background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
  borderRadius: 6, padding: '7px 10px', fontSize: 12, color: 'var(--item-text)',
  fontFamily: 'ui-monospace, monospace', outline: 'none',
}

export default function SectionGeneral() {
  const [workspacePath, setWorkspacePathState] = useState('')
  const [persistedWorkspacePath, setPersistedWorkspacePath] = useState('')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getWorkspacePath().then(path => {
      setWorkspacePathState(path)
      setPersistedWorkspacePath(path)
      setLoading(false)
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
      setTimeout(() => setSaveStatus(current => current === 'saved' ? 'idle' : current), 2000)
    } catch (error) {
      console.error('[settings/general] save failed', error)
      setSaveStatus('error')
    }
  }

  const hasUnsavedChanges = workspacePath !== persistedWorkspacePath
  const canSave = workspacePath.trim().length > 0 && hasUnsavedChanges && saveStatus !== 'saving'
  const saveHint = saveStatus === 'saving'
    ? '保存中…'
    : saveStatus === 'saved'
      ? '已保存'
      : saveStatus === 'error'
        ? '保存失败，请重试'
        : hasUnsavedChanges
          ? '有未保存修改'
          : ''

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 11, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, fontWeight: 500 }}>通用</div>

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
          {/* Workspace 路径 */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Workspace 路径</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                style={inputStyle}
                value={workspacePath}
                onChange={e => {
                  setWorkspacePathState(e.target.value)
                  setSaveStatus('idle')
                }}
                placeholder="/Users/you/Documents/journal"
              />
              <button
                onClick={handlePickFolder}
                style={{
                  background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
                  borderRadius: 6, padding: '0 12px', fontSize: 12, color: 'var(--item-meta)',
                  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                选择…
              </button>
            </div>
            <div style={hintStyle}>日志和素材的存储根目录</div>
          </div>

          {/* 保存 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
            <span style={{
              fontSize: 11,
              color: saveStatus === 'error'
                ? '#ff9f0a'
                : saveStatus === 'saved'
                  ? '#34c759'
                  : 'var(--duration-text)',
              minHeight: 16,
            }}>
              {saveHint}
            </span>
            <button
              onClick={handleSave}
              disabled={!canSave}
              style={{
                background: canSave ? 'var(--record-btn)' : 'var(--divider)', border: 'none', borderRadius: 5,
                padding: '6px 18px', fontSize: 12, fontWeight: 600,
                color: canSave ? 'var(--bg)' : 'var(--duration-text)', cursor: canSave ? 'pointer' : 'not-allowed',
              }}
            >
              {saveStatus === 'saving' ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
