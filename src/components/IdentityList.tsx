import type { IdentityEntry } from '../types'

interface IdentityItemProps {
  identity: IdentityEntry
  isSelected: boolean
  onClick: (identity: IdentityEntry) => void
}

function IdentityItem({ identity, isSelected, onClick }: IdentityItemProps) {
  return (
    <div
      onClick={() => onClick(identity)}
      style={{
        padding: '9px 14px',
        cursor: 'pointer',
        background: isSelected ? 'var(--item-selected-bg)' : 'transparent',
        borderLeft: isSelected ? '2px solid var(--record-btn)' : '2px solid transparent',
      }}
      onMouseEnter={e => {
        if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'var(--item-hover-bg)'
      }}
      onMouseLeave={e => {
        if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
      }}
    >
      <div style={{
        fontSize: 12, fontWeight: 700,
        color: isSelected ? 'var(--item-selected-text)' : 'var(--item-text)',
        fontFamily: "'Noto Serif SC', serif",
        lineHeight: 1.4, marginBottom: 3,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {identity.name}
      </div>
      <div style={{
        fontSize: 11, color: 'var(--item-meta)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {identity.region}
        {identity.summary ? ` · ${identity.summary}` : ''}
      </div>
    </div>
  )
}

interface IdentityListProps {
  identities: IdentityEntry[]
  loading?: boolean
  selectedPath: string | null
  onSelect: (identity: IdentityEntry) => void
}

export function IdentityList({ identities, loading, selectedPath, onSelect }: IdentityListProps) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--sidebar-bg)' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
          {[70, 55, 80, 60].map((w, i) => (
            <div key={i} style={{ padding: '7px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{
                height: 13, width: `${w}%`,
                background: 'linear-gradient(90deg, var(--skeleton-base, rgba(128,128,128,0.10)) 25%, var(--skeleton-shine, rgba(128,128,128,0.20)) 50%, var(--skeleton-base, rgba(128,128,128,0.10)) 75%)',
                backgroundSize: '200% 100%',
                animation: `shimmer 1.6s ease-in-out ${i * 80}ms infinite`,
                borderRadius: 3,
              }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (identities.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', gap: 8, padding: '0 24px', textAlign: 'center',
        background: 'var(--sidebar-bg)',
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--item-meta)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
        <div style={{ fontSize: 12, color: 'var(--item-meta)', lineHeight: 1.5 }}>
          暂无身份档案<br />
          <span style={{ fontSize: 11 }}>录音后会自动创建说话人档案</span>
        </div>
      </div>
    )
  }

  // Group by region
  const grouped: Record<string, IdentityEntry[]> = {}
  for (const id of identities) {
    if (!grouped[id.region]) grouped[id.region] = []
    grouped[id.region].push(id)
  }
  const regions = Object.keys(grouped).sort()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--sidebar-bg)' }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 12 }}>
        {regions.map(region => (
          <div key={region}>
            <div style={{ padding: '14px 16px 6px' }}>
              <span style={{ fontSize: 10, color: 'var(--sidebar-month)', letterSpacing: '0.12em' }}>
                {region}
              </span>
            </div>
            {grouped[region].map(identity => (
              <IdentityItem
                key={identity.path}
                identity={identity}
                isSelected={identity.path === selectedPath}
                onClick={onSelect}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
