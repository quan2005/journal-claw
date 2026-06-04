import type { LayoutAttrs, LayoutIssue, RawJournalBlock, RawLayoutParseResult } from './types'

const OPENING_RE =
  /^\s*:::([A-Za-z][A-Za-z0-9_-]*)(?:\s+([A-Za-z][A-Za-z0-9_-]*))?(?:\[([^\]\n]*)\])?(?:\{([^}\n]*)\})?\s*$/
const CLOSING_RE = /^\s*:::\s*$/
const FENCE_RE = /^\s*(```+|~~~+)/

function lineNumberAt(index: number): number {
  return index + 1
}

function makeMarkdown(value: string, startLine: number, endLine: number) {
  return {
    kind: 'markdown' as const,
    value,
    sourceRange: { startLine, endLine },
  }
}

function makeIssue({
  message,
  hint,
  source,
  startLine,
  endLine,
  blockName,
}: {
  message: string
  hint: string
  source?: string
  startLine: number
  endLine: number
  blockName?: string
}): LayoutIssue {
  return {
    kind: 'syntax',
    message,
    hint,
    source,
    sourceRange: { startLine, endLine },
    blockName,
  }
}

function parsePrimitive(value: string): string | number | boolean {
  const trimmed = value.trim()
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function splitAttrTokens(input: string): string[] {
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null

  for (const char of input) {
    if (quote) {
      current += char
      if (char === quote) quote = null
      continue
    }

    if (char === '"' || char === "'") {
      current += char
      quote = char
      continue
    }

    if (char === ',' || /\s/.test(char)) {
      if (current.trim()) tokens.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  if (current.trim()) tokens.push(current.trim())
  return tokens
}

export function parseDirectiveAttrs(input?: string): {
  attrs: LayoutAttrs
  error?: string
} {
  if (!input?.trim()) return { attrs: {} }

  const attrs: LayoutAttrs = {}
  for (const token of splitAttrTokens(input)) {
    const eq = token.indexOf('=')
    if (eq <= 0) {
      return { attrs: {}, error: `Attribute "${token}" must use key=value.` }
    }

    const key = token.slice(0, eq).trim()
    const value = token.slice(eq + 1).trim()
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(key)) {
      return { attrs: {}, error: `Attribute key "${key}" is invalid.` }
    }
    if (!value) {
      return { attrs: {}, error: `Attribute "${key}" is missing a value.` }
    }

    attrs[key] = value.includes(',') ? value.split(',').map(parsePrimitive) : parsePrimitive(value)
  }

  return { attrs }
}

function parseOpeningLine(line: string, lineNumber: number): RawJournalBlock | LayoutIssue {
  const match = line.match(OPENING_RE)
  if (!match) {
    return makeIssue({
      message: 'Directive opening line is malformed.',
      hint: 'Use :::name modifier[title]{key=value}.',
      source: line,
      startLine: lineNumber,
      endLine: lineNumber,
    })
  }

  const [, name, modifier, title, attrsRaw] = match
  const attrsResult = parseDirectiveAttrs(attrsRaw)
  if (attrsResult.error) {
    return makeIssue({
      message: attrsResult.error,
      hint: 'Use primitive attribute values such as columns=2 compact=true tone=accent.',
      source: line,
      startLine: lineNumber,
      endLine: lineNumber,
      blockName: name,
    })
  }

  return {
    name: name.toLowerCase(),
    modifier,
    title,
    attrs: attrsResult.attrs,
    bodyRaw: '',
    source: line,
    sourceRange: { startLine: lineNumber, endLine: lineNumber },
  }
}

function lineLooksLikeDirectiveOpening(line: string): boolean {
  return /^\s*:::[^\s:]/.test(line)
}

export function parseRawJournalLayout(source: string): RawLayoutParseResult {
  const lines = source.split('\n')
  const segments: RawLayoutParseResult['segments'] = []
  let markdownStart = 0
  let i = 0
  let inFence = false
  let containsLayout = false

  const flushMarkdown = (exclusiveEnd: number) => {
    if (exclusiveEnd <= markdownStart) return
    const value = lines.slice(markdownStart, exclusiveEnd).join('\n')
    if (!value) return
    segments.push(
      makeMarkdown(
        value,
        lineNumberAt(markdownStart),
        lineNumberAt(Math.max(markdownStart, exclusiveEnd - 1)),
      ),
    )
  }

  while (i < lines.length) {
    const line = lines[i]
    if (FENCE_RE.test(line)) {
      inFence = !inFence
      i += 1
      continue
    }

    if (inFence || !lineLooksLikeDirectiveOpening(line)) {
      i += 1
      continue
    }

    containsLayout = true
    flushMarkdown(i)

    const startLine = lineNumberAt(i)
    const parsed = parseOpeningLine(line, startLine)
    let closeIndex = -1
    for (let j = i + 1; j < lines.length; j += 1) {
      if (CLOSING_RE.test(lines[j])) {
        closeIndex = j
        break
      }
    }

    if ('kind' in parsed) {
      const endIndex = closeIndex >= 0 ? closeIndex : i
      segments.push({ kind: 'error', issue: parsed })
      i = endIndex + 1
      markdownStart = i
      continue
    }

    if (closeIndex === -1) {
      segments.push({
        kind: 'error',
        issue: makeIssue({
          message: 'Directive is not closed.',
          hint: 'Add a closing ::: line after the directive body.',
          source: lines.slice(i).join('\n'),
          startLine,
          endLine: lineNumberAt(lines.length - 1),
          blockName: parsed.name,
        }),
      })
      markdownStart = lines.length
      break
    }

    const bodyRaw = lines
      .slice(i + 1, closeIndex)
      .join('\n')
      .trim()
    const sourceText = lines.slice(i, closeIndex + 1).join('\n')
    segments.push({
      kind: 'raw_block',
      block: {
        ...parsed,
        bodyRaw,
        source: sourceText,
        sourceRange: { startLine, endLine: lineNumberAt(closeIndex) },
      },
    })

    i = closeIndex + 1
    markdownStart = i
  }

  flushMarkdown(lines.length)

  if (!containsLayout) {
    return {
      containsLayout: false,
      segments: [makeMarkdown(source, source ? 1 : 0, source ? source.split('\n').length : 0)],
    }
  }

  return { containsLayout, segments }
}
