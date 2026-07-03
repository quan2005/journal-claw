import { describe, it, expect, vi, afterEach } from 'vitest'
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

/**
 * Stub element geometry for the popover flip-direction logic. jsdom returns
 * all-zero rects by default; we stub getBoundingClientRect so the wrapper
 * reports the given chip-bottom edge, the popover reports the given height,
 * and the viewport height is set so the space-below math can be exercised.
 */
function domRect(top: number, bottom: number, height: number): DOMRect {
  return {
    top,
    bottom,
    left: 0,
    right: 248,
    width: 248,
    height,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect
}

function mockGeometry(opts: {
  chipBottom: number
  popoverHeight: number
  viewportHeight: number
}) {
  Object.defineProperty(window, 'innerHeight', {
    value: opts.viewportHeight,
    configurable: true,
    writable: true,
  })
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: Element,
  ) {
    if (this instanceof HTMLElement && this.classList.contains('engine-switcher__popover')) {
      return domRect(0, opts.popoverHeight, opts.popoverHeight)
    }
    if (this instanceof HTMLElement && this.classList.contains('engine-switcher')) {
      return domRect(opts.chipBottom - 28, opts.chipBottom, 28)
    }
    return domRect(0, 0, 0)
  })
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

  describe('popover fixed positioning (AC-2 rework, story ui-fixes-sidebar-dropdown)', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    /** Parse a "Npx" / number inline style value into a float. */
    const px = (v: string | number) => (typeof v === 'number' ? v : parseFloat(String(v)))

    it('uses position:fixed with viewport coords that keep the menu fully on-screen when space below is tight', () => {
      // Chip sits 30px above the viewport bottom; the 300px popover cannot fit
      // below → it must flip up so its rect stays inside the viewport.
      mockGeometry({ chipBottom: 770, popoverHeight: 300, viewportHeight: 800 })
      makeSwitcher({ engine: 'builtin' })
      fireEvent.click(screen.getByTestId('engine-switcher-chip'))
      const popover = screen.getByTestId('engine-switcher-popover')
      expect(popover.style.position).toBe('fixed')
      const top = px(popover.style.top)
      const left = px(popover.style.left)
      // Flipped up: top is above the chip, never negative, and the whole menu
      // (top..top+300) fits within [0, viewportHeight].
      expect(top).toBeLessThan(770 - 28)
      expect(top).toBeGreaterThanOrEqual(0)
      expect(top + 300).toBeLessThanOrEqual(800)
      expect(left).toBeGreaterThanOrEqual(0)
      expect(left + 248).toBeLessThanOrEqual(800)
    })

    it('drops the popover down with viewport coords fully on-screen when there is ample room below', () => {
      // Chip near the top of a tall viewport → opens downward. Guards against a
      // regression of the top-bar / Workspace-header instance.
      mockGeometry({ chipBottom: 120, popoverHeight: 300, viewportHeight: 800 })
      makeSwitcher({ engine: 'builtin' })
      fireEvent.click(screen.getByTestId('engine-switcher-chip'))
      const popover = screen.getByTestId('engine-switcher-popover')
      expect(popover.style.position).toBe('fixed')
      const top = px(popover.style.top)
      // Downward: top sits just below the chip (120 + 6 gap).
      expect(top).toBe(126)
      expect(top + 300).toBeLessThanOrEqual(800)
    })

    it('always mounts the popover on document.body (createPortal) so it escapes the panel stacking context', () => {
      // Root cause (AC-2): an ancestor of the chip establishes a stacking
      // context via opacity<1 (or transform/filter). position:fixed only
      // changes the containing block, NOT the stacking-context parent — so a
      // fixed popover that stays in the panel's DOM subtree is still occluded
      // by the middle column's z-index:50 dropdowns. Only mounting on
      // document.body (createPortal, React built-in) joins the root stacking
      // context where z-index:var(--workbench-menu-z) wins.
      mockGeometry({ chipBottom: 120, popoverHeight: 300, viewportHeight: 800 })
      makeSwitcher({ engine: 'builtin' })
      fireEvent.click(screen.getByTestId('engine-switcher-chip'))
      const popover = screen.getByTestId('engine-switcher-popover')
      expect(popover.parentElement).toBe(document.body)
    })
  })
})
