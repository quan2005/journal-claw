import { useRef, useState } from 'react'

export function useDelayedAnimated(animated: boolean, delayMs = 1000): boolean {
  const [delayed, setDelayed] = useState(animated)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevRef = useRef(animated)

  if (animated !== prevRef.current) {
    prevRef.current = animated
    if (animated) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setDelayed(true)
    } else {
      timerRef.current = setTimeout(() => {
        setDelayed(false)
        timerRef.current = null
      }, delayMs)
    }
  }

  return delayed
}
