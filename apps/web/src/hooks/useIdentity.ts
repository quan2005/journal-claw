import { useState, useEffect, useCallback } from 'react'
import { selectRuntimeClient } from '../lib/runtimeClient'
import { useEventSync } from './useEventSync'
import type { IdentityEntry } from '../types'

const listIdentities = (): Promise<IdentityEntry[]> =>
  selectRuntimeClient().invoke<IdentityEntry[]>('list_identities')

export function useIdentity() {
  const [identities, setIdentities] = useState<IdentityEntry[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const result = await listIdentities()
      setIdentities((prev) => (JSON.stringify(prev) === JSON.stringify(result) ? prev : result))
    } catch (e) {
      console.error('[useIdentity] failed to load identities:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Use event sync instead of raw event listeners
  useEventSync(['speakers-updated', 'identity-updated'], () => {
    refresh()
  })

  return { identities, loading, refresh }
}
