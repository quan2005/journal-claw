import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createRoutine,
  deleteRoutine,
  listAutomationTemplates,
  listRoutines,
  listRoutineRuns,
  pauseRoutine,
  resumeRoutine,
  runRoutineNow,
  updateRoutine,
} from '../lib/tauri'
import { selectRuntimeClient } from '../lib/runtimeClient'
import type {
  AutomationRoutine,
  AutomationRun,
  AutomationTemplate,
  CreateRoutineRequest,
  UpdateRoutineRequest,
} from '../types'

export function useAutomation() {
  const [templates, setTemplates] = useState<AutomationTemplate[]>([])
  const [routines, setRoutines] = useState<AutomationRoutine[]>([])
  const [runsByRoutine, setRunsByRoutine] = useState<Record<string, AutomationRun[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const [nextTemplates, nextRoutines] = await Promise.all([
        listAutomationTemplates(),
        listRoutines(),
      ])
      setTemplates(nextTemplates)
      setRoutines(nextRoutines)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const unlisten = selectRuntimeClient().subscribe<AutomationRun>(
      'automation-run-updated',
      (run) => {
        refresh()
        setRunsByRoutine((prev) => {
          if (!prev[run.routine_id]) {
            return prev
          }
          const existing = prev[run.routine_id]
          const next = [run, ...existing.filter((item) => item.id !== run.id)]
          return { ...prev, [run.routine_id]: next }
        })
      },
    )

    return unlisten
  }, [refresh])

  const loadRuns = useCallback(async (routineId: string) => {
    const runs = await listRoutineRuns(routineId)
    setRunsByRoutine((prev) => ({ ...prev, [routineId]: runs }))
    return runs
  }, [])

  const create = useCallback(
    async (request: CreateRoutineRequest) => {
      const routine = await createRoutine(request)
      await refresh()
      return routine
    },
    [refresh],
  )

  const update = useCallback(
    async (id: string, patch: UpdateRoutineRequest) => {
      const routine = await updateRoutine(id, patch)
      await refresh()
      return routine
    },
    [refresh],
  )

  const remove = useCallback(
    async (id: string) => {
      await deleteRoutine(id)
      setRunsByRoutine((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      await refresh()
    },
    [refresh],
  )

  const pause = useCallback(
    async (id: string) => {
      const routine = await pauseRoutine(id)
      await refresh()
      return routine
    },
    [refresh],
  )

  const resume = useCallback(
    async (id: string) => {
      const routine = await resumeRoutine(id)
      await refresh()
      return routine
    },
    [refresh],
  )

  const runNow = useCallback(
    async (id: string) => {
      const run = await runRoutineNow(id)
      await refresh()
      await loadRuns(id)
      return run
    },
    [loadRuns, refresh],
  )

  const counts = useMemo(() => {
    const enabled = routines.filter((routine) => routine.enabled).length
    const failed = routines.filter((routine) => routine.last_run?.status === 'failed').length
    return { enabled, failed, total: routines.length }
  }, [routines])

  return {
    templates,
    routines,
    runsByRoutine,
    loading,
    error,
    counts,
    refresh,
    loadRuns,
    create,
    update,
    remove,
    pause,
    resume,
    runNow,
  }
}
