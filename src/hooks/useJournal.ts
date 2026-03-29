import { useState, useEffect, useCallback } from 'react'
import { listen } from '@tauri-apps/api/event'
import { listAllJournalEntries } from '../lib/tauri'
import type { JournalEntry, ProcessingUpdate } from '../types'

export function useJournal() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [processingPaths, setProcessingPaths] = useState<string[]>([])

  const refresh = useCallback(async () => {
    try {
      const result = await listAllJournalEntries()
      setEntries(result)
    } catch (e) {
      console.error('Failed to load journal entries:', e)
    }
  }, [])

  useEffect(() => {
    refresh()

    const unlistenProcessing = listen<ProcessingUpdate>('ai-processing', (event) => {
      const { material_path, status } = event.payload
      if (status === 'processing') {
        setProcessingPaths(prev => [...new Set([...prev, material_path])])
      } else {
        setProcessingPaths(prev => prev.filter(p => p !== material_path))
      }
    })

    const unlistenUpdated = listen<string>('journal-updated', () => {
      refresh()
    })

    const unlistenProcessed = listen('recording-processed', () => {
      refresh()
    })

    return () => {
      unlistenProcessing.then(fn => fn())
      unlistenUpdated.then(fn => fn())
      unlistenProcessed.then(fn => fn())
    }
  }, [refresh])

  return { entries, processingPaths, refresh }
}
