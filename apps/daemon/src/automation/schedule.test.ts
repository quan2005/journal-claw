import { describe, expect, it } from 'vitest'
import { nextRunAfter, nextWaitMs, parseTime, shouldRunDue, validateSchedule } from './schedule.js'
import type { AutomationRoutine, AutomationSchedule } from './types.js'

// The schedule arithmetic mirrors the Rust implementation that ran in the
// daemon process's local wall clock. Pin the test timezone to Hong Kong so
// the assertions are stable regardless of the CI runner's default timezone.
process.env.TZ = 'Asia/Hong_Kong'

const HK = 'Asia/Hong_Kong'

function daily(time: string): AutomationSchedule {
  return { kind: 'daily', time, timezone: HK }
}

function routine(overrides: Partial<AutomationRoutine>): AutomationRoutine {
  return {
    id: 'r1',
    title: 'r1',
    template_id: null,
    prompt: 'run',
    schedule: daily('08:00'),
    scope: { kind: 'workspace' },
    enabled: true,
    full_agent_access: true,
    created_at: '2026-05-30T08:00:00+08:00',
    updated_at: '2026-05-30T08:00:00+08:00',
    last_run: null,
    ...overrides,
  }
}

describe('schedule.parseTime / validateSchedule', () => {
  it('rejects invalid time strings', () => {
    expect(() => parseTime('24:00')).toThrow()
    expect(() => parseTime('08')).toThrow()
    expect(() => parseTime('aa:bb')).toThrow()
  })

  it('rejects invalid weekday, day, and timezone', () => {
    expect(() =>
      validateSchedule({ kind: 'weekly', weekday: 7, time: '09:00', timezone: HK }),
    ).toThrow()
    expect(() =>
      validateSchedule({ kind: 'monthly', day: 0, time: '09:00', timezone: HK }),
    ).toThrow()
    expect(() =>
      validateSchedule({ kind: 'monthly', day: 32, time: '09:00', timezone: HK }),
    ).toThrow()
    expect(() => validateSchedule({ kind: 'daily', time: '09:00', timezone: '' })).toThrow()
    expect(() => validateSchedule({ kind: 'daily', time: '09:00', timezone: 'UTC' })).toThrow()
  })
})

describe('schedule.nextRunAfter', () => {
  it('daily uses today when time is future', () => {
    expect(nextRunAfter(daily('08:00'), new Date(2026, 4, 30, 7, 30))).toEqual(
      new Date(2026, 4, 30, 8, 0),
    )
  })

  it('daily uses tomorrow when time has passed', () => {
    expect(nextRunAfter(daily('08:00'), new Date(2026, 4, 30, 8, 0))).toEqual(
      new Date(2026, 4, 31, 8, 0),
    )
  })

  it('weekdays skips the weekend', () => {
    // 2026-05-30 is a Saturday; next weekday fire is Monday 06-01 09:00.
    expect(
      nextRunAfter({ kind: 'weekdays', time: '09:00', timezone: HK }, new Date(2026, 4, 30, 10, 0)),
    ).toEqual(new Date(2026, 5, 1, 9, 0))
  })

  it('weekly uses the requested weekday', () => {
    expect(
      nextRunAfter(
        { kind: 'weekly', weekday: 5, time: '17:30', timezone: HK },
        new Date(2026, 4, 30, 10, 0),
      ),
    ).toEqual(new Date(2026, 5, 5, 17, 30))
  })

  it('weekly exact boundary rolls to next week', () => {
    expect(
      nextRunAfter(
        { kind: 'weekly', weekday: 5, time: '17:30', timezone: HK },
        new Date(2026, 5, 5, 17, 30),
      ),
    ).toEqual(new Date(2026, 5, 12, 17, 30))
  })

  it('monthly skips months without the day', () => {
    expect(
      nextRunAfter(
        { kind: 'monthly', day: 31, time: '09:00', timezone: HK },
        new Date(2026, 5, 1, 0, 0),
      ),
    ).toEqual(new Date(2026, 6, 31, 9, 0))
  })
})

describe('schedule.shouldRunDue', () => {
  it('is not due before the routine existed', () => {
    const r = routine({ created_at: '2026-05-30T09:00:00+08:00' })
    expect(shouldRunDue(r, new Date(2026, 4, 30, 10, 0))).toBe(false)
  })

  it('is due when never run', () => {
    const r = routine({ created_at: '2026-05-29T08:00:00+08:00' })
    expect(shouldRunDue(r, new Date(2026, 4, 30, 10, 0))).toBe(true)
  })

  it('is not due when last run covers the latest due time', () => {
    const r = routine({
      created_at: '2026-05-29T08:00:00+08:00',
      last_run: {
        id: 'run_1',
        status: 'succeeded',
        trigger: 'manual',
        started_at: '2026-05-30T08:30:00+08:00',
        completed_at: '2026-05-30T08:31:00+08:00',
        summary: 'done',
        error: null,
        conversation_id: 's1',
      },
    })
    expect(shouldRunDue(r, new Date(2026, 4, 30, 10, 0))).toBe(false)
  })
})

describe('schedule.nextWaitMs', () => {
  it('uses the earliest enabled schedule', () => {
    const routines = [
      routine({ id: 'disabled', enabled: false, schedule: daily('08:01') }),
      routine({ id: 'later', schedule: daily('09:00') }),
      routine({ id: 'soon', schedule: daily('08:30') }),
    ]
    expect(nextWaitMs(routines, new Date(2026, 4, 30, 8, 0))).toBe(30 * 60 * 1000)
  })

  it('is immediate when a routine missed its due time', () => {
    const r = routine({ id: 'missed', created_at: '2026-05-29T08:00:00+08:00' })
    expect(nextWaitMs([r], new Date(2026, 4, 30, 10, 0))).toBe(0)
  })

  it('ignores due routines already in flight', () => {
    const r = routine({ id: 'missed', created_at: '2026-05-29T08:00:00+08:00' })
    const wait = nextWaitMs([r], new Date(2026, 4, 30, 10, 0), {
      inFlight: new Set(['missed']),
    })
    expect(wait).toBeGreaterThan(0)
  })

  it('is immediate when any due routine is not in flight', () => {
    const running = routine({ id: 'running', created_at: '2026-05-29T08:00:00+08:00' })
    const waiting = routine({ id: 'waiting', created_at: '2026-05-29T08:00:00+08:00' })
    expect(
      nextWaitMs([running, waiting], new Date(2026, 4, 30, 10, 0), {
        inFlight: new Set(['running']),
      }),
    ).toBe(0)
  })

  it('defaults to one hour when no routines exist', () => {
    expect(nextWaitMs([], new Date(2026, 4, 30, 8, 0))).toBe(60 * 60 * 1000)
  })
})
