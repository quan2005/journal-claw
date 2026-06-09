import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'src/styles/mdx.css'), 'utf8')

function lastRule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const matches = [...css.matchAll(new RegExp(`${escaped}\\s*\\{(?<body>[\\s\\S]*?)\\}`, 'g'))]
  return matches[matches.length - 1]?.groups?.body ?? ''
}

describe('specialized MDX component design language', () => {
  it('uses the same prose, content, and wide width tiers as canonical layout blocks', () => {
    expect(lastRule('.mdx-specialized-prose')).toContain('max-width: var(--journal-prose-max)')
    expect(lastRule('.mdx-specialized-content')).toContain('max-width: var(--journal-content-max')
    expect(lastRule('.mdx-specialized-wide')).toContain('max-width: 100%')
  })

  it('keeps decisions, semantic evidence, sources, and transcripts open instead of card-heavy', () => {
    for (const selector of [
      '.mdx-decision-record',
      '.mdx-semantic-card',
      '.mdx-source-card',
      '.mdx-transcript',
    ]) {
      const body = lastRule(selector)
      expect(body, selector).toContain('background: transparent')
      expect(body, selector).toContain('box-shadow: none')
    }

    expect(lastRule('.mdx-decision-record')).toContain('border-top')
    expect(lastRule('.mdx-semantic-card')).toContain('border-left')
    expect(lastRule('.mdx-source-card')).toContain('border-bottom')
  })

  it('removes decorative elevation while retaining framed tools', () => {
    expect(lastRule('.mdx-card--elevated')).toContain('box-shadow: none')
    expect(lastRule('.mdx-mac-preview')).toContain('box-shadow: none')
    expect(lastRule('.mdx-chart')).toContain('border: 1px solid var(--mdx-border)')
    expect(lastRule('.mdx-media-card')).toContain('border: 1px solid var(--mdx-border)')
  })

  it('keeps section rhythm and restrained radii explicit', () => {
    expect(lastRule('.mdx-section')).toContain('margin-bottom: var(--space-8)')
    expect(css).toContain('--mdx-radius: 8px')
    expect(css).not.toContain('.journal-block-quote-meta {\n.journal-block-quote-meta')
  })
})
