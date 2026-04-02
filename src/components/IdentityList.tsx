import { useCallback } from 'react'
import { Menu, MenuItem } from '@tauri-apps/api/menu'
import type { IdentityEntry } from '../types'
import { pickDisplayTags } from '../lib/tags'

export const SOUL_PATH = '__soul__'

function isSoul(identity: IdentityEntry) {
  return identity.path === SOUL_PATH
}

function isUserSelf(identity: IdentityEntry) {
  return identity.filename === 'about-me.md'
}

function isPinned(identity: IdentityEntry) {
  return isSoul(identity) || isUserSelf(identity)
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ identity }: { identity: IdentityEntry }) {
  let char: string
  let bg: string
  let color: string

  if (isSoul(identity)) {
    char = 'AI'
    bg = 'rgba(90,154,106,0.15)'
    color = '#5a9a6a'
  } else if (isUserSelf(identity)) {
    char = '我'
    bg = 'rgba(200,147,58,0.15)'
    color = '#c8933a'
  } else {
    char = identity.name.charAt(0) || '?'
    bg = 'rgba(128,128,128,0.12)'
    color = 'var(--item-meta)'
  }

  return (
    <div style={{
      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
      background: bg, color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: char === 'AI' ? 10 : 13, fontWeight: 600,
      fontFamily: char === 'AI' ? "'IBM Plex Mono', monospace" : undefined,
      userSelect: 'none',
    }}>
      {char}
    </div>
  )
}

// ── Item ──────────────────────────────────────────────────────────────────────
interface IdentityItemProps {
  identity: IdentityEntry
  isSelected: boolean
  onClick: () => void
  onContextMenu: (identity: IdentityEntry) => void
}

function IdentityItem({ identity, isSelected, onClick, onContextMenu }: IdentityItemProps) {
  const displayTags = pickDisplayTags(identity.tags, 2)

  return (
    <div
      onClick={onClick}
      onContextMenu={e => { e.preventDefault(); onContextMenu(identity) }}
      style={{
        padding: '7px 12px',
        cursor: 'pointer',
        background: isSelected ? 'var(--item-selected-bg)' : 'transparent',
        display: 'flex', alignItems: 'center', gap: 10,
      }}
      onMouseEnter={e => {
        if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'var(--item-hover-bg)'
      }}
      onMouseLeave={e => {
        if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
      }}
    >
      <Avatar identity={identity} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: 12, fontWeight: 600,
          color: isSelected ? 'var(--item-selected-text)' : 'var(--item-text)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          lineHeight: 1.4, marginBottom: identity.summary || displayTags.length > 0 ? 2 : 0,
        }}>
          {identity.name}
        </div>
        {identity.summary && (
          <div style={{
            fontSize: 11, color: 'var(--item-meta)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            lineHeight: 1.4,
          }}>
            {identity.summary}
          </div>
        )}
        {displayTags.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
            {displayTags.map((cfg, i) => (
              <span key={i} style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 4,
                fontWeight: 500, color: cfg.color, background: cfg.bg,
                fontFamily: "'IBM Plex Mono', monospace", whiteSpace: 'nowrap',
              }}>
                {cfg.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── List ──────────────────────────────────────────────────────────────────────
interface IdentityListProps {
  identities: IdentityEntry[]   // includes virtual soul entry
  loading?: boolean
  selectedPath: string | null
  onSelect: (identity: IdentityEntry) => void
  onMerge: (identity: IdentityEntry) => void
  onDelete: (identity: IdentityEntry) => void
}

export function IdentityList({
  identities, loading, selectedPath, onSelect, onMerge, onDelete,
}: IdentityListProps) {

  const handleContextMenu = useCallback(async (identity: IdentityEntry) => {
    const menuItems: Awaited<ReturnType<typeof MenuItem.new>>[] = []

    if (identity.speaker_id) {
      menuItems.push(await MenuItem.new({
        text: '合并到…',
        action: () => onMerge(identity),
      }))
    }

    if (!isSoul(identity) && !isUserSelf(identity)) {
      menuItems.push(await MenuItem.new({
        text: '删除',
        action: () => onDelete(identity),
      }))
    }

    if (menuItems.length === 0) return

    const menu = await Menu.new({ items: menuItems })
    await menu.popup()
  }, [onMerge, onDelete])

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--sidebar-bg)' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
          {[70, 55, 80, 60].map((w, i) => (
            <div key={i} style={{ padding: '7px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: 'var(--skeleton-base, rgba(128,128,128,0.10))',
              }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{
                  height: 12, width: `${w}%`,
                  background: 'linear-gradient(90deg, var(--skeleton-base, rgba(128,128,128,0.10)) 25%, var(--skeleton-shine, rgba(128,128,128,0.20)) 50%, var(--skeleton-base, rgba(128,128,128,0.10)) 75%)',
                  backgroundSize: '200% 100%',
                  animation: `shimmer 1.6s ease-in-out ${i * 80}ms infinite`,
                  borderRadius: 3,
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const pinned = identities.filter(isPinned)
  const regular = identities.filter(i => !isPinned(i))

  // Group regular by region
  const grouped: Record<string, IdentityEntry[]> = {}
  for (const id of regular) {
    if (!grouped[id.region]) grouped[id.region] = []
    grouped[id.region].push(id)
  }
  const regions = Object.keys(grouped).sort()

  const hasRegular = regular.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--sidebar-bg)' }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 12 }}>

        {/* Pinned section */}
        {pinned.length > 0 && (
          <div>
            {pinned.map(identity => (
              <IdentityItem
                key={identity.path}
                identity={identity}
                isSelected={identity.path === selectedPath}
                onClick={() => onSelect(identity)}
                onContextMenu={handleContextMenu}
              />
            ))}
          </div>
        )}

        {/* Gap between pinned and regular */}
        {pinned.length > 0 && hasRegular && (
          <div style={{ height: 6, background: 'var(--bg, #1a1a1a)' }} />
        )}

        {/* Regular section grouped by region */}
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
                onClick={() => onSelect(identity)}
                onContextMenu={handleContextMenu}
              />
            ))}
          </div>
        ))}

        {/* Empty state (no real identities, only soul) */}
        {regular.length === 0 && !loading && (
          <div style={{
            padding: '24px 16px', textAlign: 'center',
            color: 'var(--item-meta)', fontSize: 12, lineHeight: 1.6,
          }}>
            暂无身份档案<br />
            <span style={{ fontSize: 11 }}>录音后会自动创建说话人档案</span>
          </div>
        )}
      </div>
    </div>
  )
}
