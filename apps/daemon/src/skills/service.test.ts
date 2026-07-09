import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SettingsService } from '../settings/service.js'
import { SkillsService } from './service.js'

describe('SkillsService', () => {
  it('lists project skills and persists disabled skills through SettingsService', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'journal-skills-'))
    const skillDir = join(workspace, '.agents', 'skills', 'demo')
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      '---\nname: Demo\ndescription: Test skill\ntriggers:\n  - "/demo"\noutput: done\n---\n',
    )
    const settings = new SettingsService(workspace)
    const service = new SkillsService(workspace, settings, workspace, workspace)

    expect(service.listSkills()).toMatchObject([
      {
        id: 'project:demo',
        name: 'Demo',
        scope: 'project',
        enabled: true,
        triggers: [{ kind: 'slash', label: '/demo' }],
      },
    ])

    service.setSkillEnabled('project:demo', false)
    expect(JSON.parse(readFileSync(join(workspace, '.setting.json'), 'utf8'))).toMatchObject({
      disabled_skills: ['project:demo'],
    })
    expect(service.listSkills()[0].enabled).toBe(false)
  })

  it('enables global skills through enabled_global_skills', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'journal-skills-ws-'))
    const home = mkdtempSync(join(tmpdir(), 'journal-skills-home-'))
    const skillDir = join(home, '.agent', 'skills', 'global-demo')
    mkdirSync(skillDir, { recursive: true })
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: Global Demo\n---\n')
    const service = new SkillsService(workspace, new SettingsService(workspace), workspace, home)

    expect(service.listSkills()[0].enabled).toBe(false)
    service.setGlobalSkillEnabled('global:global-demo', true)
    expect(service.listSkills()[0].enabled).toBe(true)
  })
})
