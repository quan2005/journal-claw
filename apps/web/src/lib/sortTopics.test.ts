import { describe, expect, it } from 'vitest'
import { sortEntries } from './sortTopics'
import type { TopicEntry } from './apiTypes'

function entry(name: string, is_dir = false, mtime_secs = 0): TopicEntry {
  return { name, path: name, is_dir, created_secs: 0, mtime_secs }
}

describe('sortEntries', () => {
  const mixed = [entry('banana.md', false, 100), entry('Apple', true, 50), entry('cherry.md', false, 200)]

  it('sorts name-asc case-insensitively', () => {
    expect(sortEntries(mixed, 'name-asc').map((e) => e.name)).toEqual(['Apple', 'banana.md', 'cherry.md'])
  })

  it('sorts name-desc', () => {
    expect(sortEntries(mixed, 'name-desc').map((e) => e.name)).toEqual(['cherry.md', 'banana.md', 'Apple'])
  })

  it('sorts mtime-desc (newest first)', () => {
    expect(sortEntries(mixed, 'mtime-desc').map((e) => e.name)).toEqual(['cherry.md', 'banana.md', 'Apple'])
  })

  it('sorts type-first: directories before files, each group name-asc', () => {
    expect(sortEntries(mixed, 'type-first').map((e) => e.name)).toEqual(['Apple', 'banana.md', 'cherry.md'])
  })

  it('manual strategy respects manualOrder and appends unknown entries by name-asc', () => {
    const result = sortEntries(mixed, 'manual', ['cherry.md', 'Apple'])
    expect(result.map((e) => e.name)).toEqual(['cherry.md', 'Apple', 'banana.md'])
  })

  it('manual strategy with no manualOrder falls back to name-asc', () => {
    expect(sortEntries(mixed, 'manual').map((e) => e.name)).toEqual(['Apple', 'banana.md', 'cherry.md'])
  })
})
