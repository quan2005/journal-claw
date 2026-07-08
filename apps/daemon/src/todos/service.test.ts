import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ChangeSetService } from '../changeset/service.js'
import { TodosService, parseTodos } from './service.js'

function fixture(): string {
  return mkdtempSync(join(tmpdir(), 'journal-daemon-todos-'))
}

describe('TodosService', () => {
  it('parses GFM todos with Rust-compatible comment metadata', () => {
    const items = parseTodos(
      '- [ ] short <!-- due:2026-06-30 --> <!-- path:a.md -->\n- [x] done <!-- done:2026-06-27 -->',
      false,
    )
    expect(items[0]).toMatchObject({
      text: 'short',
      due: '2026-06-30',
      path: 'a.md',
      line_index: 0,
    })
    expect(items[1]).toMatchObject({ done: true, done_date: '2026-06-27' })
  })

  it('adds, toggles, updates metadata, and preserves line_index semantics', () => {
    const ws = fixture()
    try {
      const service = new TodosService(ws, new ChangeSetService(ws), () => new Date(2026, 5, 27))
      const added = service.add('hello\nworld', '2026-06-30', 's.md', 'p.md')
      expect(added.text).toBe('hello\nworld')
      expect(readFileSync(join(ws, '.journal', 'todos.md'), 'utf8')).toContain(
        '<!-- text:hello%0Aworld -->',
      )

      service.setSessionId(added.line_index, 'sid-1', false)
      service.updateText(added.line_index, 'next', false)
      expect(service.list()[0]).toMatchObject({ text: 'next', session_id: 'sid-1' })

      service.toggle(added.line_index, true, false)
      expect(service.list()[0]).toMatchObject({
        done: true,
        done_file: true,
        done_date: '2026-06-27',
      })
      service.toggle(0, false, true)
      expect(service.list().some((item) => !item.done && item.text === 'next')).toBe(true)
    } finally {
      rmSync(ws, { recursive: true, force: true })
    }
  })

  it('lists todos.md items before todos.done.md items', () => {
    const ws = fixture()
    try {
      mkdirSync(join(ws, '.journal'), { recursive: true })
      writeFileSync(join(ws, '.journal', 'todos.md'), '- [ ] active\n')
      writeFileSync(join(ws, '.journal', 'todos.done.md'), '- [x] old\n')
      const service = new TodosService(ws, new ChangeSetService(ws))
      expect(service.list().map((item) => item.text)).toEqual(['active', 'old'])
    } finally {
      rmSync(ws, { recursive: true, force: true })
    }
  })
})
