import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ChangeSetService } from '../changeset/service.js'
import { IdentityService, parseIdentityFilename } from './service.js'

function fixture(): string {
  return mkdtempSync(join(tmpdir(), 'journal-daemon-identity-'))
}

describe('IdentityService', () => {
  it('parses identity filenames and creates README self identity on list', () => {
    const ws = fixture()
    try {
      expect(parseIdentityFilename('广州-张三.md')).toEqual({ region: '广州', name: '张三' })
      const service = new IdentityService(ws, new ChangeSetService(ws))
      expect(service.list()[0]).toMatchObject({
        filename: 'README.md',
        name: '关于我',
        speaker_id: '',
      })
    } finally {
      rmSync(ws, { recursive: true, force: true })
    }
  })

  it('creates, archives, unarchives, and preserves speaker_id/expert fields', () => {
    const ws = fixture()
    try {
      const service = new IdentityService(ws, new ChangeSetService(ws))
      const path = service.create('广州', '张三', '简介', ['专家'], 'spk-1')
      expect(service.list().find((entry) => entry.name === '张三')).toMatchObject({
        is_expert: true,
        speaker_id: 'spk-1',
      })
      service.archive(path)
      expect(service.list().find((entry) => entry.name === '张三')?.archived).toBe(true)
      service.unarchive(path)
      expect(readFileSync(path, 'utf8')).not.toContain('archived: true')
    } finally {
      rmSync(ws, { recursive: true, force: true })
    }
  })

  it('lists YAML block array aliases and archived bool like Rust gray_matter', () => {
    const ws = fixture()
    try {
      const service = new IdentityService(ws, new ChangeSetService(ws))
      service.list()
      writeFileSync(
        join(ws, '.journal', 'identity', '北京-李四.md'),
        '---\nsummary: "简介含\\"引号\\""\ntags:\n  - expert\naliases:\n  - 老李\nexpert_skill: "skill-a"\nspeaker_id: "spk-2"\narchived: true\n---\n\n# 李四\n',
      )
      expect(service.list().find((entry) => entry.name === '李四')).toMatchObject({
        summary: '简介含"引号"',
        aliases: ['老李'],
        is_expert: true,
        archived: true,
        speaker_id: 'spk-2',
      })
    } finally {
      rmSync(ws, { recursive: true, force: true })
    }
  })

  it('voice_only merge copies speaker_id to empty target and deletes source', () => {
    const ws = fixture()
    try {
      const service = new IdentityService(ws, new ChangeSetService(ws))
      const source = service.create('广州', '来源', 's', [], 'spk-src')
      const target = service.create('广州', '目标', 't', [], '')
      service.merge(source, target, 'voice_only')
      expect(readFileSync(target, 'utf8')).toContain('speaker_id: "spk-src"')
      expect(service.list().some((entry) => entry.name === '来源')).toBe(false)
    } finally {
      rmSync(ws, { recursive: true, force: true })
    }
  })

  it('refuses to delete README.md', () => {
    const ws = fixture()
    try {
      const service = new IdentityService(ws, new ChangeSetService(ws))
      service.list()
      expect(() => service.delete(join(ws, '.journal', 'identity', 'README.md'))).toThrow('不可删除')
    } finally {
      rmSync(ws, { recursive: true, force: true })
    }
  })
})
