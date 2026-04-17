import { useState, useEffect, useCallback, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import {
  listAvailableMonths,
  listJournalEntriesByMonths,
  listWorkQueue,
  enqueueWork as invokeEnqueueWork,
  dismissWorkItem as invokeDismissWork,
} from '../lib/tauri'
import type { JournalEntry, ProcessingUpdate, QueueItem, AiLogLine } from '../types'
import type { WorkItem } from '../lib/tauri'

export const RECORDING_PLACEHOLDER = '__recording__'

const BATCH_SIZE = 3

/** Wrap a promise with a timeout — rejects if not settled within `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    promise.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

/** Convert a Rust WorkItem to a frontend QueueItem for display. */
function workItemToQueueItem(w: WorkItem): QueueItem {
  const filename = w.display_name || w.files?.[0]?.split('/').pop() || w.text?.slice(0, 30) || '...'
  return {
    id: w.id,
    path: w.files?.[0] ?? `text://${w.id}`,
    filename,
    status: w.status,
    error: w.error ?? undefined,
    addedAt: w.created_at * 1000,
    logs: [],
    sessionId: w.session_id ?? undefined,
  }
}

export function useJournal() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [loadedMonths, setLoadedMonths] = useState<string[]>([])
  const [loadingMore, setLoadingMore] = useState(false)

  // Local-only queue items: recording + converting (pre-work-queue states)
  const [localItems, setLocalItems] = useState<QueueItem[]>([])
  // Rust-managed work queue items
  const [workItems, setWorkItems] = useState<QueueItem[]>([])

  const removalTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const refreshing = useRef(false)
  const availableMonthsRef = useRef<string[]>([])
  const loadedMonthsRef = useRef<string[]>([])

  // Merged queue for display
  const queueItems = [...localItems, ...workItems]

  const refresh = useCallback(async () => {
    if (refreshing.current) return
    refreshing.current = true
    try {
      const allMonths = await withTimeout(listAvailableMonths(), 5000, 'listAvailableMonths')
      availableMonthsRef.current = allMonths
      setAvailableMonths(allMonths)

      const currentLoaded = loadedMonthsRef.current
      if (currentLoaded.length === 0) {
        const initial = allMonths.slice(0, BATCH_SIZE)
        const results: JournalEntry[] = []
        for (const m of initial) {
          const batch = await withTimeout(
            listJournalEntriesByMonths([m]),
            8000,
            `listEntries(${m})`,
          )
          results.push(...batch)
        }
        if (initial.length > 0) {
          loadedMonthsRef.current = initial
          setLoadedMonths(initial)
          results.sort(
            (a, b) =>
              b.year_month.localeCompare(a.year_month) ||
              b.day - a.day ||
              b.created_at_secs - a.created_at_secs,
          )
          setEntries(results)
        }
      } else {
        const results: JournalEntry[] = []
        for (const m of currentLoaded) {
          const batch = await withTimeout(
            listJournalEntriesByMonths([m]),
            8000,
            `listEntries(${m})`,
          )
          results.push(...batch)
        }
        results.sort(
          (a, b) =>
            b.year_month.localeCompare(a.year_month) ||
            b.day - a.day ||
            b.created_at_secs - a.created_at_secs,
        )
        setEntries((prev) => {
          if (prev.length !== results.length) return results
          for (let i = 0; i < prev.length; i++) {
            if (prev[i].path !== results[i].path || prev[i].mtime_secs !== results[i].mtime_secs)
              return results
          }
          return prev
        })
      }
    } catch (e) {
      console.error('Failed to load journal entries:', e)
    } finally {
      setLoading(false)
      refreshing.current = false
    }
  }, [])

  const loadMore = useCallback(async () => {
    const currentLoaded = loadedMonthsRef.current
    const allMonths = availableMonthsRef.current
    const remaining = allMonths.filter((m) => !currentLoaded.includes(m))
    if (remaining.length === 0) return

    const nextBatch = remaining.slice(0, BATCH_SIZE)
    setLoadingMore(true)
    try {
      const result = await listJournalEntriesByMonths(nextBatch)
      const newLoaded = [...currentLoaded, ...nextBatch]
      loadedMonthsRef.current = newLoaded
      setLoadedMonths(newLoaded)
      setEntries((prev) => {
        const combined = [...prev, ...result]
        combined.sort(
          (a, b) =>
            b.year_month.localeCompare(a.year_month) ||
            b.day - a.day ||
            b.created_at_secs - a.created_at_secs,
        )
        return combined
      })
    } catch (e) {
      console.error('Failed to load more entries:', e)
    } finally {
      setLoadingMore(false)
    }
  }, [])

  // ── Local item helpers (recording / converting only) ───

  const dismissQueueItem = useCallback((id: string) => {
    // Try local first
    setLocalItems((prev) => {
      const found = prev.find((i) => i.id === id)
      if (found) return prev.filter((i) => i.id !== id)
      return prev
    })
    // Try Rust work queue
    invokeDismissWork(id).catch(() => {})
  }, [])

  const addConvertingItem = useCallback((placeholderPath: string, filename: string) => {
    setLocalItems((prev) => {
      if (prev.some((i) => i.path === placeholderPath)) return prev
      return [
        {
          id: placeholderPath,
          path: placeholderPath,
          filename,
          status: 'converting' as const,
          addedAt: Date.now(),
          logs: [],
        },
        ...prev,
      ]
    })
  }, [])

  const addQueuedItem = useCallback((_path: string, _filename: string) => {
    // No-op: work queue items are now managed by Rust
    // Kept for API compatibility during transition
  }, [])

  const markItemFailed = useCallback((path: string, error: string) => {
    setLocalItems((prev) =>
      prev.map((i) => (i.path === path ? { ...i, status: 'failed' as const, error } : i)),
    )
  }, [])

  // ── Refresh work queue from Rust ───────────────────────

  const refreshWorkQueue = useCallback(async () => {
    try {
      const items = await listWorkQueue()
      setWorkItems(items.map(workItemToQueueItem))
    } catch (e) {
      console.error('[work-queue] refresh failed:', e)
    }
  }, [])

  // ── Event listeners ────────────────────────────────────

  useEffect(() => {
    refresh()
    refreshWorkQueue()

    const pollInterval = setInterval(refresh, 3000)

    // Work queue updates from Rust
    const unlistenWorkQueue = listen('work-queue-updated', () => {
      refreshWorkQueue()
      refresh() // journal entries may have changed too
    })

    // Audio pipeline events (local items)
    const unlistenProcessing = listen<ProcessingUpdate>('ai-processing', (event) => {
      const { material_path, status, error } = event.payload
      console.log('[ai-processing]', status, material_path, error ?? '')

      if (status === 'queued') {
        setLocalItems((prev) => {
          if (prev.some((i) => i.path === material_path)) return prev
          const filename = material_path.split('/').pop() ?? material_path
          return [
            ...prev,
            {
              id: material_path,
              path: material_path,
              filename,
              status: 'queued',
              addedAt: Date.now(),
              logs: [],
            },
          ]
        })
      } else if (status === 'processing') {
        setLocalItems((prev) => {
          const filename = material_path.split('/').pop() ?? material_path
          const hasPlaceholder = prev.some((i) => i.path === RECORDING_PLACEHOLDER)
          if (hasPlaceholder) {
            return prev.map((i) =>
              i.path === RECORDING_PLACEHOLDER
                ? {
                    ...i,
                    id: material_path,
                    path: material_path,
                    filename,
                    status: 'processing' as const,
                  }
                : i,
            )
          }
          if (prev.some((i) => i.path === material_path)) {
            return prev.map((i) =>
              i.path === material_path ? { ...i, status: 'processing' as const } : i,
            )
          }
          return [
            {
              id: material_path,
              path: material_path,
              filename,
              status: 'processing' as const,
              addedAt: Date.now(),
              logs: [],
            },
            ...prev,
          ]
        })
      } else if (status === 'completed') {
        setLocalItems((prev) =>
          prev.map((i) => (i.path === material_path ? { ...i, status: 'completed' } : i)),
        )
        const timer = setTimeout(() => {
          removalTimers.current.delete(material_path)
          setLocalItems((prev) => prev.filter((i) => i.path !== material_path))
        }, 1000)
        removalTimers.current.set(material_path, timer)
      } else if (status === 'failed') {
        setLocalItems((prev) =>
          prev.map((i) => (i.path === material_path ? { ...i, status: 'failed', error } : i)),
        )
      }
    })

    const unlistenLog = listen<AiLogLine>('ai-log', (event) => {
      const { material_path, message } = event.payload
      setLocalItems((prev) =>
        prev.map((i) =>
          i.path === material_path ? { ...i, logs: [...(i.logs ?? []), message] } : i,
        ),
      )
    })

    const unlistenUpdated = listen<string>('journal-updated', () => {
      refresh()
    })

    const unlistenProcessed = listen<{ filename: string; path: string }>(
      'recording-processed',
      (event) => {
        const { filename, path } = event.payload
        setLocalItems((prev) => {
          const hasPlaceholder = prev.some((i) => i.path === RECORDING_PLACEHOLDER)
          if (!hasPlaceholder) return prev
          return prev.map((i) =>
            i.path === RECORDING_PLACEHOLDER
              ? { ...i, id: path, path, filename, status: 'converting' as const }
              : i,
          )
        })
        refresh()
      },
    )

    const unlistenAudioReady = listen<{
      source_path: string
      material_path: string
      filename: string
    }>('audio-ai-material-ready', (event) => {
      const { source_path, material_path, filename } = event.payload
      invokeEnqueueWork({
        files: [material_path],
        prompt: '请根据这份音频转写材料，生成日志条目。',
        displayName: filename,
      })
        .then(() => {
          setLocalItems((prev) =>
            prev.filter((i) => i.path !== source_path && i.path !== material_path),
          )
        })
        .catch((err) => {
          console.error('[audio-enqueue]', err)
          setLocalItems((prev) =>
            prev.map((i) =>
              i.path === source_path || i.path === material_path
                ? { ...i, status: 'failed' as const, error: String(err) }
                : i,
            ),
          )
        })
    })

    const unlistenDiscarded = listen<string>('recording-discarded', () => {
      setLocalItems((prev) => prev.filter((i) => i.path !== RECORDING_PLACEHOLDER))
    })

    const unlistenAudioFailed = listen<{ source_path: string; filename: string; error: string }>(
      'audio-ai-material-failed',
      (event) => {
        const { source_path, filename, error } = event.payload
        setLocalItems((prev) => {
          if (prev.some((i) => i.path === source_path)) {
            return prev.map((i) =>
              i.path === source_path ? { ...i, filename, status: 'failed' as const, error } : i,
            )
          }
          return [
            {
              id: source_path,
              path: source_path,
              filename,
              status: 'failed' as const,
              error,
              addedAt: Date.now(),
              logs: [],
            },
            ...prev,
          ]
        })
      },
    )

    return () => {
      clearInterval(pollInterval)
      refreshing.current = false
      unlistenWorkQueue.then((fn) => fn())
      unlistenProcessing.then((fn) => fn())
      unlistenLog.then((fn) => fn())
      unlistenUpdated.then((fn) => fn())
      unlistenProcessed.then((fn) => fn())
      unlistenAudioReady.then((fn) => fn())
      unlistenDiscarded.then((fn) => fn())
      unlistenAudioFailed.then((fn) => fn())
      removalTimers.current.forEach((t) => clearTimeout(t))
      removalTimers.current.clear()
    }
  }, [refresh, refreshWorkQueue])

  const retryQueueItem = useCallback((path: string, status: 'queued' | 'converting' = 'queued') => {
    setLocalItems((prev) =>
      prev.map((i) => (i.path === path ? { ...i, status, error: undefined, logs: [] } : i)),
    )
  }, [])

  const setQueueSessionId = useCallback((_path: string, _sessionId: string) => {
    // No-op: session IDs are now managed by Rust work queue
  }, [])

  const isProcessing = queueItems.some((i) => i.status === 'processing' || i.status === 'queued')

  const hasMore = loadedMonths.length < availableMonths.length

  return {
    entries,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    queueItems,
    isProcessing,
    dismissQueueItem,
    addConvertingItem,
    addQueuedItem,
    markItemFailed,
    retryQueueItem,
    setQueueSessionId,
    refresh,
  }
}
