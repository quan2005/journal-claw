// Force Chinese locale for all tests so i18n t() calls return zh strings
Object.defineProperty(navigator, 'language', {
  value: 'zh-CN',
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
