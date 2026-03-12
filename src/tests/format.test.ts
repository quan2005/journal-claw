import { describe, it, expect } from 'vitest'
import { formatDuration, formatYearMonth, formatDisplayDate } from '../lib/format'

describe('formatDuration', () => {
  it('formats zero seconds', () => {
    expect(formatDuration(0)).toBe('0:00')
  })
  it('formats seconds under one minute', () => {
    expect(formatDuration(45)).toBe('0:45')
  })
  it('formats minutes and seconds', () => {
    expect(formatDuration(154)).toBe('2:34')
  })
  it('formats exactly one hour', () => {
    expect(formatDuration(3600)).toBe('1:00:00')
  })
  it('formats over one hour', () => {
    expect(formatDuration(3661)).toBe('1:01:01')
  })
})

describe('formatYearMonth', () => {
  it('extracts year_month from display_name', () => {
    expect(formatYearMonth('录音 2026-03-12 22:41')).toBe('202603')
  })
  it('returns 000000 for unrecognised format', () => {
    expect(formatYearMonth('unknown')).toBe('000000')
  })
})

describe('formatDisplayDate', () => {
  it('passes through display_name unchanged', () => {
    expect(formatDisplayDate('录音 2026-03-12 22:41')).toBe('录音 2026-03-12 22:41')
  })
})
