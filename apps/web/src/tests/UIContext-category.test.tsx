import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { UIProvider, useUI } from '../contexts/UIContext'
import type { ReactNode } from 'react'

const wrapper = ({ children }: { children: ReactNode }) => <UIProvider>{children}</UIProvider>

describe('UIContext category state', () => {
  beforeEach(() => {
    const store: Record<string, string> = {}
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, val: string) => {
          store[key] = val
        },
        removeItem: (key: string) => {
          delete store[key]
        },
        clear: () => {
          Object.keys(store).forEach((k) => delete store[k])
        },
        get length() {
          return Object.keys(store).length
        },
        key: (i: number) => Object.keys(store)[i] ?? null,
      },
      writable: true,
    })
  })

  it('defaults activeCategory to journal', () => {
    const { result } = renderHook(() => useUI(), { wrapper })
    expect(result.current.activeCategory).toBe('journal')
  })

  it('setActiveCategory updates value', () => {
    const { result } = renderHook(() => useUI(), { wrapper })
    act(() => result.current.setActiveCategory('ideas'))
    expect(result.current.activeCategory).toBe('ideas')
  })

  it('persists activeCategory across renders', () => {
    const { result, unmount } = renderHook(() => useUI(), { wrapper })
    act(() => result.current.setActiveCategory('automation'))
    unmount()
    const { result: result2 } = renderHook(() => useUI(), { wrapper })
    expect(result2.current.activeCategory).toBe('automation')
  })
})
