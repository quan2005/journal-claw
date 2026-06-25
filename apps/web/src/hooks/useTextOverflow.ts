import { useCallback, useEffect, useRef, useState } from 'react'

export function useTextOverflow<T extends HTMLElement>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null)
  const [isOverflow, setIsOverflow] = useState(false)

  const check = useCallback(() => {
    const el = ref.current
    if (!el) return
    setIsOverflow(el.scrollWidth > el.clientWidth)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return

    check()

    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => observer.disconnect()
  }, [check])

  return [ref, isOverflow]
}
