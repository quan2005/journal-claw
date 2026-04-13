import { useState, useRef, useCallback } from 'react'
import { startRecording, stopRecording } from '../lib/tauri'

export type RecorderStatus = 'idle' | 'recording'

interface UseRecorderReturn {
  status: RecorderStatus
  start: () => Promise<void>
  stop: () => Promise<void>
}

export function useRecorder(): UseRecorderReturn {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = useCallback(async () => {
    await startRecording()
    setStatus('recording')
  }, [])

  const stop = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    await stopRecording()
    setStatus('idle')
  }, [])

  return { status, start, stop }
}
