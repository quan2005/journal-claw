import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

type Theme = 'light' | 'dark' | 'system'

function applyTheme(theme: Theme) {
  if (theme === 'system') {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  } else {
    document.documentElement.setAttribute('data-theme', theme)
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('system')

  useEffect(() => {
    invoke<string>('get_workspace_theme')
      .then(saved => {
        const t = (saved as Theme) ?? 'system'
        setThemeState(t)
        applyTheme(t)
      })
      .catch(() => applyTheme('system'))
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
    invoke('set_workspace_theme', { theme: t }).catch(console.error)
  }

  return { theme, setTheme }
}
