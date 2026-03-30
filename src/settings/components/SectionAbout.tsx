import { useState, useEffect } from 'react'
import { getAppVersion } from '../../lib/tauri'
import qrCode from '../../assets/wechat-qrcode.png'
import SkeletonRow from './SkeletonRow'

const sectionStyle: React.CSSProperties = { padding: '28px 28px 180px' }

const beliefs = [
  {
    main: '你只管输入，剩下的交给谨迹。',
    sub: '拖入零散的会议讨论，它会替你把散的拼完整。',
  },
  {
    main: '你的时间应该花在决策上，不是整理上。',
    sub: '整理是谨迹的事，你的精力值得更好的去处。',
  },
]

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
          <div style={{ height: 1, background: 'var(--divider)', marginBottom: 28 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ paddingLeft: 14 }}>
              <SkeletonRow height={14} width="78%" mb={6} />
              <SkeletonRow height={11} width="58%" mb={0} />
            </div>
            <div style={{ paddingLeft: 14 }}>
              <SkeletonRow height={14} width="82%" mb={6} />
              <SkeletonRow height={11} width="62%" mb={0} />
            </div>
          </div>
          <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <SkeletonRow height={120} width={120} mb={0} />
            <SkeletonRow height={10} width={72} mb={0} />
          </div>
          <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <SkeletonRow height={10} width={60} mb={0} />
            <SkeletonRow height={9} width={200} mb={0} />
          </div>
        </>
      ) : (
        <div style={{ animation: 'section-fadein 160ms ease-out both' }}>

          {/* 应用名区块 */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 24, color: 'var(--item-text)', fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1 }}>谨迹</div>
            <div style={{ fontSize: 13, color: 'var(--item-meta)', marginTop: 10, lineHeight: 1.5 }}>每一次思考，都值得被谨迹</div>
          </div>

          {/* 分割线 */}
          <div style={{ height: 1, background: 'var(--divider)', marginBottom: 28 }} />

          {/* 理念信念 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {beliefs.map((b) => (
              <div key={b.main} style={{
                borderLeft: '3px solid var(--record-btn)',
                paddingLeft: 14,
              }}>
                <div style={{ fontSize: 14, color: 'var(--item-text)', fontWeight: 600, lineHeight: 1.4 }}>{b.main}</div>
                <div style={{ fontSize: 11, color: 'var(--item-meta)', marginTop: 5, lineHeight: 1.6 }}>{b.sub}</div>
              </div>
            ))}
          </div>

          {/* 联系作者 */}
          <div style={{ marginTop: 40 }}>
            <div style={{ fontSize: 11, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>联系作者</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <img
                src={qrCode}
                alt="微信二维码"
                style={{ width: 120, height: 120, borderRadius: 10, display: 'block' }}
              />
              <div style={{ fontSize: 10, color: 'var(--duration-text)', letterSpacing: '0.03em' }}>扫码添加微信</div>
            </div>
          </div>

          {/* 底部元信息 */}
          <div style={{ marginTop: 36, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--item-meta)' }}>版本 {version}</div>
            <div style={{ fontSize: 10, color: 'var(--duration-text)', marginTop: 5, letterSpacing: '0.02em' }}>
              macOS · Tauri · React · Rust · Claude
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
