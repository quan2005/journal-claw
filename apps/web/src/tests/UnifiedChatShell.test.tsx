import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor, act } from '@testing-library/react'
import { renderWithProviders as render } from './setup'
import type { ConversationMessage } from '../types'

// ── Mocks ────────────────────────────────────────────────────────────────
// useAgentEngine is controllable so each test can pin the active engine
// without going through the daemon. The module-level vars are read on every
// render, so switching them + `rerender` simulates an engine switch on the
// SAME mounted instance (this is what proves AC-6 continuity).
let mockEngine: 'builtin' | 'cli' = 'builtin'
let mockAgentId: string | null = null
const setEngine = vi.fn()
const setAgentId = vi.fn()
vi.mock('../hooks/useAgentEngine', () => ({
  useAgentEngine: () => ({
    engine: mockEngine,
    agentId: mockAgentId,
    loading: false,
    setEngine,
    setAgentId,
  }),
}))

vi.mock('../lib/localAgents', () => ({
  listLocalAgents: vi.fn().mockResolvedValue([
    { id: 'claude', name: 'Claude Code', bin: 'claude', available: true, version: '1.0' },
    { id: 'codex', name: 'Codex', bin: 'codex', available: false },
  ]),
}))

// ChatPanel is rendered for real (NOT mocked) so continuity can be asserted.
// Mock only the daemon / host-bridge touches it pulls in (same as
// ChatPanel.test.tsx) so it renders cleanly under jsdom.
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

// AgentRun daemon client — mirrors AgentRunPanel.test.tsx's mock shape.
const mockCreateRun = vi.fn()
const mockSubscribe = vi.fn()
const mockListChangeSets = vi.fn()
const mockListArtifacts = vi.fn()
const mockListMemory = vi.fn()
const mockListSources = vi.fn()
vi.mock('../lib/agentRuns', () => ({
  createRun: (...args: unknown[]) => mockCreateRun(...(args as [never])),
  subscribeRunEvents: (...args: unknown[]) => mockSubscribe(...(args as [never])),
  listChangeSets: (...args: unknown[]) => mockListChangeSets(...(args as [never])),
  listArtifacts: (...args: unknown[]) => mockListArtifacts(...(args as [never])),
  listMemory: (...args: unknown[]) => mockListMemory(...(args as [never])),
  listSources: (...args: unknown[]) => mockListSources(...(args as [never])),
}))

import { UnifiedChatShell } from '../components/UnifiedChatShell'

// A real built-in pi conversation history. The user bubble renders
// synchronously (no lazy markdown) so it can be asserted directly.
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
  let emit: ((ev: unknown) => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    mockEngine = 'builtin'
    mockAgentId = null
    emit = null
    panelMocks.invoke.mockImplementation(async (cmd: string) => {
      // UnifiedChatShell resolves the built-in pi model from daemon engine
      // config to show it on the chip (AC-2). Provide a mock so the effect
      // resolves.
      if (cmd === 'get_engine_config') {
        return {
          active_provider: 'dashscope',
          providers: [{ id: 'dashscope', model: 'qwen-max' }],
        }
      }
      return undefined
    })
    mockCreateRun.mockResolvedValue({
      id: 'r1',
      sessionId: 's1',
      goal: '',
      mode: 'agent',
      status: 'queued',
      authorizationMode: 'workspace_write',
      contextBindings: [],
      steps: [],
      createdAt: '2026-06-28T00:00:00Z',
      updatedAt: '2026-06-28T00:00:00Z',
    })
    mockSubscribe.mockImplementation((_id: string, onEvent: (e: unknown) => void) => {
      emit = onEvent
      return () => {}
    })
    mockListChangeSets.mockResolvedValue([])
    mockListArtifacts.mockResolvedValue([])
    mockListMemory.mockResolvedValue([])
    mockListSources.mockResolvedValue([])
  })

  describe('routing (AC-1, AC-3) — same surface, adaptive composer', () => {
    it('mounts the conversation surface for the built-in engine and hides the CLI goal/auth controls', () => {
      mockEngine = 'builtin'
      render(<UnifiedChatShell {...CONV_PROPS} messages={CHAT_MESSAGES} />)
      // ChatPanel is mounted: the built-in chat bubble is visible.
      expect(screen.getByText('你好 pi，帮我看看这份草稿')).toBeTruthy()
      // The CLI goal placeholder is NOT shown (composer is pure chat input).
      expect(screen.queryByPlaceholderText('想让 Agent 做什么？')).toBeNull()
      // No authorization selector for the built-in engine (pi has no auth).
      expect(screen.queryByText('工作区可写')).toBeNull()
    })

    it('adapts the shared composer to the external engine (goal input + auth pill)', () => {
      mockEngine = 'cli'
      mockAgentId = 'claude'
      render(<UnifiedChatShell {...CONV_PROPS} messages={CHAT_MESSAGES} />)
      // The same textarea now serves as the CLI goal input.
      expect(screen.getByPlaceholderText('想让 Agent 做什么？')).toBeTruthy()
      // AC-2 (P2 polish): the authorization control is now a compact pill
      // (not a full-width native <select>). The pill shows the current mode
      // label on its trigger; the other modes are inside its popover (opened
      // on click — exercised in AuthModeToggle.test.tsx).
      expect(screen.getByTestId('auth-mode-toggle')).toBeTruthy()
      expect(screen.getByTestId('auth-mode-toggle-trigger').textContent).toContain('工作区可写')
      // The pill now lives INSIDE the bordered composer box, fused into the
      // bottom toolbar row alongside add-file / send — not on a separate row
      // below the box.
      const fused = screen.getByTestId('chat-composer-fused')
      const pill = screen.getByTestId('auth-mode-toggle')
      expect(fused.contains(pill)).toBe(true)
      // The old standalone extras row below the box is gone.
      expect(screen.queryByTestId('chat-composer-extras-row')).toBeNull()
      // No native <select> anymore.
      expect(document.querySelector('select')).toBeNull()
    })
  })

  describe('continuity — render-layer fusion (AC-6)', () => {
    it('does NOT unmount the conversation area when switching engines', () => {
      // AC-6 core guarantee: chat bubbles persist across an engine switch.
      mockEngine = 'builtin'
      const { rerender } = render(<UnifiedChatShell {...CONV_PROPS} messages={CHAT_MESSAGES} />)
      const bubble = screen.getByText('你好 pi，帮我看看这份草稿')
      expect(bubble).toBeTruthy()

      // Switch to the external CLI engine on the SAME mounted instance.
      mockEngine = 'cli'
      mockAgentId = 'claude'
      rerender(<UnifiedChatShell {...CONV_PROPS} messages={CHAT_MESSAGES} />)

      // The exact same bubble node is still in the document — the conversation
      // area was not unmounted/remounted by the engine switch.
      expect(bubble).toBeTruthy()
      expect(document.body.contains(bubble)).toBe(true)
    })

    it('renders a chat bubble and a CLI run changeset in the SAME conversation surface at once', async () => {
      // Start in the built-in engine with an existing pi conversation.
      mockEngine = 'builtin'
      const { rerender } = render(<UnifiedChatShell {...CONV_PROPS} messages={CHAT_MESSAGES} />)
      expect(screen.getByText('你好 pi，帮我看看这份草稿')).toBeTruthy()

      // Switch to the external CLI engine and start a run from the shared composer.
      mockEngine = 'cli'
      mockAgentId = 'codex'
      mockListChangeSets.mockResolvedValue([
        {
          id: 'cs-1',
          runId: 'r1',
          path: 'notes/draft.md',
          operation: 'edit',
          diffPreview: '-old\n+new',
          risk: 'medium',
          authorizationMode: 'workspace_write',
          status: 'applied',
        },
      ])
      rerender(<UnifiedChatShell {...CONV_PROPS} messages={CHAT_MESSAGES} />)

      // The chat bubble survived the switch; the composer is now the goal input.
      expect(screen.getByText('你好 pi，帮我看看这份草稿')).toBeTruthy()
      const goalInput = screen.getByPlaceholderText('想让 Agent 做什么？')
      expect(goalInput).toBeTruthy()

      fireEvent.change(goalInput, { target: { value: 'fix the draft' } })
      fireEvent.keyDown(goalInput, { key: 'Enter' })

      // AC-3: the run is created against the external CLI engine + selected agent.
      await waitFor(() => expect(mockCreateRun).toHaveBeenCalled())
      expect(mockCreateRun.mock.calls[0][0]).toMatchObject({
        engine: 'cli',
        agentId: 'codex',
        authorizationMode: 'workspace_write',
      })

      act(() => {
        emit?.({ type: 'run_started', runId: 'r1', sessionId: 's1', data: '{}', timestamp: 't1' })
        emit?.({ type: 'run_finished', runId: 'r1', sessionId: 's1', data: '{}', timestamp: 't2' })
      })

      // AC-6 fusion: the CLI run's changeset renders INLINE in the same
      // conversation surface, coexisting with the built-in pi chat bubble.
      await waitFor(() => expect(screen.getByText(/文件改动/)).toBeTruthy())
      expect(screen.getByText('notes/draft.md')).toBeTruthy()
      expect(screen.getByText('你好 pi，帮我看看这份草稿')).toBeTruthy()
    })
  })

  describe('engine switcher is always present (AC-2)', () => {
    it('renders the engine chip above the conversation surface', () => {
      mockEngine = 'builtin'
      render(<UnifiedChatShell {...CONV_PROPS} messages={[]} />)
      expect(screen.getByTestId('engine-switcher-chip')).toBeTruthy()
    })

    it('shows the active built-in model on the engine chip (AC-2)', async () => {
      // The built-in pi model is resolved from the daemon engine config mock
      // (dashscope / qwen-max) and surfaced on the chip's model field.
      mockEngine = 'builtin'
      render(<UnifiedChatShell {...CONV_PROPS} messages={[]} />)
      await waitFor(() =>
        expect(screen.getByTestId('engine-switcher-chip-model').textContent).toBe('qwen-max'),
      )
    })
  })

  describe('P2 polish: overlap fix + auth pill (AC-1, AC-2, AC-3)', () => {
    it('AC-1: renders the history control in the top bar and the engine switcher on the right', () => {
      mockEngine = 'builtin'
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
      // Engine switcher sits at the end of the header row.
      expect(screen.getByTestId('engine-switcher-chip')).toBeTruthy()
    })

    it('AC-3: does not render the auth pill for the built-in pi engine', () => {
      // pi has no authorization concept → the AuthModeToggle must not be
      // mounted at all. The pill's slot inside the fused composer box stays
      // empty.
      mockEngine = 'builtin'
      render(<UnifiedChatShell {...CONV_PROPS} messages={[]} />)
      expect(screen.queryByTestId('auth-mode-toggle')).toBeNull()
      const fused = screen.getByTestId('chat-composer-fused')
      expect(fused.querySelector('[data-testid="auth-mode-toggle"]')).toBeNull()
    })

    it('AC-3: renders the auth pill only after switching to the external CLI engine', () => {
      mockEngine = 'builtin'
      const { rerender } = render(<UnifiedChatShell {...CONV_PROPS} messages={[]} />)
      expect(screen.queryByTestId('auth-mode-toggle')).toBeNull()

      mockEngine = 'cli'
      mockAgentId = 'claude'
      rerender(<UnifiedChatShell {...CONV_PROPS} messages={[]} />)
      expect(screen.getByTestId('auth-mode-toggle')).toBeTruthy()
    })
  })
})
