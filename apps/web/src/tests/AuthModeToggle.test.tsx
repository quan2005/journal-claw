import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders as render } from './setup'
import { AuthModeToggle } from '../components/AuthModeToggle'
import type { AuthorizationMode } from '../types/agentRun'

function makeToggle(
  overrides: {
    mode?: AuthorizationMode
    onChange?: (mode: AuthorizationMode) => void
    disabled?: boolean
  } = {},
) {
  const onChange = overrides.onChange ?? vi.fn()
  render(
    <AuthModeToggle
      mode={overrides.mode ?? 'workspace_write'}
      onChange={onChange}
      disabled={overrides.disabled}
    />,
  )
  return { onChange }
}

describe('AuthModeToggle (P2 polish · AC-2)', () => {
  it('renders a compact pill trigger with the current mode label', () => {
    makeToggle({ mode: 'workspace_write' })
    const trigger = screen.getByTestId('auth-mode-toggle-trigger')
    expect(trigger).toBeTruthy()
    // Trigger shows the current mode label (zh is the default in tests).
    expect(trigger.textContent).toContain('工作区可写')
    // No native <select> — the pill is a real button, not a select wrapper.
    expect(document.querySelector('select')).toBeNull()
    // Popover is closed initially.
    expect(screen.queryByTestId('auth-mode-toggle-popover')).toBeNull()
  })

  it('opens the popover on trigger click and lists all 4 authorization modes', () => {
    makeToggle({ mode: 'workspace_write' })
    fireEvent.click(screen.getByTestId('auth-mode-toggle-trigger'))
    const popover = screen.getByTestId('auth-mode-toggle-popover')
    expect(popover).toBeTruthy()

    // Every mode from AUTHORIZATION_MODES is rendered as a menuitemradio.
    const modes: AuthorizationMode[] = [
      'read_only',
      'workspace_write',
      'full_access',
      'wide_with_audit',
    ]
    for (const m of modes) {
      const opt = screen.getByTestId(`auth-mode-toggle-option-${m}`)
      expect(opt).toBeTruthy()
      expect(opt.getAttribute('role')).toBe('menuitemradio')
    }
  })

  it('marks the active mode with aria-checked and a check icon', () => {
    makeToggle({ mode: 'full_access' })
    fireEvent.click(screen.getByTestId('auth-mode-toggle-trigger'))

    const active = screen.getByTestId('auth-mode-toggle-option-full_access')
    expect(active.getAttribute('aria-checked')).toBe('true')
    expect(active.className).toContain('is-active')
    // Other modes are not checked.
    const inactive = screen.getByTestId('auth-mode-toggle-option-read_only')
    expect(inactive.getAttribute('aria-checked')).toBe('false')
    expect(inactive.className).not.toContain('is-active')
  })

  it('emits onChange with the selected mode and closes the popover', () => {
    const onChange = vi.fn()
    makeToggle({ mode: 'workspace_write', onChange })
    fireEvent.click(screen.getByTestId('auth-mode-toggle-trigger'))
    fireEvent.click(screen.getByTestId('auth-mode-toggle-option-wide_with_audit'))
    expect(onChange).toHaveBeenCalledWith('wide_with_audit')
    // Popover closed after selection.
    expect(screen.queryByTestId('auth-mode-toggle-popover')).toBeNull()
  })

  it('does not emit onChange when re-selecting the already-active mode', () => {
    const onChange = vi.fn()
    makeToggle({ mode: 'workspace_write', onChange })
    fireEvent.click(screen.getByTestId('auth-mode-toggle-trigger'))
    fireEvent.click(screen.getByTestId('auth-mode-toggle-option-workspace_write'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('closes the popover on Escape', () => {
    makeToggle({ mode: 'workspace_write' })
    fireEvent.click(screen.getByTestId('auth-mode-toggle-trigger'))
    expect(screen.getByTestId('auth-mode-toggle-popover')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('auth-mode-toggle-popover')).toBeNull()
  })

  it('closes the popover on outside pointerdown', () => {
    makeToggle({ mode: 'workspace_write' })
    fireEvent.click(screen.getByTestId('auth-mode-toggle-trigger'))
    expect(screen.getByTestId('auth-mode-toggle-popover')).toBeTruthy()
    // Simulate a pointerdown somewhere outside the toggle root.
    fireEvent.pointerDown(document.body)
    expect(screen.queryByTestId('auth-mode-toggle-popover')).toBeNull()
  })
})
