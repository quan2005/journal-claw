import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { selectRuntimeClient } from '../lib/runtimeClient'
import { useEventSync } from './useEventSync'
import type { JournalEntry, ProcessingUpdate, QueueItem, AiLogLine } from '../types'
import type { WorkItem } from '../lib/apiTypes'

const listAvailableMonths = (): Promise<string[]> =>
  selectRuntimeClient().invoke<string[]>('list_available_months')

const listJournalEntriesByMonths = (months: string[]): Promise<JournalEntry[]> =>
  selectRuntimeClient().invoke<JournalEntry[]>('list_journal_entries_by_months', { months })

const listWorkQueue = (): Promise<WorkItem[]> =>
  selectRuntimeClient().invoke<WorkItem[]>('list_work_queue')

const invokeEnqueueWork = (params: {
  text?: string
  files?: string[]
  prompt?: string
  displayName: string
}): Promise<WorkItem> =>
  selectRuntimeClient().invoke<WorkItem>('enqueue_work', {
    text: params.text ?? null,
    files: params.files ?? null,
    prompt: params.prompt ?? null,
    displayName: params.displayName,
  })

const invokeDismissWork = (id: string): Promise<void> =>
  selectRuntimeClient().invoke<void>('dismiss_work_item', { id })

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

function entryMtime(entry: JournalEntry): number {
  return entry.mtime_ms ?? entry.mtime_secs
}

function sameStringList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function sameEntryMetadata(a: JournalEntry, b: JournalEntry): boolean {
  return (
    a.path === b.path &&
    entryMtime(a) === entryMtime(b) &&
    a.title === b.title &&
    a.summary === b.summary &&
    a.filename === b.filename &&
    JSON.stringify(a.tags) === JSON.stringify(b.tags) &&
    JSON.stringify(a.sources) === JSON.stringify(b.sources)
  )
}

function reconcileLoadedMonths(allMonths: string[], currentLoaded: string[]): string[] {
  const keepLoaded = currentLoaded.filter((month) => allMonths.includes(month))
  const neededRecent = allMonths.slice(0, BATCH_SIZE)
  const merged = new Set([...neededRecent, ...keepLoaded])
  return allMonths.filter((month) => merged.has(month))
}

export function useJournal() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [loadedMonths, setLoadedMonths] = useState<string[]>([])
  const [loadingMore, setLoadingMore] = useState(false)

  // Local-only queue items: audio conversion state before work queue handoff
  const [localItems, setLocalItems] = useState<QueueItem[]>([])
  // Rust-managed work queue items
  const [workItems, setWorkItems] = useState<QueueItem[]>([])

  const removalTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const refreshing = useRef(false)
  const availableMonthsRef = useRef<string[]>([])
  const loadedMonthsRef = useRef<string[]>([])

  // Merged queue for display — memoized so consumers don't re-render on unrelated state changes (AC-12)
  const queueItems = useMemo(() => [...localItems, ...workItems], [localItems, workItems])

  const refresh = useCallback(async () => {
    if (refreshing.current) return
    refreshing.current = true
    try {
      const allMonths = await withTimeout(listAvailableMonths(), 5000, 'listAvailableMonths')
      availableMonthsRef.current = allMonths
      setAvailableMonths((prev) => (sameStringList(prev, allMonths) ? prev : allMonths))

      const currentLoaded = loadedMonthsRef.current
      if (currentLoaded.length === 0) {
        const initial = allMonths.slice(0, BATCH_SIZE)
        // AC-25: single batched IPC instead of per-month serial awaits
        const results = initial.length
          ? await withTimeout(listJournalEntriesByMonths(initial), 8000, 'listEntries(initial)')
          : []
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
        const nextLoaded = reconcileLoadedMonths(allMonths, currentLoaded)
        if (
          nextLoaded.length !== currentLoaded.length ||
          nextLoaded.some((m, i) => m !== currentLoaded[i])
        ) {
          loadedMonthsRef.current = nextLoaded
          setLoadedMonths(nextLoaded)
        }

        // AC-25: single batched IPC for all loaded months
        const results = nextLoaded.length
          ? await withTimeout(listJournalEntriesByMonths(nextLoaded), 8000, 'listEntries(loaded)')
          : []
        results.sort(
          (a, b) =>
            b.year_month.localeCompare(a.year_month) ||
            b.day - a.day ||
            b.created_at_secs - a.created_at_secs,
        )
        setEntries((prev) => {
          if (prev.length !== results.length) return results
          for (let i = 0; i < prev.length; i++) {
            if (!sameEntryMetadata(prev[i], results[i])) return results
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

  // ── Local item helpers (audio conversion only) ──────────

  const dismissQueueItem = useCallback((id: string) => {
    // Try local first
    setLocalItems((prev) => {
      const found = prev.find((i) => i.id === id)
      if (found) return prev.filter((i) => i.id !== id)
      return prev
    })
    // Try Rust work queue
    invokeDismissWork(id).catch(console.error)
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

  // Event-driven journal refresh (replaces polling)
  useEventSync(['journal-updated', 'work-queue-updated'], () => {
    refresh()
    refreshWorkQueue()
  })

  useEffect(() => {
    refresh()
    refreshWorkQueue()
    const client = selectRuntimeClient()

    // Work queue updates from Rust — also refresh journal entries (may have changed)
    const unlistenWorkQueue = client.subscribe('work-queue-updated', () => {
      refreshWorkQueue()
      refresh()
    })

    // Audio pipeline events (local items)
    const unlistenProcessing = client.subscribe<ProcessingUpdate>('ai-processing', (payload) => {
      const { material_path, status, error, structured_error } = payload
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
          prev.map((i) =>
            i.path === material_path ? { ...i, status: 'failed', error, structured_error } : i,
          ),
        )
      }
    })

    const unlistenLog = client.subscribe<AiLogLine>('ai-log', (payload) => {
      const { material_path, message } = payload
      setLocalItems((prev) =>
        prev.map((i) =>
          i.path === material_path ? { ...i, logs: [...(i.logs ?? []), message] } : i,
        ),
      )
    })

    const unlistenAudioReady = client.subscribe<{
      source_path: string
      material_path: string
      filename: string
    }>('audio-ai-material-ready', (payload) => {
      const { source_path, material_path, filename } = payload
      invokeEnqueueWork({
        files: [material_path],
        prompt: '请根据这份素材，生成日志条目。',
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

    const unlistenAudioFailed = client.subscribe<{
      source_path: string
      filename: string
      error: string
    }>('audio-ai-material-failed', (payload) => {
      const { source_path, filename, error } = payload
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
    })

    const unlistenPipelineFailed = client.subscribe<{
      filename: string
      stage: string
      error: string
    }>('audio-pipeline-failed', (payload) => {
      const { filename, error } = payload
      setLocalItems((prev) => {
        const match = prev.find((i) => i.filename === filename)
        if (match) {
          return prev.map((i) =>
            i.filename === filename ? { ...i, status: 'failed' as const, error } : i,
          )
        }
        return [
          {
            id: filename,
            path: filename,
            filename,
            status: 'failed' as const,
            error,
            addedAt: Date.now(),
            logs: [],
          },
          ...prev,
        ]
      })
    })

    const unlistenTranscriptionProgress = client.subscribe<{
      filename: string
      status: string
      message?: string
    }>('transcription-progress', (payload) => {
      const { filename, status, message } = payload
      if (status === 'failed') {
        setLocalItems((prev) =>
          prev.map((i) =>
            i.filename === filename
              ? { ...i, status: 'failed' as const, error: message ?? '处理失败' }
              : i,
          ),
        )
      } else if (message) {
        setLocalItems((prev) =>
          prev.map((i) =>
            i.filename === filename ? { ...i, logs: [...(i.logs ?? []), message] } : i,
          ),
        )
      }
    })

    const timers = removalTimers.current

    return () => {
      refreshing.current = false
      unlistenWorkQueue()
      unlistenProcessing()
      unlistenLog()
      unlistenAudioReady()
      unlistenAudioFailed()
      unlistenPipelineFailed()
      unlistenTranscriptionProgress()
      timers.forEach((t) => clearTimeout(t))
      timers.clear()
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

  const isProcessing = useMemo(
    () => queueItems.some((i) => i.status === 'processing' || i.status === 'queued'),
    [queueItems],
  )

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
