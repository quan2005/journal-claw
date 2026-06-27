import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DirectiveMigrationService, hasLegacyDirective } from './service.js'

describe('DirectiveMigrationService', () => {
  it('scans legacy directives while ignoring fenced examples', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'journal-directive-'))
    mkdirSync(join(workspace, '2606'), { recursive: true })
    writeFileSync(join(workspace, '2606', '01-note.md'), ':::quote\ntext: visible\n:::')
    writeFileSync(join(workspace, '2606', '02-example.md'), '```md\n:::quote\n:::\n```')
    const service = new DirectiveMigrationService(workspace)
    expect(hasLegacyDirective('```md\n:::quote\n:::\n```')).toBe(false)
    expect(service.scanLegacyDirectiveFiles()).toMatchObject([
      { relative_path: '2606/01-note.md', extension: 'md' },
    ])
  })

  it('backs up and renames markdown to mdx after validation', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'journal-directive-apply-'))
    mkdirSync(join(workspace, '2606'), { recursive: true })
    const source = join(workspace, '2606', '01-note.md')
    const destination = join(workspace, '2606', '01-note.mdx')
    writeFileSync(source, ':::quote\ntext: old\n:::')
    const service = new DirectiveMigrationService(workspace, () => new Date(2026, 5, 27, 12, 0, 0))

    const result = service.applyDirectiveMigration({
      source_path: source,
      destination_path: destination,
      content: '<Quote text="new" />',
    })

    expect(existsSync(source)).toBe(false)
    expect(readFileSync(destination, 'utf8')).toBe('<Quote text="new" />')
    expect(readFileSync(result.backup_path, 'utf8')).toContain('old')
  })
})
