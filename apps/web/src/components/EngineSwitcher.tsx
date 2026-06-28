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
import { useCallback, useEffect, useRef, useState } from 'react'
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
  const wrapRef = useRef<HTMLDivElement | null>(null)

  // Close on outside click / Escape — same defensive pattern as open-design's
  // switcher so a click on a diagnostic fix button (rendered in-portal later)
  // never gets yanked away mid-interaction.
  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (!wrapRef.current) return
      if (wrapRef.current.contains(e.target as Node)) return
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

      {open ? (
        <div className="engine-switcher__popover" role="menu" data-testid="engine-switcher-popover">
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
      ) : null}
    </div>
  )
}
