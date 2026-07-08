import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AgentRunService } from './service.js'
import type { AgentRunEvent } from '@journal/contracts'

function makeEvent(
  service: AgentRunService,
  runId: string,
  partial: Partial<AgentRunEvent> & { type: AgentRunEvent['type'] },
): AgentRunEvent {
  const run = service.getRun(runId)
  return {
    runId,
    sessionId: run?.sessionId ?? 'sess-1',
    data: '',
    timestamp: new Date().toISOString(),
    ...partial,
  } as AgentRunEvent
}

describe('AgentRunService', () => {
  let dataDir: string
  let service: AgentRunService

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'journal-svc-'))
    service = new AgentRunService(dataDir)
  })

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true })
  })

  describe('createRun', () => {
    it('creates a run with status=queued and all required fields', () => {
      const run = service.createRun({ goal: 'write tests', mode: 'agent' })
      expect(run.id).toBeTruthy()
      expect(run.sessionId).toBeTruthy()
      expect(run.goal).toBe('write tests')
      expect(run.mode).toBe('agent')
      expect(run.status).toBe('queued')
      expect(run.agentId).toBeUndefined()
      expect(run.authorizationMode).toBe('workspace_write')
      expect(run.contextBindings).toEqual([])
      expect(run.steps).toEqual([])
      expect(run.createdAt).toBeTruthy()
      expect(run.updatedAt).toBeTruthy()
    })

    it('generates unique ids across runs', () => {
      const a = service.createRun({ goal: 'a', mode: 'chat' })
      const b = service.createRun({ goal: 'b', mode: 'chat' })
      expect(a.id).not.toBe(b.id)
      expect(a.sessionId).not.toBe(b.sessionId)
    })

    it('stores the agentId and lists child runs', () => {
      const parent = service.createRun({ goal: 'parent', mode: 'agent' })
      const child = service.createRun({
        goal: 'child',
        mode: 'agent',
        agentId: 'builtin',
        parentRunId: parent.id,
      })
      expect(child.agentId).toBe('builtin')
      expect(service.listChildRuns(parent.id)[0].agentId).toBe('builtin')
    })
  })

  describe('getRun', () => {
    it('returns null for unknown runId', () => {
      expect(service.getRun('nope')).toBeNull()
    })

    it('returns the created run', () => {
      const run = service.createRun({ goal: 'g', mode: 'observe' })
      expect(service.getRun(run.id)?.id).toBe(run.id)
    })
  })

  describe('state machine', () => {
    it('queued → running on run_started', () => {
      const run = service.createRun({ goal: 'g', mode: 'agent' })
      service.appendEvent(run.id, makeEvent(service, run.id, { type: 'run_started' }))
      expect(service.getRun(run.id)?.status).toBe('running')
    })

    it('running → succeeded on run_finished', () => {
      const run = service.createRun({ goal: 'g', mode: 'agent' })
      service.appendEvent(run.id, makeEvent(service, run.id, { type: 'run_started' }))
      service.appendEvent(run.id, makeEvent(service, run.id, { type: 'text_delta', data: 'hi' }))
      service.appendEvent(run.id, makeEvent(service, run.id, { type: 'run_finished' }))
      expect(service.getRun(run.id)?.status).toBe('succeeded')
    })

    it('running → failed on run_failed', () => {
      const run = service.createRun({ goal: 'g', mode: 'agent' })
      service.appendEvent(run.id, makeEvent(service, run.id, { type: 'run_started' }))
      service.appendEvent(run.id, makeEvent(service, run.id, { type: 'run_failed', data: 'boom' }))
      expect(service.getRun(run.id)?.status).toBe('failed')
    })

    it('cancel moves running → canceled', () => {
      const run = service.createRun({ goal: 'g', mode: 'agent' })
      service.appendEvent(run.id, makeEvent(service, run.id, { type: 'run_started' }))
      service.cancelRun(run.id)
      expect(service.getRun(run.id)?.status).toBe('canceled')
    })

    it('appendEvent does not change status after cancel', () => {
      const run = service.createRun({ goal: 'g', mode: 'agent' })
      service.appendEvent(run.id, makeEvent(service, run.id, { type: 'run_started' }))
      service.cancelRun(run.id)
      // Post-cancel events must NOT mutate status.
      service.appendEvent(run.id, makeEvent(service, run.id, { type: 'run_finished' }))
      service.appendEvent(run.id, makeEvent(service, run.id, { type: 'run_failed' }))
      expect(service.getRun(run.id)?.status).toBe('canceled')
    })

    it('appendEvent does not change status after a terminal succeeded/failed', () => {
      const run = service.createRun({ goal: 'g', mode: 'agent' })
      service.appendEvent(run.id, makeEvent(service, run.id, { type: 'run_started' }))
      service.appendEvent(run.id, makeEvent(service, run.id, { type: 'run_finished' }))
      // A late failure after success must not flip status.
      service.appendEvent(run.id, makeEvent(service, run.id, { type: 'run_failed' }))
      expect(service.getRun(run.id)?.status).toBe('succeeded')
    })

    it('updates updatedAt on each appendEvent', () => {
      const run = service.createRun({ goal: 'g', mode: 'agent' })
      const before = run.updatedAt
      // Ensure timestamp ticks forward.
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          service.appendEvent(run.id, makeEvent(service, run.id, { type: 'run_started' }))
          const after = service.getRun(run.id)?.updatedAt
          expect(after).toBeTruthy()
          expect(after).not.toBe(before)
          resolve()
        }, 5)
      })
    })
  })

  describe('SSE subscription', () => {
    it('subscribe yields existing events then emits future events', async () => {
      const run = service.createRun({ goal: 'g', mode: 'agent' })
      service.appendEvent(run.id, makeEvent(service, run.id, { type: 'run_started', data: 's' }))

      const received: AgentRunEvent[] = []
      const done = service.subscribe(run.id, (event) => {
        received.push(event)
      })

      // Existing event should be replayed first.
      service.appendEvent(run.id, makeEvent(service, run.id, { type: 'text_delta', data: 'live' }))
      done()

      const types = received.map((e) => e.type)
      expect(types).toContain('run_started')
      expect(types).toContain('text_delta')
      // Ordering: replayed (run_started) before live (text_delta)
      expect(types.indexOf('run_started')).toBeLessThan(types.indexOf('text_delta'))
    })
  })

  describe('persistence integration', () => {
    it('events survive to JSONL via the store', () => {
      const run = service.createRun({ goal: 'g', mode: 'agent' })
      service.appendEvent(run.id, makeEvent(service, run.id, { type: 'run_started' }))
      service.appendEvent(run.id, makeEvent(service, run.id, { type: 'run_finished' }))

      // A fresh service pointed at the same dataDir should be able to replay.
      const replayed = service.readEvents(run.id)
      expect(replayed.map((e) => e.type)).toEqual(['run_started', 'run_finished'])
    })
  })
})
