import { useState, useCallback } from 'react'
import { checkAppPermissions, openPrivacySettings } from '../../lib/tauri'
import type { AppPermissions, PermStatus } from '../../lib/tauri'
import SkeletonRow from './SkeletonRow'

const sectionStyle: React.CSSProperties = {
  padding: '28px 28px 40px',
  borderBottom: '1px solid var(--divider)',
}

// ---- Status badge ----

type BadgeVariant = 'ok' | 'warn' | 'error' | 'idle'

function statusBadge(s: PermStatus): { label: string; variant: BadgeVariant } {
  switch (s) {
    case 'granted':       return { label: '已授权',  variant: 'ok'   }
    case 'denied':        return { label: '已拒绝',  variant: 'error' }
    case 'restricted':    return { label: '受限制',  variant: 'warn' }
    case 'not_determined':return { label: '未授权',  variant: 'warn' }
    default:              return { label: '未知',    variant: 'idle' }
  }
}

function Badge({ variant, label }: { variant: BadgeVariant; label: string }) {
  const color: Record<BadgeVariant, string> = {
    ok:    'var(--ok-color, #34c759)',
    warn:  'var(--warn-color, #ff9f0a)',
    error: 'var(--record-btn, #ff3b30)',
    idle:  'var(--item-meta)',
  }
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 500,
      color: color[variant],
      background: `color-mix(in srgb, ${color[variant]} 12%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color[variant]} 30%, transparent)`,
      borderRadius: 4,
      padding: '2px 7px',
      letterSpacing: '0.02em',
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }}>
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
}

function PermRow({ icon, title, description, status, actionLabel, onAction, extra }: PermRowProps) {
  const badge = status ? statusBadge(status) : null
  const needsAction = status === 'denied' || status === 'not_determined' || status === 'restricted'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 14,
      padding: '14px 0',
      borderBottom: '1px solid var(--divider)',
    }}>
      {/* Icon */}
      <div style={{
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
      }}>
        {icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--item-text)' }}>{title}</span>
          {badge && <Badge variant={badge.variant} label={badge.label} />}
        </div>
        <div style={{ fontSize: 11, color: 'var(--item-meta)', marginTop: 3, lineHeight: 1.6 }}>
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
            fontSize: 11,
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

export default function SectionPermissions() {
  const [perms, setPerms] = useState<AppPermissions | null>(null)
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState(false)

  const handleCheck = useCallback(async () => {
    setLoading(true)
    try {
      const result = await checkAppPermissions()
      setPerms(result)
      setChecked(true)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleRequestAll = useCallback(async () => {
    if (!perms) {
      await handleCheck()
      return
    }
    // Open System Settings pane for each missing permission
    if (perms.microphone !== 'granted') {
      await openPrivacySettings('microphone')
    }
    if (perms.speech_recognition !== 'granted') {
      await openPrivacySettings('speech_recognition')
    }
  }, [perms, handleCheck])

  const allGranted =
    perms !== null &&
    perms.microphone === 'granted' &&
    perms.speech_recognition === 'granted' &&
    perms.claude_cli_path !== null

  return (
    <div style={sectionStyle}>
      <div style={{
        fontSize: 11,
        color: 'var(--month-label)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginBottom: 20,
        fontWeight: 500,
      }}>
        授权管理
      </div>

      <div style={{ fontSize: 12, color: 'var(--item-meta)', lineHeight: 1.7, marginBottom: 24 }}>
        谨迹需要以下系统权限才能正常工作。点击「检测权限」查看当前状态，或点击「一键授权」前往系统设置完成授权。
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
            fontSize: 12,
            fontWeight: 500,
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? '检测中…' : checked ? '重新检测' : '检测权限'}
        </button>

        {checked && !allGranted && (
          <button
            onClick={handleRequestAll}
            style={{
              padding: '7px 16px',
              borderRadius: 7,
              border: 'none',
              background: 'var(--record-btn, #ff3b30)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            一键授权
          </button>
        )}

        {checked && allGranted && (
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 12,
            color: 'var(--ok-color, #34c759)',
            fontWeight: 500,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            所有权限已就绪
          </span>
        )}
      </div>

      {/* Permission rows */}
      {!checked && !loading && (
        <div style={{
          padding: '32px 0',
          textAlign: 'center',
          color: 'var(--duration-text)',
          fontSize: 12,
        }}>
          点击「检测权限」查看各项授权状态
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            }
            title="麦克风"
            description="录音功能需要访问麦克风，用于语音转写和会议记录。"
            status={perms.microphone}
            actionLabel="前往系统设置"
            onAction={() => openPrivacySettings('microphone')}
          />

          {/* Speech Recognition */}
          <PermRow
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            }
            title="语音识别"
            description="使用 Apple 语音识别引擎时需要此权限（DashScope / WhisperKit 不需要）。"
            status={perms.speech_recognition}
            actionLabel="前往系统设置"
            onAction={() => openPrivacySettings('speech_recognition')}
          />

          {/* Claude CLI */}
          <PermRow
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 17 10 11 4 5"/>
                <line x1="12" y1="19" x2="20" y2="19"/>
              </svg>
            }
            title="Claude CLI"
            description="AI 日志处理需要系统中安装 Claude CLI 命令行工具。"
            status={perms.claude_cli_path ? 'granted' : 'not_determined'}
            extra={
              perms.claude_cli_path
                ? (
                  <span style={{
                    fontSize: 10,
                    color: 'var(--duration-text)',
                    fontFamily: 'ui-monospace, monospace',
                  }}>
                    {perms.claude_cli_path}
                  </span>
                )
                : (
                  <span style={{ fontSize: 10, color: 'var(--duration-text)' }}>
                    请先安装 Claude CLI：<code style={{ fontFamily: 'ui-monospace, monospace' }}>npm install -g @anthropic-ai/claude-code</code>
                  </span>
                )
            }
          />
        </div>
      )}
    </div>
  )
}
