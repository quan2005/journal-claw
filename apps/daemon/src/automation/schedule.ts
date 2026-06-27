import type { AutomationRoutine, AutomationSchedule } from './types.js'

/**
 * Schedule arithmetic — ported from Rust automation_schedule.rs.
 *
 * Like the Rust implementation, the `timezone` field is validated but the
 * actual math runs in the daemon process's local wall clock (the Rust code
 * used Local::now().naive_local() and never converted by the stored tz).
 * Keeping that behavior means identical "due" decisions across both runtimes.
 */

export function parseTime(time: string): { hour: number; minute: number } {
  const parts = time.split(':')
  if (parts.length !== 2) throw new Error('time must use HH:MM')
  const hour = Number(parts[0])
  const minute = Number(parts[1])
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new Error('time must be numeric')
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error('time must be between 00:00 and 23:59')
  }
  return { hour, minute }
}

const ALLOWED_TIMEZONES = new Set(['Asia/Hong_Kong', 'Local'])

function validateTimezone(timezone: string): void {
  if (timezone.trim() === '') throw new Error('timezone is required')
  if (!ALLOWED_TIMEZONES.has(timezone)) {
    throw new Error('first version supports Asia/Hong_Kong or Local timezone')
  }
}

export function validateSchedule(schedule: AutomationSchedule): void {
  switch (schedule.kind) {
    case 'daily':
    case 'weekdays':
      parseTime(schedule.time)
      validateTimezone(schedule.timezone)
      break
    case 'weekly':
      if (schedule.weekday > 6) {
        throw new Error('weekday must be 0..6 where 0 is Sunday')
      }
      parseTime(schedule.time)
      validateTimezone(schedule.timezone)
      break
    case 'monthly':
      if (schedule.day === 0 || schedule.day > 31) {
        throw new Error('monthly day must be 1..31')
      }
      parseTime(schedule.time)
      validateTimezone(schedule.timezone)
      break
  }
}

interface Ymdhm {
  year: number
  month: number // 1-12
  day: number
  hour: number
  minute: number
}

function atDate(base: Ymdhm, time: string): Date {
  const { hour, minute } = parseTime(time)
  return new Date(base.year, base.month - 1, base.day, hour, minute, 0, 0)
}

function dateYmd(date: Date): Ymdhm {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  }
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** Sunday = 0 .. Saturday = 6, matching chrono Weekday::num_days_from_sunday. */
function numDaysFromSunday(date: Date): number {
  return date.getDay()
}

function isWeekday(date: Date): boolean {
  const d = date.getDay()
  return d >= 1 && d <= 5
}

function nextDaily(time: string, after: Date): Date {
  const today = atDate(dateYmd(after), time)
  return after < today ? today : addDays(today, 1)
}

function nextWeekdays(time: string, after: Date): Date {
  for (let offset = 0; offset <= 7; offset += 1) {
    const date = addDays(atStartOfDay(after), offset)
    if (isWeekday(date)) {
      const candidate = atDate(dateYmd(date), time)
      if (after < candidate) return candidate
    }
  }
  throw new Error('could not compute weekday schedule')
}

function nextWeekly(weekday: number, time: string, after: Date): Date {
  for (let offset = 0; offset <= 7; offset += 1) {
    const date = addDays(atStartOfDay(after), offset)
    if (numDaysFromSunday(date) === weekday) {
      const candidate = atDate(dateYmd(date), time)
      if (after < candidate) return candidate
    }
  }
  throw new Error('could not compute weekly schedule')
}

function nextMonthly(day: number, time: string, after: Date): Date {
  let { year, month } = dateYmd(after)
  for (let i = 0; i < 14; i += 1) {
    const candidate = safeDate(year, month, day)
    if (candidate) {
      const at = atDate(dateYmd(candidate), time)
      if (after < at) return at
    }
    if (month === 12) {
      year += 1
      month = 1
    } else {
      month += 1
    }
  }
  throw new Error('could not compute monthly schedule')
}

/** Next scheduled fire strictly after `after`. Throws on invalid schedule. */
export function nextRunAfter(schedule: AutomationSchedule, after: Date): Date {
  validateSchedule(schedule)
  switch (schedule.kind) {
    case 'daily':
      return nextDaily(schedule.time, after)
    case 'weekdays':
      return nextWeekdays(schedule.time, after)
    case 'weekly':
      return nextWeekly(schedule.weekday, schedule.time, after)
    case 'monthly':
      return nextMonthly(schedule.day, schedule.time, after)
  }
}

function atStartOfDay(date: Date): Date {
  const { year, month, day } = dateYmd(date)
  return new Date(year, month - 1, day, 0, 0, 0, 0)
}

function safeDate(year: number, month: number, day: number): Date | null {
  const d = new Date(year, month - 1, day, 0, 0, 0, 0)
  if (d.getFullYear() !== year || d.getMonth() + 1 !== month || d.getDate() !== day) {
    return null
  }
  return d
}

/**
 * Most recent fire time at or before `now` (null if none within the scan
 * window). Mirrors Rust latest_due_at, used to decide whether a routine is due.
 */
function latestDueAt(schedule: AutomationSchedule, now: Date): Date | null {
  validateSchedule(schedule)
  switch (schedule.kind) {
    case 'daily': {
      const today = atDate(dateYmd(now), schedule.time)
      return today <= now ? today : addDays(today, -1)
    }
    case 'weekdays': {
      for (let offset = 0; offset <= 7; offset += 1) {
        const date = addDays(atStartOfDay(now), -offset)
        if (isWeekday(date)) {
          const candidate = atDate(dateYmd(date), schedule.time)
          if (candidate <= now) return candidate
        }
      }
      return null
    }
    case 'weekly': {
      for (let offset = 0; offset <= 7; offset += 1) {
        const date = addDays(atStartOfDay(now), -offset)
        if (numDaysFromSunday(date) === schedule.weekday) {
          const candidate = atDate(dateYmd(date), schedule.time)
          if (candidate <= now) return candidate
        }
      }
      return null
    }
    case 'monthly': {
      let { year, month } = dateYmd(now)
      for (let i = 0; i < 14; i += 1) {
        const candidateDate = safeDate(year, month, schedule.day)
        if (candidateDate) {
          const candidate = atDate(dateYmd(candidateDate), schedule.time)
          if (candidate <= now) return candidate
        }
        if (month === 1) {
          year -= 1
          month = 12
        } else {
          month -= 1
        }
      }
      return null
    }
  }
}

/** Parse an RFC3339 string into a local Date (Rust parsed to naive_local). */
function parseRfc3339Local(value: string): Date | null {
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : new Date(ms)
}

/**
 * Should this routine fire at `now`? True when its latest due time is covered
 * neither by its creation time nor its last run — matching Rust should_run_due.
 */
export function shouldRunDue(routine: AutomationRoutine, now: Date): boolean {
  const dueAt = latestDueAt(routine.schedule, now)
  if (!dueAt) return false

  const createdAt = parseRfc3339Local(routine.created_at)
  if (createdAt && createdAt > dueAt) return false

  const lastRun = routine.last_run
    ? parseRfc3339Local(routine.last_run.started_at)
    : null
  return lastRun ? lastRun < dueAt : true
}

export interface NextWaitOptions {
  inFlight?: ReadonlySet<string>
}

/**
 * How long the scheduler should wait before its next tick. 0 when an enabled,
 * non-in-flight routine is already due; otherwise the gap to the earliest
 * next fire; 1 hour when no schedules exist — mirroring Rust next_wait_duration.
 */
export function nextWaitMs(
  routines: readonly AutomationRoutine[],
 now: Date,
 opts: NextWaitOptions = {},
): number {
  const inFlight = opts.inFlight ?? EMPTY_SET
  for (const routine of routines) {
    if (!routine.enabled) continue
    if (inFlight.has(routine.id)) continue
    if (shouldRunDue(routine, now)) return 0
  }

  let earliest: number | null = null
  for (const routine of routines) {
    if (!routine.enabled) continue
    try {
      const fire = nextRunAfter(routine.schedule, now).getTime()
      if (earliest === null || fire < earliest) earliest = fire
    } catch {
      // Skip routines with unresolvable schedules (e.g. monthly day 31 in Feb).
    }
  }
  if (earliest === null) return 60 * 60 * 1000
  const wait = earliest - now.getTime()
  return wait > 0 ? wait : 1000
}

const EMPTY_SET: ReadonlySet<string> = new Set()
