/**
 * AgentDiagnosticRow — renders one agent diagnostic as "one-line reason + fix
 * button(s)".
 *
 * Mirrors open-design apps/web/src/components/AgentDiagnosticRow.tsx in shape
 * (typed fix intents → icon buttons, host wires handlers), but the reason
 * text is i18n-driven (journal is bilingual; open-design shipped English-only
 * daemon messages). Each `reason` maps to a locale key; the daemon's English
 * `message` is kept only as an unseen contract field for non-UI consumers.
 *
 * Fix intents render a button per kind:
 *   openInstall → opens the agent's installUrl
 *   openDocs    → opens the agent's docsUrl
 *   setEnv      → shows a toast explaining how to set the `*_BIN` env var
 *   clearEnv    → shows a toast explaining how to clear the override
 *   rescan      → triggers re-detection
 */
import type { AgentDiagnostic, AgentFixIntent } from '@journal/contracts'
import { useTranslation, type TFn } from '../contexts/I18nContext'

export interface AgentFixHandlers {
  onRescan?: () => void
  onOpenInstall?: () => void
  onOpenDocs?: () => void
  onSetEnv?: (envKey: string) => void
  onClearEnv?: (envKey: string) => void
}

interface Props {
  diagnostic: AgentDiagnostic
  /** Agent display name + bin, injected into the localized reason template. */
  agentName: string
  agentBin: string
  handlers?: AgentFixHandlers
}

function reasonMessageKey(reason: AgentDiagnostic['reason']): Parameters<TFn>[0] {
  switch (reason) {
    case 'not-on-path':
      return 'diagNotOnPath'
    case 'not-executable':
      return 'diagNotExecutable'
    case 'shim-broken':
      return 'diagShimBroken'
    case 'configured-bin-invalid':
      return 'diagConfiguredBinInvalid'
    case 'auth-missing':
      return 'diagAuthMissing'
    case 'auth-unknown':
      return 'diagAuthUnknown'
  }
}

/** Extract the envKey a setEnv/clearEnv intent carries, if any. */
function envKeyFromActions(actions: AgentFixIntent[] | undefined): string | null {
  if (!actions) return null
  const setEnv = actions.find((a): a is { kind: 'setEnv'; envKey: string } => a.kind === 'setEnv')
  if (setEnv) return setEnv.envKey
  const clearEnv = actions.find(
    (a): a is { kind: 'clearEnv'; envKey: string } => a.kind === 'clearEnv',
  )
  return clearEnv ? clearEnv.envKey : null
}

type ResolvedAction = {
  key: string
  label: string
  onClick: () => void
}

function useResolveAction(t: TFn) {
  return (
    intent: AgentFixIntent,
    handlers: AgentFixHandlers,
  ): ResolvedAction | null => {
    switch (intent.kind) {
      case 'openInstall':
        return handlers.onOpenInstall
          ? { key: 'openInstall', label: t('agentInstall'), onClick: handlers.onOpenInstall }
          : null
      case 'openDocs':
        return handlers.onOpenDocs
          ? { key: 'openDocs', label: t('agentDocs'), onClick: handlers.onOpenDocs }
          : null
      case 'rescan':
        return handlers.onRescan
          ? { key: 'rescan', label: t('rescan'), onClick: handlers.onRescan }
          : null
      case 'setEnv':
        return handlers.onSetEnv
          ? {
              key: `setEnv:${intent.envKey}`,
              label: t('agentSetEnv'),
              onClick: () => handlers.onSetEnv?.(intent.envKey),
            }
          : null
      case 'clearEnv':
        return handlers.onClearEnv
          ? {
              key: `clearEnv:${intent.envKey}`,
              label: t('agentClearEnv'),
              onClick: () => handlers.onClearEnv?.(intent.envKey),
            }
          : null
      default:
        return null
    }
  }
}

const severityColor: Record<AgentDiagnostic['severity'], string> = {
  error: 'var(--status-danger)',
  warning: 'var(--status-warning)',
  info: 'var(--item-meta)',
}

export function AgentDiagnosticRow({
  diagnostic,
  agentName,
  agentBin,
  handlers = {},
}: Props) {
  const { t } = useTranslation()
  const resolveAction = useResolveAction(t)
  const actions = (diagnostic.fixActions ?? [])
    .map((intent) => resolveAction(intent, handlers))
    .filter((action): action is ResolvedAction => action !== null)

  const envKey = envKeyFromActions(diagnostic.fixActions)
  const reasonKey = reasonMessageKey(diagnostic.reason)
  const message = t(reasonKey, {
    name: agentName,
    bin: agentBin,
    envKey: envKey ?? '',
  })

  const tooltip = [
    diagnostic.detail,
    ...(diagnostic.searchedDirs && diagnostic.searchedDirs.length > 0
      ? [`${t('localAgentsSearchedDirs')}:`, ...diagnostic.searchedDirs]
      : []),
  ]
    .filter((line): line is string => typeof line === 'string' && line.length > 0)
    .join('\n')

  return (
    <div
      role="group"
      data-reason={diagnostic.reason}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 'var(--radius-sm)',
        background:
          diagnostic.severity === 'error'
            ? 'var(--status-danger-bg)'
            : diagnostic.severity === 'warning'
              ? 'var(--status-warning-bg)'
              : 'color-mix(in srgb, var(--item-meta) 6%, transparent)',
      }}
    >
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 'var(--text-sm)',
          lineHeight: 1.45,
          color: 'var(--item-text)',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}
        title={tooltip || undefined}
      >
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: severityColor[diagnostic.severity],
            marginRight: 8,
            verticalAlign: 'middle',
            flexShrink: 0,
          }}
        />
        {message}
      </span>
      {actions.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flexShrink: 0 }}>
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={action.onClick}
              style={{
                minHeight: 26,
                padding: '0 10px',
                border: '1px solid var(--divider)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg)',
                color: 'var(--item-text)',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-xs)',
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
