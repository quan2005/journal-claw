import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

export default function SettingsApp() {
  const [apiKey, setApiKey] = useState('')
  const [workspacePath, setWorkspacePath] = useState('')
  const [claudeCli, setClaudeCli] = useState('claude')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    invoke<string | null>('get_api_key').then(k => setApiKey(k ?? ''))
    invoke<string>('get_workspace_path').then(p => setWorkspacePath(p))
    invoke<string>('get_claude_cli_path').then(p => setClaudeCli(p))
  }, [])

  const handleSave = async () => {
    await invoke('set_api_key', { key: apiKey })
    await invoke('set_workspace_path', { path: workspacePath })
    await invoke('set_claude_cli_path', { path: claudeCli })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '6px 8px', fontSize: 13,
    border: '1px solid #e5e5ea', borderRadius: 6,
    fontFamily: 'inherit', outline: 'none', marginTop: 4,
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 500, color: '#636366', display: 'block',
  }
  const sectionStyle: React.CSSProperties = { marginBottom: 16 }

  return (
    <div style={{ padding: '20px 20px 16px', fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Text, sans-serif' }}>
      <div style={sectionStyle}>
        <label style={labelStyle}>Workspace 路径</label>
        <input style={inputStyle} value={workspacePath}
          onChange={e => setWorkspacePath(e.target.value)}
          placeholder="/Users/you/notebook" />
        <div style={{ fontSize: 11, color: '#aeaeb2', marginTop: 4 }}>
          日志和素材的存储根目录（如 ~/Projects/github/notebook）
        </div>
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>Claude CLI 路径</label>
        <input style={inputStyle} value={claudeCli}
          onChange={e => setClaudeCli(e.target.value)}
          placeholder="claude" />
        <div style={{ fontSize: 11, color: '#aeaeb2', marginTop: 4 }}>
          claude 可执行文件路径，默认直接填 claude
        </div>
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>DashScope API Key</label>
        <input style={inputStyle} value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder="sk-..." type="password" />
        <div style={{ fontSize: 11, color: '#aeaeb2', marginTop: 4 }}>
          配置后，超过 30 秒的录音将自动转写为文字
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={handleSave} style={{
          background: '#ff3b30', color: 'white', border: 'none',
          borderRadius: 6, padding: '7px 18px', fontSize: 13,
          fontWeight: 500, cursor: 'pointer',
        }}>保存</button>
        {saved && <span style={{ fontSize: 12, color: '#34c759' }}>已保存</span>}
      </div>
    </div>
  )
}
