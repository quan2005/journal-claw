import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { BootGate } from '../components/BootGate'

const runtimeMock = vi.hoisted(() => ({
  health: vi.fn(),
  invoke: vi.fn(),
  subscribe: vi.fn(() => () => {}),
}))

vi.mock('../lib/runtimeClient', () => ({
  selectRuntimeClient: () => runtimeMock,
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('BootGate', () => {
  it('shows the boot loading state while the daemon is unreachable', async () => {
    runtimeMock.health.mockResolvedValue(false)

    await act(async () => {
      render(
        <BootGate>
          <div>real-app-content</div>
        </BootGate>,
      )
    })

    expect(screen.getByTestId('boot-loading')).toBeTruthy()
    expect(screen.queryByText('real-app-content')).toBeNull()
  })

  it('renders children once the daemon becomes reachable', async () => {
    // Fail first probe, succeed on the second (after backoff).
    runtimeMock.health.mockResolvedValueOnce(false).mockResolvedValueOnce(true)

    await act(async () => {
      render(
        <BootGate>
          <div>real-app-content</div>
        </BootGate>,
      )
    })

    // Still loading after the first failed probe.
    expect(screen.getByTestId('boot-loading')).toBeTruthy()

    // Advance past the 250ms backoff so the second probe fires.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    expect(screen.queryByTestId('boot-loading')).toBeNull()
    expect(screen.getByText('real-app-content')).toBeTruthy()
  })

  it('transitions to the error state with a retry button after the 30s budget', async () => {
    runtimeMock.health.mockResolvedValue(false)

    await act(async () => {
      render(
        <BootGate>
          <div>real-app-content</div>
        </BootGate>,
      )
    })

    // Exhaust the 30s total probe budget (exponential backoff cumulates
    // past 30s before the budget check triggers — advance generously).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(40_000)
    })

    expect(screen.getByTestId('boot-error')).toBeTruthy()
    const retry = screen.getByRole('button', { name: '重试' })
    expect(retry).toBeTruthy()
    expect(screen.queryByText('real-app-content')).toBeNull()
  })

  it('retries probing when the retry button is clicked', async () => {
    runtimeMock.health.mockResolvedValue(false)

    await act(async () => {
      render(
        <BootGate>
          <div>real-app-content</div>
        </BootGate>,
      )
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(40_000)
    })

    expect(screen.getByTestId('boot-error')).toBeTruthy()

    // Now make the daemon reachable and click retry.
    runtimeMock.health.mockResolvedValue(true)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '重试' }))
    })

    expect(screen.getByText('real-app-content')).toBeTruthy()
    expect(screen.queryByTestId('boot-error')).toBeNull()
  })
})
