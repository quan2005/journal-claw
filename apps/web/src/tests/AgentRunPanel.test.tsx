import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

// Mock the daemon client so the panel is testable without a live server.
const mockCreateRun = vi.fn()
const mockSubscribe = vi.fn()
const mockListChangeSets = vi.fn()

vi.mock('../lib/agentRuns', () => ({
  createRun: (...args: unknown[]) => mockCreateRun(...(args as [never])),
  subscribeRunEvents: (...args: unknown[]) => mockSubscribe(...(args as [never])),
  listChangeSets: (...args: unknown[]) => mockListChangeSets(...(args as [never])),
}))

import { AgentRunPanel } from '../components/AgentRunPanel'

describe('AgentRunPanel', () => {
  let emit: ((ev: unknown) => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    emit = null
    mockCreateRun.mockResolvedValue({
      id: 'r1',
      sessionId: 's1',
      goal: '',
      mode: 'agent',
      status: 'queued',
      authorizationMode: 'workspace_write',
      contextBindings: [],
      steps: [],
      createdAt: '2026-06-25T12:00:00Z',
      updatedAt: '2026-06-25T12:00:00Z',
    })
    mockSubscribe.mockImplementation((_id: string, onEvent: (e: unknown) => void) => {
      emit = onEvent
      return () => {}
    })
    mockListChangeSets.mockResolvedValue([])
  })

  it('renders the goal form before a run starts', () => {
    render(<AgentRunPanel />)
    expect(screen.getByText('Agent Run')).toBeTruthy()
    expect(screen.getByPlaceholderText('What should the agent do?')).toBeTruthy()
  })

  it('creates a run and shows the timeline + output from streamed events', async () => {
    render(<AgentRunPanel />)
    const input = screen.getByPlaceholderText('What should the agent do?')
    fireEvent.change(input, { target: { value: 'reply pong' } })
    fireEvent.click(screen.getByText('Start run'))

    await waitFor(() => expect(mockCreateRun).toHaveBeenCalled())
    expect(mockCreateRun.mock.calls[0][0]).toMatchObject({ goal: 'reply pong', authorizationMode: 'workspace_write' })

    // Simulate the daemon emitting events.
    act(() => {
      emit?.({ type: 'run_started', runId: 'r1', sessionId: 's1', data: '{}', timestamp: '2026-06-25T12:00:01Z' })
      emit?.({ type: 'text_delta', runId: 'r1', sessionId: 's1', data: '{"text":"pong"}', timestamp: '2026-06-25T12:00:02Z' })
      emit?.({ type: 'tool_call', runId: 'r1', sessionId: 's1', spanId: 'tu1', data: '{"name":"Bash","input":{"command":"ls"}}', timestamp: '2026-06-25T12:00:03Z' })
      emit?.({ type: 'run_finished', runId: 'r1', sessionId: 's1', data: '{}', timestamp: '2026-06-25T12:00:04Z' })
    })

    await waitFor(() => expect(screen.getByText('pong')).toBeTruthy())
    expect(screen.getByText('Bash')).toBeTruthy()
    expect(screen.getByText('Done')).toBeTruthy()
  })

  it('shows an authorization mode selector', () => {
    render(<AgentRunPanel />)
    expect(screen.getByText('Workspace write')).toBeTruthy()
  })
})
