/**
 * SectionLocalAgents — Settings → 本地 Agent 引擎.
 *
 * Lists every detected CLI coding agent as a card showing availability,
 * version, sign-in status, and (when unhealthy) a one-line reason + fix
 * buttons. The header carries a "重新扫描" affordance that bypasses the
 * daemon detection cache. Visual language follows 谨迹 design tokens
 * (--record-btn accent, structured radius/shadow tokens, --font-body);
 * it intentionally does not import open-design's design-system.
 */
import { useCallback, useEffect, useState } from 'react'
import type { AgentInfo } from '@journal/contracts'
import { listLocalAgents } from '../../lib/localAgents'
import { hostOpenWithSystem } from '../../lib/hostBridge'
import { useTranslation } from '../../contexts/I18nContext'
import { useToast } from '../../contexts/ToastContext'
import { AgentDiagnosticRow } from '../../components/AgentDiagnosticRow'
import SkeletonRow from './SkeletonRow'

const sectionStyle: React.CSSProperties = {
  padding: '28px 28px 40px',
  maxWidth: 760,
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: 16,
  marginBottom: 18,
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 600,
  color: 'var(--item-text)',
}

const subtitleStyle: React.CSSProperties = {
  margin: '8px 0 0',
  fontSize: 'var(--text-sm)',
  lineHeight: 1.55,
  color: 'var(--item-meta)',
  maxWidth: 560,
}

const rescanBtn = (busy: boolean): React.CSSProperties => ({
  minHeight: 32,
  padding: '0 14px',
  border: '1px solid var(--record-btn)',
  borderRadius: 'var(--radius-md)',
  background: busy ? 'var(--record-btn-hover)' : 'var(--record-btn)',
  color: '#ffffff',
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  cursor: busy ? 'progress' : 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
})

type StatusKind = 'available' | 'unavailable' | 'auth-warn'

function classifyAgent(agent: AgentInfo): StatusKind {
  if (!agent.available) return 'unavailable'
  if (agent.authStatus && agent.authStatus !== 'ok') return 'auth-warn'
  return 'available'
}

function StatusPill({ kind, label }: { kind: StatusKind; label: string }) {
  const palette: Record<StatusKind, { color: string; bg: string }> = {
    available: {
      color: 'var(--status-success)',
      bg: 'var(--status-success-bg)',
    },
    unavailable: {
      color: 'var(--status-danger)',
      bg: 'var(--status-danger-bg)',
    },
    'auth-warn': {
      color: 'var(--status-warning)',
      bg: 'var(--status-warning-bg)',
    },
  }
  const p = palette[kind]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 9px',
        borderRadius: 'var(--radius-pill)',
        background: p.bg,
        color: p.color,
        fontSize: 'var(--text-xs)',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'currentColor',
        }}
      />
      {label}
    </span>
  )
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        fontSize: 'var(--text-xs)',
        lineHeight: 1.5,
        color: 'var(--item-meta)',
      }}
    >
      <span style={{ flexShrink: 0 }}>{label}</span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          color: 'var(--item-text)',
          overflowWrap: 'anywhere',
          minWidth: 0,
        }}
      >
        {value}
      </span>
    </div>
  )
}

interface CardProps {
  agent: AgentInfo
  onRescan: () => void
  onSetEnvHint: (envKey: string) => void
  onClearEnvHint: (envKey: string) => void
}

function AgentCard({ agent, onRescan, onSetEnvHint, onClearEnvHint }: CardProps) {
  const { t } = useTranslation()
  const kind = classifyAgent(agent)
  const statusLabel = !agent.available
    ? t('agentUnavailable')
    : agent.authStatus === 'missing'
      ? t('agentAuthMissing')
      : agent.authStatus === 'unknown'
        ? t('agentAuthUnknown')
        : t('agentAvailable')

  const authLabel =
    agent.authStatus === 'ok'
      ? t('agentAuthOk')
      : agent.authStatus === 'missing'
        ? t('agentAuthMissing')
        : agent.authStatus === 'unknown'
          ? t('agentAuthUnknown')
          : t('agentAuthNotProbed')

  return (
    <div
      style={{
        padding: 16,
        border: '1px solid var(--detail-case-border)',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--detail-case-bg)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 'var(--text-md)',
            fontWeight: 600,
            color: 'var(--item-text)',
          }}
        >
          {agent.name}
        </span>
        <StatusPill kind={kind} label={statusLabel} />
      </div>

      <div style={{ display: 'grid', gap: 4, marginBottom: 4 }}>
        {agent.version ? <MetaLine label={t('agentVersionLabel')} value={agent.version} /> : null}
        {agent.path ? <MetaLine label={t('agentPathLabel')} value={agent.path} /> : null}
        {agent.authStatus ? <MetaLine label={t('agentAuthStatus')} value={authLabel} /> : null}
      </div>

      {agent.diagnostics && agent.diagnostics.length > 0 ? (
        <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
          {agent.diagnostics.map((diag, idx) => (
            <AgentDiagnosticRow
              key={`${diag.reason}-${idx}`}
              diagnostic={diag}
              agentName={agent.name}
              agentBin={agent.bin}
              handlers={{
                onRescan,
                onOpenInstall: agent.installUrl
                  ? () => {
                      void hostOpenWithSystem(agent.installUrl!)
                    }
                  : undefined,
                onOpenDocs: agent.docsUrl
                  ? () => {
                      void hostOpenWithSystem(agent.docsUrl!)
                    }
                  : undefined,
                onSetEnv: onSetEnvHint,
                onClearEnv: onClearEnvHint,
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function SectionLocalAgents() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [rescanning, setRescanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (rescan: boolean) => {
    if (rescan) setRescanning(true)
    else setLoading(true)
    setError(null)
    try {
      const result = await listLocalAgents(rescan)
      setAgents(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setAgents([])
    } finally {
      setLoading(false)
      setRescanning(false)
    }
  }, [])

  useEffect(() => {
    void load(false)
  }, [load])

  const handleRescan = useCallback(() => {
    void load(true)
  }, [load])

  const handleSetEnvHint = useCallback(
    (envKey: string) => {
      showToast('warning', t('agentSetEnvHint', { envKey }))
    },
    [showToast, t],
  )
  const handleClearEnvHint = useCallback(
    (envKey: string) => {
      showToast('warning', t('agentClearEnvHint', { envKey }))
    },
    [showToast, t],
  )

  return (
    <section style={sectionStyle}>
      <header style={headerStyle}>
        <div style={{ minWidth: 0 }}>
          <h2 style={titleStyle}>{t('localAgents')}</h2>
          <p style={subtitleStyle}>{t('localAgentsSubtitle')}</p>
        </div>
        <button
          type="button"
          onClick={handleRescan}
          disabled={rescanning}
          style={rescanBtn(rescanning)}
        >
          {rescanning ? t('rescanning') : t('rescan')}
        </button>
      </header>

      {error ? (
        <div
          role="alert"
          style={{
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--status-danger-bg)',
            color: 'var(--status-danger)',
            fontSize: 'var(--text-sm)',
            marginBottom: 12,
          }}
        >
          {t('localAgentsLoadFailed')}
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 10 }}>
        {loading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : agents.length === 0 && !error ? (
          <div
            style={{
              padding: 20,
              border: '1px dashed var(--detail-case-border)',
              borderRadius: 'var(--radius-lg)',
              color: 'var(--item-meta)',
              fontSize: 'var(--text-sm)',
              textAlign: 'center',
            }}
          >
            {t('localAgentsEmpty')}
          </div>
        ) : (
          agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onRescan={handleRescan}
              onSetEnvHint={handleSetEnvHint}
              onClearEnvHint={handleClearEnvHint}
            />
          ))
        )}
      </div>
    </section>
  )
}
