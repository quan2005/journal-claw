import { useState, useCallback } from 'react'
import { checkAppPermissions, openPrivacySettings, requestPermission } from '../../lib/tauri'
import type { AppPermissions, PermStatus } from '../../lib/tauri'
import SkeletonRow from './SkeletonRow'
import { useTranslation, type TFn } from '../../contexts/I18nContext'

const sectionStyle: React.CSSProperties = {
  padding: '28px 28px 40px',
  borderBottom: '1px solid var(--divider)',
}

// ---- Status badge ----

type BadgeVariant = 'ok' | 'warn' | 'error' | 'idle'

function statusBadge(s: PermStatus, t: TFn): { label: string; variant: BadgeVariant } {
  switch (s) {
    case 'granted':
      return { label: t('statusGranted'), variant: 'ok' }
    case 'denied':
      return { label: t('statusDenied'), variant: 'error' }
    case 'restricted':
      return { label: t('statusRestricted'), variant: 'warn' }
    case 'not_determined':
      return { label: t('statusNotDetermined'), variant: 'warn' }
    default:
      return { label: t('statusUnknown'), variant: 'idle' }
  }
}

function Badge({ variant, label }: { variant: BadgeVariant; label: string }) {
  // Single accent color (var(--record-btn)) with opacity variations per CLAUDE.md design principles
  const color: Record<BadgeVariant, string> = {
    ok: 'var(--item-text)',
    warn: 'color-mix(in srgb, var(--record-btn, #ff3b30) 60%, var(--item-text))',
    error: 'var(--record-btn, #ff3b30)',
    idle: 'var(--item-meta)',
  }
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 500,
        color: color[variant],
        background:
          variant === 'ok'
            ? 'color-mix(in srgb, var(--item-text) 8%, transparent)'
            : variant === 'error'
              ? 'color-mix(in srgb, var(--record-btn, #ff3b30) 12%, transparent)'
              : variant === 'warn'
                ? 'color-mix(in srgb, var(--record-btn, #ff3b30) 8%, transparent)'
                : 'color-mix(in srgb, var(--item-meta) 8%, transparent)',
        border:
          variant === 'error'
            ? '1px solid color-mix(in srgb, var(--record-btn, #ff3b30) 30%, transparent)'
            : '1px solid transparent',
        borderRadius: 4,
        padding: '2px 7px',
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  )
}

// ---- Single permission row ----

interface PermRowProps {
  icon: React.ReactNode
  title: string
  description: string
  status?: PermStatus
  actionLabel?: string
  onAction?: () => void
  extra?: React.ReactNode
  t: TFn
}

function PermRow({
  icon,
  title,
  description,
  status,
  actionLabel,
  onAction,
  extra,
  t,
}: PermRowProps) {
  const badge = status ? statusBadge(status, t) : null
  const needsAction = status === 'denied' || status === 'not_determined' || status === 'restricted'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        padding: '14px 0',
        borderBottom: '1px solid var(--divider)',
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: 'var(--detail-case-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: 'var(--item-meta)',
          marginTop: 1,
        }}
      >
        {icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--item-text)' }}>{title}</span>
          {badge && <Badge variant={badge.variant} label={badge.label} />}
        </div>
        <div style={{ fontSize: 13, color: 'var(--item-meta)', marginTop: 3, lineHeight: 1.6 }}>
          {description}
        </div>
        {extra && <div style={{ marginTop: 6 }}>{extra}</div>}
      </div>

      {/* Action */}
      {actionLabel && onAction && needsAction && (
        <button
          onClick={onAction}
          style={{
            flexShrink: 0,
            marginTop: 2,
            padding: '5px 12px',
            borderRadius: 6,
            border: '1px solid var(--divider)',
            background: 'transparent',
            color: 'var(--item-text)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

// ---- Section ----

type SystemPerm = 'microphone' | 'speech_recognition'

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
      const result = await checkAppPermissions()
      setPerms(result)
      setChecked(true)
    } catch (err) {
      console.error('[settings/permissions] check failed', err)
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const handleOpenSettings = useCallback(async (pane: SystemPerm) => {
    try {
      await openPrivacySettings(pane)
    } catch (err) {
      console.error(`[settings/permissions] failed to open ${pane} settings`, err)
      setError(t('failedToOpen', { err: String(err) }))
    }
  }, [])

  // Trigger system authorization dialog for a single permission
  const handleRequest = useCallback(async (perm: SystemPerm) => {
    setError(null)
    try {
      const newStatus = await requestPermission(perm)
      setPerms((prev) => (prev ? { ...prev, [perm]: newStatus } : prev))
    } catch (err) {
      console.error(`[settings/permissions] request ${perm} failed`, err)
      setError(t('requestFailed', { err: String(err) }))
    }
  }, [])

  const handleRequestAll = useCallback(async () => {
    if (!perms) {
      await handleCheck()
      return
    }
    setError(null)
    try {
      // Step 1: Request not_determined permissions (triggers system dialog)
      if (perms.microphone === 'not_determined') {
        const micStatus = await requestPermission('microphone')
        setPerms((prev) => (prev ? { ...prev, microphone: micStatus } : prev))
      }
      if (perms.speech_recognition === 'not_determined') {
        const speechStatus = await requestPermission('speech_recognition')
        setPerms((prev) => (prev ? { ...prev, speech_recognition: speechStatus } : prev))
      }
      // Step 2: Open System Settings for denied/restricted permissions only
      setPerms((current) => {
        if (current) {
          if (current.microphone === 'denied' || current.microphone === 'restricted') {
            openPrivacySettings('microphone').catch(() => {})
          }
          if (
            current.speech_recognition === 'denied' ||
            current.speech_recognition === 'restricted'
          ) {
            openPrivacySettings('speech_recognition').catch(() => {})
          }
        }
        return current
      })
    } catch (err) {
      console.error('[settings/permissions] request all failed', err)
      setError(t('authError', { err: String(err) }))
    }
  }, [perms, handleCheck])

  const allGranted =
    perms !== null &&
    (perms.microphone === 'granted' || perms.microphone === 'unknown') &&
    (perms.speech_recognition === 'granted' || perms.speech_recognition === 'unknown') &&
    perms.claude_cli_path !== null

  // Determine action label per permission based on status
  const permAction = useCallback(
    (status: PermStatus, perm: SystemPerm) => {
      if (status === 'not_determined') {
        return { label: t('requestPermission'), action: () => handleRequest(perm) }
      }
      if (status === 'unknown') {
        return null // non-macOS: no actionable path
      }
      // denied / restricted → open System Settings
      return { label: t('openSystemSettings'), action: () => handleOpenSettings(perm) }
    },
    [handleRequest, handleOpenSettings],
  )

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
              background: 'var(--record-btn, #ff3b30)',
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
            color: 'var(--record-btn, #ff3b30)',
            background: 'color-mix(in srgb, var(--record-btn, #ff3b30) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--record-btn, #ff3b30) 20%, transparent)',
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
        <div style={{ animation: 'section-fadein 160ms ease-out both' }}>
          {/* Microphone */}
          <PermRow
            icon={
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            }
            title={t('permMic')}
            description={t('permMicDesc')}
            status={perms.microphone}
            actionLabel={permAction(perms.microphone, 'microphone')?.label}
            onAction={permAction(perms.microphone, 'microphone')?.action}
            t={t}
          />

          {/* Speech Recognition */}
          <PermRow
            icon={
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            }
            title={t('permSpeech')}
            description={t('permSpeechDesc')}
            status={perms.speech_recognition}
            actionLabel={permAction(perms.speech_recognition, 'speech_recognition')?.label}
            onAction={permAction(perms.speech_recognition, 'speech_recognition')?.action}
            t={t}
          />

          {/* Claude CLI */}
          <PermRow
            icon={
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="4 17 10 11 4 5" />
                <line x1="12" y1="19" x2="20" y2="19" />
              </svg>
            }
            title="Claude CLI"
            description={t('permClaudeDesc')}
            status={perms.claude_cli_path ? 'granted' : 'not_determined'}
            extra={
              perms.claude_cli_path ? (
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--duration-text)',
                    fontFamily: 'ui-monospace, monospace',
                  }}
                >
                  {perms.claude_cli_path}
                </span>
              ) : (
                <span style={{ fontSize: 10, color: 'var(--duration-text)' }}>
                  {t('installClaude')}
                  <code style={{ fontFamily: 'ui-monospace, monospace' }}>
                    npm install -g @anthropic-ai/claude-code
                  </code>
                </span>
              )
            }
            t={t}
          />
        </div>
      )}
    </div>
  )
}
