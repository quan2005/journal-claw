import { useState } from 'react'
import { useIdentity } from '../hooks/useIdentity'
import { IdentityList } from './IdentityList'
import { IdentityDetail } from './IdentityDetail'
import SoulView from './SoulView'
import type { IdentityEntry } from '../types'

interface IdentityViewProps {
  baseWidth: number
  dividerWidth: number
  onDividerMouseDown: (e: React.MouseEvent) => void
}

export default function IdentityView({ baseWidth, dividerWidth, onDividerMouseDown }: IdentityViewProps) {
  const { identities, loading, refresh } = useIdentity()
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [soulExpanded, setSoulExpanded] = useState(false)

  const selectedIdentity = identities.find(i => i.path === selectedPath) ?? null

  const handleSelect = (identity: IdentityEntry) => {
    setSelectedPath(identity.path)
  }

  const handleDeleted = () => {
    setSelectedPath(null)
    refresh()
  }

  const handleMerged = () => {
    setSelectedPath(null)
    refresh()
  }

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', animation: 'view-enter 0.2s ease-out' }}>
      {/* Left: Soul card + Identity list */}
      <div style={{ width: baseWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '0.5px solid var(--divider)' }}>
        {/* Soul card (collapsible) */}
        <div style={{ flexShrink: 0, borderBottom: '0.5px solid var(--divider)' }}>
          <button
            onClick={() => setSoulExpanded(v => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', background: 'none', border: 'none',
              cursor: 'pointer', color: 'var(--item-text)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--soul-color, #5a9a6a)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4"/>
              <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 12 0"/>
              <path d="M12 12a2 2 0 0 0-2 2c0 2 1 4 1 6"/>
              <path d="M8.5 16.5c-.3 2-.1 4 .5 6"/>
              <path d="M14 13.5c0 1.5-.5 3-1 5.5"/>
              <path d="M17.5 15c-.5 2-1 4-1.5 6"/>
            </svg>
            <span style={{ fontSize: 11, color: 'var(--item-meta)', flex: 1, textAlign: 'left' }}>人格设定</span>
            <svg
              width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="var(--item-meta)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: soulExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {soulExpanded && (
            <div style={{ height: 260, borderTop: '0.5px solid var(--divider)' }}>
              <SoulView />
            </div>
          )}
        </div>

        {/* Identity list */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <IdentityList
            identities={identities}
            loading={loading}
            selectedPath={selectedPath}
            onSelect={handleSelect}
          />
        </div>
      </div>

      {/* Divider */}
      <div
        onMouseDown={onDividerMouseDown}
        style={{ width: dividerWidth, flexShrink: 0, background: 'transparent', cursor: 'col-resize' }}
      />

      {/* Right: Identity detail */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <IdentityDetail
          identity={selectedIdentity}
          onDeleted={handleDeleted}
          onMerged={handleMerged}
        />
      </div>
    </div>
  )
}
