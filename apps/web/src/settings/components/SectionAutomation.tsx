import type { CSSProperties } from 'react'
import { useTranslation } from '../../contexts/I18nContext'

const sectionStyle: CSSProperties = {
  padding: '28px 28px 180px',
  borderBottom: '1px solid var(--divider)',
}

export default function SectionAutomation() {
  const { t } = useTranslation()

  const openWorkbench = () => {
    window.dispatchEvent(new CustomEvent('open-automation-workbench'))
  }

  return (
    <div style={sectionStyle}>
      <div
        style={{
          fontSize: 13,
          color: 'var(--month-label)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 16,
          fontWeight: 500,
        }}
      >
        {t('automation')}
      </div>
      <div
        style={{
          background: 'var(--detail-case-bg)',
          border: '1px solid var(--divider)',
          borderRadius: 8,
          padding: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, color: 'var(--item-text)', marginBottom: 4 }}>
              自动化工作台
            </div>
            <div style={{ fontSize: 12, color: 'var(--item-meta)', lineHeight: 1.5 }}>
              模板、Routine 和运行记录在主界面统一管理。
            </div>
          </div>
          <button
            type="button"
            onClick={openWorkbench}
            style={{
              minHeight: 32,
              padding: '0 14px',
              border: 0,
              borderRadius: 6,
              background: 'var(--record-btn)',
              color: 'var(--record-btn-icon)',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            打开工作台
          </button>
        </div>
        <SettingRow
          title="允许后台自动化运行"
          desc="关闭后，定时 Routine 暂停；手动运行仍可执行。"
          value="开启"
        />
        <SettingRow
          title="默认 Agent 权限"
          desc="自动化使用完整 Agent 权限，并保留完整会话与 manifest。"
          value="完整 Agent"
        />
        <SettingRow title="失败通知" desc="只在失败或连续跳过时提示，避免打扰阅读。" value="开启" />
      </div>
    </div>
  )
}

function SettingRow({ title, desc, value }: { title: string; desc: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        minHeight: 50,
        borderTop: '1px solid var(--divider)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--item-text)' }}>{title}</div>
        <div style={{ marginTop: 3, fontSize: 11, color: 'var(--duration-text)' }}>{desc}</div>
      </div>
      <span
        style={{
          padding: '3px 8px',
          borderRadius: 5,
          border: '1px solid color-mix(in srgb, var(--record-btn) 32%, var(--divider))',
          color: 'var(--record-btn)',
          fontSize: 11,
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
    </div>
  )
}
