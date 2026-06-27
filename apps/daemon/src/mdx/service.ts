export function compileMdx(source: string, filepath?: string | null): string {
  const normalized = normalizeMdxCompatibility(source)
  const body = compileMarkdownBody(normalized)
  const fileComment = filepath
    ? `\n/*@jsxRuntime automatic @jsxImportSource react file:${escapeComment(filepath)}*/`
    : ''
  return [
    'import {jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment} from "react/jsx-runtime";',
    'function _createMdxContent(props) {',
    '  const _components = {a: "a", blockquote: "blockquote", code: "code", em: "em", h1: "h1", h2: "h2", h3: "h3", h4: "h4", h5: "h5", h6: "h6", li: "li", ol: "ol", p: "p", pre: "pre", strong: "strong", table: "table", tbody: "tbody", td: "td", th: "th", thead: "thead", tr: "tr", ul: "ul", ...props.components};',
    `  return ${body};`,
    '}',
    'export default function MDXContent(props = {}) {',
    '  return _createMdxContent(props);',
    `}${fileComment}`,
  ].join('\n')
}

export function validateMdxDocument(source: string, filepath?: string | null): void {
  const stripped = stripFrontmatter(source)
  const issues = collectMdxPreflightIssues(stripped.source, stripped.lineOffset)
  try {
    compileMdx(stripped.source, filepath)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (issues.length > 0) throw new Error(formatPreflightIssues(issues, message))
    throw err
  }
  if (issues.length > 0) throw new Error(formatPreflightIssues(issues))
}

function compileMarkdownBody(source: string): string {
  const blocks = collectBlocks(source)
  if (blocks.length === 0) return '_jsx(_Fragment, {})'
  const children = blocks.map((block) => compileBlock(block))
  if (children.length === 1) return children[0]
  return `_jsxs(_Fragment, {children: [${children.join(', ')}]})`
}

type MarkdownBlock =
  | { kind: 'heading'; depth: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'table'; text: string }
  | { kind: 'jsx'; text: string }
  | { kind: 'blockquote'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'code'; lang: string | null; text: string }

function collectBlocks(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: MarkdownBlock[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i += 1
      continue
    }
    const fence = line.match(/^(```|~~~)\s*(\w+)?\s*$/)
    if (fence) {
      const marker = fence[1]
      const body: string[] = []
      i += 1
      while (i < lines.length && !lines[i].startsWith(marker)) body.push(lines[i++])
      if (i < lines.length) i += 1
      blocks.push({ kind: 'code', lang: fence[2] ?? null, text: body.join('\n') })
      continue
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      blocks.push({ kind: 'heading', depth: heading[1].length, text: heading[2] })
      i += 1
      continue
    }
    if (i + 1 < lines.length && isTable(`${line}\n${lines[i + 1]}`)) {
      const tableLines = [line, lines[i + 1]]
      i += 2
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) tableLines.push(lines[i++])
      blocks.push({ kind: 'table', text: tableLines.join('\n') })
      continue
    }
    const list = collectList(lines, i)
    if (list) {
      blocks.push(list.block)
      i = list.next
      continue
    }
    if (/^\s*>/.test(line)) {
      const quote: string[] = []
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ''))
        i += 1
      }
      blocks.push({ kind: 'blockquote', text: quote.join(' ') })
      continue
    }
    if (/^<\w[\s\S]*\/?>$/.test(line.trim())) {
      blocks.push({ kind: 'jsx', text: line.trim() })
      i += 1
      continue
    }
    const paragraph: string[] = []
    while (i < lines.length && lines[i].trim()) paragraph.push(lines[i++].trim())
    blocks.push({ kind: 'paragraph', text: paragraph.join(' ') })
  }
  return blocks
}

function collectList(
  lines: string[],
  start: number,
): { block: MarkdownBlock & { kind: 'list' }; next: number } | null {
  const first = lines[start].match(/^\s*(?:([-*+])|(\d+)\.)\s+(.+)$/)
  if (!first) return null
  const ordered = first[2] !== undefined
  const items: string[] = []
  let i = start
  while (i < lines.length) {
    const match = lines[i].match(/^\s*(?:([-*+])|(\d+)\.)\s+(.+)$/)
    if (!match || (match[2] !== undefined) !== ordered) break
    items.push(match[3])
    i += 1
  }
  return { block: { kind: 'list', ordered, items }, next: i }
}

function compileBlock(block: MarkdownBlock): string {
  if (block.kind === 'heading') {
    const tag = `h${Math.min(block.depth, 6)}`
    return `_jsx(_components.${tag}, {children: ${compileInline(block.text)}})`
  }
  if (block.kind === 'table') return compileTable(block.text)
  if (block.kind === 'jsx') return block.text
  if (block.kind === 'blockquote') {
    return `_jsx(_components.blockquote, {children: _jsx(_components.p, {children: ${compileInline(block.text)}})})`
  }
  if (block.kind === 'list') {
    const tag = block.ordered ? 'ol' : 'ul'
    const items = block.items.map(
      (item) => `_jsx(_components.li, {children: ${compileInline(item)}})`,
    )
    return `_jsx(_components.${tag}, {children: [${items.join(', ')}]})`
  }
  if (block.kind === 'code') {
    const className = block.lang ? `, className: ${JSON.stringify(`language-${block.lang}`)}` : ''
    return `_jsx(_components.pre, {children: _jsx(_components.code, {children: ${JSON.stringify(block.text)}${className}})})`
  }
  return `_jsx(_components.p, {children: ${compileInline(block.text)}})`
}

function isTable(block: string): boolean {
  const lines = block.split(/\r?\n/)
  return (
    lines.length >= 2 &&
    /^\s*\|.*\|\s*$/.test(lines[0]) &&
    /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(lines[1])
  )
}

function compileTable(block: string): string {
  const [head, , ...rows] = block.split(/\r?\n/)
  const headers = splitTableRow(head).map(
    (cell) => `_jsx(_components.th, {children: ${compileInline(cell)}})`,
  )
  const bodyRows = rows.map((row) => {
    const cells = splitTableRow(row).map(
      (cell) => `_jsx(_components.td, {children: ${compileInline(cell)}})`,
    )
    return `_jsx(_components.tr, {children: [${cells.join(', ')}]})`
  })
  return `_jsxs(_components.table, {children: [_jsx(_components.thead, {children: _jsx(_components.tr, {children: [${headers.join(', ')}]})}), _jsx(_components.tbody, {children: [${bodyRows.join(', ')}]})]})`
}

function splitTableRow(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function compileInline(text: string): string {
  const nodes: string[] = []
  let i = 0
  while (i < text.length) {
    const rest = text.slice(i)
    const code = rest.match(/^`([^`]+)`/)
    if (code) {
      nodes.push(`_jsx(_components.code, {children: ${JSON.stringify(code[1])}})`)
      i += code[0].length
      continue
    }
    const strong = rest.match(/^\*\*([^*]+)\*\*/)
    if (strong) {
      nodes.push(`_jsx(_components.strong, {children: ${JSON.stringify(strong[1])}})`)
      i += strong[0].length
      continue
    }
    const emphasis = rest.match(/^\*([^*]+)\*/)
    if (emphasis) {
      nodes.push(`_jsx(_components.em, {children: ${JSON.stringify(emphasis[1])}})`)
      i += emphasis[0].length
      continue
    }
    const link = rest.match(/^\[([^\]]+)\]\(([^)]+)\)/)
    if (link) {
      nodes.push(
        `_jsx(_components.a, {href: ${JSON.stringify(link[2])}, children: ${JSON.stringify(link[1])}})`,
      )
      i += link[0].length
      continue
    }
    const nextSpecial = rest.slice(1).search(/[`*[]/)
    const take = nextSpecial < 0 ? rest.length : nextSpecial + 1
    nodes.push(JSON.stringify(rest.slice(0, take)))
    i += take
  }
  const compact = nodes.filter((node) => node !== '""')
  if (compact.length === 0) return '""'
  if (compact.length === 1) return compact[0]
  return `[${compact.join(', ')}]`
}

interface StrippedMdxSource {
  source: string
  lineOffset: number
}

function stripFrontmatter(source: string): StrippedMdxSource {
  if (!source.startsWith('---')) return { source, lineOffset: 0 }
  const end = source.slice(3).indexOf('\n---')
  if (end < 0) return { source, lineOffset: 0 }
  const body = source.slice(end + 7).replace(/^[\r\n]+/, '')
  const bodyStart = source.length - body.length
  return { source: body, lineOffset: (source.slice(0, bodyStart).match(/\n/g) ?? []).length }
}

interface MdxPreflightIssue {
  line: number
  column: number
  message: string
}

function collectMdxPreflightIssues(source: string, lineOffset: number): MdxPreflightIssue[] {
  const issues: MdxPreflightIssue[] = []
  const stack: { name: string; line: number; column: number }[] = []
  let inFence = false
  source.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trimStart()
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inFence = !inFence
      return
    }
    if (inFence) return
    scanMdxLineForJsx(line, lineOffset + index + 1, stack, issues)
  })
  for (const tag of stack) {
    issues.push({
      line: tag.line,
      column: tag.column,
      message: `opening tag <${tag.name}> is not closed`,
    })
  }
  return issues
}

function scanMdxLineForJsx(
  line: string,
  lineNumber: number,
  stack: { name: string; line: number; column: number }[],
  issues: MdxPreflightIssue[],
): void {
  const tagPattern = /<\/?([A-Za-z][\w.:-]*)([^>]*)>/g
  for (const match of line.matchAll(tagPattern)) {
    const raw = match[0]
    const name = match[1]
    if (raw.startsWith('<!--') || raw.startsWith('<http://') || raw.startsWith('<https://'))
      continue
    if (raw.startsWith('</')) {
      const open = stack.pop()
      if (!open)
        issues.push({
          line: lineNumber,
          column: (match.index ?? 0) + 1,
          message: `closing tag </${name}> has no matching opening tag`,
        })
      else if (open.name !== name)
        issues.push({
          line: lineNumber,
          column: (match.index ?? 0) + 1,
          message: `closing tag </${name}> does not match opening tag <${open.name}> from line ${open.line}`,
        })
    } else if (!raw.endsWith('/>') && !isVoidTag(name)) {
      stack.push({ name, line: lineNumber, column: (match.index ?? 0) + 1 })
    }
  }
}

function isVoidTag(name: string): boolean {
  if (/^[A-Z]/.test(name)) return false
  return new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
  ]).has(name.toLowerCase())
}

function formatPreflightIssues(issues: MdxPreflightIssue[], compilerError?: string): string {
  const lines = [`MDX preflight found ${issues.length} issue(s):`]
  for (const issue of issues) lines.push(`- Line ${issue.line}:${issue.column}: ${issue.message}`)
  if (compilerError) lines.push('', 'Compiler error:', compilerError)
  return lines.join('\n')
}

type MathKind = 'Inline' | 'Block'

interface MathState {
  close: string
  kind: MathKind
  value: string
}

export function normalizeMdxCompatibility(source: string): string {
  let out = ''
  let inFence = false
  const mathState: { current: MathState | null } = { current: null }
  for (const line of source.match(/[^\n]*\n?|$/g) ?? []) {
    if (line === '') continue
    const trimmed = line.trimStart()
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inFence = !inFence
      out += line
      continue
    }
    out += inFence
      ? line
      : normalizeMdxLine(
          line,
          (next) => {
            mathState.current = next
          },
          () => mathState.current,
        )
  }
  if (mathState.current) out += mathComponent(mathState.current.kind, mathState.current.value)
  return out
}

function normalizeMdxLine(
  line: string,
  setMathState: (state: MathState | null) => void,
  getMathState: () => MathState | null,
): string {
  let out = ''
  let inInlineCode = false
  let braceDepth = 0
  let i = 0
  while (i < line.length) {
    const mathState = getMathState()
    if (mathState) {
      if (line.slice(i).startsWith(mathState.close)) {
        out += mathComponent(mathState.kind, mathState.value)
        i += mathState.close.length
        setMathState(null)
      } else {
        mathState.value += line[i++]
      }
      continue
    }
    const delimiter = !inInlineCode && braceDepth === 0 ? mathDelimiterAt(line, i) : null
    if (delimiter) {
      setMathState({ close: delimiter.close, kind: delimiter.kind, value: '' })
      i += delimiter.open.length
      continue
    }
    const autolink = !inInlineCode && braceDepth === 0 ? markdownAutolinkAt(line, i) : null
    if (autolink) {
      out += `[${autolink.url}](${autolink.url})`
      i = autolink.next
      continue
    }
    const ch = line[i]
    if (ch === '`') inInlineCode = !inInlineCode
    if (ch === '{' && !inInlineCode) braceDepth += 1
    if (ch === '}' && !inInlineCode) braceDepth = Math.max(0, braceDepth - 1)
    if (ch === '<' && !inInlineCode && braceDepth === 0 && /\d/.test(line[i + 1] ?? ''))
      out += '&lt;'
    else out += ch
    i += 1
  }
  return out
}

function mathDelimiterAt(
  line: string,
  index: number,
): { open: string; close: string; kind: MathKind } | null {
  for (const delimiter of [
    { open: '\\\\[', close: '\\\\]', kind: 'Block' as const },
    { open: '\\\\(', close: '\\\\)', kind: 'Inline' as const },
    { open: '\\[', close: '\\]', kind: 'Block' as const },
    { open: '\\(', close: '\\)', kind: 'Inline' as const },
  ]) {
    if (line.slice(index).startsWith(delimiter.open)) return delimiter
  }
  return null
}

function markdownAutolinkAt(line: string, index: number): { url: string; next: number } | null {
  if (line[index] !== '<') return null
  const rest = line.slice(index + 1)
  if (!rest.startsWith('http://') && !rest.startsWith('https://')) return null
  const end = rest.indexOf('>')
  if (end < 0) return null
  const url = rest.slice(0, end)
  if (/\s/.test(url)) return null
  return { url, next: index + end + 2 }
}

function mathComponent(kind: MathKind, value: string): string {
  return `<${kind}Math math={${JSON.stringify(value.trim())}} />`
}

function escapeComment(value: string): string {
  return value.replace(/\*\//g, '*\\/')
}
