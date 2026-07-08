import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders as render } from './setup'
import type { ConversationMessage } from '../types'

// ChatPanel is rendered for real (NOT mocked). Mock only the daemon /
// host-bridge touches it pulls in so it renders cleanly under jsdom.
const panelMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  openFile: vi.fn(),
  openDialog: vi.fn(),
}))
vi.mock('../lib/runtimeClient', () => ({
  selectRuntimeClient: () => ({
    invoke: panelMocks.invoke,
    subscribe: () => () => {},
  }),
}))
vi.mock('../lib/hostBridge', () => ({
  hostOpenDialog: panelMocks.openDialog,
  hostOpenWithSystem: panelMocks.openFile,
}))

import { UnifiedChatShell } from '../components/UnifiedChatShell'

const CHAT_MESSAGES: ConversationMessage[] = [
  { role: 'user', content: '你好 pi，帮我看看这份草稿' },
]

const CONV_PROPS = {
  sessionId: 's1',
  isStreaming: false,
  usage: { input: 0, output: 0 },
  stats: null,
  pendingQueue: [],
  onSend: vi.fn(),
  onCancel: vi.fn(),
  onRetry: vi.fn(),
  onEditAndResend: vi.fn(),
  onRemovePendingItem: vi.fn(),
  onContinue: vi.fn(),
}

describe('UnifiedChatShell', () => {
  it('renders the conversation surface with chat messages', () => {
    render(<UnifiedChatShell {...CONV_PROPS} messages={CHAT_MESSAGES} />)
    expect(screen.getByText('你好 pi，帮我看看这份草稿')).toBeTruthy()
  })

  it('renders the header with optional history control', () => {
    render(
      <UnifiedChatShell
        {...CONV_PROPS}
        messages={[]}
        historyControl={<div data-testid="history-control" />}
      />,
    )
    const header = screen.getByTestId('unified-chat-header')
    expect(header).toBeTruthy()
    expect(header.querySelector('[data-testid="history-control"]')).toBeTruthy()
  })
})
