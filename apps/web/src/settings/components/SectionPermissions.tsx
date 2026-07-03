import { useState, useCallback } from 'react'
import { checkAppPermissions, getPlatformCapabilities } from '../../lib/tauri'
import type { AppPermissions, PlatformCapabilities } from '../../lib/tauri'
import SkeletonRow from './SkeletonRow'
import { useTranslation } from '../../contexts/I18nContext'

const sectionStyle: React.CSSProperties = {
  padding: '28px 28px 40px',
  borderBottom: '1px solid var(--divider)',
}

// ---- Section ----

const DEFAULT_PLATFORM: PlatformCapabilities = {
  os: 'macos',
  apple_stt: false,
  whisperkit: false,
  speaker_diarization: false,
  native_permissions: true,
}

export default function SectionPermissions() {
  const { t } = useTranslation()
  const [perms, setPerms] = useState<AppPermissions | null>(null)
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCheck = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [, result] = await Promise.all([
        getPlatformCapabilities().catch(() => DEFAULT_PLATFORM),
        checkAppPermissions(),
      ])
      setPerms(result)
      setChecked(true)
    } catch (err) {
      console.error('[settings/permissions] check failed', err)
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const handleRequestAll = useCallback(async () => {
    if (!perms) {
      await handleCheck()
    }
  }, [perms, handleCheck])

  const allGranted = perms !== null

  return (
    <div style={sectionStyle}>
      <div
        style={{
          fontSize: 13,
          color: 'var(--month-label)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 20,
          fontWeight: 500,
        }}
      >
        {t('permissionsSection')}
      </div>

      <div style={{ fontSize: 14, color: 'var(--item-meta)', lineHeight: 1.7, marginBottom: 24 }}>
        {t('permissionsDesc')}
      </div>

      {/* Action bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        <button
          onClick={handleCheck}
          disabled={loading}
          style={{
            padding: '7px 16px',
            borderRadius: 7,
            border: '1px solid var(--divider)',
            background: 'transparent',
            color: loading ? 'var(--item-meta)' : 'var(--item-text)',
            fontSize: 14,
            fontWeight: 500,
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? t('checking') : checked ? t('rechecking') : t('checkPermissions')}
        </button>

        {checked && !allGranted && (
          <button
            onClick={handleRequestAll}
            style={{
              padding: '7px 16px',
              borderRadius: 7,
              border: 'none',
              background: 'var(--record-btn, #FF5701)',
              color: 'var(--status-on-fill)',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {t('grantAll')}
          </button>
        )}

        {checked && allGranted && (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 14,
              color: 'var(--item-text)',
              fontWeight: 500,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {t('allGranted')}
          </span>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div
          style={{
            padding: '8px 12px',
            marginBottom: 20,
            borderRadius: 6,
            fontSize: 13,
            color: 'var(--record-btn, #FF5701)',
            background: 'color-mix(in srgb, var(--record-btn, #FF5701) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--record-btn, #FF5701) 20%, transparent)',
          }}
        >
          {error}
        </div>
      )}

      {/* Permission rows */}
      {!checked && !loading && !error && (
        <div
          style={{
            padding: '32px 0',
            textAlign: 'center',
            color: 'var(--duration-text)',
            fontSize: 14,
          }}
        >
          {t('clickToCheck')}
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
          <SkeletonRow height={56} mb={0} />
          <SkeletonRow height={56} mb={0} />
          <SkeletonRow height={56} mb={0} />
        </div>
      )}

      {checked && perms && !loading && (
        <div style={{ animation: 'section-fadein 160ms ease-out both' }} />
      )}
    </div>
  )
}
