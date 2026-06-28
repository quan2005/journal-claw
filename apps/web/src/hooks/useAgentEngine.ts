/**
 * useAgentEngine — the selected chat engine for the unified conversation panel.
 *
 * Two engines, persisted via the daemon (PUT /settings), never localStorage:
 *   - `builtin` → in-process pi engine (useConversation → /conversation)
 *   - `cli`     → a detected external CLI agent (useAgentRun → POST /runs)
 *
 * Mirrors useTheme: load on mount, optimistic update + persist on set. Falls
 * back to `builtin` when the daemon is unreachable (tests, daemon offline) so
 * the panel always renders a working default instead of a loading dead-end.
 */
import { useState, useEffect, useCallback } from 'react'
import type { RunEngine } from '../types/agentRun'
import { getAgentEngine, setAgentEngine } from '../lib/tauri'

export interface AgentEngineState {
  engine: RunEngine
  agentId: string | null
  /** True until the initial daemon read settles (success or failure). */
  loading: boolean
  setEngine: (engine: RunEngine) => void
  setAgentId: (agentId: string | null) => void
}

function isValidEngine(value: unknown): value is RunEngine {
  return value === 'builtin' || value === 'cli'
}

export function useAgentEngine(): AgentEngineState {
  const [engine, setEngineState] = useState<RunEngine>('builtin')
  const [agentId, setAgentIdState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getAgentEngine()
      .then((saved) => {
        if (cancelled) return
        if (isValidEngine(saved?.engine)) setEngineState(saved.engine)
        if (typeof saved?.agentId === 'string' && saved.agentId) setAgentIdState(saved.agentId)
      })
      .catch(() => {
        // Daemon offline / unreachable — keep the builtin default so the
        // panel renders a working conversation surface.
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const setEngine = useCallback((next: RunEngine) => {
    setEngineState(next)
    setAgentEngine({ engine: next }).catch(() => {
      // Persistence is best-effort; the in-memory selection still applies.
    })
  }, [])

  const setAgentId = useCallback((next: string | null) => {
    setAgentIdState(next)
    setAgentEngine({ agentId: next }).catch(() => {
      // ignore — best-effort persistence
    })
  }, [])

  return { engine, agentId, loading, setEngine, setAgentId }
}
