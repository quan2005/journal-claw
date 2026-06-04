import { describe, expect, it } from 'vitest'
import { parseJournalLayout } from '../lib/journalLayout'

describe('parseJournalLayout validation', () => {
  it('validates fields bodies', () => {
    const result = parseJournalLayout(`:::hero
eyebrow: Deep note
title: Structure before style
subtitle: Blocks define reading rhythm
:::`)

    expect(result.segments[0]).toMatchObject({
      kind: 'block',
      block: {
        name: 'hero',
        body: {
          format: 'fields',
          fields: {
            eyebrow: 'Deep note',
            title: 'Structure before style',
            subtitle: 'Blocks define reading rhythm',
          },
        },
      },
    })
  })

  it('reports missing required fields locally', () => {
    const result = parseJournalLayout(`:::hero
subtitle: Missing title
:::`)

    expect(result.segments[0]).toMatchObject({
      kind: 'error',
      issue: {
        kind: 'schema',
        message: 'hero is missing required field "title".',
      },
    })
  })

  it('validates rows bodies and minimum columns', () => {
    const result = parseJournalLayout(`:::metrics
Structure | 43 modules | catalog
Effort | -42% | less JSX
:::`)

    expect(result.segments[0]).toMatchObject({
      kind: 'block',
      block: {
        name: 'metrics',
        body: {
          format: 'rows',
          rows: [
            ['Structure', '43 modules', 'catalog'],
            ['Effort', '-42%', 'less JSX'],
          ],
        },
      },
    })
  })

  it('reports rows with too few columns', () => {
    const result = parseJournalLayout(`:::metrics
Only label | 1
:::`)

    expect(result.segments[0]).toMatchObject({
      kind: 'error',
      issue: {
        kind: 'schema',
        message: 'metrics row 1 expected at least 3 columns, got 2.',
      },
    })
  })

  it('validates json object bodies', () => {
    const result = parseJournalLayout(`:::definition
{"term":"Catalog","description":"Single source of truth"}
:::`)

    expect(result.segments[0]).toMatchObject({
      kind: 'block',
      block: {
        name: 'definition',
        body: {
          format: 'json_object',
          value: { term: 'Catalog', description: 'Single source of truth' },
        },
      },
    })
  })

  it('reports invalid json array shape', () => {
    const result = parseJournalLayout(`:::resource-list
{"title":"Not an array"}
:::`)

    expect(result.segments[0]).toMatchObject({
      kind: 'error',
      issue: {
        kind: 'schema',
        message: 'resource-list body must be a JSON array.',
      },
    })
  })

  it('reports unknown modules and unknown modifiers', () => {
    const unknown = parseJournalLayout(`:::made-up
text
:::`)
    expect(unknown.segments[0]).toMatchObject({
      kind: 'error',
      issue: {
        kind: 'catalog',
        message: 'Unknown layout module "made-up".',
      },
    })

    const badModifier = parseJournalLayout(`:::callout urgent
text
:::`)
    expect(badModifier.segments[0]).toMatchObject({
      kind: 'error',
      issue: {
        kind: 'schema',
        message: 'callout modifier "urgent" is not supported.',
      },
    })
  })
})
