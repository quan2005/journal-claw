/**
 * EngineSwitcher — the unified conversation panel's top-bar engine chip.
 *
 * Replicates open-design's InlineModelSwitcher interaction (one-line chip +
 * compact popover) on journal's design system: signal-orange accent is
 * `--record-btn` (never `--accent`, which is danger red), corners/shadows/
 * borders/focus ring come from the structured tokens, and the three font
 * stacks are respected. A single chip shows the active engine (built-in pi
 * or the external agent's name); the popover swaps between the two engines
 * and — for the external path — lists P1-detected agents, greying out the
 * unavailable ones and surfacing their diagnostics inline.
 *
 * The component is fully controlled: it derives state from props and emits
 * intent via callbacks. Persistence lives one level up (useAgentEngine →
 * daemon settings), never in localStorage.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import type { AgentInfo } from '@journal/contracts'
import type { RunEngine } from '../types/agentRun'
import { useTranslation } from '../contexts/I18nContext'
import { AgentDiagnosticRow } from './AgentDiagnosticRow'
import '../styles/engine-switcher.css'

export interface EngineSwitcherProps {
  engine: RunEngine
  agentId: string | null
  agents: AgentInfo[]
  /**
   * The current model name to show on the chip (AC-2: the chip displays the
   * current engine + current model on one line). For the built-in pi engine
   * this is the active provider's model (resolved from daemon engine config);
   * for an external CLI agent it may be undefined (no live-listing) → the chip
   * falls back to a localized "Default" so the field is never missing.
   */
  model?: string | null
  loading?: boolean
  onEngineChange: (engine: RunEngine) => void
  onAgentChange: (agentId: string) => void
  onRescan: () => void
  rescanning?: boolean
}

/** Resolve a short display label for an agent id (falls back to its name). */
function agentLabel(agent: AgentInfo | undefined, agentId: string | null): string {
  if (!agentId) return ''
  return agent?.name ?? agentId
}

/** Pixel gap between the chip and the popover (matches the pre-rework CSS). */
const POPOVER_GAP = 6

export function EngineSwitcher({
  engine,
  agentId,
  agents,
  model,
  loading = false,
  onEngineChange,
  onAgentChange,
  onRescan,
  rescanning = false,
}: EngineSwitcherProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({ position: 'fixed' })
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  // Close on outside click / Escape — same defensive pattern as open-design's
  // switcher so a click on a diagnostic fix button (rendered in-portal) never
  // gets yanked away mid-interaction. The popover lives on document.body (via
  // createPortal) so the check must cover both the chip wrapper and the popover.
  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return
      if (popoverRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // AC-2 rework (story ui-fixes-sidebar-dropdown): the same chip is mounted in
  // the Workspace view's right panel. That panel's ancestor (an
  // `.app-sidebar-panel` with opacity<1, or any transform/filter) establishes a
  // *stacking context* — and stacking context, not containing block, is what
  // decides paint order. position:fixed only changes the containing block, so a
  // fixed popover still paints *inside* the panel's stacking subtree and gets
  // occluded by the middle column's z-index:50 dropdowns. The fix: portal the
  // popover to document.body (createPortal, React built-in) so it joins the
  // *root* stacking context, where z-index:var(--workbench-menu-z) (1010) wins.
  // Space-aware flip + viewport coords are computed in a layout effect (no
  // drop-then-flip flash) — no Popper / generic popover layer (story boundary).
  useLayoutEffect(() => {
    if (!open) {
      setPopoverStyle({ position: 'fixed' })
      return
    }
    const wrap = wrapRef.current
    const popover = popoverRef.current
    if (!wrap || !popover) return

    const wrapRect = wrap.getBoundingClientRect()
    const popRect = popover.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    const spaceBelow = vh - wrapRect.bottom - POPOVER_GAP
    const flipUp = popRect.height > spaceBelow
    const top = flipUp
      ? Math.round(wrapRect.top - POPOVER_GAP - popRect.height)
      : Math.round(wrapRect.bottom + POPOVER_GAP)

    // Right-align the popover to the chip's right edge, clamped into the viewport.
    const margin = 8
    let left = Math.round(wrapRect.right - popRect.width)
    if (left < margin) left = margin
    if (left + popRect.width > vw - margin) left = Math.round(vw - margin - popRect.width)

    setPopoverStyle({ position: 'fixed', top, left })
  }, [open])

  // Close on viewport resize or any scroll (capture so scrolls inside the
  // workspace panel's own scroll container also dismiss). Repositioning on
  // every scroll frame is heavier than this chip needs.
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  const currentAgent = agents.find((a) => a.id === agentId) ?? null

  // Chip primary text: built-in pi label, or the external agent's display name.
  const chipPrimary =
    engine === 'builtin'
      ? t('engineSwitcherBuiltin')
      : currentAgent
        ? agentLabel(currentAgent, agentId)
        : agentId
          ? agentId
          : t('engineSwitcherNoAgent')

  // AC-2: the chip shows the current model on the same line. The model field
  // must never be blank — fall back to a localized "Default" when unknown.
  const chipModel = model ? model : t('engineSwitcherModelDefault')

  const handleEngineSelect = useCallback(
    (next: RunEngine) => {
      onEngineChange(next)
      // Auto-pick the first available agent when entering cli with none chosen,
      // mirroring how a user expects "external agent" to be immediately usable.
      if (next === 'cli' && !agentId) {
        const firstAvailable = agents.find((a) => a.available)
        if (firstAvailable) onAgentChange(firstAvailable.id)
      }
    },
    [agentId, agents, onAgentChange, onEngineChange],
  )

  const handleAgentSelect = useCallback(
    (agent: AgentInfo) => {
      if (!agent.available) return
      onAgentChange(agent.id)
    },
    [onAgentChange],
  )

  // The popover is hoisted into a const so it can be portaled to document.body
  // when an ancestor creates a fixed-position containing block (transform /
  // filter / …). position:fixed + the computed viewport coords are applied via
  // inline style; the matching .engine-switcher__popover CSS only carries the
  // visual tokens + z-index:var(--workbench-menu-z) (1010, above the workspace
  // middle column's z-index:50 dropdowns).
  const popoverEl = open ? (
    <div
      ref={popoverRef}
      className="engine-switcher__popover"
      role="menu"
      data-testid="engine-switcher-popover"
      style={popoverStyle}
    >
      <div className="engine-switcher__row">
        <span className="engine-switcher__label">{t('engineSwitcherModeLabel')}</span>
        <div className="engine-switcher__seg" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={engine === 'builtin'}
            className={'engine-switcher__seg-btn' + (engine === 'builtin' ? ' is-active' : '')}
            data-testid="engine-switcher-mode-builtin"
            onClick={() => handleEngineSelect('builtin')}
          >
            {t('engineSwitcherBuiltin')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={engine === 'cli'}
            className={'engine-switcher__seg-btn' + (engine === 'cli' ? ' is-active' : '')}
            data-testid="engine-switcher-mode-cli"
            onClick={() => handleEngineSelect('cli')}
          >
            {t('engineSwitcherCli')}
          </button>
        </div>
      </div>

      {engine === 'cli' ? (
        <div className="engine-switcher__row">
          <span className="engine-switcher__label">
            {t('engineSwitcherAgentLabel')}
            <button
              type="button"
              className="engine-switcher__rescan"
              data-testid="engine-switcher-rescan"
              onClick={onRescan}
              disabled={rescanning}
              title={t('rescan')}
            >
              {rescanning ? t('rescanning') : t('rescan')}
            </button>
          </span>
          {loading && agents.length === 0 ? (
            <span className="engine-switcher__hint">{t('rescanning')}</span>
          ) : agents.length === 0 ? (
            <span className="engine-switcher__hint">{t('engineSwitcherNoAgents')}</span>
          ) : (
            <ul className="engine-switcher__agent-list" role="radiogroup">
              {agents.map((a) => {
                const active = a.id === agentId
                return (
                  <li
                    key={a.id}
                    className={
                      'engine-switcher__agent' +
                      (active ? ' is-active' : '') +
                      (a.available ? '' : ' is-unavailable')
                    }
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={!a.available}
                      data-testid={`engine-switcher-agent-${a.id}`}
                      className="engine-switcher__agent-btn"
                      onClick={() => handleAgentSelect(a)}
                      title={a.available && a.version ? `${a.name} · ${a.version}` : a.name}
                    >
                      <span className="engine-switcher__agent-glyph" aria-hidden>
                        {(a.name.match(/[A-Za-z]/)?.[0] ?? '?').toUpperCase()}
                      </span>
                      <span className="engine-switcher__agent-meta">
                        <span className="engine-switcher__agent-name">{a.name}</span>
                        <span className="engine-switcher__agent-status">
                          {a.available
                            ? a.version
                              ? `${t('agentAvailable')} · ${a.version}`
                              : t('agentAvailable')
                            : t('agentUnavailable')}
                        </span>
                      </span>
                    </button>
                    {!a.available && a.diagnostics && a.diagnostics.length > 0
                      ? a.diagnostics.map((d, i) => (
                          <AgentDiagnosticRow
                            key={`${a.id}-diag-${i}`}
                            diagnostic={d}
                            agentName={a.name}
                            agentBin={a.bin}
                            handlers={{ onRescan }}
                          />
                        ))
                      : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : (
        <p className="engine-switcher__builtin-hint">{t('engineSwitcherBuiltinHint')}</p>
      )}
    </div>
  ) : null

  return (
    <div className="engine-switcher" ref={wrapRef} data-testid="engine-switcher">
      <button
        type="button"
        className="engine-switcher__chip"
        data-testid="engine-switcher-chip"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t('engineSwitcherLabel')}: ${chipPrimary} · ${chipModel}`}
        title={`${t('engineSwitcherLabel')}: ${chipPrimary} · ${chipModel}`}
      >
        <span className="engine-switcher__chip-dot" aria-hidden />
        <span className="engine-switcher__chip-text">
          <span className="engine-switcher__chip-mode">
            {engine === 'builtin' ? t('engineSwitcherBuiltinShort') : t('engineSwitcherCliShort')}
          </span>
          <span className="engine-switcher__chip-sep" aria-hidden>
            ·
          </span>
          <span className="engine-switcher__chip-primary">{chipPrimary}</span>
          <span className="engine-switcher__chip-sep" aria-hidden>
            ·
          </span>
          <span className="engine-switcher__chip-model" data-testid="engine-switcher-chip-model">
            {chipModel}
          </span>
        </span>
        <span className="engine-switcher__chip-chevron" aria-hidden>
          ▾
        </span>
      </button>

      {popoverEl && typeof document !== 'undefined' ? createPortal(popoverEl, document.body) : null}
    </div>
  )
}
