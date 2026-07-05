import { useState, useEffect, useCallback } from 'react'
import { selectRuntimeClient } from '../lib/runtimeClient'
import { useEventSync } from './useEventSync'
import type { TodoItem } from '../types'

const listTodos = (): Promise<TodoItem[]> => selectRuntimeClient().invoke<TodoItem[]>('list_todos')

const addTodoIpc = (
  text: string,
  due?: string,
  source?: string,
  path?: string,
): Promise<TodoItem> =>
  selectRuntimeClient().invoke<TodoItem>('add_todo', {
    text,
    due: due ?? null,
    source: source ?? null,
    path: path ?? null,
  })

const toggleTodoIpc = (lineIndex: number, checked: boolean, doneFile: boolean): Promise<void> =>
  selectRuntimeClient().invoke<void>('toggle_todo', { lineIndex, checked, doneFile })

const deleteTodoIpc = (lineIndex: number, doneFile: boolean): Promise<void> =>
  selectRuntimeClient().invoke<void>('delete_todo', { lineIndex, doneFile })

const setTodoDueIpc = (lineIndex: number, due: string | null, doneFile: boolean): Promise<void> =>
  selectRuntimeClient().invoke<void>('set_todo_due', { lineIndex, due, doneFile })

const updateTodoTextIpc = (lineIndex: number, text: string, doneFile: boolean): Promise<void> =>
  selectRuntimeClient().invoke<void>('update_todo_text', { lineIndex, text, doneFile })

const setTodoPathIpc = (lineIndex: number, path: string | null, doneFile: boolean): Promise<void> =>
  selectRuntimeClient().invoke<void>('set_todo_path', { lineIndex, path, doneFile })

const removeTodoPathIpc = (lineIndex: number, doneFile: boolean): Promise<void> =>
  selectRuntimeClient().invoke<void>('remove_todo_path', { lineIndex, doneFile })

const setTodoSessionIdIpc = (
  lineIndex: number,
  sessionId: string | null,
  doneFile: boolean,
): Promise<void> =>
  selectRuntimeClient().invoke<void>('set_todo_session_id', { lineIndex, sessionId, doneFile })

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
  }, [refresh])

  // Use event sync instead of raw event listener
  useEventSync(['todos-updated'], () => {
    refresh()
  })

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
