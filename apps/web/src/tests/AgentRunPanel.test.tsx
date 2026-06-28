import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor, act } from '@testing-library/react'
import { renderWithProviders as render } from './setup'

// Mock the daemon client so the panel is testable without a live server.
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
    mockListArtifacts.mockResolvedValue([])
    mockListMemory.mockResolvedValue([])
    mockListSources.mockResolvedValue([])
  })

  it('renders the goal form before a run starts', () => {
    render(<AgentRunPanel />)
    expect(screen.getByText('Agent 任务')).toBeTruthy()
    expect(screen.getByPlaceholderText('想让 Agent 做什么？')).toBeTruthy()
  })

  it('creates a run and shows the timeline + output from streamed events', async () => {
    render(<AgentRunPanel />)
    const input = screen.getByPlaceholderText('想让 Agent 做什么？')
    fireEvent.change(input, { target: { value: 'reply pong' } })
    fireEvent.click(screen.getByText('开始执行'))

    await waitFor(() => expect(mockCreateRun).toHaveBeenCalled())
    expect(mockCreateRun.mock.calls[0][0]).toMatchObject({
      goal: 'reply pong',
      authorizationMode: 'workspace_write',
    })

    // Simulate the daemon emitting events.
    act(() => {
      emit?.({
        type: 'run_started',
        runId: 'r1',
        sessionId: 's1',
        data: '{}',
        timestamp: '2026-06-25T12:00:01Z',
      })
      emit?.({
        type: 'text_delta',
        runId: 'r1',
        sessionId: 's1',
        data: '{"text":"pong"}',
        timestamp: '2026-06-25T12:00:02Z',
      })
      emit?.({
        type: 'tool_call',
        runId: 'r1',
        sessionId: 's1',
        spanId: 'tu1',
        data: '{"name":"Bash","input":{"command":"ls"}}',
        timestamp: '2026-06-25T12:00:03Z',
      })
      emit?.({
        type: 'run_finished',
        runId: 'r1',
        sessionId: 's1',
        data: '{}',
        timestamp: '2026-06-25T12:00:04Z',
      })
    })

    await waitFor(() => expect(screen.getByText('pong')).toBeTruthy())
    expect(screen.getByText('Bash')).toBeTruthy()
    expect(screen.getByText('已完成')).toBeTruthy()
  })

  it('shows an authorization mode selector', () => {
    render(<AgentRunPanel />)
    expect(screen.getByText('工作区可写')).toBeTruthy()
  })

  it('offers wide_with_audit as an explicit selectable authorization option', () => {
    render(<AgentRunPanel />)
    // The option is rendered inside a <select>; getByText finds the option label.
    expect(screen.getByText('宽松（带审计）')).toBeTruthy()
    // The product default remains workspace_write.
    const select = screen.getByRole('combobox')
    expect((select as HTMLSelectElement).value).toBe('workspace_write')
  })

  it('defaults the authorization mode to workspace_write when creating a run', async () => {
    render(<AgentRunPanel />)
    fireEvent.change(screen.getByPlaceholderText('想让 Agent 做什么？'), {
      target: { value: 'do stuff' },
    })
    fireEvent.click(screen.getByText('开始执行'))
    await waitFor(() => expect(mockCreateRun).toHaveBeenCalled())
    expect(mockCreateRun.mock.calls[0][0]).toMatchObject({
      authorizationMode: 'workspace_write',
    })
  })

  it('renders blocked and failed changesets with a visible danger status', async () => {
    mockListChangeSets.mockResolvedValue([
      {
        id: 'cs-1',
        runId: 'r1',
        path: 'notes/secret.md',
        operation: 'edit',
        diffPreview: '',
        risk: 'medium',
        authorizationMode: 'workspace_write',
        status: 'blocked',
      },
      {
        id: 'cs-2',
        runId: 'r1',
        path: 'notes/gone.md',
        operation: 'remove',
        diffPreview: '',
        risk: 'high',
        authorizationMode: 'workspace_write',
        status: 'failed',
      },
    ])

    render(<AgentRunPanel />)
    fireEvent.change(screen.getByPlaceholderText('想让 Agent 做什么？'), {
      target: { value: 'edit things' },
    })
    fireEvent.click(screen.getByText('开始执行'))
    await waitFor(() => expect(mockCreateRun).toHaveBeenCalled())

    act(() => {
      emit?.({
        type: 'run_started',
        runId: 'r1',
        sessionId: 's1',
        data: '{}',
        timestamp: '2026-06-25T12:00:01Z',
      })
      emit?.({
        type: 'run_finished',
        runId: 'r1',
        sessionId: 's1',
        data: '{}',
        timestamp: '2026-06-25T12:00:02Z',
      })
    })

    await waitFor(() => expect(screen.getByText('文件改动 (2)')).toBeTruthy())
    // Both paths render, and both non-muted statuses are surfaced.
    expect(screen.getByText('notes/secret.md')).toBeTruthy()
    expect(screen.getByText('notes/gone.md')).toBeTruthy()
    // Operation/status tags are localized (zh) — no raw backend enum leaks.
    expect(screen.getAllByText('编辑').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('删除').length).toBeGreaterThanOrEqual(1)
    const blockedTags = screen.getAllByText('已阻止')
    const failedTags = screen.getAllByText('已失败')
    expect(blockedTags.length).toBeGreaterThanOrEqual(1)
    expect(failedTags.length).toBeGreaterThanOrEqual(1)
  })

  it('renders Sources, Artifacts, and Memory sections after a run finishes', async () => {
    mockListArtifacts.mockResolvedValue([
      {
        id: 'art-1',
        runId: 'r1',
        type: 'summary',
        title: 'Q2 Review',
        content: 'findings',
        createdAt: '2026-06-25T12:00:00Z',
      },
    ])
    mockListMemory.mockResolvedValue([
      {
        id: 'mem-1',
        sourceRunId: 'r1',
        kind: 'preference',
        summary: 'I prefer concise text',
        detail: 'd',
        evidence: ['evidence snippet'],
        createdAt: '2026-06-25T12:00:00Z',
      },
    ])
    mockListSources.mockResolvedValue([
      {
        id: 'src-1',
        runId: 'r1',
        path: 'meetings/standup.md',
        kind: 'read',
        createdAt: '2026-06-25T12:00:00Z',
      },
    ])

    render(<AgentRunPanel />)
    fireEvent.change(screen.getByPlaceholderText('想让 Agent 做什么？'), {
      target: { value: 'test' },
    })
    fireEvent.click(screen.getByText('开始执行'))
    await waitFor(() => expect(mockCreateRun).toHaveBeenCalled())

    act(() => {
      emit?.({
        type: 'run_started',
        runId: 'r1',
        sessionId: 's1',
        data: '{}',
        timestamp: '2026-06-25T12:00:01Z',
      })
      emit?.({
        type: 'run_finished',
        runId: 'r1',
        sessionId: 's1',
        data: '{}',
        timestamp: '2026-06-25T12:00:02Z',
      })
    })

    await waitFor(() => expect(screen.getByText('读取的来源 (1)')).toBeTruthy())
    expect(screen.getByText('产物 (1)')).toBeTruthy()
    expect(screen.getByText('记忆 (1)')).toBeTruthy()
    expect(screen.getByText('Q2 Review')).toBeTruthy()
    expect(screen.getByText('meetings/standup.md')).toBeTruthy()
    // Source kind + artifact type tags are localized (zh), not raw enums.
    expect(screen.getByText('读取')).toBeTruthy()
    expect(screen.getByText('摘要')).toBeTruthy()
  })

  it('does not crash when the daemon emits an unrecognized run status', async () => {
    // The contracts union may grow new statuses (e.g. "rejected"); the panel
    // must fall back to a safe badge rather than throw.
    mockCreateRun.mockResolvedValue({
      id: 'r1',
      sessionId: 's1',
      goal: '',
      mode: 'agent',
      status: 'rejected' as never,
      authorizationMode: 'workspace_write',
      contextBindings: [],
      steps: [],
      createdAt: '2026-06-25T12:00:00Z',
      updatedAt: '2026-06-25T12:00:00Z',
    })

    render(<AgentRunPanel />)
    fireEvent.change(screen.getByPlaceholderText('想让 Agent 做什么？'), {
      target: { value: 'risky' },
    })
    fireEvent.click(screen.getByText('开始执行'))
    await waitFor(() => expect(mockCreateRun).toHaveBeenCalled())

    // The header badge surfaces the raw status string instead of throwing.
    await waitFor(() => expect(screen.getByText('rejected')).toBeTruthy())
  })
})
