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

  it('keeps plain prose after summary fields as the summary body', () => {
    const result = parseJournalLayout(`:::summary[简报要点]
title: 三件事
一个信号：**自然语言生成工作流**仍是压倒性第一需求（19/27，70%），新样本中何靖瑶提出「vibe coding」级体验期望，需求从「能不能有」升级为「能不能做好」。两个底线：**调试体验**（12/27，含 Agent 节点专项痛点）和**平台稳定性**持续侵蚀用户信任，已从功能缺失演变为信任危机。
:::`)

    expect(result.segments[0]).toMatchObject({
      kind: 'block',
      block: {
        name: 'summary',
        title: '简报要点',
        body: {
          format: 'fields',
          fields: {
            title: '三件事',
            body: expect.stringContaining('自然语言生成工作流'),
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
