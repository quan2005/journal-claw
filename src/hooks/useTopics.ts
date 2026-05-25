import { useState, useCallback } from 'react'
import { listTopicsDir, type TopicEntry } from '../lib/tauri'

interface DirState {
  entries: TopicEntry[]
  expanded: boolean
  loading: boolean
}

export function useTopics() {
  const [dirs, setDirs] = useState<Map<string, DirState>>(new Map())
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const entries = await listTopicsDir('')
      setDirs(new Map([['', { entries, expanded: true, loading: false }]]))
    } catch (e) {
      console.error('[useTopics] load failed:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  const toggleDir = useCallback(async (path: string) => {
    const current = dirs.get(path)
    if (current) {
      // Already loaded — just toggle expansion
      setDirs(prev => {
        const next = new Map(prev)
        next.set(path, { ...current, expanded: !current.expanded })
        return next
      })
    } else {
      // Not loaded yet — fetch and expand
      setDirs(prev => {
        const next = new Map(prev)
        next.set(path, { entries: [], expanded: true, loading: true })
        return next
      })
      try {
        const entries = await listTopicsDir(path)
        setDirs(prev => {
          const next = new Map(prev)
          next.set(path, { entries, expanded: true, loading: false })
          return next
        })
      } catch (e) {
        console.error('[useTopics] toggleDir failed:', e)
        setDirs(prev => {
          const next = new Map(prev)
          next.set(path, { entries: [], expanded: false, loading: false })
          return next
        })
      }
    }
  }, [dirs])

  return { dirs, loading, load, toggleDir }
}
