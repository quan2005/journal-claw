import { useState, useEffect, useCallback, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import { listAllJournalEntries } from '../lib/tauri'
import type { JournalEntry, ProcessingUpdate, QueueItem, AiLogLine } from '../types'

export const RECORDING_PLACEHOLDER = '__recording__'

export function useJournal() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [queueItems, setQueueItems] = useState<QueueItem[]>([])
  const removalTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const refreshing = useRef(false)

  const refresh = useCallback(async () => {
    if (refreshing.current) return
    refreshing.current = true
    try {
      const result = await listAllJournalEntries()
      setEntries(result)
    } catch (e) {
      console.error('Failed to load journal entries:', e)
    } finally {
      setLoading(false)
      refreshing.current = false
    }
  }, [])

  const dismissQueueItem = useCallback((path: string) => {
    const timer = removalTimers.current.get(path)
    if (timer) clearTimeout(timer)
    removalTimers.current.delete(path)
    setQueueItems(prev => prev.filter(i => i.path !== path))
  }, [])

  const addConvertingItem = useCallback((placeholderPath: string, filename: string) => {
    setQueueItems(prev => {
      if (prev.some(i => i.path === placeholderPath)) return prev
      return [{ path: placeholderPath, filename, status: 'converting' as const, addedAt: Date.now(), logs: [] }, ...prev]
    })
  }, [])

  const addQueuedItem = useCallback((path: string, filename: string) => {
    setQueueItems(prev => {
      if (prev.some(i => i.path === path)) return prev
      return [{ path, filename, status: 'queued' as const, addedAt: Date.now(), logs: [] }, ...prev]
    })
  }, [])

  const markItemFailed = useCallback((path: string, error: string) => {
    setQueueItems(prev => {
      if (prev.some(i => i.path === path)) {
        return prev.map(i => i.path === path ? { ...i, status: 'failed' as const, error } : i)
      }
      return prev
    })
  }, [])

  useEffect(() => {
    refresh()

    // Tauri watch events are not exhaustive; poll as safety net for manually-added files
    const pollInterval = setInterval(refresh, 3000)

    const unlistenProcessing = listen<ProcessingUpdate>('ai-processing', (event) => {
      const { material_path, status, error } = event.payload
      console.log('[ai-processing]', status, material_path, error ?? '')

      if (status === 'queued') {
        setQueueItems(prev => {
          if (prev.some(i => i.path === material_path)) return prev
          const filename = material_path.split('/').pop() ?? material_path
          return [...prev, {
            path: material_path,
            filename,
            status: 'queued',
            addedAt: Date.now(),
            logs: [],
          }]
        })
      } else if (status === 'processing') {
        setQueueItems(prev => {
          const filename = material_path.split('/').pop() ?? material_path
          // Case 1: recording placeholder still present — upgrade it directly
          const hasPlaceholder = prev.some(i => i.path === RECORDING_PLACEHOLDER)
          if (hasPlaceholder) {
            return prev.map(i =>
              i.path === RECORDING_PLACEHOLDER
                ? { ...i, path: material_path, filename, status: 'processing' as const }
                : i
            )
          }
          // Case 2: item already in queue (normal path) — just update status
          if (prev.some(i => i.path === material_path)) {
            return prev.map(i => i.path === material_path ? { ...i, status: 'processing' as const } : i)
          }
          // Case 3: processing event arrived before addQueuedItem (race) — insert directly
          return [{ path: material_path, filename, status: 'processing' as const, addedAt: Date.now(), logs: [] }, ...prev]
        })
      } else if (status === 'completed') {
        setQueueItems(prev =>
          prev.map(i => i.path === material_path ? { ...i, status: 'completed' } : i)
        )
        const timer = setTimeout(() => {
          removalTimers.current.delete(material_path)
          setQueueItems(prev => prev.filter(i => i.path !== material_path))
        }, 1000)
        removalTimers.current.set(material_path, timer)
      } else if (status === 'failed') {
        setQueueItems(prev =>
          prev.map(i => i.path === material_path
            ? { ...i, status: 'failed', error }
            : i
          )
        )
      }
    })

    const unlistenLog = listen<AiLogLine>('ai-log', (event) => {
      const { material_path, message } = event.payload
      setQueueItems(prev =>
        prev.map(i =>
          i.path === material_path
            ? { ...i, logs: [...(i.logs ?? []), message] }
            : i
        )
      )
    })

    const unlistenUpdated = listen<string>('journal-updated', () => {
      refresh()
    })

    const unlistenProcessed = listen<{ filename: string; path: string }>('recording-processed', (event) => {
      const { filename, path } = event.payload
      setQueueItems(prev => {
        const hasPlaceholder = prev.some(i => i.path === RECORDING_PLACEHOLDER)
        if (!hasPlaceholder) return prev
        return prev.map(i =>
          i.path === RECORDING_PLACEHOLDER
            ? { ...i, path, filename, status: 'converting' as const }
            : i
        )
      })
      refresh()
    })

    const unlistenAudioReady = listen<{ source_path: string; material_path: string; filename: string }>('audio-ai-material-ready', (event) => {
      const { source_path, material_path, filename } = event.payload
      setQueueItems(prev => {
        if (prev.some(i => i.path === source_path)) {
          return prev.map(i =>
            i.path === source_path
              ? { ...i, path: material_path, filename, status: 'queued' as const }
              : i
          )
        }
        if (prev.some(i => i.path === material_path)) {
          return prev
        }
        return [{ path: material_path, filename, status: 'queued' as const, addedAt: Date.now(), logs: [] }, ...prev]
      })
    })

    const unlistenAudioFailed = listen<{ source_path: string; filename: string; error: string }>('audio-ai-material-failed', (event) => {
      const { source_path, filename, error } = event.payload
      setQueueItems(prev => {
        if (prev.some(i => i.path === source_path)) {
          return prev.map(i =>
            i.path === source_path
              ? { ...i, filename, status: 'failed' as const, error }
              : i
          )
        }
        return [{ path: source_path, filename, status: 'failed' as const, error, addedAt: Date.now(), logs: [] }, ...prev]
      })
    })

    return () => {
      clearInterval(pollInterval)
      unlistenProcessing.then(fn => fn())
      unlistenLog.then(fn => fn())
      unlistenUpdated.then(fn => fn())
      unlistenProcessed.then(fn => fn())
      unlistenAudioReady.then(fn => fn())
      unlistenAudioFailed.then(fn => fn())
      removalTimers.current.forEach(t => clearTimeout(t))
      removalTimers.current.clear()
    }
  }, [refresh])

  const retryQueueItem = useCallback((path: string) => {
    setQueueItems(prev =>
      prev.map(i => i.path === path ? { ...i, status: 'queued' as const, error: undefined, logs: [] } : i)
    )
  }, [])

  const isProcessing = queueItems.some(
    i => i.status === 'processing' || i.status === 'queued'
  )

  return { entries, loading, queueItems, isProcessing, dismissQueueItem, addConvertingItem, addQueuedItem, markItemFailed, retryQueueItem, refresh }
}
