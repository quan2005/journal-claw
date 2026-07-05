import { useState, useEffect, useCallback } from 'react'
import { selectRuntimeClient } from '../lib/runtimeClient'
import type { PinnedItem } from '../types'

const getPinnedItems = (): Promise<PinnedItem[]> =>
  selectRuntimeClient().invoke<PinnedItem[]>('get_pinned_items')

const setPinnedItems = (items: PinnedItem[]): Promise<void> =>
  selectRuntimeClient().invoke<void>('set_pinned_items', { items })

export function usePinned() {
  const [items, setItems] = useState<PinnedItem[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const list = await getPinnedItems()
      setItems(list.sort((a, b) => a.order - b.order))
    } catch (e) {
      console.error('[usePinned] refresh failed:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const pin = useCallback(
    async (itemType: 'journal' | 'identity' | 'topic', path: string) => {
      const updated = [...items, { type: itemType, path, order: items.length }]
      await setPinnedItems(updated)
      setItems(updated)
    },
    [items],
  )

  const unpin = useCallback(
    async (path: string) => {
      const updated = items.filter((i) => i.path !== path).map((item, i) => ({ ...item, order: i }))
      await setPinnedItems(updated)
      setItems(updated)
    },
    [items],
  )

  const reorder = useCallback(
    async (fromIndex: number, toIndex: number) => {
      const updated = [...items]
      const [moved] = updated.splice(fromIndex, 1)
      updated.splice(toIndex, 0, moved)
      const reordered = updated.map((item, i) => ({ ...item, order: i }))
      await setPinnedItems(reordered)
      setItems(reordered)
    },
    [items],
  )

  return { items, loading, pin, unpin, reorder, refresh }
}
