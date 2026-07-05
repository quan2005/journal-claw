import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('runtimeClient', () => {
  beforeEach(() => {
    vi.resetModules()
    const g = globalThis as Record<string, unknown>
    delete g.__JOURNAL_RUNTIME
  })

  it('uses the daemon HTTP runtime by default', async () => {
    const { defaultRuntimeClient, readRuntimeKind, selectRuntimeClient } =
      await import('../lib/runtimeClient')

    expect(readRuntimeKind()).toBe('http')
    expect(defaultRuntimeClient.constructor.name).toBe('HttpRuntimeClient')
    expect(selectRuntimeClient()).toBe(defaultRuntimeClient)
  })

  it('ignores the retired JOURNAL_RUNTIME=tauri override', async () => {
    ;(globalThis as Record<string, unknown>).__JOURNAL_RUNTIME = 'tauri'

    const { readRuntimeKind, selectRuntimeClient } = await import('../lib/runtimeClient')

    expect(readRuntimeKind()).toBe('http')
    expect(selectRuntimeClient().constructor.name).toBe('HttpRuntimeClient')
  })
})
