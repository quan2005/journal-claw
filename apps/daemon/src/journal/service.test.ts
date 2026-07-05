import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ChangeSetService } from '../changeset/service.js'
import { JournalService, parseEntryFilename } from './service.js'

function fixture(): string {
  return mkdtempSync(join(tmpdir(), 'journal-daemon-journal-'))
}

describe('JournalService', () => {
  it('parses Rust-compatible filenames and ignores unsupported names', () => {
    expect(parseEntryFilename('28-AI平台.md')).toEqual({ day: 28, title: 'AI平台' })
    expect(parseEntryFilename('01-dashboard.html')).toEqual({ day: 1, title: 'dashboard' })
    expect(parseEntryFilename('README.md')).toBeNull()
  })

  it('lists months and entries with Rust sorting and metadata parsing', () => {
    const ws = fixture()
    try {
      const service = new JournalService(ws, new ChangeSetService(ws))
      writeFileSync(join(ws, 'note.txt'), '')
      mkdirSync(join(ws, '2605'), { recursive: true })
      mkdirSync(join(ws, '2606'), { recursive: true })
      writeFileSync(
        join(ws, '2606', '27-会议.md'),
        '---\nsummary: "\\"摘要\\""\ntags:\n  - a\n  - "b"\nsources:\n  - 2606/raw/a.txt\n---\n正文',
      )
      writeFileSync(
        join(ws, '2605', '03-page.html'),
        '<!--\ntags: 示例, 产品\nsummary: HTML 摘要\nsources: 2605/raw/a.txt\n-->\n<h1>x</h1>',
      )

      expect(service.listMonths()).toEqual(['2606', '2605'])
      expect(service.listAll().map((entry) => entry.filename)).toEqual([
        '27-会议.md',
        '03-page.html',
      ])
      expect(service.list('2606')[0]).toMatchObject({
        title: '会议',
        summary: '摘要',
        tags: ['a', 'b'],
        sources: ['2606/raw/a.txt'],
      })
      expect(service.listPaginated(1, 1)[0][0].filename).toBe('03-page.html')
    } finally {
      rmSync(ws, { recursive: true, force: true })
    }
  })

  it('creates sample entry only when needed', () => {
    const ws = fixture()
    try {
      const service = new JournalService(ws, new ChangeSetService(ws), () => new Date(2026, 5, 27))
      expect(service.createSampleEntryIfNeeded()).toBe(true)
      expect(service.createSampleEntryIfNeeded()).toBe(false)
      expect(service.listMonths()).toEqual(['2606'])
      expect(service.list('2606')[0].filename).toBe('27-产品评审示例.html')
    } finally {
      rmSync(ws, { recursive: true, force: true })
    }
  })
})
