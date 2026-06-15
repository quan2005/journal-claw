/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useTodos } from '../hooks/useTodos'
import type { TodoItem } from '../types'

interface TodoContextValue {
  todos: TodoItem[]
  loading: boolean
  refresh: () => Promise<void>
  addTodo: (text: string, due?: string, source?: string, path?: string) => Promise<void>
  toggleTodo: (lineIndex: number, checked: boolean, doneFile: boolean) => Promise<void>
  deleteTodo: (lineIndex: number, doneFile: boolean) => Promise<void>
  setTodoDue: (lineIndex: number, due: string | null, doneFile: boolean) => Promise<void>
  updateTodoText: (lineIndex: number, text: string, doneFile: boolean) => Promise<void>
  setTodoPath: (lineIndex: number, path: string | null, doneFile: boolean) => Promise<void>
  removeTodoPath: (lineIndex: number, doneFile: boolean) => Promise<void>
  setTodoSessionId: (
    lineIndex: number,
    sessionId: string | null,
    doneFile: boolean,
  ) => Promise<void>
}

const TodoContext = createContext<TodoContextValue>(null!)

export function TodoProvider({ children }: { children: ReactNode }) {
  const todoHook = useTodos()
  // Memoize value so consumers don't re-render unless todos/loading actually change (AC-4).
  // useTodos() already returns useCallback-stable functions; only todos/loading vary.
  const value = useMemo<TodoContextValue>(
    () => todoHook,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todoHook.todos, todoHook.loading],
  )
  return <TodoContext.Provider value={value}>{children}</TodoContext.Provider>
}

export function useTodoContext() {
  return useContext(TodoContext)
}
