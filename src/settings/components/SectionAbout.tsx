import { useState, useEffect } from 'react'
import { getAppVersion } from '../../lib/tauri'
import qrCode from '../../assets/wechat-qrcode.png'
import SkeletonRow from './SkeletonRow'

const sectionStyle: React.CSSProperties = { padding: '28px 28px 180px' }

export default function SectionAbout() {
  const [version, setVersion] = useState('…')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAppVersion()
      .then(v => { setVersion(v); setLoading(false) })
      .catch(() => { setVersion('—'); setLoading(false) })
  }, [])

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 11, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20, fontWeight: 500 }}>关于</div>

      {loading ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 32 }}>
            <SkeletonRow height={24} width={56} mb={0} />
            <SkeletonRow height={13} width={180} mb={0} />
            <SkeletonRow height={11} width={80} mb={0} />
          </div>
          <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <SkeletonRow height={150} width={110} mb={0} />
            <SkeletonRow height={10} width={72} mb={0} />
          </div>
          <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <SkeletonRow height={11} width={60} mb={0} />
            <SkeletonRow height={9} width={200} mb={0} />
          </div>
        </>
      ) : (
        <div style={{ animation: 'section-fadein 160ms ease-out both' }}>

          {/* 应用名区块 */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ fontSize: 24, color: 'var(--item-text)', fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1 }}>谨迹</div>
            <div style={{ fontSize: 13, color: 'var(--item-meta)', marginTop: 10, lineHeight: 1.5 }}>每一次思考，都值得被谨迹</div>
          </div>

          {/* 联系作者 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 140, height: 180, borderRadius: 10, overflow: 'hidden' }}>
              <img
                src={qrCode}
                alt="微信二维码"
                style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover', objectPosition: 'center center', transform: 'scale(1.2) translateY(10px)', transformOrigin: 'center center' }}
              />
            </div>
            <div style={{ fontSize: 10, color: 'var(--duration-text)', letterSpacing: '0.03em' }}>扫码添加微信</div>
          </div>

          {/* 底部元信息 */}
          <div style={{ marginTop: 36, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--item-meta)' }}>版本 {version}</div>
            <div style={{ fontSize: 10, color: 'var(--duration-text)', marginTop: 5, letterSpacing: '0.02em' }}>
              macOS · Tauri · React · Rust · Claude
            </div>
            <div style={{ fontSize: 10, color: 'var(--duration-text)', marginTop: 8, lineHeight: 1.6 }}>
              内置 WhisperKit（MIT License）by Argmax, Inc. — 本地语音识别引擎
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
