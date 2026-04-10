import { useTranslation } from '../../contexts/I18nContext'
import { FeishuIcon } from '../../components/icons/FeishuIcon'

const sectionStyle: React.CSSProperties = { padding: '28px 28px 40px', borderBottom: '1px solid var(--divider)' }

export default function SectionFeishu() {
  const { t } = useTranslation()

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 13, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, fontWeight: 500 }}>{t('im')}</div>

      <div style={{ opacity: 0.35, pointerEvents: 'none' }}>
        <div style={{
          background: 'var(--detail-case-bg)',
          border: '1px solid var(--divider)',
          borderRadius: 8,
          padding: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'rgba(100,160,255,0.10)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}><FeishuIcon size={20} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: 'var(--item-text)' }}>{t('feishuTitle')}</div>
              <div style={{ fontSize: 11, color: 'var(--duration-text)', marginTop: 2 }}>{t('feishuDesc')}</div>
            </div>
            {/* Disabled toggle */}
            <div style={{
              width: 40, height: 22, borderRadius: 11,
              background: 'var(--divider)',
              position: 'relative', flexShrink: 0,
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 2, left: 2,
              }} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: 'var(--duration-text)', letterSpacing: '0.04em' }}>
        {t('comingSoon')}
      </div>
    </div>
  )
}
