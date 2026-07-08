/**
 * UnifiedChatShell — the single right-side conversation surface.
 *
 * Owns the scrollable conversation stream and the composer via ChatPanel.
 * The external CLI engine adapter has been removed; only the built-in pi
 * engine remains, so this is now a pure chat surface (no engine switcher,
 * no CLI run fusion, no authorization selector).
 */
import type { ReactNode } from 'react'
import { ChatPanel, type ChatPanelProps } from './ChatPanel'

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
  return (
    <div style={shellStyle}>
      <header data-testid="unified-chat-header" style={topBarStyle}>
        {props.historyControl}
        <div style={{ flex: 1 }} />
      </header>
      <div style={contentStyle} data-testid="unified-chat-content">
        <ChatPanel
          sessionId={props.sessionId}
          messages={props.messages}
          isStreaming={props.isStreaming}
          usage={props.usage}
          stats={props.stats}
          pendingQueue={props.pendingQueue}
          initialInput={props.initialInput}
          onSend={props.onSend}
          onCancel={props.onCancel}
          onRetry={props.onRetry}
          onEditAndResend={props.onEditAndResend}
          onRemovePendingItem={props.onRemovePendingItem}
          onContinue={props.onContinue}
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
  // Establish the positioning context for absolutely-positioned descendants
  // of ChatPanel (notably HistoryFloatingButton, which uses position:absolute;
  // top:8; left:8; zIndex:20).
  position: 'relative',
}
