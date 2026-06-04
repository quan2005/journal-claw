import { getLayoutModuleSpec, resolveLayoutModuleName } from './catalog'
import { parseRawJournalLayout } from './parse'
import type {
  JournalBlock,
  LayoutIssue,
  LayoutParseResult,
  ParsedBlockBody,
  RawJournalBlock,
} from './types'

function issue(
  block: RawJournalBlock,
  kind: LayoutIssue['kind'],
  message: string,
  hint: string,
): LayoutIssue {
  return {
    kind,
    message,
    hint,
    source: block.source,
    sourceRange: block.sourceRange,
    blockName: block.name,
  }
}

function parseFields(bodyRaw: string): Record<string, string> {
  const fields: Record<string, string> = {}
  let activeKey = ''

  for (const rawLine of bodyRaw.split(/\r?\n/)) {
    if (!rawLine.trim()) continue

    const match = rawLine.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/)
    if (match) {
      activeKey = match[1]
      fields[activeKey] = match[2].trim()
      continue
    }

    if (activeKey && /^\s+/.test(rawLine)) {
      fields[activeKey] = `${fields[activeKey]} ${rawLine.trim()}`.trim()
    }
  }

  return fields
}

function parseRows(bodyRaw: string): string[][] {
  return bodyRaw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split('|').map((cell) => cell.trim()))
}

function parseJsonObject(bodyRaw: string): Record<string, unknown> {
  const value = JSON.parse(bodyRaw)
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('body must be a JSON object')
  }
  return value as Record<string, unknown>
}

function parseJsonArray(bodyRaw: string): unknown[] {
  const value = JSON.parse(bodyRaw)
  if (!Array.isArray(value)) throw new Error('body must be a JSON array')
  return value
}

function parseBody(block: RawJournalBlock): ParsedBlockBody | LayoutIssue {
  const spec = getLayoutModuleSpec(block.name)
  if (!spec) {
    return issue(
      block,
      'catalog',
      `Unknown layout module "${block.name}".`,
      'Use a module from the Journal Layout Catalog.',
    )
  }

  const canonicalName = resolveLayoutModuleName(block.name) ?? block.name
  const normalizedBlock = { ...block, name: canonicalName }

  if (spec.modifiers && block.modifier && !spec.modifiers.includes(block.modifier)) {
    return issue(
      normalizedBlock,
      'schema',
      `${canonicalName} modifier "${block.modifier}" is not supported.`,
      `Use one of: ${spec.modifiers.join(', ')}.`,
    )
  }

  const variant = block.attrs.variant
  if (spec.variants && typeof variant === 'string' && !spec.variants.includes(variant)) {
    return issue(
      normalizedBlock,
      'schema',
      `${canonicalName} variant "${variant}" is not supported.`,
      `Use one of: ${spec.variants.join(', ')}.`,
    )
  }

  try {
    if (spec.bodyFormat === 'fields') {
      const fields = parseFields(block.bodyRaw)
      for (const field of spec.requiredFields ?? []) {
        if (!fields[field]) {
          return issue(
            normalizedBlock,
            'schema',
            `${canonicalName} is missing required field "${field}".`,
            `Add "${field}: ..." inside the directive body.`,
          )
        }
      }
      return { format: 'fields', fields }
    }

    if (spec.bodyFormat === 'rows') {
      const rows = parseRows(block.bodyRaw)
      const minColumns = spec.minColumns ?? 1
      for (const [index, row] of rows.entries()) {
        if (row.length < minColumns) {
          return issue(
            normalizedBlock,
            'schema',
            `${canonicalName} row ${index + 1} expected at least ${minColumns} columns, got ${row.length}.`,
            `Use pipe-separated columns: ${(spec.columns ?? ['value']).join(' | ')}.`,
          )
        }
      }
      return { format: 'rows', rows }
    }

    if (spec.bodyFormat === 'json_object') {
      try {
        return { format: 'json_object', value: parseJsonObject(block.bodyRaw) }
      } catch {
        return issue(
          normalizedBlock,
          'schema',
          `${canonicalName} body must be a JSON object.`,
          'Use an object such as {"term":"Catalog","description":"..."}.',
        )
      }
    }

    try {
      return { format: 'json_array', value: parseJsonArray(block.bodyRaw) }
    } catch {
      return issue(
        normalizedBlock,
        'schema',
        `${canonicalName} body must be a JSON array.`,
        'Use an array such as [{"title":"Reference","url":"https://example.com"}].',
      )
    }
  } catch (error) {
    return issue(
      normalizedBlock,
      'schema',
      error instanceof Error ? error.message : String(error),
      'Check the directive body format.',
    )
  }
}

export function validateJournalBlock(block: RawJournalBlock): JournalBlock | LayoutIssue {
  const parsedBody = parseBody(block)
  if ('kind' in parsedBody) return parsedBody

  const canonicalName = resolveLayoutModuleName(block.name) ?? block.name
  return {
    name: canonicalName,
    title: block.title,
    modifier: block.modifier,
    attrs: block.attrs,
    body: parsedBody,
    source: block.source,
    sourceRange: block.sourceRange,
  }
}

export function parseJournalLayout(source: string): LayoutParseResult {
  const raw = parseRawJournalLayout(source)
  return {
    containsLayout: raw.containsLayout,
    segments: raw.segments.map((segment) => {
      if (segment.kind === 'markdown') return segment
      if (segment.kind === 'error') return segment

      const validated = validateJournalBlock(segment.block)
      if ('kind' in validated) return { kind: 'error', issue: validated }
      return { kind: 'block', block: validated }
    }),
  }
}
