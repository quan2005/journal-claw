import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from './setup'
import { WorkspaceView, WorkspaceChatShell } from '../components/WorkspaceView'

vi.mock('../hooks/useTopics', () => ({
  useTopics: () => ({
    dirs: new Map([['', { entries: [], expanded: true, loading: false }]]),
    loading: false,
    load: vi.fn(),
    toggleDir: vi.fn(),
  }),
}))

vi.mock('../hooks/useAgentEngine', () => ({
  useAgentEngine: () => ({
    engine: 'builtin',
    agentId: null,
    loading: false,
    setEngine: vi.fn(),
    setAgentId: vi.fn(),
  }),
}))

vi.mock('../hooks/useAgentRun', () => ({
  useAgentRun: () => ({
    run: null,
    timeline: [],
    changeSets: [],
    artifacts: [],
    memory: [],
    sources: [],
    assistantText: '',
    isRunning: false,
    start: vi.fn(),
  }),
}))

vi.mock('../lib/localAgents', () => ({
  listLocalAgents: vi.fn().mockResolvedValue([]),
}))

vi.mock('../lib/runtimeClient', () => ({
  selectRuntimeClient: () => ({
    subscribe: () => () => {},
  }),
}))

vi.mock('../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../lib/tauri')>('../lib/tauri')
  return {
    ...actual,
    getEngineConfig: vi.fn().mockResolvedValue({ providers: [], active_provider: '' }),
    conversationList: vi.fn().mockResolvedValue([]),
    conversationDelete: vi.fn().mockResolvedValue(undefined),
  }
})

// Mock toast dispatcher used by placeholder actions
const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent').mockReturnValue(true)

const chatShellProps = {
  messages: [],
  isStreaming: false,
  usage: { input: 0, output: 0 },
  stats: null,
  pendingQueue: [],
  onSend: vi.fn(),
  onCancel: vi.fn(),
  onRetry: vi.fn(),
  onEditAndResend: vi.fn(),
  onRemovePendingItem: vi.fn(),
}

describe('WorkspaceView', () => {
  it('renders Quick Start cards', () => {
    renderWithProviders(<WorkspaceView />)
    expect(screen.getByRole('button', { name: /New File/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /New Folder/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Import/i })).toBeTruthy()
  })

  it('renders Recently Viewed table headers', () => {
    renderWithProviders(<WorkspaceView />)
    expect(screen.getByRole('columnheader', { name: /Name/i })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: /Contributors/i })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: /Viewed/i })).toBeTruthy()
  })

  it('expands more rows when Show more is clicked', () => {
    renderWithProviders(<WorkspaceView />)
    const rowsBefore = screen.getAllByRole('row').length
    fireEvent.click(screen.getByRole('button', { name: /Show more/i }))
    expect(screen.getAllByRole('row').length).toBeGreaterThan(rowsBefore)
  })

  it('dispatches placeholder action on card click', () => {
    renderWithProviders(<WorkspaceView />)
    fireEvent.click(screen.getByRole('button', { name: /New File/i }))
    expect(dispatchEventSpy).toHaveBeenCalled()
  })

  it('calls onOpenRecent when a recently viewed row is clicked', () => {
    const onOpenRecent = vi.fn()
    renderWithProviders(<WorkspaceView onOpenRecent={onOpenRecent} />)
    const rows = screen.getAllByRole('row')
    // Skip the header row.
    fireEvent.click(rows[1])
    expect(onOpenRecent).toHaveBeenCalled()
  })
})

describe('WorkspaceChatShell', () => {
  it('renders greeting and input', async () => {
    renderWithProviders(<WorkspaceChatShell {...chatShellProps} />)
    await waitFor(() => {
      expect(screen.getByText("闫戍's momo")).toBeTruthy()
    })
    expect(screen.getByPlaceholderText(/Ask me anything/i)).toBeTruthy()
  })

  it('calls onSend when a message is sent', async () => {
    const onSend = vi.fn()
    renderWithProviders(<WorkspaceChatShell {...chatShellProps} onSend={onSend} />)
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Ask me anything/i)).toBeTruthy()
    })
    const input = screen.getByPlaceholderText(/Ask me anything/i) as HTMLTextAreaElement
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
    expect(onSend).toHaveBeenCalledWith('hello')
  })

  it('disables send when input is empty', async () => {
    renderWithProviders(<WorkspaceChatShell {...chatShellProps} />)
    const send = await waitFor(() => screen.getByRole('button', { name: /Send/i }))
    expect(send.hasAttribute('disabled')).toBe(true)
  })

  it('calls onNewChat when the create-new-chat button is clicked', async () => {
    const onNewChat = vi.fn()
    renderWithProviders(<WorkspaceChatShell {...chatShellProps} onNewChat={onNewChat} />)
    const btn = await waitFor(() => screen.getByRole('button', { name: /Create new chat/i }))
    fireEvent.click(btn)
    expect(onNewChat).toHaveBeenCalled()
  })
})
