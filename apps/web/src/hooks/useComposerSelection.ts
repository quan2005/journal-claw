import { useState, useEffect } from 'react'
import { selectRuntimeClient } from '../lib/runtimeClient'

export type ThinkingLevel = 'low' | 'medium' | 'high'

export interface ComposerSelection {
  providerId: string | null
  thinkingLevel: ThinkingLevel
}

const getComposerSelection = (): Promise<ComposerSelection> =>
  selectRuntimeClient().invoke<ComposerSelection>('get_composer_selection')

const setComposerSelectionRemote = (selection: ComposerSelection): Promise<void> =>
  selectRuntimeClient().invoke<void>('set_composer_selection', {
    providerId: selection.providerId,
    thinkingLevel: selection.thinkingLevel,
  })

export function useComposerSelection() {
  const [providerId, setProviderIdState] = useState<string | null>(null)
  const [thinkingLevel, setThinkingLevelState] = useState<ThinkingLevel>('medium')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getComposerSelection()
      .then((saved) => {
        if (cancelled) return
        setProviderIdState(saved.providerId ?? null)
        setThinkingLevelState(saved.thinkingLevel ?? 'medium')
      })
      .catch(() => {
        if (!cancelled) {
          setProviderIdState(null)
          setThinkingLevelState('medium')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function setProviderId(next: string) {
    setProviderIdState(next)
    setComposerSelectionRemote({ providerId: next, thinkingLevel }).catch(console.error)
  }

  function setThinkingLevel(next: ThinkingLevel) {
    setThinkingLevelState(next)
    setComposerSelectionRemote({ providerId, thinkingLevel: next }).catch(console.error)
  }

  return { providerId, thinkingLevel, setProviderId, setThinkingLevel, loading }
}
