/**
 * useAgentRun — drives a single Agent Run from creation to completion.
 *
 * create(goal) -> POST /runs -> subscribe SSE -> accumulate events into a
 * structured timeline (text deltas folded into the latest assistant text,
 * tool_calls listed as steps, changesets fetched on finish). Returns the run,
 * the derived timeline, and the change sets.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  createRun,
  subscribeRunEvents,
  listChangeSets,
  type CreateRunInput,
} from '../lib/agentRuns'
import type { AgentRun, AgentRunEvent, ChangeSet, AuthorizationMode } from '../types/agentRun'

export interface TimelineEntry {
  id: string
  kind: 'thinking' | 'text' | 'tool_call' | 'status'
  label?: string
  text?: string
  toolName?: string
  timestamp: string
}

export interface UseAgentRunResult {
  run: AgentRun | null
  timeline: TimelineEntry[]
  changeSets: ChangeSet[]
  assistantText: string
  isRunning: boolean
  error: string | null
  start: (input: CreateRunInput) => Promise<void>
}

export function useAgentRun(): UseAgentRunResult {
  const [run, setRun] = useState<AgentRun | null>(null)
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [changeSets, setChangeSets] = useState<ChangeSet[]>([])
  const [assistantText, setAssistantText] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.()
    }
  }, [])

  const start = useCallback(async (input: CreateRunInput) => {
    setError(null)
    setTimeline([])
    setAssistantText('')
    setChangeSets([])
    try {
      const created = await createRun(input)
      setRun(created)
      setIsRunning(true)
      unsubscribeRef.current?.()
      unsubscribeRef.current = subscribeRunEvents(created.id, (ev: AgentRunEvent) => {
        applyEvent(ev)
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setIsRunning(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyEvent = useCallback(
    (ev: AgentRunEvent) => {
     setRun((prev) => (prev ? { ...prev, updatedAt: ev.timestamp } : prev))
      const nextStatus = statusAfterEvent(ev.type)
      if (nextStatus) {
        setRun((prev) => (prev ? { ...prev, status: nextStatus, updatedAt: ev.timestamp } : prev))
      }
     switch (ev.type) {
        case 'run_started':
          setTimeline((t) => [...t, { id: ev.spanId ?? ev.timestamp, kind: 'status', label: 'Run started', timestamp: ev.timestamp }])
          break
       case 'thinking_delta': {
         const d = safeParse(ev.data)
          const text = typeof d?.text === 'string' ? d.text : ''
          setTimeline((t) => [...t, { id: ev.spanId ?? ev.timestamp, kind: 'thinking', text, timestamp: ev.timestamp }])
         break
       }
       case 'text_delta': {
         const d = safeParse(ev.data)
          const text = typeof d?.text === 'string' ? d.text : ''
         setAssistantText((prev) => prev + text)
         break
       }
       case 'tool_call': {
         const d = safeParse(ev.data)
          const name = typeof d?.name === 'string' ? d.name : 'tool'
          const inputText = d?.input ? JSON.stringify(d.input).slice(0, 200) : ''
         setTimeline((t) => [
           ...t,
            { id: ev.spanId ?? ev.timestamp, kind: 'tool_call', toolName: name, text: inputText, timestamp: ev.timestamp },
         ])
         break
       }
        case 'run_finished':
          setTimeline((t) => [...t, { id: ev.timestamp, kind: 'status', label: 'Run finished', timestamp: ev.timestamp }])
          setIsRunning(false)
          // Fetch the recorded file changes for this run.
          if (run) {
            listChangeSets(run.id)
              .then(setChangeSets)
              .catch(() => {})
          }
          break
        case 'run_failed':
          setTimeline((t) => [...t, { id: ev.timestamp, kind: 'status', label: 'Run failed', timestamp: ev.timestamp }])
          setIsRunning(false)
          break
      }
    },
    [run],
  )

  return { run, timeline, changeSets, assistantText, isRunning, error, start }
}

function safeParse(data: string): Record<string, unknown> | null {
  try {
    return JSON.parse(data) as Record<string, unknown>
  } catch {
    return null
  }
}

export const AUTHORIZATION_MODES: AuthorizationMode[] = ['read_only', 'workspace_write', 'full_access']

function statusAfterEvent(type: AgentRunEvent['type']): AgentRun['status'] | null {
  switch (type) {
    case 'run_started':
      return 'running'
    case 'run_finished':
      return 'succeeded'
    case 'run_failed':
      return 'failed'
    default:
      return null
  }
}
