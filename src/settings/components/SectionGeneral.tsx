import { useState, useEffect } from 'react'
import { getWorkspacePath, setWorkspacePath, pickFolder } from '../../lib/tauri'

const sectionStyle: React.CSSProperties = { padding: '28px 28px 120px', borderBottom: '1px solid var(--divider)' }
const labelStyle: React.CSSProperties = { fontSize: 11, color: 'var(--item-meta)', marginBottom: 5, display: 'block' }
const hintStyle: React.CSSProperties = { fontSize: 10, color: 'var(--duration-text)', marginTop: 4, lineHeight: 1.5 }
const inputStyle: React.CSSProperties = {
  flex: 1, background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
  borderRadius: 6, padding: '7px 10px', fontSize: 12, color: 'var(--item-text)',
  fontFamily: 'ui-monospace, monospace', outline: 'none',
}

export default function SectionGeneral() {
  const [workspacePath, setWorkspacePathState] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getWorkspacePath().then(setWorkspacePathState)
  }, [])

  const handlePickFolder = async () => {
    const picked = await pickFolder()
    if (picked) setWorkspacePathState(picked)
  }

  const handleSave = async () => {
    await setWorkspacePath(workspacePath)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 11, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, fontWeight: 500 }}>通用</div>

      {/* Workspace 路径 */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Workspace 路径</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={inputStyle}
            value={workspacePath}
            onChange={e => setWorkspacePathState(e.target.value)}
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
        {saved && <span style={{ fontSize: 11, color: '#34c759' }}>已保存</span>}
        <button
          onClick={handleSave}
          style={{
            background: 'var(--record-btn)', border: 'none', borderRadius: 5,
            padding: '6px 18px', fontSize: 12, fontWeight: 600,
            color: 'var(--bg)', cursor: 'pointer',
          }}
        >
          保存
        </button>
      </div>
    </div>
  )
}
