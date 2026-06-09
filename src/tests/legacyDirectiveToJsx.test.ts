import { describe, expect, it } from 'vitest'
import { convertLegacyDirectivesToJsx } from '../lib/legacyDirectives'

describe('legacy directive to JSX conversion', () => {
  it('converts field directives to canonical JSX props', () => {
    const result = convertLegacyDirectivesToJsx(`:::quote
text: 最看重的是效果，不是效率。
author: 冯灿威
context: 新用户（<1 月）
:::`)

    expect(result.errors).toEqual([])
    expect(result.convertedCount).toBe(1)
    expect(result.source).toContain('<Quote')
    expect(result.source).toContain('text="最看重的是效果，不是效率。"')
    expect(result.source).toContain('author="冯灿威"')
    expect(result.source).toContain('context="新用户（<1 月）"')
    expect(result.source).not.toContain(':::quote')
  })

  it('converts headings, modifiers, attributes, rows, and JSON bodies', () => {
    const result = convertLegacyDirectivesToJsx(`:::callout tip[建议]
先定位偏差节点
:::

:::cards[关键主题]{variant=accent}
效果 | 优先保证质量 | 新用户 | accent
:::

:::definition
{"term":"可观测性","description":"定位偏差节点"}
:::`)

    expect(result.errors).toEqual([])
    expect(result.convertedCount).toBe(3)
    expect(result.source).toContain('<Callout')
    expect(result.source).toContain('heading="建议"')
    expect(result.source).toContain('tone="tip"')
    expect(result.source).toContain('content="先定位偏差节点"')
    expect(result.source).toContain('<Cards')
    expect(result.source).toContain('heading="关键主题"')
    expect(result.source).toContain('"title": "效果"')
    expect(result.source).toContain('<Definition')
    expect(result.source).toContain('term="可观测性"')
  })

  it('is idempotent and leaves fenced examples untouched', () => {
    const source = `\`\`\`md
:::quote
text: example
:::
\`\`\`

:::summary
title: 结论
body: 保留正文
:::`
    const first = convertLegacyDirectivesToJsx(source)
    const second = convertLegacyDirectivesToJsx(first.source)

    expect(first.convertedCount).toBe(1)
    expect(first.source).toContain(':::quote')
    expect(second).toEqual({ source: first.source, convertedCount: 0, errors: [] })
  })

  it('does not partially rewrite a document with invalid directives', () => {
    const source = `:::hero
subtitle: 缺少标题
:::`
    const result = convertLegacyDirectivesToJsx(source)

    expect(result.convertedCount).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.source).toBe(source)
  })
})
