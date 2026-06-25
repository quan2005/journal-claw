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
import type { AuthorizationMode, ChangeSet } from '../types/agentRun'

const STATUS_META: Record<string, { label: string; color: string }> = {
  queued: { label: 'Queued', color: 'var(--status-warning)' },
  running: { label: 'Running', color: 'var(--record-btn, var(--accent))' },
  succeeded: { label: 'Done', color: 'var(--status-success, #16a34a)' },
  failed: { label: 'Failed', color: 'var(--status-danger)' },
  canceled: { label: 'Canceled', color: 'var(--text-tertiary, #999)' },
  waiting_for_confirmation: { label: 'Needs confirmation', color: 'var(--status-warning)' },
}

const MODE_LABEL: Record<AuthorizationMode, string> = {
  read_only: 'Read-only',
  workspace_write: 'Workspace write',
  full_access: 'Full access',
  wide_with_audit: 'Audit',
}

export function AgentRunPanel() {
  const { run, timeline, changeSets, assistantText, isRunning, error, start } = useAgentRun()
  const [goal, setGoal] = useState('')
  const [mode, setMode] = useState<AuthorizationMode>('workspace_write')

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!goal.trim() || isRunning) return
    void start({ goal: goal.trim(), prompt: goal.trim(), authorizationMode: mode })
    setGoal('')
  }

  const statusMeta = run ? STATUS_META[run.status] ?? STATUS_META.queued : null

  return (
    <div style={panelStyle}>
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={dotStyle(statusMeta?.color)} aria-hidden />
          <h2 style={titleStyle}>Agent Run</h2>
        </div>
        {run && (
          <span style={statusBadge(statusMeta?.color)}>{statusMeta?.label ?? run.status}</span>
        )}
      </header>

      {!run && !isRunning && (
        <form onSubmit={onSubmit} style={formStyle}>
          <label style={fieldLabel}>Goal</label>
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="What should the agent do?"
            style={inputStyle}
            autoFocus
          />
          <label style={{ ...fieldLabel, marginTop: 12 }}>Authorization</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as AuthorizationMode)}
            style={selectStyle}
          >
            {AUTHORIZATION_MODES.map((m) => (
              <option key={m} value={m}>
                {MODE_LABEL[m]}
              </option>
            ))}
          </select>
          <button type="submit" disabled={!goal.trim()} style={primaryButton(!!goal.trim())}>
            Start run
          </button>
        </form>
      )}

      {error && <div style={errorStyle}>{error}</div>}

      {run && (
        <>
          <section style={sectionStyle}>
            <div style={eyebrowStyle}>Goal</div>
            <div style={goalStyle}>{run.goal}</div>
            <div style={metaRowStyle}>
              <span style={chipStyle}>{MODE_LABEL[run.authorizationMode]}</span>
              <span style={chipStyle}>claude</span>
            </div>
          </section>

          {timeline.length > 0 && (
            <section style={sectionStyle}>
              <div style={eyebrowStyle}>Timeline</div>
              <ol style={timelineListStyle}>
                {timeline.map((entry) => (
                  <TimelineRow key={entry.id} entry={entry} />
                ))}
              </ol>
            </section>
          )}

          {assistantText && (
            <section style={sectionStyle}>
              <div style={eyebrowStyle}>Output</div>
              <div style={outputStyle}>{assistantText}</div>
            </section>
          )}

          {changeSets.length > 0 && (
            <section style={sectionStyle}>
              <div style={eyebrowStyle}>File changes ({changeSets.length})</div>
              <ul style={changeListStyle}>
                {changeSets.map((cs) => (
                  <ChangeSetRow key={cs.id} cs={cs} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
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
        <span style={toolIcon} aria-hidden>⚙</span>
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
        <span style={thinkIcon} aria-hidden>···</span>
        <span style={thinkingStyle}>{entry.text}</span>
      </li>
    )
  }
  return null
}

function ChangeSetRow({ cs }: { cs: ChangeSet }): ReactNode {
  const opColor =
    cs.operation === 'remove' ? 'var(--status-danger)' : cs.operation === 'create' ? 'var(--status-success, #16a34a)' : 'var(--accent)'
  return (
    <li style={changeItemStyle}>
      <span style={{ ...opTag, color: opColor }}>{cs.operation}</span>
      <code style={pathStyle}>{cs.path}</code>
      <span style={{ ...statusTag, opacity: cs.status === 'blocked' ? 1 : 0.6 }}>{cs.status}</span>
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
  background: 'color-mix(in srgb, ' + (color ?? 'var(--accent)') + ' 14%, transparent)',
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
  background: enabled ? 'var(--accent)' : 'var(--border, #e5e7eb)',
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
const metaRowStyle: React.CSSProperties = { display: 'flex', gap: 6, flexWrap: 'wrap' }
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
const toolIcon: React.CSSProperties = { color: 'var(--accent)', marginTop: 1, fontSize: 12, flexShrink: 0 }
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
const thinkIcon: React.CSSProperties = { color: 'var(--text-tertiary, #999)', flexShrink: 0, letterSpacing: -2 }
const thinkingStyle: React.CSSProperties = { color: 'var(--text-tertiary, #999)', fontStyle: 'italic' }
const outputStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.6,
  color: 'var(--text-primary, #111827)',
  whiteSpace: 'pre-wrap',
}
const changeListStyle: React.CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }
const changeItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 12,
  padding: '4px 0',
}
const opTag: React.CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', minWidth: 48 }
const pathStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono, monospace)',
  fontSize: 12,
  color: 'var(--text-secondary, #555)',
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}
const statusTag: React.CSSProperties = { fontSize: 10, textTransform: 'uppercase', color: 'var(--text-tertiary, #999)' }
