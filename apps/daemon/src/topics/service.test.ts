import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

  it('parses frontmatter title for .md/.mdx notes and leaves it absent otherwise', () => {
    const ws = fixture()
    try {
      mkdirSync(join(ws, 'topics'), { recursive: true })
      const service = new TopicsService(ws, new ChangeSetService(ws))
      writeFileSync(
        join(ws, 'topics', 'titled.md'),
        '---\ntitle: 我的笔记标题\n---\n\n正文',
      )
      writeFileSync(join(ws, 'topics', 'plain.md'), '# 没有frontmatter')
      writeFileSync(join(ws, 'topics', 'notes.mdx'), '---\ntitle: "MDX Title"\n---\nbody')
      writeFileSync(join(ws, 'topics', 'data.json'), '{}')
      const byName = new Map(service.listDir('').map((e) => [e.name, e]))
      expect(byName.get('titled.md')?.title).toBe('我的笔记标题')
      expect(byName.get('notes.mdx')?.title).toBe('MDX Title')
      expect(byName.get('plain.md')?.title).toBeUndefined()
      expect(byName.get('data.json')?.title).toBeUndefined()
    } finally {
      rmSync(ws, { recursive: true, force: true })
    }
  })
})
