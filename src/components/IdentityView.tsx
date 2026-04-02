import { useState } from 'react'
import { useIdentity } from '../hooks/useIdentity'
import { IdentityList, SOUL_PATH } from './IdentityList'
import { IdentityDetail } from './IdentityDetail'
import { MergeIdentityDialog } from './MergeIdentityDialog'
import { deleteIdentity } from '../lib/tauri'
import type { IdentityEntry } from '../types'

// Virtual Soul entry — not a real file
const SOUL_ENTRY: IdentityEntry = {
  filename: '__soul__',
  path: SOUL_PATH,
  name: '人格设定',
  region: '',
  summary: '定义谨迹的角色与工作偏好',
  tags: [],
  speaker_id: '',
  mtime_secs: 0,
}

interface IdentityViewProps {
  baseWidth: number
  dividerWidth: number
  onDividerMouseDown: (e: React.MouseEvent) => void
}

export default function IdentityView({ baseWidth, dividerWidth, onDividerMouseDown }: IdentityViewProps) {
  const { identities, loading, refresh } = useIdentity()
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [mergeSource, setMergeSource] = useState<IdentityEntry | null>(null)

  // Prepend virtual Soul entry
  const allIdentities: IdentityEntry[] = [SOUL_ENTRY, ...identities]

  const selectedIdentity = selectedPath === SOUL_PATH
    ? SOUL_ENTRY
    : identities.find(i => i.path === selectedPath) ?? null

  const handleDelete = async (identity: IdentityEntry) => {
    if (!window.confirm(`确认删除「${identity.name}」的档案？`)) return
    try {
      await deleteIdentity(identity.path)
      if (selectedPath === identity.path) setSelectedPath(null)
      refresh()
    } catch (e) {
      console.error('[IdentityView] delete failed', e)
    }
  }

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', animation: 'view-enter 0.2s ease-out' }}>
      {/* Left: Identity list */}
      <div style={{
        width: baseWidth, flexShrink: 0,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        borderRight: '0.5px solid var(--divider)',
      }}>
        <IdentityList
          identities={allIdentities}
          loading={loading}
          selectedPath={selectedPath}
          onSelect={identity => setSelectedPath(identity.path)}
          onMerge={identity => setMergeSource(identity)}
          onDelete={handleDelete}
        />
      </div>

      {/* Divider */}
      <div
        onMouseDown={onDividerMouseDown}
        style={{ width: dividerWidth, flexShrink: 0, background: 'transparent', cursor: 'col-resize' }}
      />

      {/* Right: Identity detail */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <IdentityDetail identity={selectedIdentity} />
      </div>

      {mergeSource && (
        <MergeIdentityDialog
          source={mergeSource}
          onClose={() => setMergeSource(null)}
          onMerged={() => {
            setMergeSource(null)
            if (selectedPath === mergeSource.path) setSelectedPath(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}
