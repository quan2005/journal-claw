import { useState, useEffect } from 'react'
import { getApiKey, setApiKey } from '../../lib/tauri'

const sectionStyle: React.CSSProperties = { padding: '0 12px 120px', borderBottom: '1px solid var(--divider)' }
const labelStyle: React.CSSProperties = { fontSize: 11, color: 'var(--item-meta)', marginBottom: 5, display: 'block' }
const hintStyle: React.CSSProperties = { fontSize: 10, color: 'var(--duration-text)', marginTop: 4, lineHeight: 1.5 }
const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
  borderRadius: 6, padding: '7px 10px', fontSize: 12, color: 'var(--item-text)',
  fontFamily: 'ui-monospace, monospace', outline: 'none', boxSizing: 'border-box',
}

export default function SectionVoice() {
  const [apiKey, setApiKeyState] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getApiKey().then(k => setApiKeyState(k ?? ''))
  }, [])

  const handleSave = async () => {
    await setApiKey(apiKey)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 11, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, fontWeight: 500 }}>语音转写</div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>转写引擎</label>
        <div style={{ ...inputStyle, color: 'var(--item-meta)', cursor: 'default' }}>阿里云 DashScope</div>
        <div style={hintStyle}>当前仅支持 DashScope，更多引擎即将支持</div>
      </div>

      <div style={{ height: 1, background: 'var(--divider)', margin: '14px 0' }} />

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>DashScope API Key</label>
        <input type="password" style={inputStyle} placeholder="sk-…"
          value={apiKey} onChange={e => setApiKeyState(e.target.value)} />
        <div style={hintStyle}>配置后，超过 30 秒的录音将自动转写为文字</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
        {saved && <span style={{ fontSize: 11, color: '#34c759' }}>已保存</span>}
        <button onClick={handleSave} style={{
          background: 'var(--record-btn)', border: 'none', borderRadius: 5,
          padding: '6px 18px', fontSize: 12, fontWeight: 600,
          color: 'var(--bg)', cursor: 'pointer',
        }}>保存</button>
      </div>
    </div>
  )
}
