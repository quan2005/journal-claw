import { useState, useRef, useCallback } from 'react'
import { startRecording, stopRecording } from '../lib/tauri'
import type { RecordingItem } from '../types'

export type RecorderStatus = 'idle' | 'recording'

interface UseRecorderReturn {
  status: RecorderStatus
  elapsedSecs: number
  start: () => Promise<void>
  stop: () => Promise<void>
}

export function useRecorder(
  onStopped: (item: RecordingItem) => void
): UseRecorderReturn {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [elapsedSecs, setElapsedSecs] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = useCallback(async () => {
    await startRecording()
    setStatus('recording')
    setElapsedSecs(0)
    timerRef.current = setInterval(() => {
      setElapsedSecs(s => s + 1)
    }, 1000)
  }, [])

  const stop = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    const item = await stopRecording()
    setStatus('idle')
    setElapsedSecs(0)
    onStopped(item)
  }, [onStopped])

  return { status, elapsedSecs, start, stop }
}
