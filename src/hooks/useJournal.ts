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
        setQueueItems(prev =>
          prev.map(i => i.path === material_path ? { ...i, status: 'processing' } : i)
        )
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

    const unlistenProcessed = listen('recording-processed', () => {
      refresh()
    })

    return () => {
      clearInterval(pollInterval)
      unlistenProcessing.then(fn => fn())
      unlistenLog.then(fn => fn())
      unlistenUpdated.then(fn => fn())
      unlistenProcessed.then(fn => fn())
      removalTimers.current.forEach(t => clearTimeout(t))
      removalTimers.current.clear()
    }
  }, [refresh])

  const isProcessing = queueItems.some(
    i => i.status === 'processing' || i.status === 'queued'
  )

  return { entries, loading, queueItems, isProcessing, dismissQueueItem, addConvertingItem, addQueuedItem, refresh }
}
