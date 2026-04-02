import { useState, useEffect, useCallback } from 'react'
import { listen } from '@tauri-apps/api/event'
import { listIdentities } from '../lib/tauri'
import type { IdentityEntry } from '../types'

export function useIdentity() {
  const [identities, setIdentities] = useState<IdentityEntry[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const result = await listIdentities()
      setIdentities(result)
    } catch (e) {
      console.error('[useIdentity] failed to load identities:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()

    // Refresh when speakers are updated (new speaker registered after recording)
    const unlistenSpeakers = listen('speakers-updated', () => refresh())
    // Refresh when identity files change (merge, delete, create)
    const unlistenIdentity = listen('identity-updated', () => refresh())

    return () => {
      unlistenSpeakers.then(fn => fn())
      unlistenIdentity.then(fn => fn())
    }
  }, [refresh])

  return { identities, loading, refresh }
}
