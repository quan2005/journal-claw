import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { selectRuntimeClient } from '../lib/runtimeClient'

/**
 * BootGate — renderer-side boot state (design.md D3).
 *
 * Mounted as the outermost component. It renders a self-contained loading state
 * immediately, then probes the daemon via runtimeClient.health() with
 * exponential backoff (250ms → 2s cap, 30s total budget). While probing, none
 * of the provider/hooks tree is mounted, so no daemon calls fire and no error
 * toasts can appear. Once healthy, children mount and the app boots normally.
 * On timeout (30s) an error state with a retry button replaces the spinner.
 */

const PROBE_INITIAL_MS = 250
const PROBE_MAX_MS = 2000
const PROBE_TOTAL_BUDGET_MS = 30_000

type BootStatus = 'probing' | 'ready' | 'error'

export function BootGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<BootStatus>('probing')
  const [attempt, setAttempt] = useState(0)
  const cancelledRef = useRef(false)

  const probe = useCallback(async () => {
    cancelledRef.current = false
    setStatus('probing')
    performance.mark?.('boot:probing-start')

    const client = selectRuntimeClient()
    const startedAt = Date.now()
    let delay = PROBE_INITIAL_MS

    for (;;) {
      if (cancelledRef.current) return
      const healthy = await client.health()
      if (cancelledRef.current) return
      if (healthy) {
        performance.mark?.('boot:daemon-ready')
        setStatus('ready')
        return
      }
      if (Date.now() - startedAt >= PROBE_TOTAL_BUDGET_MS) {
        setStatus('error')
        return
      }
      setAttempt((a) => a + 1)
      await new Promise<void>((resolve) => {
        setTimeout(resolve, delay)
      })
      delay = Math.min(delay * 2, PROBE_MAX_MS)
    }
  }, [])

  useEffect(() => {
    void probe()
    return () => {
      cancelledRef.current = true
    }
  }, [probe])

  if (status === 'ready') {
    performance.mark?.('boot:children-rendered')
    return <>{children}</>
  }

  if (status === 'error') {
    return <BootError onRetry={probe} />
  }

  return <BootLoading attempt={attempt} />
}

function BootLoading({ attempt }: { attempt: number }): ReactNode {
  return (
    <div
      data-testid="boot-loading"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        background: 'var(--bg)',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Noto Serif SC", serif',
      }}
    >
      <div
        style={{
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: '.04em',
          color: 'var(--text-primary)',
        }}
      >
        谨迹
      </div>
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 999,
          border: '2.5px solid color-mix(in srgb, var(--record-btn) 20%, transparent)',
          borderTopColor: 'var(--record-btn)',
          animation: 'bootspin .8s linear infinite',
        }}
      />
      <div
        style={{
          fontSize: 13,
          color: 'var(--text-tertiary)',
          opacity: 0.8,
        }}
      >
        {attempt > 0 ? '正在连接后台…' : '正在启动谨迹…'}
      </div>
    </div>
  )
}

function BootError({ onRetry }: { onRetry: () => void }): ReactNode {
  return (
    <div
      data-testid="boot-error"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: 'var(--bg)',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Noto Serif SC", serif',
        padding: 24,
      }}
    >
      <div
        style={{
          fontSize: 17,
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}
      >
        无法连接到后台服务
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--text-tertiary)',
          textAlign: 'center',
          maxWidth: 320,
        }}
      >
        daemon 启动超时，请确认后台进程正常运行后重试。
      </div>
      <button
        type="button"
        onClick={onRetry}
        style={{
          marginTop: 4,
          padding: '8px 22px',
          borderRadius: 'var(--radius-pill)',
          border: 'none',
          background: 'var(--record-btn)',
          color: 'var(--record-btn-icon)',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        重试
      </button>
    </div>
  )
}
