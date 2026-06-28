import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from './setup'
import { AgentDiagnosticRow } from '../components/AgentDiagnosticRow'
import type { AgentDiagnostic } from '@journal/contracts'

const diag = (patch: Partial<AgentDiagnostic>): AgentDiagnostic => ({
  reason: 'not-on-path',
  severity: 'error',
  message: 'daemon fallback',
  ...patch,
})

describe('AgentDiagnosticRow', () => {
  it('not-on-path: localizes message with name + bin and offers install + rescan', () => {
    const onRescan = vi.fn()
    renderWithProviders(
      <AgentDiagnosticRow
        diagnostic={diag({
          reason: 'not-on-path',
          fixActions: [{ kind: 'openInstall' }, { kind: 'rescan' }],
        })}
        agentName="Claude Code"
        agentBin="claude"
        handlers={{ onRescan, onOpenInstall: vi.fn() }}
      />,
    )
    // zh locale + reason → localized; must include name + bin, not the English fallback.
    expect(screen.getByText(/未在 PATH 上找到 Claude Code.*claude/)).toBeTruthy()
    expect(screen.getByText('前往安装')).toBeTruthy()
    expect(screen.getByText('重新扫描')).toBeTruthy()
  })

  it('auth-missing: shows docs + rescan buttons', () => {
    renderWithProviders(
      <AgentDiagnosticRow
        diagnostic={diag({
          reason: 'auth-missing',
          severity: 'error',
          fixActions: [{ kind: 'openDocs' }, { kind: 'rescan' }],
        })}
        agentName="Codex CLI"
        agentBin="codex"
        handlers={{ onRescan: vi.fn(), onOpenDocs: vi.fn() }}
      />,
    )
    expect(screen.getByText(/Codex CLI 已安装但未登录/)).toBeTruthy()
    expect(screen.getByText('查看文档')).toBeTruthy()
  })

  it('configured-bin-invalid: message includes envKey + setEnv/clearEnv/rescan', () => {
    renderWithProviders(
      <AgentDiagnosticRow
        diagnostic={diag({
          reason: 'configured-bin-invalid',
          severity: 'error',
          detail: '/bad/path',
          fixActions: [
            { kind: 'setEnv', envKey: 'CODEX_BIN' },
            { kind: 'clearEnv', envKey: 'CODEX_BIN' },
            { kind: 'rescan' },
          ],
        })}
        agentName="Codex CLI"
        agentBin="codex"
        handlers={{ onSetEnv: vi.fn(), onClearEnv: vi.fn(), onRescan: vi.fn() }}
      />,
    )
    expect(screen.getByText(/CODEX_BIN/)).toBeTruthy()
    expect(screen.getByText('设置二进制路径')).toBeTruthy()
    expect(screen.getByText('清除覆盖')).toBeTruthy()
  })

  it('clicking rescan invokes the handler', () => {
    const onRescan = vi.fn()
    renderWithProviders(
      <AgentDiagnosticRow
        diagnostic={diag({ fixActions: [{ kind: 'rescan' }] })}
        agentName="Claude Code"
        agentBin="claude"
        handlers={{ onRescan }}
      />,
    )
    fireEvent.click(screen.getByText('重新扫描'))
    expect(onRescan).toHaveBeenCalledOnce()
  })

  it('clicking setEnv forwards the envKey', () => {
    const onSetEnv = vi.fn()
    renderWithProviders(
      <AgentDiagnosticRow
        diagnostic={diag({
          reason: 'configured-bin-invalid',
          fixActions: [{ kind: 'setEnv', envKey: 'OPENCODE_BIN' }],
        })}
        agentName="OpenCode"
        agentBin="opencode"
        handlers={{ onSetEnv }}
      />,
    )
    fireEvent.click(screen.getByText('设置二进制路径'))
    expect(onSetEnv).toHaveBeenCalledWith('OPENCODE_BIN')
  })

  it('searchedDirs are surfaced via title tooltip', () => {
    renderWithProviders(
      <AgentDiagnosticRow
        diagnostic={diag({
          reason: 'not-on-path',
          searchedDirs: ['/usr/local/bin', '/opt/homebrew/bin'],
          fixActions: [],
        })}
        agentName="Claude Code"
        agentBin="claude"
      />,
    )
    const message = screen.getByText(/未在 PATH 上找到/)
    expect(message.getAttribute('title') ?? '').toContain('/opt/homebrew/bin')
  })
})
