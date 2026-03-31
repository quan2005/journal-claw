import { useState, useRef, useCallback, useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { startRecording, stopRecording } from '../lib/tauri'

export type RecorderStatus = 'idle' | 'recording'

interface UseRecorderReturn {
  status: RecorderStatus
  elapsedSecs: number
  audioLevel: number
  start: () => Promise<void>
  stop: () => Promise<void>
}

export function useRecorder(): UseRecorderReturn {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [elapsedSecs, setElapsedSecs] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let unlisten: (() => void) | undefined
    listen<number>('audio-level', (event) => {
      setAudioLevel(event.payload)
    }).then(fn => { unlisten = fn })
    return () => { unlisten?.() }
  }, [])

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
    await stopRecording()
    setStatus('idle')
    setElapsedSecs(0)
  }, [])

  return { status, elapsedSecs, audioLevel, start, stop }
}
