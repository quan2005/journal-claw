import { useState, useCallback, useEffect, useRef } from 'react'
import { listTopicsDir, type TopicEntry } from '../lib/tauri'

const TOPICS_REFRESH_INTERVAL_MS = 3000

interface DirState {
  entries: TopicEntry[]
  expanded: boolean
  loading: boolean
}

export function useTopics() {
  const [dirs, setDirs] = useState<Map<string, DirState>>(new Map())
  const [loading, setLoading] = useState(true)
  const dirsRef = useRef(dirs)

  useEffect(() => {
    dirsRef.current = dirs
  }, [dirs])

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

  const refreshLoadedDirs = useCallback(async () => {
    const current = dirsRef.current
    const paths = current.size > 0 ? [...current.keys()] : ['']

    try {
      const loaded = await Promise.all(
        paths.map(async (path) => [path, await listTopicsDir(path)] as const),
      )

      setDirs((prev) => {
        const next = new Map(prev)
        for (const [path, entries] of loaded) {
          const existing = next.get(path)
          next.set(path, {
            entries,
            expanded: existing?.expanded ?? path === '',
            loading: false,
          })
        }
        return next
      })
    } catch (e) {
      console.error('[useTopics] refresh failed:', e)
    }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshLoadedDirs()
    }, TOPICS_REFRESH_INTERVAL_MS)
    const onFocus = () => {
      void refreshLoadedDirs()
    }

    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [refreshLoadedDirs])

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
