import { useState, useCallback, useEffect, useRef } from 'react'
import { selectRuntimeClient } from '../lib/runtimeClient'
import type { TopicEntry } from '../lib/apiTypes'

const listTopicsDir = (relativePath: string): Promise<TopicEntry[]> =>
  selectRuntimeClient().invoke<TopicEntry[]>('list_topics_dir', { relativePath })

const TOPICS_REFRESH_DEBOUNCE_MS = 250
const TOPIC_EXPANDED_DIRS_STORAGE_KEY = 'journal_topics_expanded_dirs_v1'

interface DirState {
  entries: TopicEntry[]
  expanded: boolean
  loading: boolean
}

function loadExpandedTopicDirs(): string[] {
  try {
    // eslint-disable-next-line no-restricted-syntax -- ARCH.md 白名单：topics 树展开态（纯 UI 折叠状态），非业务数据
    const raw = localStorage.getItem(TOPIC_EXPANDED_DIRS_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.filter((path): path is string => typeof path === 'string' && path.length > 0)
  } catch {
    return []
  }
}

function saveExpandedTopicDirs(dirs: Map<string, DirState>) {
  try {
    const expanded = [...dirs.entries()]
      .filter(([path, state]) => path.length > 0 && state.expanded)
      .map(([path]) => path)
      .sort()
    // eslint-disable-next-line no-restricted-syntax -- ARCH.md 白名单：topics 树展开态（纯 UI 折叠状态），非业务数据
    localStorage.setItem(TOPIC_EXPANDED_DIRS_STORAGE_KEY, JSON.stringify(expanded))
  } catch {
    /* quota exceeded — ignore */
  }
}

function topicEntriesEqual(a: TopicEntry[], b: TopicEntry[]): boolean {
  if (a.length !== b.length) return false
  return a.every((entry, index) => {
    const other = b[index]
    return (
      other !== undefined &&
      entry.name === other.name &&
      entry.path === other.path &&
      entry.is_dir === other.is_dir &&
      entry.created_secs === other.created_secs &&
      entry.mtime_secs === other.mtime_secs
    )
  })
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
      const next = new Map<string, DirState>([['', { entries, expanded: true, loading: false }]])
      const expandedDirs = loadExpandedTopicDirs()
      const loadedDirs = await Promise.all(
        expandedDirs.map(async (path) => {
          try {
            return [path, await listTopicsDir(path)] as const
          } catch (e) {
            console.error('[useTopics] restore expanded dir failed:', e)
            return null
          }
        }),
      )

      for (const loaded of loadedDirs) {
        if (!loaded) continue
        const [path, childEntries] = loaded
        next.set(path, { entries: childEntries, expanded: true, loading: false })
      }

      setDirs(next)
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

      const latest = dirsRef.current
      let next: Map<string, DirState> | null = null
      for (const [path, entries] of loaded) {
        const existing = latest.get(path)
        const nextState = {
          entries,
          expanded: existing?.expanded ?? path === '',
          loading: false,
        }
        if (
          existing &&
          existing.expanded === nextState.expanded &&
          existing.loading === nextState.loading &&
          topicEntriesEqual(existing.entries, nextState.entries)
        ) {
          continue
        }
        if (!next) {
          next = new Map(latest)
        }
        next.set(path, nextState)
      }

      if (next) {
        setDirs(next)
      }
    } catch (e) {
      console.error('[useTopics] refresh failed:', e)
    }
  }, [])

  useEffect(() => {
    let refreshTimer: number | undefined

    const scheduleRefresh = () => {
      if (refreshTimer !== undefined) {
        window.clearTimeout(refreshTimer)
      }
      refreshTimer = window.setTimeout(() => {
        refreshTimer = undefined
        void refreshLoadedDirs()
      }, TOPICS_REFRESH_DEBOUNCE_MS)
    }

    const unlisten = selectRuntimeClient().subscribe('topics-updated', scheduleRefresh)

    return () => {
      if (refreshTimer !== undefined) {
        window.clearTimeout(refreshTimer)
      }
      unlisten()
    }
  }, [refreshLoadedDirs])

  const toggleDir = useCallback(
    async (path: string) => {
      const current = dirs.get(path)
      if (current) {
        // Already loaded — just toggle expansion
        setDirs((prev) => {
          const next = new Map(prev)
          const existing = prev.get(path) ?? current
          next.set(path, { ...existing, expanded: !existing.expanded })
          saveExpandedTopicDirs(next)
          return next
        })
      } else {
        // Not loaded yet — fetch and expand
        setDirs((prev) => {
          const next = new Map(prev)
          next.set(path, { entries: [], expanded: true, loading: true })
          saveExpandedTopicDirs(next)
          return next
        })
        try {
          const entries = await listTopicsDir(path)
          setDirs((prev) => {
            const next = new Map(prev)
            next.set(path, { entries, expanded: true, loading: false })
            saveExpandedTopicDirs(next)
            return next
          })
        } catch (e) {
          console.error('[useTopics] toggleDir failed:', e)
          setDirs((prev) => {
            const next = new Map(prev)
            next.set(path, { entries: [], expanded: false, loading: false })
            saveExpandedTopicDirs(next)
            return next
          })
        }
      }
    },
    [dirs],
  )

  return { dirs, loading, load, toggleDir }
}
