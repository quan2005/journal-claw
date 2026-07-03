import { useEffect, useRef } from 'react'
import { selectRuntimeClient } from '../lib/runtimeClient'
import type { DomainEvent } from '../types'

const getEventsSince = (sinceSeq: number): Promise<DomainEvent[]> =>
  selectRuntimeClient().invoke<DomainEvent[]>('get_events_since', { sinceSeq })

/**
 * Subscribe to Tauri events AND catch up via the event log on mount.
 * Guarantees no missed updates even if the webview was hidden.
 *
 * @param eventKinds - Which event kinds to watch (e.g. 'todos-updated')
 * @param onEvent - Callback fired for each matching event (live or catch-up)
 */
export function useEventSync(eventKinds: string[], onEvent: (payload: unknown) => void) {
  const lastSeq = useRef<number>(0)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  // Catch up on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const events = await getEventsSince(lastSeq.current)
        if (cancelled) return
        for (const event of events) {
          if (eventKinds.includes(event.kind)) {
            onEventRef.current(event.payload)
          }
          if (event.seq > lastSeq.current) {
            lastSeq.current = event.seq
          }
        }
      } catch (e) {
        console.error('[useEventSync] catch-up failed:', e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to live events (daemon SSE when runtime=http, Tauri listen otherwise).
  useEffect(() => {
    const client = selectRuntimeClient()
    const offs = eventKinds.map((eventName) =>
      client.subscribe<unknown>(eventName, (payload) => {
        onEventRef.current(payload)
      }),
    )
    return () => {
      offs.forEach((off) => off())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
