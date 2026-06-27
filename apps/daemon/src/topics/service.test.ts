import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ChangeSetService } from '../changeset/service.js'
import { TopicsService } from './service.js'

function fixture(): string {
  return mkdtempSync(join(tmpdir(), 'journal-daemon-topics-'))
}

describe('TopicsService', () => {
  it('lists directories first then files alphabetically and skips hidden entries', () => {
    const ws = fixture()
    try {
      const service = new TopicsService(ws, new ChangeSetService(ws))
      service.create('B')
      service.create('A')
      writeFileSync(join(ws, 'topics', 'z.md'), 'z')
      writeFileSync(join(ws, 'topics', '.hidden'), '')
      expect(service.listDir('').map((entry) => entry.name)).toEqual(['A', 'B', 'z.md'])
    } finally {
      rmSync(ws, { recursive: true, force: true })
    }
  })

  it('imports a file into a topic directory and returns workspace-topic relative path', () => {
    const ws = fixture()
    const src = join(ws, 'src.txt')
    try {
      writeFileSync(src, 'hello')
      const service = new TopicsService(ws, new ChangeSetService(ws))
      service.create('A')
      expect(service.importFile(src, 'A')).toBe('A/src.txt')
      expect(readFileSync(join(ws, 'topics', 'A', 'src.txt'), 'utf8')).toBe('hello')
    } finally {
      rmSync(ws, { recursive: true, force: true })
    }
  })
})
