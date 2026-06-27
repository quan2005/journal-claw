import { selectRuntimeClient } from '../../lib/runtimeClient'
import { isAppEvent, type AppEvent } from '../protocol/appEvent'

export interface AppEventSubscription {
  ready: Promise<void>
  unsubscribe: () => Promise<void>
}

export function subscribeAppEvents(onEvent: (event: AppEvent) => void): AppEventSubscription {
  // Transport-agnostic: daemon runtime subscribes over SSE (GET /events/app-event),
  // Tauri runtime via listen(). Either surfaces the parsed payload directly.
  const off = selectRuntimeClient().subscribe<unknown>('app-event', (payload) => {
    if (isAppEvent(payload)) {
      onEvent(payload)
    }
  })
  // SSE/listen open synchronously (the underlying EventSource connects async),
  // so there is no ready gate to await. Kept for API compatibility.
  return {
    ready: Promise.resolve(),
    unsubscribe: async () => {
      off()
    },
  }
}
