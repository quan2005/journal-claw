import { useEffect, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { Mic, Pencil, Trash2, GitMerge, Check, X } from 'lucide-react'
import {
  getSpeakerProfiles,
  updateSpeakerName,
  deleteSpeakerProfile,
  mergeSpeakerProfiles,
} from '../../lib/tauri'
import type { SpeakerProfile } from '../../types'
import { useTranslation } from '../../contexts/I18nContext'

const sectionStyle: React.CSSProperties = {
  padding: '28px 28px 60px',
  borderBottom: '1px solid var(--divider)',
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--item-meta)',
  marginBottom: 5,
  display: 'block',
}

const hintStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--duration-text)',
  marginTop: 4,
  lineHeight: 1.5,
}

// Deterministic avatar color from profile id
const AVATAR_COLORS = [
  '#5e81f4',
  '#3eb489',
  '#e8a838',
  '#e05252',
  '#9b59b6',
  '#1abc9c',
  '#e67e22',
  '#e74c3c',
]

function avatarColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function displayName(profile: SpeakerProfile): string {
  return profile.name.trim() || profile.auto_name
}

function avatarInitial(profile: SpeakerProfile): string {
  const name = displayName(profile)
  return name.charAt(0).toUpperCase()
}

// ---------------------------------------------------------------------------
// Merge modal
// ---------------------------------------------------------------------------
interface MergeModalProps {
  source: SpeakerProfile
  profiles: SpeakerProfile[]
  onConfirm: (targetId: string) => void
  onCancel: () => void
}

function MergeModal({ source, profiles, onConfirm, onCancel }: MergeModalProps) {
  const { t } = useTranslation()
  const [targetId, setTargetId] = useState('')
  const candidates = profiles.filter((p) => p.id !== source.id)

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--divider)',
          borderRadius: 12,
          padding: '24px 28px',
          width: 320,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--item-text)' }}>
          {t('mergeVoice')}
        </div>
        <div style={{ fontSize: 13, color: 'var(--item-meta)', lineHeight: 1.5 }}>
          {t('mergeVoiceDesc', { name: displayName(source) })}
        </div>

        {candidates.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--duration-text)' }}>{t('noOtherSpeakers')}</div>
        ) : (
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            style={{
              background: 'var(--detail-case-bg)',
              border: '1px solid var(--divider)',
              borderRadius: 6,
              padding: '7px 10px',
              fontSize: 14,
              color: 'var(--item-text)',
              outline: 'none',
              width: '100%',
            }}
          >
            <option value="">{t('selectTargetSpeaker')}</option>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>
                {displayName(p)}
              </option>
            ))}
          </select>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid var(--divider)',
              background: 'transparent',
              color: 'var(--item-meta)',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {t('cancel')}
          </button>
          <button
            disabled={!targetId}
            onClick={() => targetId && onConfirm(targetId)}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              background: targetId ? 'var(--record-btn)' : 'var(--divider)',
              color: targetId ? '#fff' : 'var(--item-meta)',
              fontSize: 14,
              cursor: targetId ? 'pointer' : 'default',
              fontWeight: 500,
            }}
          >
            {t('merge')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Profile row
// ---------------------------------------------------------------------------
interface ProfileRowProps {
  profile: SpeakerProfile
  allProfiles: SpeakerProfile[]
  onUpdated: () => void
}

function ProfileRow({ profile, allProfiles, onUpdated }: ProfileRowProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [nameInput, setNameInput] = useState(profile.name)
  const [merging, setMerging] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commitName = async () => {
    setEditing(false)
    const trimmed = nameInput.trim()
    if (trimmed !== profile.name) {
      try {
        await updateSpeakerName(profile.id, trimmed)
        onUpdated()
      } catch (err) {
        console.error('[speakers] rename failed', err)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitName()
    if (e.key === 'Escape') {
      setNameInput(profile.name)
      setEditing(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    try {
      await deleteSpeakerProfile(profile.id)
      onUpdated()
    } catch (err) {
      console.error('[speakers] delete failed', err)
      setConfirmDelete(false)
    }
  }

  const handleMergeConfirm = async (targetId: string) => {
    setMerging(false)
    try {
      await mergeSpeakerProfiles(profile.id, targetId)
      onUpdated()
    } catch (err) {
      console.error('[speakers] merge failed', err)
    }
  }

  const color = avatarColor(profile.id)

  return (
    <>
      {merging && (
        <MergeModal
          source={profile}
          profiles={allProfiles}
          onConfirm={handleMergeConfirm}
          onCancel={() => setMerging(false)}
        />
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 12px',
          borderRadius: 8,
          background: 'var(--detail-case-bg)',
          border: '1px solid var(--divider)',
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--status-on-fill)',
            flexShrink: 0,
          }}
        >
          {avatarInitial(profile)}
        </div>

        {/* Name + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                ref={inputRef}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={commitName}
                onKeyDown={handleKeyDown}
                placeholder={profile.auto_name}
                style={{
                  flex: 1,
                  background: 'var(--bg)',
                  border: '1px solid var(--record-btn)',
                  borderRadius: 4,
                  padding: '3px 7px',
                  fontSize: 14,
                  color: 'var(--item-text)',
                  outline: 'none',
                }}
              />
              <button
                onMouseDown={(e) => {
                  e.preventDefault()
                  commitName()
                }}
                title={t('save')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--status-success)',
                  padding: 2,
                }}
              >
                <Check size={13} />
              </button>
              <button
                onMouseDown={(e) => {
                  e.preventDefault()
                  setNameInput(profile.name)
                  setEditing(false)
                }}
                title={t('cancel')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--item-meta)',
                  padding: 2,
                }}
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <div
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--item-text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {displayName(profile)}
              {!profile.name && (
                <span style={{ fontSize: 12, color: 'var(--duration-text)', marginLeft: 5 }}>
                  {t('unnamed')}
                </span>
              )}
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--duration-text)', marginTop: 2 }}>
            {t('appearsIn', { count: profile.recording_count })}
          </div>
        </div>

        {/* Actions */}
        {!editing && (
          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
            <button
              onClick={() => setEditing(true)}
              title={t('nameTooltip')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--item-meta)',
                padding: '4px 6px',
                borderRadius: 4,
              }}
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={() => setMerging(true)}
              title={t('mergeTooltip')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--item-meta)',
                padding: '4px 6px',
                borderRadius: 4,
              }}
            >
              <GitMerge size={13} />
            </button>
            <button
              onClick={handleDelete}
              onBlur={() => setConfirmDelete(false)}
              title={t('deleteTooltip')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: confirmDelete ? '#ff3b30' : 'var(--item-meta)',
                padding: '4px 6px',
                borderRadius: 4,
                fontSize: confirmDelete ? 10 : undefined,
                fontWeight: confirmDelete ? 600 : undefined,
              }}
            >
              {confirmDelete ? t('confirmDelete') : <Trash2 size={13} />}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Main section
// ---------------------------------------------------------------------------
export default function SectionSpeakers() {
  const { t } = useTranslation()
  const [profiles, setProfiles] = useState<SpeakerProfile[]>([])
  const [loading, setLoading] = useState(true)

  const reload = () => {
    getSpeakerProfiles()
      .then(setProfiles)
      .catch((err) => console.error('[speakers] load failed', err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()

    // Refresh whenever backend registers new speakers after a recording
    let unlisten: (() => void) | null = null
    listen('speakers-updated', () => {
      getSpeakerProfiles()
        .then(setProfiles)
        .catch((err) => console.error('[speakers] event reload failed', err))
    }).then((fn) => {
      unlisten = fn
    })
    return () => {
      unlisten?.()
    }
  }, [])

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--item-text)', marginBottom: 4 }}>
        {t('speakersSection')}
      </div>
      <div style={{ ...hintStyle, marginBottom: 20 }}>{t('speakersDesc')}</div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: 58,
                borderRadius: 8,
                background: 'var(--detail-case-bg)',
                border: '1px solid var(--divider)',
                opacity: 0.5,
              }}
            />
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            padding: '40px 20px',
            color: 'var(--duration-text)',
          }}
        >
          <Mic size={28} strokeWidth={1.2} />
          <div style={{ fontSize: 14 }}>{t('noSpeakers')}</div>
          <div style={{ fontSize: 12, lineHeight: 1.5, textAlign: 'center', maxWidth: 200 }}>
            {t('noSpeakersHint')}
          </div>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 8 }}>
            <span style={labelStyle}>{t('speakerCount', { count: profiles.length })}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {profiles.map((profile) => (
              <ProfileRow
                key={profile.id}
                profile={profile}
                allProfiles={profiles}
                onUpdated={reload}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
