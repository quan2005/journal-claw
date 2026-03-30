import { useState, useEffect } from 'react'
import { getAppVersion } from '../../lib/tauri'

const sectionStyle: React.CSSProperties = { padding: '28px 28px 120px' }

export default function SectionAbout() {
  const [version, setVersion] = useState('…')

  useEffect(() => {
    getAppVersion().then(setVersion)
  }, [])

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 11, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, fontWeight: 500 }}>关于</div>
      <div style={{
        background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
        borderRadius: 8, padding: 20, textAlign: 'center',
      }}>
        <div style={{ fontSize: 18, color: 'var(--item-text)', fontWeight: 500, marginBottom: 4 }}>谨迹</div>
        <div style={{ fontSize: 11, color: 'var(--duration-text)' }}>版本 {version}</div>
      </div>
    </div>
  )
}
