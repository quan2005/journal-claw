import { useState } from 'react'
import type { IdentityEntry, MergeMode } from '../types'
import { listIdentities, mergeIdentity, triggerAiPrompt } from '../lib/tauri'
import { useTranslation } from '../contexts/I18nContext'

interface MergeIdentityDialogProps {
  source: IdentityEntry
  onClose: () => void
  onMerged: () => void
}

export function MergeIdentityDialog({ source, onClose, onMerged }: MergeIdentityDialogProps) {
  const { t } = useTranslation()
  const [identities, setIdentities] = useState<IdentityEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [targetPath, setTargetPath] = useState<string>('')
  const [mode, setMode] = useState<MergeMode>(source.speaker_id ? 'voice_only' : 'full')
  const [merging, setMerging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load on first render
  useState(() => {
    listIdentities().then(all => {
      setIdentities(all.filter(i => i.path !== source.path))
      setLoaded(true)
    })
  })

  const handleMerge = async () => {
    if (!targetPath) return
    setMerging(true)
    setError(null)
    try {
      await mergeIdentity(source.path, targetPath, mode)
      if (mode === 'full') {
        // AI intelligently merges content, then deletes source
        const srcRel = source.path.split('/identity/').pop() || source.filename
        const tgtRel = targetPath.split('/identity/').pop() || targetPath
        await triggerAiPrompt(
          `将身份档案 identity/${srcRel} 的内容智能合并到 identity/${tgtRel} 中。\n` +
          `要求：\n` +
          `- 阅读两份档案，将来源档案中的有用信息整合进目标档案（去重、补充、更新）\n` +
          `- 合并 tags（去重）\n` +
          `- 更新 summary 使其反映合并后的完整信息\n` +
          `- 完成后删除来源文件 identity/${srcRel}\n` +
          `- 直接操作文件，不要输出解释`
        )
      }
      onMerged()
    } catch (e) {
      setError(String(e))
      setMerging(false)
    }
  }

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  const dialog: React.CSSProperties = {
    background: 'var(--bg)',
    border: '1px solid var(--divider)',
    borderRadius: 12,
    padding: '24px 28px',
    width: 360,
    display: 'flex', flexDirection: 'column', gap: 16,
  }

  const label: React.CSSProperties = {
    fontSize: 'var(--text-sm)', color: 'var(--item-meta)', marginBottom: 4,
  }

  const select: React.CSSProperties = {
    width: '100%', padding: '7px 10px',
    background: 'var(--detail-case-bg)',
    border: '1px solid var(--divider)',
    borderRadius: 6, color: 'var(--item-text)',
    fontSize: 'var(--text-md)', outline: 'none',
  }

  const modeBtn = (m: MergeMode, label: string, desc: string) => (
    <div
      key={m}
      onClick={() => setMode(m)}
      style={{
        padding: '8px 12px', borderRadius: 7, cursor: 'pointer',
        border: `1px solid ${mode === m ? 'var(--record-btn)' : 'var(--divider)'}`,
        background: mode === m ? 'rgba(255,59,48,0.06)' : 'transparent',
      }}
    >
      <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', color: 'var(--item-text)' }}>{label}</div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--item-meta)', marginTop: 2 }}>{desc}</div>
    </div>
  )

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={dialog}>
        <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--font-semibold)', color: 'var(--item-text)' }}>
          {t('mergeProfiles')}
        </div>

        <div>
          <div style={label}>{t('mergeFrom', { name: source.name })}</div>
          <select
            style={select}
            value={targetPath}
            onChange={e => setTargetPath(e.target.value)}
            disabled={!loaded}
          >
            <option value="">{t('selectTarget')}</option>
            {identities.map(i => (
              <option key={i.path} value={i.path}>
                {i.region}-{i.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={label}>{t('mergeMode')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {source.speaker_id && modeBtn('voice_only', t('voiceOnly'), t('voiceOnlyDesc'))}
            {modeBtn('full', t('fullMerge'), t('fullMergeDesc'))}
          </div>
        </div>

        {error && (
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--record-btn)' }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 16px', borderRadius: 6, border: '1px solid var(--divider)',
              background: 'transparent', color: 'var(--item-text)', fontSize: 'var(--text-base)', cursor: 'pointer',
            }}
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleMerge}
            disabled={!targetPath || merging}
            style={{
              padding: '7px 16px', borderRadius: 6, border: 'none',
              background: !targetPath || merging ? 'var(--divider)' : 'var(--record-btn)',
              color: !targetPath || merging ? 'var(--item-meta)' : '#fff',
              fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)',
              cursor: !targetPath || merging ? 'not-allowed' : 'pointer',
            }}
          >
            {merging ? t('mergingDots') : t('confirmMerge')}
          </button>
        </div>
      </div>
    </div>
  )
}
