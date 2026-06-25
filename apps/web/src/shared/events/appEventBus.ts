import { listen } from '@tauri-apps/api/event'
import { isAppEvent, type AppEvent } from '../protocol/appEvent'

export interface AppEventSubscription {
  ready: Promise<void>
  unsubscribe: () => Promise<void>
}

export function subscribeAppEvents(onEvent: (event: AppEvent) => void): AppEventSubscription {
  let unlisten: (() => void) | null = null

  const ready = listen<unknown>('app-event', (event) => {
    if (isAppEvent(event.payload)) {
      onEvent(event.payload)
    }
  }).then((fn) => {
    unlisten = fn
  })

  return {
    ready,
    async unsubscribe() {
      await ready
      unlisten?.()
      unlisten = null
    },
  }
}
