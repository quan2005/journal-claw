import { describe, expect, it } from 'vitest'
import { compileMdx, normalizeMdxCompatibility, validateMdxDocument } from './service.js'

describe('mdx service', () => {
  it('emits Rust-shaped JSX runtime module markers', () => {
    const output = compileMdx('# Hi!', 'entry.mdx')
    expect(output).toContain('react/jsx-runtime')
    expect(output).toContain('function MDXContent')
    expect(output).toContain('export default function MDXContent')
    expect(output).toContain('file:entry.mdx')
  })

  it('preserves common GFM and MDX structure in the generated module', () => {
    const output = compileMdx(
      [
        '# Title',
        '',
        'A **strong** and *em* paragraph with `code` and [link](https://example.com).',
        '',
        '- one',
        '- two',
        '',
        '> quoted',
        '',
        '```ts',
        'const answer = 42',
        '```',
        '',
        '<Chart data={items} />',
        '',
        '| A | B |',
        '| - | - |',
        '| 1 | 2 |',
      ].join('\n'),
    )

    expect(output).toContain('_components.h1')
    expect(output).toContain('_components.strong')
    expect(output).toContain('_components.em')
    expect(output).toContain('_components.code')
    expect(output).toContain('_components.a')
    expect(output).toContain('_components.ul')
    expect(output).toContain('_components.li')
    expect(output).toContain('_components.blockquote')
    expect(output).toContain('_components.pre')
    expect(output).toContain('<Chart data={items} />')
    expect(output).toContain('_components.table')
    expect(output).toContain('_components.tbody')
  })

  it('normalizes numeric less-than, autolinks, and math components', () => {
    expect(normalizeMdxCompatibility('p<0.001')).toContain('p&lt;0.001')
    expect(normalizeMdxCompatibility('<https://example.com>')).toContain(
      '[https://example.com](https://example.com)',
    )
    expect(normalizeMdxCompatibility('\\( x + y \\)')).toContain('<InlineMath math={"x + y"} />')
  })

  it('validates unclosed JSX tags before migration writes', () => {
    expect(() => validateMdxDocument('<Hero>\ntext')).toThrow('opening tag <Hero> is not closed')
  })
})
