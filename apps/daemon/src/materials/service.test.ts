import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ChangeSetService } from '../changeset/service.js'
import { MaterialsService, rustDefaultHasherHex } from './service.js'

function fixture(): string {
  return mkdtempSync(join(tmpdir(), 'journal-daemon-materials-'))
}

describe('MaterialsService', () => {
  it('matches Rust DefaultHasher for Vec<u8> content hashes', () => {
    expect(rustDefaultHasherHex(Buffer.from('hello'))).toBe('875d2e6a522e4e9c')
    expect(rustDefaultHasherHex(Buffer.from('png'))).toBe('ab0c5dcf87645425')
  })

  it('imports files into yyMM/raw with day prefix and hash suffix', () => {
    const ws = fixture()
    const src = join(ws, 'source.txt')
    try {
      writeFileSync(src, 'hello')
      const service = new MaterialsService(
        ws,
        new ChangeSetService(ws),
        () => new Date(2026, 5, 27, 1, 2, 3),
      )
      const result = service.importFile(src)
      expect(result.year_month).toBe('2606')
      expect(result.filename).toMatch(/^27-source-[0-9a-f]{8}\.txt$/)
      expect(readFileSync(result.path, 'utf8')).toBe('hello')
    } finally {
      rmSync(ws, { recursive: true, force: true })
    }
  })

  it('imports text into raw using relative path like Rust import_text', () => {
    const ws = fixture()
    try {
      const service = new MaterialsService(
        ws,
        new ChangeSetService(ws),
        () => new Date(2026, 5, 27, 1, 2, 3),
      )
      const result = service.importText('hello')
      expect(result).toEqual({
        filename: '27-paste-20260627-010203.txt',
        path: '2606/raw/27-paste-20260627-010203.txt',
        year_month: '2606',
      })
      expect(readFileSync(join(ws, result.path), 'utf8')).toBe('hello')
    } finally {
      rmSync(ws, { recursive: true, force: true })
    }
  })

  it('writes text and image temp files outside workspace immediately', () => {
    const ws = fixture()
    try {
      const service = new MaterialsService(
        ws,
        new ChangeSetService(ws),
        () => new Date(2026, 5, 27, 1, 2, 3),
      )
      const text = service.importTextTemp('hello')
      const image = service.importImageTemp(Buffer.from('png').toString('base64'), 'image/webp')
      expect(text.filename).toBe('paste-20260627-010203.txt')
      expect(image.filename).toBe('paste-20260627-010203.webp')
      expect(existsSync(text.path)).toBe(true)
      expect(existsSync(image.path)).toBe(true)
      rmSync(text.path, { force: true })
      rmSync(image.path, { force: true })
    } finally {
      rmSync(ws, { recursive: true, force: true })
    }
  })
})
