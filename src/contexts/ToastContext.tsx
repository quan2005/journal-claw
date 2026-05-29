/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { ToastContainer } from '../components/Toast'

export type ToastLevel = 'success' | 'warning' | 'error'

export interface ToastItem {
  id: number
  level: ToastLevel
  message: string
}

interface ToastContextValue {
  showToast: (level: ToastLevel, message: string) => void
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
})

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (level: ToastLevel, message: string) => {
      const id = ++nextId
      setToasts((prev) => [...prev, { id, level, message }])
      setTimeout(() => dismiss(id), 4000)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
