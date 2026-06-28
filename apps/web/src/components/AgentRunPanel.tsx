/**
 * AgentRunPanel — the right-side "Agent Run" surface (G12).
 *
 * Not a chat. A structured view of a Run: goal, status, the agent's plan/
 * steps/tool calls as a timeline, the file changes it made (ChangeSets), and
 * the assistant's output text. This is what makes the product feel like
 * "directing a local worker that operates your knowledge base" rather than
 * "chatting with AI".
 *
 * Visual: reuses the workspace design tokens (signal accent, radius, density),
 * no decorative cards-in-cards, monospace for paths/commands.
 */
import { useState, type ReactNode } from 'react'
import { useAgentRun, AUTHORIZATION_MODES, type TimelineEntry } from '../hooks/useAgentRun'
import type { AuthorizationMode, ChangeSet, RunEngine, AgentRun } from '../types/agentRun'
import type { Artifact, MemoryRecord, SourceBinding } from '../types/agentRun'
import { useTranslation, type TFn } from '../contexts/I18nContext'

// Run-status → signal color. Kept as a pure color map so the label can be
// resolved through i18n (statusLabel) without re-deriving colors per render.
// Signal accent is always --record-btn (never bare --accent, which is danger
// red) — see AGENTS.md §5 / FIX-4.
const STATUS_COLOR: Record<string, string> = {
  queued: 'var(--status-warning)',
  running: 'var(--record-btn)',
  succeeded: 'var(--status-success, #16a34a)',
  failed: 'var(--status-danger)',
  canceled: 'var(--text-tertiary, #999)',
  waiting_for_confirmation: 'var(--status-warning)',
}

/** Resolve a localized run-status label; unknown statuses fall back to the
 *  raw status string so a future contract value surfaces instead of being
 *  mislabeled. */
function statusLabel(status: string, t: TFn): string {
  switch (status) {
    case 'queued':
      return t('agentRunStatusQueued')
    case 'running':
      return t('agentRunStatusRunning')
    case 'succeeded':
      return t('agentRunStatusDone')
    case 'failed':
      return t('agentRunStatusFailed')
    case 'canceled':
      return t('agentRunStatusCanceled')
    case 'waiting_for_confirmation':
      return t('agentRunStatusNeedsConfirmation')
    default:
      return status
  }
}

export interface AgentRunPanelProps {
  /**
   * Backend engine + agent id chosen by the top-bar engine switcher. Defaults
   * to `cli` / `claude` so a standalone mount (e.g. the panel test) behaves
   * exactly as before. When wired from the UnifiedChatShell these carry the
   * user's persisted selection so POST /runs is created against the right agent.
   */
  engine?: RunEngine
  agentId?: string | null
}

/** Shared authorization-mode label resolver (used by both the standalone
 *  AgentRunPanel form and the inline RunStreamEntries). */
export function authorizationModeLabel(m: AuthorizationMode, t: TFn): string {
  switch (m) {
    case 'read_only':
      return t('agentRunModeReadOnly')
    case 'workspace_write':
      return t('agentRunModeWorkspaceWrite')
    case 'full_access':
      return t('agentRunModeFullAccess')
    case 'wide_with_audit':
      return t('agentRunModeWideAudited')
  }
}

export function AgentRunPanel({ engine = 'cli', agentId }: AgentRunPanelProps) {
  const { t } = useTranslation()
  const modeLabel = (m: AuthorizationMode): string => authorizationModeLabel(m, t)
  const {
    run,
    timeline,
    changeSets,
    artifacts,
    memory,
    sources,
    assistantText,
    isRunning,
    error,
    start,
  } = useAgentRun()
  const [goal, setGoal] = useState('')
  const [mode, setMode] = useState<AuthorizationMode>('workspace_write')

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!goal.trim() || isRunning) return
    void start({
      goal: goal.trim(),
      prompt: goal.trim(),
      engine,
      agentId: agentId ?? 'claude',
      authorizationMode: mode,
    })
    setGoal('')
  }

  // Resolve the status signal color directly; an unrecognized status leaves
  // statusColor undefined so the header badge dot falls back to the neutral
  // default instead of mislabeling it as "Queued".
  const statusColor = run ? STATUS_COLOR[run.status] : undefined

  return (
    <div style={panelStyle}>
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={dotStyle(statusColor)} aria-hidden />
          <h2 style={titleStyle}>{t('agentRunTitle')}</h2>
        </div>
      </header>

      {!run && !isRunning && (
        <form onSubmit={onSubmit} style={formStyle}>
          <label style={fieldLabel}>{t('agentRunGoalLabel')}</label>
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder={t('agentRunGoalPlaceholder')}
            style={inputStyle}
            autoFocus
          />
          <label style={{ ...fieldLabel, marginTop: 12 }}>{t('agentRunAuthLabel')}</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as AuthorizationMode)}
            style={selectStyle}
          >
            {AUTHORIZATION_MODES.map((m) => (
              <option key={m} value={m}>
                {modeLabel(m)}
              </option>
            ))}
          </select>
          <button type="submit" disabled={!goal.trim()} style={primaryButton(!!goal.trim())}>
            {t('agentRunStart')}
          </button>
        </form>
      )}

      {error && <div style={errorStyle}>{error}</div>}

      <RunStreamEntries
        run={run}
        timeline={timeline}
        changeSets={changeSets}
        artifacts={artifacts}
        memory={memory}
        sources={sources}
        assistantText={assistantText}
        isRunning={isRunning}
        agentId={agentId}
      />
    </div>
  )
}

function TimelineRow({ entry }: { entry: TimelineEntry }): ReactNode {
  if (entry.kind === 'status') {
    return (
      <li style={timelineItemStyle}>
        <span style={statusDot} aria-hidden />
        <span style={statusTextStyle}>{entry.label}</span>
      </li>
    )
  }
  if (entry.kind === 'tool_call') {
    return (
      <li style={timelineItemStyle}>
        <span style={toolIcon} aria-hidden>
          ⚙
        </span>
        <div>
          <div style={toolNameStyle}>{entry.toolName}</div>
          {entry.text && <div style={toolInputStyle}>{entry.text}</div>}
        </div>
      </li>
    )
  }
  if (entry.kind === 'thinking') {
    return (
      <li style={timelineItemStyle}>
        <span style={thinkIcon} aria-hidden>
          ···
        </span>
        <span style={thinkingStyle}>{entry.text}</span>
      </li>
    )
  }
  return null
}

/** Resolve a localized changeset-operation label; unknown ops fall back to
 *  the raw operation string so a future contract value surfaces instead of
 *  being mislabeled. */
function changeOperationLabel(op: string, t: TFn): string {
  switch (op) {
    case 'create':
      return t('agentRunChangeOpCreate')
    case 'edit':
      return t('agentRunChangeOpEdit')
    case 'move':
      return t('agentRunChangeOpMove')
    case 'remove':
      return t('agentRunChangeOpRemove')
    default:
      return op
  }
}

/** Resolve a localized changeset-status label; unknown statuses fall back to
 *  the raw status string. */
function changeStatusLabel(status: string, t: TFn): string {
  switch (status) {
    case 'applied':
      return t('agentRunChangeStatusApplied')
    case 'blocked':
      return t('agentRunChangeStatusBlocked')
    case 'failed':
      return t('agentRunChangeStatusFailed')
    case 'reverted':
      return t('agentRunChangeStatusReverted')
    case 'recorded':
      return t('agentRunChangeStatusRecorded')
    default:
      return status
  }
}

function ChangeSetRow({ cs }: { cs: ChangeSet }): ReactNode {
  const { t } = useTranslation()
  const opColor =
    cs.operation === 'remove'
      ? 'var(--status-danger)'
      : cs.operation === 'create'
        ? 'var(--status-success, #16a34a)'
        : 'var(--record-btn)'
  // Blocked/failed changesets are surfaced at full opacity with a danger tint
  // so the user can see what the agent was stopped from doing. Applied/reverted/
  // recorded stay muted as ordinary history.
  const statusColor =
    cs.status === 'blocked' || cs.status === 'failed'
      ? 'var(--status-danger)'
      : cs.status === 'reverted'
        ? 'var(--text-tertiary, #999)'
        : 'var(--text-tertiary, #999)'
  return (
    <li style={changeItemStyle}>
      <span style={{ ...opTag, color: opColor }}>{changeOperationLabel(cs.operation, t)}</span>
      <code style={pathStyle}>{cs.path}</code>
      <span
        style={{
          ...statusTag,
          color: statusColor,
          opacity: cs.status === 'blocked' || cs.status === 'failed' ? 1 : 0.7,
        }}
      >
        {changeStatusLabel(cs.status, t)}
      </span>
    </li>
  )
}

// ── styles (token-driven, no hard-coded palette numbers) ───────────────────
const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'auto',
  padding: '16px 18px',
  gap: 16,
  background: 'var(--surface, #fff)',
}
const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}
const titleStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontSize: 18,
  fontWeight: 600,
  color: 'var(--text-primary, #111827)',
}
const dotStyle = (color?: string): React.CSSProperties => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: color ?? 'var(--text-tertiary, #999)',
  display: 'inline-block',
})
const statusBadge = (color?: string): React.CSSProperties => ({
  fontSize: 12,
  color: color ?? 'var(--text-secondary)',
  padding: '2px 8px',
  borderRadius: 'var(--radius-pill, 999px)',
  background: 'color-mix(in srgb, ' + (color ?? 'var(--record-btn)') + ' 14%, transparent)',
})
const formStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column' }
const fieldLabel: React.CSSProperties = {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--text-tertiary, #999)',
  marginBottom: 6,
}
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--border, #e5e7eb)',
  borderRadius: 'var(--radius-md, 6px)',
  fontSize: 14,
  background: 'var(--surface-raised, #fff)',
  color: 'var(--text-primary, #111827)',
}
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }
const primaryButton = (enabled: boolean): React.CSSProperties => ({
  marginTop: 16,
  padding: '8px 14px',
  border: 'none',
  borderRadius: 'var(--radius-md, 6px)',
  background: enabled ? 'var(--record-btn)' : 'var(--border, #e5e7eb)',
  color: enabled ? '#fff' : 'var(--text-tertiary, #999)',
  fontWeight: 600,
  fontSize: 14,
  cursor: enabled ? 'pointer' : 'not-allowed',
})
const errorStyle: React.CSSProperties = {
  color: 'var(--status-danger)',
  fontSize: 13,
  padding: '8px 10px',
  background: 'color-mix(in srgb, var(--status-danger) 8%, transparent)',
  borderRadius: 'var(--radius-md, 6px)',
}
const sectionStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 }
const eyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--text-tertiary, #999)',
}
const goalStyle: React.CSSProperties = {
  fontSize: 15,
  color: 'var(--text-primary, #111827)',
  lineHeight: 1.5,
}
const chipStyle: React.CSSProperties = {
  fontSize: 11,
  padding: '2px 8px',
  borderRadius: 'var(--radius-pill, 999px)',
  background: 'var(--surface-raised, #f6f6f1)',
  color: 'var(--text-secondary, #555)',
}
const timelineListStyle: React.CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}
const timelineItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  fontSize: 13,
}
const statusDot: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: 'var(--text-tertiary, #999)',
  marginTop: 6,
  flexShrink: 0,
}
const statusTextStyle: React.CSSProperties = { color: 'var(--text-secondary, #555)', paddingTop: 2 }
const toolIcon: React.CSSProperties = {
  color: 'var(--record-btn)',
  marginTop: 1,
  fontSize: 12,
  flexShrink: 0,
}
const toolNameStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono, monospace)',
  fontSize: 12,
  color: 'var(--text-primary, #111827)',
  fontWeight: 600,
}
const toolInputStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono, monospace)',
  fontSize: 11,
  color: 'var(--text-tertiary, #999)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
}
const thinkIcon: React.CSSProperties = {
  color: 'var(--text-tertiary, #999)',
  flexShrink: 0,
  letterSpacing: -2,
}
const thinkingStyle: React.CSSProperties = {
  color: 'var(--text-tertiary, #999)',
  fontStyle: 'italic',
}
const outputStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.6,
  color: 'var(--text-primary, #111827)',
  whiteSpace: 'pre-wrap',
}
const changeListStyle: React.CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}
const changeItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 12,
  padding: '4px 0',
}
const opTag: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  minWidth: 48,
}
const pathStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono, monospace)',
  fontSize: 12,
  color: 'var(--text-secondary, #555)',
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}
const statusTag: React.CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  color: 'var(--text-tertiary, #999)',
}

/** Resolve a localized source-binding kind label; unknown kinds fall back to
 *  the raw kind string. */
function sourceKindLabel(kind: string, t: TFn): string {
  switch (kind) {
    case 'read':
      return t('agentRunSourceKindRead')
    case 'reference':
      return t('agentRunSourceKindReference')
    case 'search':
      return t('agentRunSourceKindSearch')
    case 'cite':
      return t('agentRunSourceKindCite')
    default:
      return kind
  }
}

function SourceRow({ source }: { source: SourceBinding }): ReactNode {
  const { t } = useTranslation()
  const kindColor =
    source.kind === 'cite'
      ? 'var(--record-btn)'
      : source.kind === 'read'
        ? 'var(--status-success, #16a34a)'
        : 'var(--text-tertiary, #999)'
  return (
    <li style={changeItemStyle}>
      <span style={{ ...opTag, color: kindColor }}>{sourceKindLabel(source.kind, t)}</span>
      <code style={pathStyle}>{source.path}</code>
    </li>
  )
}

/** Resolve a localized artifact-type label; unknown types fall back to the
 *  raw type string. */
function artifactTypeLabel(type: string, t: TFn): string {
  switch (type) {
    case 'article':
      return t('agentRunArtifactTypeArticle')
    case 'outline':
      return t('agentRunArtifactTypeOutline')
    case 'report':
      return t('agentRunArtifactTypeReport')
    case 'summary':
      return t('agentRunArtifactTypeSummary')
    case 'plan':
      return t('agentRunArtifactTypePlan')
    case 'todo':
      return t('agentRunArtifactTypeTodo')
    case 'index':
      return t('agentRunArtifactTypeIndex')
    case 'card':
      return t('agentRunArtifactTypeCard')
    case 'note':
      return t('agentRunArtifactTypeNote')
    default:
      return type
  }
}

function ArtifactRow({ artifact }: { artifact: Artifact }): ReactNode {
  const { t } = useTranslation()
  return (
    <li style={{ ...changeItemStyle, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
        <span style={{ ...opTag, color: 'var(--record-btn)' }}>{artifactTypeLabel(artifact.type, t)}</span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary, #111827)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {artifact.title}
        </span>
      </div>
      {artifact.content && (
        <code style={{ ...pathStyle, whiteSpace: 'pre-wrap', maxHeight: 60, overflow: 'hidden' }}>
          {artifact.content.slice(0, 200)}
        </code>
      )}
    </li>
  )
}

/** Resolve a localized memory-kind label; unknown kinds fall back to the raw
 *  kind string. */
function memoryKindLabel(kind: string, t: TFn): string {
  switch (kind) {
    case 'preference':
      return t('agentRunMemoryPref')
    case 'project_fact':
      return t('agentRunMemoryFact')
    case 'writing_rule':
      return t('agentRunMemoryRule')
    case 'tool_rule':
      return t('agentRunMemoryTool')
    case 'note':
      return t('agentRunMemoryNote')
    default:
      return kind
  }
}

function MemoryRow({ record }: { record: MemoryRecord }): ReactNode {
  const { t } = useTranslation()
  return (
    <li style={{ ...changeItemStyle, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
        <span style={{ ...opTag, color: 'var(--record-btn)' }}>
          {memoryKindLabel(record.kind, t)}
        </span>
        <span
          style={{
            fontSize: 12,
            color: 'var(--text-secondary, #555)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {record.summary}
        </span>
      </div>
      {record.evidence.length > 0 && (
        <code
          style={{
            ...pathStyle,
            whiteSpace: 'pre-wrap',
            maxHeight: 40,
            overflow: 'hidden',
            fontStyle: 'italic',
          }}
        >
          {record.evidence[0].slice(0, 160)}
        </code>
      )}
    </li>
  )
}

// ── RunStreamEntries ────────────────────────────────────────────────────────
// Presentational: renders a Run's artifacts (status badge, goal, timeline,
// output, changesets, sources, artifacts, memory) as a self-contained block.
// Used in two places:
//   1. AgentRunPanel — the standalone full panel delegates its run body here.
//   2. UnifiedChatShell — injected into ChatPanel's scroll area (streamExtras)
//      so a CLI run's changeset/timeline appear inline in the SAME conversation
//      stream as the built-in pi chat bubbles (AC-6 render-layer fusion).
// It owns no data hook — callers pass the useAgentRun result in.
export interface RunStreamEntriesProps {
  run: AgentRun | null
  timeline: TimelineEntry[]
  changeSets: ChangeSet[]
  artifacts: Artifact[]
  memory: MemoryRecord[]
  sources: SourceBinding[]
  assistantText: string
  isRunning: boolean
  agentId?: string | null
}

export function RunStreamEntries({
  run,
  timeline,
  changeSets,
  artifacts,
  memory,
  sources,
  assistantText,
  isRunning,
  agentId,
}: RunStreamEntriesProps): ReactNode {
  const { t } = useTranslation()
  // Idle state (before any run / not running) renders nothing — the host
  // surface's own empty state shows through.
  if (!run && !isRunning) return null

  const statusColor = run ? STATUS_COLOR[run.status] : STATUS_COLOR.running
  const statusLabelText = run ? statusLabel(run.status, t) : t('agentRunStatusRunning')
  const modeLabel = (m: AuthorizationMode): string => authorizationModeLabel(m, t)

  return (
    <div style={runBlockStyle}>
      <div style={runHeaderRowStyle}>
        <span style={statusBadge(statusColor)}>{statusLabelText}</span>
        {run && (
          <span style={chipStyle}>{modeLabel(run.authorizationMode)}</span>
        )}
        {run && (
          <span style={chipStyle}>{run.agentId ?? agentId ?? 'claude'}</span>
        )}
      </div>

      {run && <div style={goalStyle}>{run.goal}</div>}

      {timeline.length > 0 && (
        <section style={sectionStyle}>
          <div style={eyebrowStyle}>{t('agentRunSectionTimeline')}</div>
          <ol style={timelineListStyle}>
            {timeline.map((entry) => (
              <TimelineRow key={entry.id} entry={entry} />
            ))}
          </ol>
        </section>
      )}

      {assistantText && (
        <section style={sectionStyle}>
          <div style={eyebrowStyle}>{t('agentRunSectionOutput')}</div>
          <div style={outputStyle}>{assistantText}</div>
        </section>
      )}

      {changeSets.length > 0 && (
        <section style={sectionStyle}>
          <div style={eyebrowStyle}>{t('agentRunSectionFileChanges', { count: changeSets.length })}</div>
          <ul style={changeListStyle}>
            {changeSets.map((cs) => (
              <ChangeSetRow key={cs.id} cs={cs} />
            ))}
          </ul>
        </section>
      )}

      {sources.length > 0 && (
        <section style={sectionStyle}>
          <div style={eyebrowStyle}>{t('agentRunSectionSourcesRead', { count: sources.length })}</div>
          <ul style={changeListStyle}>
            {sources.map((s) => (
              <SourceRow key={s.id} source={s} />
            ))}
          </ul>
        </section>
      )}

      {artifacts.length > 0 && (
        <section style={sectionStyle}>
          <div style={eyebrowStyle}>{t('agentRunSectionArtifacts', { count: artifacts.length })}</div>
          <ul style={changeListStyle}>
            {artifacts.map((a) => (
              <ArtifactRow key={a.id} artifact={a} />
            ))}
          </ul>
        </section>
      )}

      {memory.length > 0 && (
        <section style={sectionStyle}>
          <div style={eyebrowStyle}>{t('agentRunSectionMemory', { count: memory.length })}</div>
          <ul style={changeListStyle}>
            {memory.map((m) => (
              <MemoryRow key={m.id} record={m} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

const runBlockStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 8,
  width: '100%',
  paddingTop: 4,
}
const runHeaderRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexWrap: 'wrap',
}
