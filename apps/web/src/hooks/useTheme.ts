import { useState, useEffect } from 'react'
import type { Theme } from '../types'
import { selectRuntimeClient } from '../lib/runtimeClient'
import { setHostWindowTheme } from '../lib/hostBridge'

const getWorkspaceTheme = (): Promise<Theme> =>
  selectRuntimeClient().invoke<Theme>('get_workspace_theme')

const setWorkspaceTheme = (theme: Theme): Promise<void> =>
  selectRuntimeClient().invoke<void>('set_workspace_theme', { theme })

function applyTheme(theme: Theme) {
  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme
  document.documentElement.setAttribute('data-theme', resolved)
  // Sync macOS native chrome (traffic light buttons) with the webview theme
  setHostWindowTheme(resolved)
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('system')

  useEffect(() => {
    let cancelled = false
    getWorkspaceTheme()
      .then((saved) => {
        if (cancelled) return
        const valid: Theme[] = ['light', 'dark', 'system']
        const t: Theme = valid.includes(saved as Theme) ? (saved as Theme) : 'system'
        setThemeState(t)
        applyTheme(t)
      })
      .catch(() => {
        if (!cancelled) {
          setThemeState('system')
          applyTheme('system')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  function setTheme(t: Theme) {
    setThemeState(t)
    applyTheme(t)
    setWorkspaceTheme(t).catch(console.error)
  }

  return { theme, setTheme }
}
