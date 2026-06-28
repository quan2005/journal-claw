import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SettingsService, SettingsValidationError } from './service.js'

describe('SettingsService', () => {
  let ws: string

  beforeEach(() => {
    ws = join(tmpdir(), 'journal-settings-' + Math.random().toString(36).slice(2))
    mkdirSync(ws, { recursive: true })
  })

  afterEach(() => {
    try {
      rmSync(ws, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('returns Rust-compatible defaults when .setting.json is absent', () => {
    const settings = new SettingsService(ws).load()
    expect(settings).toMatchObject({
      theme: 'system',
      auto_lint: {
        enabled: false,
        frequency: 'daily',
        time: '03:00',
        min_entries: 10,
      },
      global_skills_enabled: false,
    })
  })

  it('reads an existing .setting.json and fills missing nested defaults', () => {
    writeFileSync(
      join(ws, '.setting.json'),
      JSON.stringify({
        theme: 'dark',
        auto_lint: { enabled: true, frequency: 'weekly' },
        global_skills_enabled: true,
        disabled_skills: ['project:journal'],
      }),
      'utf8',
    )

    const settings = new SettingsService(ws).load()
    expect(settings.theme).toBe('dark')
    expect(settings.auto_lint).toEqual({
      enabled: true,
      frequency: 'weekly',
      time: '03:00',
      min_entries: 10,
    })
    expect(settings.global_skills_enabled).toBe(true)
    expect(settings.disabled_skills).toEqual(['project:journal'])
  })

  it('partially updates auto_lint without dropping existing fields', () => {
    writeFileSync(
      join(ws, '.setting.json'),
      JSON.stringify({
        theme: 'light',
        auto_lint: { enabled: false, frequency: 'daily', time: '12:00', min_entries: 20 },
      }),
      'utf8',
    )

    const settings = new SettingsService(ws).update({
      auto_lint: { enabled: true, frequency: 'monthly' },
    })

    expect(settings.auto_lint).toEqual({
      enabled: true,
      frequency: 'monthly',
      time: '12:00',
      min_entries: 20,
    })
    const persisted = JSON.parse(readFileSync(join(ws, '.setting.json'), 'utf8'))
    expect(persisted.auto_lint).toEqual({
      enabled: true,
      frequency: 'monthly',
      time: '12:00',
      min_entries: 20,
    })
  })

  it('preserves unknown top-level and nested fields during updates', () => {
    writeFileSync(
      join(ws, '.setting.json'),
      JSON.stringify({
        theme: 'system',
        future_flag: { keep: true },
        auto_lint: { enabled: false, custom: 'keep-me' },
      }),
      'utf8',
    )

    new SettingsService(ws).update({ theme: 'dark', auto_lint: { time: '22:00' } })

    const persisted = JSON.parse(readFileSync(join(ws, '.setting.json'), 'utf8'))
    expect(persisted.future_flag).toEqual({ keep: true })
    expect(persisted.auto_lint.custom).toBe('keep-me')
    expect(persisted.auto_lint.time).toBe('22:00')
  })

  it('removes optional skill lists when patch value is null', () => {
    writeFileSync(
      join(ws, '.setting.json'),
      JSON.stringify({
        disabled_skills: ['project:journal'],
        enabled_global_skills: ['global:writer'],
      }),
      'utf8',
    )

    new SettingsService(ws).update({ disabled_skills: null })

    const persisted = JSON.parse(readFileSync(join(ws, '.setting.json'), 'utf8'))
    expect(persisted.disabled_skills).toBeUndefined()
    expect(persisted.enabled_global_skills).toEqual(['global:writer'])
  })

  it('rejects invalid theme', () => {
    expect(() => new SettingsService(ws).update({ theme: 'auto' })).toThrow(SettingsValidationError)
  })

  it('rejects invalid auto_lint frequency', () => {
    expect(() =>
      new SettingsService(ws).update({ auto_lint: { frequency: 'hourly' } }),
    ).toThrow(SettingsValidationError)
  })

  // P2 unified conversation panel: the selected chat engine (built-in pi vs an
  // external CLI agent) persists through the same generic unknown-field path.
  // Verifies PUT /settings { agent_engine, agent_id } round-trips so the web
  // useAgentEngine hook can restore the user's last choice across restarts.
  it('persists the agent_engine and agent_id selection across partial updates', () => {
    new SettingsService(ws).update({ agent_engine: 'cli', agent_id: 'codex' })
    let settings = new SettingsService(ws).load()
    expect(settings.agent_engine).toBe('cli')
    expect(settings.agent_id).toBe('codex')

    // Switching only the engine must not clobber the previously chosen agent.
    new SettingsService(ws).update({ agent_engine: 'builtin' })
    settings = new SettingsService(ws).load()
    expect(settings.agent_engine).toBe('builtin')
    expect(settings.agent_id).toBe('codex')
  })
})
