import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SettingsService } from '../settings/service.js'
import { AutoLintService } from './service.js'

describe('AutoLintService', () => {
  it('counts new journal entries and writes trigger checkpoint', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'journal-auto-lint-'))
    mkdirSync(join(workspace, '.journal', 'memory', '2606'), { recursive: true })
    writeFileSync(join(workspace, '.journal', 'memory', '2606', '01-a.md'), 'a')
    const settings = new SettingsService(workspace)
    settings.update({
      auto_lint: { enabled: true, frequency: 'daily', time: '03:00', min_entries: 10 },
    })
    const service = new AutoLintService(workspace, settings, () => new Date(2026, 5, 27, 4, 0, 0))

    expect(service.getStatus()).toMatchObject({ state: 'never_run', current_new_entries: 1 })
    service.triggerLintNow()
    expect(existsSync(join(workspace, '.claude', 'last-lint.json'))).toBe(true)
    expect(service.getStatus()).toMatchObject({ state: 'idle', current_new_entries: 0 })
  })
})
