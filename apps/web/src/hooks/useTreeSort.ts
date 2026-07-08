import { useState, useEffect } from 'react'
import { selectRuntimeClient } from '../lib/runtimeClient'
import type { WorkspaceTreeSort } from '../lib/sortTopics'

export type { WorkspaceTreeSort }

const getTreeSort = (): Promise<WorkspaceTreeSort> =>
  selectRuntimeClient().invoke<WorkspaceTreeSort>('get_workspace_tree_sort')

const setTreeSort = (strategy: WorkspaceTreeSort): Promise<void> =>
  selectRuntimeClient().invoke<void>('set_workspace_tree_sort', { strategy })

const getManualOrder = (): Promise<Record<string, string[]>> =>
  selectRuntimeClient().invoke<Record<string, string[]>>('get_workspace_tree_manual_order')

const setManualOrderAll = (order: Record<string, string[]>): Promise<void> =>
  selectRuntimeClient().invoke<void>('set_workspace_tree_manual_order', { order })

export function useTreeSort() {
  const [strategy, setStrategyState] = useState<WorkspaceTreeSort>('name-asc')
  const [loading, setLoading] = useState(true)
  const [manualOrder, setManualOrderState] = useState<Record<string, string[]>>({})

  useEffect(() => {
    let cancelled = false
    getTreeSort()
      .then((saved) => {
        if (!cancelled) setStrategyState(saved)
      })
      .catch(() => {
        if (!cancelled) setStrategyState('name-asc')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    getManualOrder()
      .then((order) => setManualOrderState(order ?? {}))
      .catch(() => setManualOrderState({}))
  }, [])

  function setStrategy(next: WorkspaceTreeSort) {
    setStrategyState(next)
    setTreeSort(next).catch(console.error)
  }

  function setManualOrderFor(parentPath: string, order: string[]) {
    const next = { ...manualOrder, [parentPath]: order }
    setManualOrderState(next)
    setManualOrderAll(next).catch(console.error)
  }

  return { strategy, setStrategy, manualOrder, setManualOrderFor, loading }
}
