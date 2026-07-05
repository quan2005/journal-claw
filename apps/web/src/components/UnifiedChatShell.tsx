/**
 * UnifiedChatShell — the single right-side conversation surface (AC-6 深度融合).
 *
 * Replaces the former "swap ChatPanel ⇄ AgentRunPanel on engine change" model
 * (which UNMOUNTED the conversation area on every switch) with **render-layer
 * fusion**: one always-mounted ChatPanel owns the scrollable conversation
 * stream and the composer; a CLI run's artifacts (timeline, changeset, …) are
 * injected INTO that same stream as entries, so chat bubbles and run output
 * coexist and scroll continuously.
 *
 * How the continuity is achieved (without merging the data hooks):
 *   • ChatPanel is rendered UNCONDITIONALLY → its message list (useConversation
 *     messages) stays mounted across engine switches; chat bubbles never vanish.
 *   • useAgentRun lives HERE (lifted out of AgentRunPanel). When engine === cli
 *     its output is handed to <RunStreamEntries> and passed to ChatPanel as
 *     `streamExtras`, which renders it inside the SAME scroll container, right
 *     after the chat bubbles. The two data arrays are never merged — only their
 *     rendered output shares the stream.
 *   • The composer is shared too: engine === builtin → pure chat input; engine
 *     === cli → the same textarea serves as the goal (placeholder switches to
 *     the goal hint) and the authorization selector is injected inline as
 *     `composerExtras`, so there is no separate form block.
 *
 * Engine/agent selection persists via useAgentEngine (daemon settings), never
 * localStorage. AgentRunPanel is retained as the standalone full view (and for
 * its own test) but is no longer used as a swap target here.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { AgentInfo } from '@journal/contracts'
import { listLocalAgents } from '../lib/localAgents'
import { selectRuntimeClient } from '../lib/runtimeClient'
import { useAgentEngine } from '../hooks/useAgentEngine'
import { useAgentRun } from '../hooks/useAgentRun'
import { useTranslation } from '../contexts/I18nContext'
import type { AuthorizationMode } from '../types/agentRun'
import { EngineSwitcher } from './EngineSwitcher'
import { ChatPanel, type ChatPanelProps } from './ChatPanel'
import { RunStreamEntries } from './AgentRunPanel'
import { AuthModeToggle } from './AuthModeToggle'
import type { EngineConfig } from '../lib/apiTypes'

const getEngineConfig = () => selectRuntimeClient().invoke<EngineConfig>('get_engine_config')

/** The conversation slice App.tsx already assembles from useConversation. */
export type ConversationSlice = Pick<
  ChatPanelProps,
  | 'sessionId'
  | 'messages'
  | 'isStreaming'
  | 'usage'
  | 'stats'
  | 'pendingQueue'
  | 'initialInput'
  | 'onSend'
  | 'onCancel'
  | 'onRetry'
  | 'onEditAndResend'
  | 'onRemovePendingItem'
  | 'onContinue'
>

export type UnifiedChatShellProps = ConversationSlice & {
  historyControl?: ReactNode
}

export function UnifiedChatShell(props: UnifiedChatShellProps) {
  const { engine, agentId, loading, setEngine, setAgentId } = useAgentEngine()
  const { t } = useTranslation()
  // useAgentRun is lifted here so a CLI run's artifacts can be fused into the
  // chat stream (it previously lived inside AgentRunPanel). AgentRunPanel keeps
  // its own instance for standalone use; this one drives the inline stream.
  const agentRun = useAgentRun()
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [rescanning, setRescanning] = useState(false)
  const [authMode, setAuthMode] = useState<AuthorizationMode>('workspace_write')
  // AC-2: the active built-in pi model, resolved from the daemon engine
  // config (the provider/model the user configured in Settings). Shown on the
  // engine chip so the user always sees which model the built-in engine uses.
  const [builtinModel, setBuiltinModel] = useState<string | null>(null)

  // Load detected agents on mount. listLocalAgents hits the daemon directly;
  // in environments without a daemon (tests, offline) the rejection is caught
  // so the panel still renders with an empty agent list rather than crashing.
  const refreshAgents = useCallback((rescan = false) => {
    setRescanning(true)
    listLocalAgents(rescan)
      .then((next) => setAgents(next))
      .catch(() => {
        // Daemon offline / unreachable — keep the current list (likely empty).
      })
      .finally(() => setRescanning(false))
  }, [])

  useEffect(() => {
    refreshAgents(false)
  }, [refreshAgents])

  // Resolve the built-in pi engine's current model once on mount. Read via the
  // existing runtimeClient path (daemon /config/engine), never localStorage.
  // Best-effort: a daemon-offline rejection is swallowed so the chip falls
  // back to the localized "Default" placeholder rather than crashing.
  useEffect(() => {
    let cancelled = false
    getEngineConfig()
      .then((cfg) => {
        if (cancelled) return
        const active = cfg.providers?.find((p) => p.id === cfg.active_provider)
        if (active?.model) setBuiltinModel(active.model)
      })
      .catch(() => {
        // Daemon offline / unreachable — keep null so the chip shows "Default".
      })
    return () => {
      cancelled = true
    }
  }, [])

  // If the persisted agent id is no longer detected as available, drop back
  // to null so the switcher shows the "no agent" state instead of a ghost.
  useEffect(() => {
    if (engine !== 'cli' || !agentId) return
    if (agents.length === 0) return
    const stillKnown = agents.some((a) => a.id === agentId)
    if (!stillKnown) setAgentId(null)
  }, [engine, agentId, agents, setAgentId])

  const isCli = engine === 'cli'

  // Composer submit routing. The SAME textarea + send button serve both
  // engines: built-in pi → conversation send; external CLI → start a run with
  // the typed text as the goal. A run in flight blocks a second start.
  const handleSend: ChatPanelProps['onSend'] = (text, images) => {
    if (!isCli) {
      props.onSend(text, images)
      return
    }
    if (agentRun.isRunning) return
    void agentRun.start({
      goal: text,
      prompt: text,
      engine: 'cli',
      agentId: agentId ?? 'claude',
      authorizationMode: authMode,
    })
  }

  // CLI run artifacts fused into the conversation scroll surface (AC-6).
  // Only materialized when there is actual run output, so the built-in empty
  // state still shows while the CLI engine is idle (no ghost element).
  const hasRunOutput = !!agentRun.run || agentRun.isRunning
  const streamExtras: ReactNode =
    isCli && hasRunOutput ? (
      <RunStreamEntries
        run={agentRun.run}
        timeline={agentRun.timeline}
        changeSets={agentRun.changeSets}
        artifacts={agentRun.artifacts}
        memory={agentRun.memory}
        sources={agentRun.sources}
        assistantText={agentRun.assistantText}
        isRunning={agentRun.isRunning}
        agentId={agentId}
      />
    ) : undefined

  // Authorization selector (P2 polish · AC-2): a compact pill button that
  // opens a popover of the four authorization modes. Rendered only for the
  // external CLI engine — the built-in pi engine has no authorization
  // concept, so composerExtras stays undefined and the row is not mounted
  // (AC-3). The pill lives in the composer extras row BELOW the textarea
  // (not inside the bordered input box), pushed right by the row's spacer.
  const composerExtras: ReactNode = isCli ? (
    <AuthModeToggle mode={authMode} onChange={setAuthMode} />
  ) : undefined

  // CLI: the textarea doubles as the goal input → goal placeholder.
  const inputPlaceholder = isCli ? t('agentRunGoalPlaceholder') : undefined

  return (
    <div style={shellStyle}>
      <header data-testid="unified-chat-header" style={topBarStyle}>
        {props.historyControl}
        <div style={{ flex: 1 }} />
        <EngineSwitcher
          engine={engine}
          agentId={agentId}
          agents={agents}
          model={engine === 'builtin' ? builtinModel : null}
          loading={loading}
          rescanning={rescanning}
          onEngineChange={setEngine}
          onAgentChange={setAgentId}
          onRescan={() => refreshAgents(true)}
        />
      </header>
      <div style={contentStyle} data-testid="unified-chat-content">
        {/*
          ChatPanel is mounted UNCONDITIONALLY — switching engines no longer
          unmounts the conversation area, so chat bubbles persist (AC-6).
          streamExtras/composerExtras/inputPlaceholder adapt the same surface
          to the external CLI engine without a panel swap.

          position:relative on this container (set in contentStyle) is the
          P2 polish overlap fix (AC-1): HistoryFloatingButton uses
          position:absolute and previously anchored to a higher ancestor,
          overlapping the EngineSwitcher chip in the top bar. With the content
          container as its positioned ancestor, the floating button now anchors
          inside the conversation area (below the top bar).
        */}
        <ChatPanel
          sessionId={props.sessionId}
          messages={props.messages}
          isStreaming={props.isStreaming}
          usage={props.usage}
          stats={props.stats}
          pendingQueue={props.pendingQueue}
          initialInput={props.initialInput}
          onSend={handleSend}
          onCancel={props.onCancel}
          onRetry={props.onRetry}
          onEditAndResend={props.onEditAndResend}
          onRemovePendingItem={props.onRemovePendingItem}
          onContinue={props.onContinue}
          streamExtras={streamExtras}
          composerExtras={composerExtras}
          inputPlaceholder={inputPlaceholder}
        />
      </div>
    </div>
  )
}

// ── styles (token-driven) ────────────────────────────────────────────────
const shellStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
}
const topBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  borderBottom: '0.5px solid var(--divider)',
  flexShrink: 0,
  background: 'var(--sidebar-bg)',
}
const contentStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  // AC-1 (P2 polish): establish the positioning context for absolutely-
  // positioned descendants of ChatPanel (notably HistoryFloatingButton,
  // which uses position:absolute; top:8; left:8; zIndex:20). Without this,
  // the floating button anchored to a higher ancestor and overlapped the
  // EngineSwitcher chip in the top bar.
  position: 'relative',
}
