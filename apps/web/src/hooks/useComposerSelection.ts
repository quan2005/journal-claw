import { useState, useEffect } from 'react'
import { selectRuntimeClient } from '../lib/runtimeClient'

export type ThinkingLevel = 'low' | 'medium' | 'high'

export interface ComposerSelection {
  providerId: string | null
  modelId: string | null
  thinkingLevel: ThinkingLevel
}

const getComposerSelection = (): Promise<ComposerSelection> =>
  selectRuntimeClient().invoke<ComposerSelection>('get_composer_selection')

const setComposerSelectionRemote = (selection: ComposerSelection): Promise<void> =>
  selectRuntimeClient().invoke<void>('set_composer_selection', {
    providerId: selection.providerId,
    modelId: selection.modelId,
    thinkingLevel: selection.thinkingLevel,
  })

export function useComposerSelection() {
  const [providerId, setProviderIdState] = useState<string | null>(null)
  const [modelId, setModelIdState] = useState<string | null>(null)
  const [thinkingLevel, setThinkingLevelState] = useState<ThinkingLevel>('medium')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getComposerSelection()
      .then((saved) => {
        if (cancelled) return
        setProviderIdState(saved.providerId ?? null)
        setModelIdState(saved.modelId ?? null)
        setThinkingLevelState(saved.thinkingLevel ?? 'medium')
      })
      .catch(() => {
        if (!cancelled) {
          setProviderIdState(null)
          setModelIdState(null)
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

  /** Switch the active credential + model together. Provider and model ids are
   * always written in the same request so a switch can never leave a stale
   * model paired with a new provider. */
  function setSelection(provider: string, model: string) {
    setProviderIdState(provider)
    setModelIdState(model)
    setComposerSelectionRemote({
      providerId: provider,
      modelId: model,
      thinkingLevel,
    }).catch(console.error)
  }

  function setThinkingLevel(next: ThinkingLevel) {
    setThinkingLevelState(next)
    setComposerSelectionRemote({ providerId, modelId, thinkingLevel: next }).catch(console.error)
  }

  return { providerId, modelId, thinkingLevel, setSelection, setThinkingLevel, loading }
}
