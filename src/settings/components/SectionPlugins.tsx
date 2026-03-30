const sectionStyle: React.CSSProperties = { padding: '28px 28px 180px', borderBottom: '1px solid var(--divider)' }

const PLUGINS = [
  {
    icon: '🗂', iconBg: 'rgba(200,147,58,0.12)',
    name: '定时文件整理',
    desc: '按规则自动归档 Workspace 中的素材和日志，保持目录整洁',
  },
  {
    icon: '✦', iconBg: 'rgba(120,100,200,0.12)',
    name: '图文可视化美化',
    desc: '将日志内容转换为图文并茂的可视化卡片，便于分享',
  },
]

export default function SectionPlugins() {
  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 11, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, fontWeight: 500 }}>技能插件</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {PLUGINS.map(({ icon, iconBg, name, desc }) => (
          <div key={name} style={{
            background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
            borderRadius: 8, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--item-text)', marginBottom: 2 }}>{name}</div>
              <div style={{ fontSize: 10, color: 'var(--duration-text)', lineHeight: 1.4 }}>{desc}</div>
            </div>
            <div style={{ fontSize: 9, color: 'var(--record-btn)', background: 'rgba(200,147,58,0.08)', border: '1px solid rgba(200,147,58,0.15)', borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap' }}>即将推出</div>
          </div>
        ))}
        <div style={{ border: '1px dashed var(--divider)', borderRadius: 8, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, opacity: 0.4 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, border: '1px dashed var(--divider)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: 'var(--item-meta)', flexShrink: 0 }}>+</div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--item-meta)' }}>更多插件</div>
            <div style={{ fontSize: 10, color: 'var(--duration-text)' }}>插件市场即将开放</div>
          </div>
        </div>
      </div>
    </div>
  )
}
