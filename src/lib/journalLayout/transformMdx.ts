import { parseJournalLayout } from './validate'
import type { JournalBlock, LayoutIssue } from './types'

function jsxObject(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
}

function blockToJsx(block: JournalBlock): string {
  return `<JournalBlock block={${jsxObject(block)}} />`
}

function issueToJsx(issue: LayoutIssue): string {
  return `<JournalBlockError issue={${jsxObject(issue)}} />`
}

export function transformMdxDirectives(source: string): string {
  if (!source.includes(':::')) return source

  const parsed = parseJournalLayout(source)
  if (!parsed.containsLayout) return source

  return parsed.segments
    .map((segment) => {
      if (segment.kind === 'markdown') return segment.value
      if (segment.kind === 'error') return issueToJsx(segment.issue)
      return blockToJsx(segment.block)
    })
    .join('\n\n')
}
