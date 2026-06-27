import { useState, useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type { Theme } from '../types'
import { getWorkspaceTheme, setWorkspaceTheme } from '../lib/tauri'

function applyTheme(theme: Theme) {
  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme
  document.documentElement.setAttribute('data-theme', resolved)
  // Sync macOS native chrome (traffic light buttons) with the webview theme
  getCurrentWindow().setTheme(resolved).catch(console.error)
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
