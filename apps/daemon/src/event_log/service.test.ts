import { describe, expect, it } from 'vitest'
import { EventLogService } from './service.js'

describe('EventLogService', () => {
  it('records events and returns events after a sequence', () => {
    const log = new EventLogService()
    const first = log.record('todos-updated', null)
    const second = log.record('journal-updated', '2606')
    expect(log.eventsSince(first)).toMatchObject([{ seq: second, kind: 'journal-updated' }])
  })
})
