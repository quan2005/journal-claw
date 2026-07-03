/**
 * SectionLocalAgents integration tests.
 *
 * Mocks the daemon GET /agents fetch surface and the host `openUrl` bridge,
 * then asserts the section renders agent cards, statuses, diagnostics, and
 * that the "重新扫描" affordance triggers a cache-bypassing re-fetch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from './setup'
import { ToastProvider } from '../contexts/ToastContext'
import { createElement } from 'react'

// Mock the host bridge so openUrl clicks never touch a real shell.
vi.mock('../lib/hostBridge', () => ({
  hostOpenWithSystem: vi.fn(async () => {}),
}))

import SectionLocalAgents from '../settings/components/SectionLocalAgents'
import type { AgentInfo, AgentsResponse } from '@journal/contracts'

function render(ui: React.ReactElement) {
  return renderWithProviders(createElement(ToastProvider, null, ui))
}

const okClaude: AgentInfo = {
  id: 'claude',
  name: 'Claude Code',
  bin: 'claude',
  available: true,
  version: '2.1.191',
  path: '/usr/local/bin/claude',
  authStatus: 'ok',
  installUrl: 'https://example.com/install',
  docsUrl: 'https://example.com/docs',
}

const missingCodex: AgentInfo = {
  id: 'codex',
  name: 'Codex CLI',
  bin: 'codex',
  available: false,
  diagnostics: [
    {
      reason: 'not-on-path',
      severity: 'error',
      message: 'daemon fallback',
      searchedDirs: ['/usr/local/bin'],
      fixActions: [{ kind: 'openInstall' }, { kind: 'rescan' }],
    },
  ],
  installUrl: 'https://example.com/codex-install',
}

const authMissingOpencode: AgentInfo = {
  id: 'opencode',
  name: 'OpenCode',
  bin: 'opencode',
  available: true,
  version: '1.0.0',
  authStatus: 'missing',
  path: '/opt/homebrew/bin/opencode',
  diagnostics: [
    {
      reason: 'auth-missing',
      severity: 'error',
      message: 'fallback',
      fixActions: [{ kind: 'openDocs' }, { kind: 'rescan' }],
    },
  ],
  docsUrl: 'https://example.com/opencode-docs',
}

function mockAgentsResponse(body: AgentsResponse): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => body,
          text: async () => JSON.stringify(body),
        }) as unknown as Response,
    ),
  )
}

function fetchCallUrls(): string[] {
  const fn = globalThis.fetch as unknown as { mock?: { calls: unknown[][] } }
  return (fn.mock?.calls ?? []).map((c) => String(c[0]))
}

describe('SectionLocalAgents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders one card per detected agent with name + status', async () => {
    mockAgentsResponse({ agents: [okClaude, missingCodex, authMissingOpencode] })
    render(<SectionLocalAgents />)
    await waitFor(() => expect(screen.getByText('Claude Code')).toBeTruthy())
    expect(screen.getByText('Codex CLI')).toBeTruthy()
    expect(screen.getByText('OpenCode')).toBeTruthy()
    expect(screen.getByText('可用')).toBeTruthy()
    expect(screen.getByText('不可用')).toBeTruthy()
  })

  it('shows version + path on a healthy agent', async () => {
    mockAgentsResponse({ agents: [okClaude] })
    render(<SectionLocalAgents />)
    await waitFor(() => expect(screen.getByText('2.1.191')).toBeTruthy())
    expect(screen.getByText('/usr/local/bin/claude')).toBeTruthy()
  })

  it('renders diagnostics with localized reason on an unavailable agent', async () => {
    mockAgentsResponse({ agents: [missingCodex] })
    render(<SectionLocalAgents />)
    await waitFor(() => expect(screen.getByText(/未在 PATH 上找到 Codex CLI/)).toBeTruthy())
    expect(screen.getByText('前往安装')).toBeTruthy()
  })

  it('rescan button triggers a fetch with ?rescan=1', async () => {
    mockAgentsResponse({ agents: [okClaude] })
    render(<SectionLocalAgents />)
    await waitFor(() => expect(screen.getByText('Claude Code')).toBeTruthy())
    fireEvent.click(screen.getByText('重新扫描'))
    await waitFor(() => expect(fetchCallUrls().some((u) => u.includes('rescan=1'))).toBe(true))
  })

  it('shows an error banner when the daemon is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network')
      }),
    )
    render(<SectionLocalAgents />)
    await waitFor(() => expect(screen.getByText('检测失败，请稍后重试。')).toBeTruthy())
  })

  it('shows the empty state when no agents are registered', async () => {
    mockAgentsResponse({ agents: [] })
    render(<SectionLocalAgents />)
    await waitFor(() => expect(screen.getByText('尚未注册任何 agent。')).toBeTruthy())
  })
})
