/**
 * AuthModeToggle — compact pill + popover for selecting the external CLI
 * agent's authorization mode (read_only / workspace_write / full_access /
 * wide_with_audit).
 *
 * Replaces the former inline `<select>` that lived inside the composer's
 * bordered input box (P2 polish · AC-2). Modeled on open-design's
 * SessionModeToggle trigger pattern (icon + label + chevron → popover menu
 * of menuitemradio items with a check on the active one), but rewritten on
 * journal's design tokens — accent is --record-btn (never --accent, which
 * is danger red), corners via --radius-*, shadow via --shadow-overlay, menu
 * border via --border-menu, focus ring via --focus-ring, and the popover
 * has a small pop-in animation (see auth-mode-toggle.css).
 *
 * Purely controlled: derives state from props, emits intent via onChange.
 * The parent (UnifiedChatShell) decides whether to render it at all — for
 * the built-in pi engine it is not mounted (AC-3).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AuthorizationMode } from '../types/agentRun'
import { AUTHORIZATION_MODES } from '../hooks/useAgentRun'
import { authorizationModeLabel } from './AgentRunPanel'
import { useTranslation } from '../contexts/I18nContext'
import '../styles/auth-mode-toggle.css'

export interface AuthModeToggleProps {
  mode: AuthorizationMode
  onChange: (mode: AuthorizationMode) => void
  disabled?: boolean
}

export function AuthModeToggle({ mode, onChange, disabled = false }: AuthModeToggleProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const closeMenu = useCallback(() => setOpen(false), [])

  // Close on outside pointerdown / Escape so a click elsewhere never leaves
  // the popover stranded open.
  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current) return
      if (rootRef.current.contains(e.target as Node)) return
      closeMenu()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [closeMenu, open])

  const handleSelect = useCallback(
    (next: AuthorizationMode) => {
      if (next !== mode) onChange(next)
      closeMenu()
    },
    [closeMenu, mode, onChange],
  )

  return (
    <div className="auth-mode-toggle" ref={rootRef} data-testid="auth-mode-toggle">
      <button
        type="button"
        className={`auth-mode-toggle__trigger${open ? ' is-open' : ''}`}
        data-testid="auth-mode-toggle-trigger"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t('agentRunAuthLabel')}: ${authorizationModeLabel(mode, t)}`}
        title={`${t('agentRunAuthLabel')}: ${authorizationModeLabel(mode, t)}`}
        onClick={() => {
          if (disabled) return
          setOpen((v) => !v)
        }}
      >
        <span className="auth-mode-toggle__dot" aria-hidden />
        <span className="auth-mode-toggle__label">{authorizationModeLabel(mode, t)}</span>
        <svg
          className="auth-mode-toggle__chevron"
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open ? (
        <div
          className="auth-mode-toggle__popover"
          role="menu"
          data-testid="auth-mode-toggle-popover"
        >
          {AUTHORIZATION_MODES.map((m) => {
            const active = m === mode
            return (
              <button
                key={m}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                data-testid={`auth-mode-toggle-option-${m}`}
                className={`auth-mode-toggle__option${active ? ' is-active' : ''}`}
                onClick={() => handleSelect(m)}
              >
                <span className="auth-mode-toggle__option-label">
                  {authorizationModeLabel(m, t)}
                </span>
                <span className="auth-mode-toggle__check" aria-hidden>
                  {active ? (
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : null}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
