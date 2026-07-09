import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { migrateGlobalAgentDir } from './globalMigration.js'

describe('migrateGlobalAgentDir', () => {
  let home: string
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'global-agent-migration-'))
  })
  afterEach(() => {
    rmSync(home, { recursive: true, force: true })
  })

  it('moves ~/.claude/skills → ~/.agent/skills and plugins/cache → ~/.agent/plugins/cache', () => {
    mkdirSync(join(home, '.claude', 'skills', 'demo'), { recursive: true })
    writeFileSync(join(home, '.claude', 'skills', 'demo', 'SKILL.md'), 'skill')
    mkdirSync(join(home, '.claude', 'plugins', 'cache', 'pub', 'plugin', '1.0.0'), {
      recursive: true,
    })
    writeFileSync(
      join(home, '.claude', 'plugins', 'cache', 'pub', 'plugin', '1.0.0', 'pkg.json'),
      '{}',
    )

    migrateGlobalAgentDir(home)

    expect(existsSync(join(home, '.claude', 'skills'))).toBe(false)
    expect(existsSync(join(home, '.claude', 'plugins', 'cache'))).toBe(false)
    expect(readFileSync(join(home, '.agent', 'skills', 'demo', 'SKILL.md'), 'utf8')).toBe(
      'skill',
    )
    expect(
      readFileSync(
        join(home, '.agent', 'plugins', 'cache', 'pub', 'plugin', '1.0.0', 'pkg.json'),
        'utf8',
      ),
    ).toBe('{}')
  })

  it('is a no-op when no legacy ~/.claude exists', () => {
    migrateGlobalAgentDir(home)
    expect(existsSync(join(home, '.agent'))).toBe(false)
  })

  it('never overwrites an existing ~/.agent destination', () => {
    mkdirSync(join(home, '.claude', 'skills', 'old'), { recursive: true })
    writeFileSync(join(home, '.claude', 'skills', 'old', 'SKILL.md'), 'old')
    mkdirSync(join(home, '.agent', 'skills', 'new'), { recursive: true })
    writeFileSync(join(home, '.agent', 'skills', 'new', 'SKILL.md'), 'new')

    const warnings: string[] = []
    const originalWarn = console.warn
    console.warn = (msg: string) => warnings.push(msg)
    try {
      migrateGlobalAgentDir(home)
    } finally {
      console.warn = originalWarn
    }

    expect(readFileSync(join(home, '.claude', 'skills', 'old', 'SKILL.md'), 'utf8')).toBe(
      'old',
    )
    expect(readFileSync(join(home, '.agent', 'skills', 'new', 'SKILL.md'), 'utf8')).toBe(
      'new',
    )
    expect(existsSync(join(home, '.agent', 'skills', 'old'))).toBe(false)
    expect(warnings.some((msg) => msg.includes('skipping'))).toBe(true)
  })

  it('is idempotent on a second call', () => {
    mkdirSync(join(home, '.claude', 'skills', 'demo'), { recursive: true })
    writeFileSync(join(home, '.claude', 'skills', 'demo', 'SKILL.md'), 'skill')

    migrateGlobalAgentDir(home)

    const warnings: string[] = []
    const originalWarn = console.warn
    console.warn = (msg: string) => warnings.push(msg)
    try {
      migrateGlobalAgentDir(home)
    } finally {
      console.warn = originalWarn
    }
    expect(warnings).toEqual([])
    expect(readFileSync(join(home, '.agent', 'skills', 'demo', 'SKILL.md'), 'utf8')).toBe(
      'skill',
    )
  })
})
