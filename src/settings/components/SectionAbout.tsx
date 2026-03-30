import { useState, useEffect } from 'react'
import { getAppVersion } from '../../lib/tauri'

const sectionStyle: React.CSSProperties = { padding: '28px 28px 180px' }

function SkeletonRow({ width = '100%', height = 28, mb = 14 }: { width?: string | number; height?: number; mb?: number }) {
  return (
    <div style={{
      width, height, borderRadius: 6, marginBottom: mb,
      background: 'linear-gradient(90deg, var(--detail-case-bg) 25%, var(--divider) 50%, var(--detail-case-bg) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s ease-in-out infinite',
    }} />
  )
}

export default function SectionAbout() {
  const [version, setVersion] = useState('…')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAppVersion().then(v => {
      setVersion(v)
      setLoading(false)
    })
  }, [])

  return (
    <div style={sectionStyle}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes section-fadein {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      <div style={{ fontSize: 11, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, fontWeight: 500 }}>关于</div>

      {loading ? (
        <div style={{
          background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
          borderRadius: 8, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        }}>
          <SkeletonRow height={18} width={60} mb={0} />
          <SkeletonRow height={12} width={80} mb={0} />
        </div>
      ) : (
        <div style={{ animation: 'section-fadein 160ms ease-out both' }}>
          <div style={{
            background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
            borderRadius: 8, padding: 20, textAlign: 'center',
          }}>
            <div style={{ fontSize: 18, color: 'var(--item-text)', fontWeight: 500, marginBottom: 4 }}>谨迹</div>
            <div style={{ fontSize: 11, color: 'var(--duration-text)' }}>版本 {version}</div>
          </div>
        </div>
      )}
    </div>
  )
}
