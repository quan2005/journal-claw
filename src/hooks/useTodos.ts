import { useState, useEffect, useCallback } from 'react'
import { listen } from '@tauri-apps/api/event'
import {
  listTodos,
  addTodo as addTodoIpc,
  toggleTodo as toggleTodoIpc,
  deleteTodo as deleteTodoIpc,
  setTodoDue as setTodoDueIpc,
  updateTodoText as updateTodoTextIpc,
  setTodoPath as setTodoPathIpc,
  removeTodoPath as removeTodoPathIpc,
  setTodoSessionId as setTodoSessionIdIpc,
} from '../lib/tauri'
import type { TodoItem } from '../types'

export function useTodos() {
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const result = await listTodos()
      setTodos((prev) => (JSON.stringify(prev) === JSON.stringify(result) ? prev : result))
    } catch (e) {
      console.error('[useTodos] failed to load todos:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()

    const unlistenTodos = listen('todos-updated', () => refresh())
    // Poll every 3s to catch external edits
    const pollId = setInterval(refresh, 3000)

    return () => {
      unlistenTodos.then((fn) => fn())
      clearInterval(pollId)
    }
  }, [refresh])

  const addTodo = useCallback(
    async (text: string, due?: string, source?: string, path?: string) => {
      await addTodoIpc(text, due, source, path)
      await refresh()
    },
    [refresh],
  )

  const toggleTodo = useCallback(
    async (lineIndex: number, checked: boolean, doneFile: boolean) => {
      await toggleTodoIpc(lineIndex, checked, doneFile)
      await refresh()
    },
    [refresh],
  )

  const deleteTodo = useCallback(
    async (lineIndex: number, doneFile: boolean) => {
      await deleteTodoIpc(lineIndex, doneFile)
      await refresh()
    },
    [refresh],
  )

  const setTodoDue = useCallback(
    async (lineIndex: number, due: string | null, doneFile: boolean) => {
      await setTodoDueIpc(lineIndex, due, doneFile)
      await refresh()
    },
    [refresh],
  )

  const updateTodoText = useCallback(
    async (lineIndex: number, text: string, doneFile: boolean) => {
      await updateTodoTextIpc(lineIndex, text, doneFile)
      await refresh()
    },
    [refresh],
  )

  const setTodoPath = useCallback(
    async (lineIndex: number, path: string | null, doneFile: boolean) => {
      await setTodoPathIpc(lineIndex, path, doneFile)
      await refresh()
    },
    [refresh],
  )

  const removeTodoPath = useCallback(
    async (lineIndex: number, doneFile: boolean) => {
      await removeTodoPathIpc(lineIndex, doneFile)
      await refresh()
    },
    [refresh],
  )

  const setTodoSessionId = useCallback(
    async (lineIndex: number, sessionId: string | null, doneFile: boolean) => {
      await setTodoSessionIdIpc(lineIndex, sessionId, doneFile)
      await refresh()
    },
    [refresh],
  )

  return {
    todos,
    loading,
    refresh,
    addTodo,
    toggleTodo,
    deleteTodo,
    setTodoDue,
    updateTodoText,
    setTodoPath,
    removeTodoPath,
    setTodoSessionId,
  }
}
