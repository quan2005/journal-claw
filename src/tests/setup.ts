// Force Chinese locale for all tests so i18n t() calls return zh strings
Object.defineProperty(navigator, 'language', {
  value: 'zh-CN',
  configurable: true,
})

// jsdom does not implement the CSS Custom Highlight API used by FindBar/DetailView.
const highlightStore = new Map<string, unknown>()
Object.defineProperty(globalThis, 'CSS', {
  value: {
    ...(globalThis.CSS ?? {}),
    highlights: {
      set: (key: string, value: unknown) => highlightStore.set(key, value),
      get: (key: string) => highlightStore.get(key),
      delete: (key: string) => highlightStore.delete(key),
      clear: () => highlightStore.clear(),
    },
  },
  configurable: true,
})

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
