import { useCallback, useEffect, useRef, useState } from 'react'
import type { IdentityEntry } from '../types'
import { pickDisplayTags } from '../lib/tags'
import { getIdentityContent, revealInFinder, openFile } from '../lib/tauri'
import { useTranslation } from '../contexts/I18nContext'
import { detectLang, createTranslator } from '../lib/i18n'

export const SOUL_PATH = '__soul__'

function isSoul(identity: IdentityEntry) {
  return identity.path === SOUL_PATH
}

function isUserSelf(identity: IdentityEntry) {
  return identity.filename === 'README.md'
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
    char = createTranslator(detectLang())('me')
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
  onContextMenu: (identity: IdentityEntry, e: React.MouseEvent) => void
}

function IdentityItem({ identity, isSelected, onClick, onContextMenu }: IdentityItemProps) {
  const displayTags = pickDisplayTags(identity.tags, 2)

  return (
    <div
      onClick={onClick}
      onContextMenu={e => { e.preventDefault(); onContextMenu(identity, e) }}
      style={{
        padding: '10px 14px 4px',
        cursor: 'pointer',
        background: isSelected ? 'var(--item-selected-bg)' : 'transparent',
        display: 'flex', alignItems: 'flex-start', gap: 10,
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
          display: 'flex', alignItems: 'center', gap: 6,
          lineHeight: 1.4, marginBottom: identity.summary ? 2 : 0,
        }}>
          <span style={{
            fontSize: 14, fontWeight: 600,
            color: isSelected ? 'var(--item-selected-text)' : 'var(--item-text)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            flexShrink: 1, minWidth: 0,
          }}>
            {identity.name}
          </span>
          {displayTags.length > 0 && displayTags.map((cfg, i) => (
            <span key={i} style={{
              fontSize: 11, padding: '1px 5px', borderRadius: 3,
              fontWeight: 500, color: cfg.color, background: cfg.bg,
              fontFamily: "'IBM Plex Mono', monospace", whiteSpace: 'nowrap',
              flexShrink: 0,
            }}>
              {cfg.label}
            </span>
          ))}
        </div>
        {identity.summary && (
          <div style={{
            fontSize: 13, color: 'var(--item-meta)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            lineHeight: 1.4,
          }}>
            {identity.summary}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Context Menu ─────────────────────────────────────────────────────────────
function MenuIcon({ icon, danger }: { icon: string; danger?: boolean }) {
  const color = danger ? '#ff3b30' : 'var(--item-meta)'
  const size = 14
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  switch (icon) {
    case 'merge':
      return <svg {...props}><path d="M18 21V8a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v13"/><path d="M6 13h12"/><polyline points="9 3 12 6 15 3"/></svg>
    case 'content':
      return <svg {...props}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="16" x2="13" y2="16"/></svg>
    case 'path':
      return <svg {...props}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
    case 'edit':
      return <svg {...props}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    case 'finder':
      return <svg {...props}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
    case 'delete':
      return <svg {...props}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
    default:
      return null
  }
}

function MenuItemRow({ label, icon, danger, onClick }: { label: string; icon: string; danger?: boolean; onClick: () => void }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 12px', fontSize: 13, cursor: 'pointer',
        color: danger ? '#ff3b30' : 'var(--item-text)',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.background = danger ? 'rgba(255,59,48,0.06)' : 'var(--item-hover-bg)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.background = 'transparent'
      }}
      onClick={onClick}
    >
      <MenuIcon icon={icon} danger={danger} />
      <span>{label}</span>
    </div>
  )
}

type ContextMenuItem =
  | { type: 'action'; label: string; icon: string; danger?: boolean; onClick: () => void }
  | { type: 'divider' }

interface IdentityContextMenuProps {
  x: number
  y: number
  identity: IdentityEntry
  onMerge: () => void
  onDelete: () => void
  onClose: () => void
}

function IdentityContextMenu({ x, y, identity, onMerge, onDelete, onClose }: IdentityContextMenuProps) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [onClose])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (rect.right > vw) ref.current.style.left = `${Math.max(4, vw - rect.width - 8)}px`
    if (rect.bottom > vh) ref.current.style.top = `${Math.max(4, vh - rect.height - 8)}px`
  }, [])

  async function copyContent() {
    try {
      const content = await getIdentityContent(identity.path)
      await navigator.clipboard.writeText(content)
    } catch { /* silent */ }
  }

  async function copyPath() {
    await navigator.clipboard.writeText(identity.path)
  }

  async function handleShowInFinder() {
    await revealInFinder(identity.path)
  }

  async function handleOpenWithEditor() {
    await openFile(identity.path)
  }

  const items: ContextMenuItem[] = []

  if (!isSoul(identity) && !isUserSelf(identity)) {
    items.push({ type: 'action', label: t('mergeTo'), icon: 'merge', onClick: () => { onMerge(); onClose() } })
  }

  items.push(
    { type: 'action', label: t('copyContent'), icon: 'content', onClick: () => { copyContent(); onClose() } },
    { type: 'action', label: t('copyFilePath'), icon: 'path', onClick: () => { copyPath(); onClose() } },
    { type: 'divider' },
    { type: 'action', label: t('openInEditor'), icon: 'edit', onClick: () => { handleOpenWithEditor(); onClose() } },
    { type: 'action', label: t('showInFinder'), icon: 'finder', onClick: () => { handleShowInFinder(); onClose() } },
  )

  if (!isSoul(identity) && !isUserSelf(identity)) {
    items.push(
      { type: 'divider' },
      { type: 'action', label: t('delete'), icon: 'delete', danger: true, onClick: () => { onDelete(); onClose() } },
    )
  }

  return (
    <div ref={ref} style={{
      position: 'fixed', top: y, left: x, zIndex: 9999,
      background: 'var(--context-menu-bg)',
      border: '1px solid var(--context-menu-border)',
      borderRadius: 8,
      boxShadow: '0 4px 20px var(--context-menu-shadow)',
      minWidth: 180, overflow: 'hidden',
      padding: '4px 0',
    }}>
      {items.map((item, i) => {
        if (item.type === 'divider') {
          return <div key={i} style={{ height: 1, background: 'var(--divider)', margin: '4px 0' }} />
        }
        return <MenuItemRow key={i} label={item.label} icon={item.icon} danger={item.danger} onClick={item.onClick} />
      })}
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
  const { t } = useTranslation()
  const [contextMenu, setContextMenu] = useState<{ identity: IdentityEntry; x: number; y: number } | null>(null)

  const handleContextMenu = useCallback((identity: IdentityEntry, e: React.MouseEvent) => {
    if (isSoul(identity)) return
    setContextMenu({ identity, x: e.clientX, y: e.clientY })
  }, [])

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
            <div style={{ padding: '14px 16px 6px' }}>
              <span style={{ fontSize: 12, color: 'var(--sidebar-month)', letterSpacing: '0.12em' }}>
                {t('builtin')}
              </span>
            </div>
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
              <span style={{ fontSize: 12, color: 'var(--sidebar-month)', letterSpacing: '0.12em' }}>
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
            color: 'var(--item-meta)', fontSize: 14, lineHeight: 1.6,
          }}>
            {t('noProfiles')}<br />
            <span style={{ fontSize: 13 }}>{t('recordingHint')}</span>
          </div>
        )}
      </div>

      {contextMenu && (
        <IdentityContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          identity={contextMenu.identity}
          onMerge={() => onMerge(contextMenu.identity)}
          onDelete={() => onDelete(contextMenu.identity)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
