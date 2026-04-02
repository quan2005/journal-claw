import { useState, useEffect, useCallback } from 'react'
import { listen } from '@tauri-apps/api/event'
import { listTodos, addTodo as addTodoIpc, toggleTodo as toggleTodoIpc, deleteTodo as deleteTodoIpc, setTodoDue as setTodoDueIpc } from '../lib/tauri'
import type { TodoItem } from '../types'

export function useTodos() {
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const result = await listTodos()
      setTodos(prev =>
        JSON.stringify(prev) === JSON.stringify(result) ? prev : result
      )
    } catch (e) {
      console.error('[useTodos] failed to load todos:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()

    const unlistenTodos = listen('todos-updated', () => refresh())

    return () => {
      unlistenTodos.then(fn => fn())
    }
  }, [refresh])

  const addTodo = useCallback(async (text: string, due?: string) => {
    await addTodoIpc(text, due)
    await refresh()
  }, [refresh])

  const toggleTodo = useCallback(async (lineIndex: number, checked: boolean) => {
    await toggleTodoIpc(lineIndex, checked)
    await refresh()
  }, [refresh])

  const deleteTodo = useCallback(async (lineIndex: number) => {
    await deleteTodoIpc(lineIndex)
    await refresh()
  }, [refresh])

  const setTodoDue = useCallback(async (lineIndex: number, due: string | null) => {
    await setTodoDueIpc(lineIndex, due)
    await refresh()
  }, [refresh])

  return { todos, loading, refresh, addTodo, toggleTodo, deleteTodo, setTodoDue }
}
