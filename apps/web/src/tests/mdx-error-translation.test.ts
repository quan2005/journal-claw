import { describe, it, expect } from 'vitest'
import { translateError } from '../lib/mdx/errorTranslation'

describe('mdx error translation', () => {
  it('translates unclosed tag errors', () => {
    const result = translateError('Expected a closing tag for `<Chart>` (1:1-1:7)')
    expect(result.friendly).toContain('<Chart>')
    expect(result.friendly).toContain('未闭合')
    expect(result.fixHint).toContain('</Chart>')
  })

  it('translates unexpected token errors', () => {
    const result = translateError('Unexpected token (acorn)')
    expect(result.friendly).toContain('表达式语法')
  })

  it('translates mismatched closing tag', () => {
    const result = translateError('Unexpected closing tag `</Card>`')
    expect(result.friendly).toContain('</Card>')
    expect(result.friendly).toContain('多余')
  })

  it('returns generic message for unknown errors', () => {
    const result = translateError('some weird error nobody has seen')
    expect(result.friendly).toContain('无法识别的语法')
    expect(result.raw).toBe('some weird error nobody has seen')
  })

  it('extracts line/column from error string', () => {
    const result = translateError('3:5: Expected a closing tag for `<X>`')
    expect(result.line).toBe(3)
    expect(result.column).toBe(5)
  })
})
