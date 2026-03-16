import '../styles/globals.css'
import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'

export default function SettingsApp() {
  const [key, setKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    invoke<string | null>('get_api_key').then(k => {
      setKey(k ?? '')
      setLoading(false)
    })
  }, [])

  const handleSave = useCallback(async () => {
    await invoke('set_api_key', { key })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [key])

  if (loading) return null

  return (
    <div style={{
      padding: 24,
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
      background: 'var(--bg)',
      minHeight: '100vh',
      color: 'var(--item-text)',
    }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--item-text)' }}>
        DashScope API Key
      </h2>
      <input
        type="text"
        value={key}
        onChange={e => setKey(e.target.value)}
        placeholder="sk-..."
        style={{
          width: '100%',
          padding: '8px 12px',
          fontSize: 14,
          border: '1px solid var(--divider)',
          borderRadius: 8,
          outline: 'none',
          background: 'var(--item-icon-bg)',
          color: 'var(--item-text)',
          boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 12, gap: 12 }}>
        <button
          onClick={handleSave}
          style={{
            padding: '6px 16px',
            fontSize: 14,
            background: 'var(--record-btn)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          保存
        </button>
        {saved && <span style={{ fontSize: 13, color: 'var(--item-meta)' }}>已保存</span>}
      </div>
      <p style={{ fontSize: 12, color: 'var(--item-meta)', marginTop: 16, lineHeight: 1.5 }}>
        配置后，超过 30 秒的录音将自动转写为文字。
      </p>
    </div>
  )
}
