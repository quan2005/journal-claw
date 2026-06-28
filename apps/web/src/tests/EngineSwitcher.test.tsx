import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders as render } from './setup'
import { EngineSwitcher } from '../components/EngineSwitcher'
import type { AgentInfo } from '@journal/contracts'
import type { RunEngine } from '../types/agentRun'

const AGENTS: AgentInfo[] = [
  { id: 'claude', name: 'Claude Code', bin: 'claude', available: true, version: '1.4.0' },
  {
    id: 'codex',
    name: 'Codex',
    bin: 'codex',
    available: false,
    authStatus: 'missing',
    diagnostics: [
      {
        reason: 'not-on-path',
        severity: 'error',
        message: 'codex not on PATH',
      },
    ],
  },
]

function makeSwitcher(
  overrides: Partial<{ engine: RunEngine; agentId: string | null; model: string | null }> = {},
) {
  const onEngineChange = vi.fn()
  const onAgentChange = vi.fn()
  const onRescan = vi.fn()
  render(
    <EngineSwitcher
      engine={overrides.engine ?? 'builtin'}
      agentId={overrides.agentId ?? null}
      model={overrides.model}
      agents={AGENTS}
      onEngineChange={onEngineChange}
      onAgentChange={onAgentChange}
      onRescan={onRescan}
    />,
  )
  return { onEngineChange, onAgentChange, onRescan }
}

describe('EngineSwitcher', () => {
  it('renders the chip showing the active engine', () => {
    makeSwitcher({ engine: 'builtin' })
    const chip = screen.getByTestId('engine-switcher-chip')
    expect(chip).toBeTruthy()
    // Built-in mode shows the built-in short label on the chip.
    expect(chip.textContent).toContain('内置')
  })

  it('shows the active model on the chip for the built-in engine (AC-2)', () => {
    // The built-in pi engine's model is resolved from daemon engine config
    // upstream and passed in; the chip surfaces it on the same line.
    makeSwitcher({ engine: 'builtin', model: 'qwen-max' })
    const model = screen.getByTestId('engine-switcher-chip-model')
    expect(model.textContent).toBe('qwen-max')
  })

  it('falls back to a localized Default when the model is unknown (AC-2)', () => {
    // External CLI agents have no live model listing → the field must still
    // render (never blank), falling back to the localized "Default".
    makeSwitcher({ engine: 'cli', agentId: 'claude', model: null })
    const model = screen.getByTestId('engine-switcher-chip-model')
    expect(model.textContent).toBe('默认')
  })

  it('opens the popover and switches between built-in and external engines', () => {
    const { onEngineChange, onAgentChange } = makeSwitcher({ engine: 'builtin' })
    fireEvent.click(screen.getByTestId('engine-switcher-chip'))
    expect(screen.getByTestId('engine-switcher-popover')).toBeTruthy()

    // Select external CLI engine.
    fireEvent.click(screen.getByTestId('engine-switcher-mode-cli'))
    expect(onEngineChange).toHaveBeenCalledWith('cli')

    // Selecting CLI with no agent pre-selected auto-picks the first available.
    expect(onAgentChange).toHaveBeenCalledWith('claude')
  })

  it('lists detected agents and selects an available one', () => {
    const { onAgentChange } = makeSwitcher({ engine: 'cli', agentId: null })
    fireEvent.click(screen.getByTestId('engine-switcher-chip'))
    // Both agents render; the available one is clickable.
    expect(screen.getByTestId('engine-switcher-agent-claude')).toBeTruthy()
    fireEvent.click(screen.getByTestId('engine-switcher-agent-claude'))
    expect(onAgentChange).toHaveBeenCalledWith('claude')
  })

  it('greys out unavailable agents and exposes their diagnostics', () => {
    makeSwitcher({ engine: 'cli', agentId: 'claude' })
    fireEvent.click(screen.getByTestId('engine-switcher-chip'))

    const codexBtn = screen.getByTestId('engine-switcher-agent-codex') as HTMLButtonElement
    // Unavailable → disabled, not selectable.
    expect(codexBtn.disabled).toBe(true)
    // The "unavailable" status label renders.
    expect(screen.getAllByText('不可用').length).toBeGreaterThan(0)
    // The diagnostic reason surfaces inline (the i18n message naming the agent).
    expect(screen.getByText(/未在 PATH 上找到 Codex/)).toBeTruthy()
  })

  it('shows an empty hint when no agents are detected', () => {
    const onRescan = vi.fn()
    render(
      <EngineSwitcher
        engine="cli"
        agentId={null}
        agents={[]}
        onEngineChange={vi.fn()}
        onAgentChange={vi.fn()}
        onRescan={onRescan}
      />,
    )
    fireEvent.click(screen.getByTestId('engine-switcher-chip'))
    expect(screen.getByText('未检测到可用的外部 Agent，可重新扫描或在设置中安装。')).toBeTruthy()
  })
})
