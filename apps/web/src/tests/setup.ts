// Force Chinese locale for all tests so i18n t() calls return zh strings
Object.defineProperty(navigator, 'language', {
  value: 'zh-CN',
  configurable: true,
})

// jsdom does not implement the CSS Custom Highlight API used by FindBar/DetailView.
const highlightStore = new Map<string, unknown>()
class MockHighlight {
  ranges: unknown[]

  constructor(...ranges: unknown[]) {
    this.ranges = ranges
  }
}

Object.defineProperty(globalThis, 'CSS', {
  value: {
    ...(globalThis.CSS ?? {}),
    escape: (value: string) => value.replace(/"/g, '\\"'),
    highlights: {
      set: (key: string, value: unknown) => highlightStore.set(key, value),
      get: (key: string) => highlightStore.get(key),
      delete: (key: string) => highlightStore.delete(key),
      clear: () => highlightStore.clear(),
    },
  },
  configurable: true,
})
Object.defineProperty(globalThis, 'Highlight', {
  value: MockHighlight,
  configurable: true,
})

// jsdom does not provide EventSource. The app's daemon runtime uses SSE in
// production (browser/Electron), so tests need a lightweight compatible global.
type MockEventSourceHandler = (event: Event | MessageEvent) => void

class MockEventSource {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2

  readonly CONNECTING = 0
  readonly OPEN = 1
  readonly CLOSED = 2

  readonly url: string
  readonly withCredentials: boolean
  readyState = MockEventSource.CONNECTING
  onopen: MockEventSourceHandler | null = null
  onmessage: MockEventSourceHandler | null = null
  onerror: MockEventSourceHandler | null = null

  private listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()

  constructor(url: string | URL, init?: EventSourceInit) {
    this.url = String(url)
    this.withCredentials = init?.withCredentials ?? false
  }

  close() {
    this.readyState = MockEventSource.CLOSED
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
    if (!listener) return
    const listeners = this.listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
    if (!listener) return
    this.listeners.get(type)?.delete(listener)
  }

  dispatchEvent(event: Event): boolean {
    if (event.type === 'open') this.readyState = MockEventSource.OPEN
    const propertyHandler = this[`on${event.type}` as 'onopen' | 'onmessage' | 'onerror']
    propertyHandler?.(event)
    for (const listener of this.listeners.get(event.type) ?? []) {
      if (typeof listener === 'function') {
        listener.call(this, event)
      } else {
        listener.handleEvent(event)
      }
    }
    return true
  }
}

Object.defineProperty(globalThis, 'EventSource', {
  value: MockEventSource,
  configurable: true,
  writable: true,
})

if (!Range.prototype.getBoundingClientRect) {
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    value: () => ({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      toJSON: () => ({}),
    }),
    configurable: true,
  })
}

let tauriEventId = 1
Object.defineProperty(window, '__TAURI_EVENT_PLUGIN_INTERNALS__', {
  value: {
    unregisterListener: () => {},
  },
  configurable: true,
})

Object.defineProperty(window, '__TAURI_INTERNALS__', {
  value: {
    metadata: {
      currentWindow: { label: 'main' },
      currentWebview: { label: 'main' },
    },
    invoke: async (cmd: string) => {
      if (cmd === 'plugin:event|listen') return tauriEventId++
      return null
    },
    transformCallback: (callback: (...args: unknown[]) => void, once?: boolean) => {
      const id = tauriEventId++
      Object.defineProperty(window, `_${id}`, {
        value: (...args: unknown[]) => {
          callback(...args)
          if (once) {
            delete (window as unknown as Record<string, unknown>)[`_${id}`]
          }
        },
        configurable: true,
      })
      return id
    },
  },
  configurable: true,
})

// Provide a render wrapper that includes I18nProvider
import { render, type RenderOptions } from '@testing-library/react'
import { createElement, type ReactElement } from 'react'
import { I18nProvider } from '../contexts/I18nContext'

function AllProviders({ children }: { children: React.ReactNode }) {
  return createElement(I18nProvider, null, children)
}

const renderWithProviders = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, { wrapper: AllProviders, ...options })

export { renderWithProviders }
