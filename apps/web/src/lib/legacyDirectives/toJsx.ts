import { getLayoutModuleSpec, parseJournalLayout } from '../journalLayout'
import type { JournalBlock, LayoutIssue } from '../journalLayout'

export interface LegacyDirectiveConversion {
  source: string
  convertedCount: number
  errors: LayoutIssue[]
}

function prop(name: string, value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'string' && !/["{}\n\r&]/.test(value)) {
    return `${name}="${value}"`
  }
  return `${name}={${JSON.stringify(value, null, 2)}}`
}

function jsx(name: string, values: Array<[string, unknown]>): string {
  const props = values
    .map(([key, value]) => prop(key, value))
    .filter((value): value is string => Boolean(value))

  if (props.length === 0) return `<${name} />`
  return `<${name}\n${props.map((value) => `  ${value}`).join('\n')}\n/>`
}

function headingProps(block: JournalBlock): Array<[string, unknown]> {
  return block.title ? [['heading', block.title]] : []
}

function variantProps(block: JournalBlock): Array<[string, unknown]> {
  const variant = block.attrs.variant
  return typeof variant === 'string' ? [['variant', variant]] : []
}

function fieldsToJsx(block: JournalBlock, jsxName: string): string {
  const fields = block.body.format === 'fields' ? block.body.fields : {}
  const values: Array<[string, unknown]> = Object.entries(fields)

  if (block.name === 'notice' && block.title && !fields.title) {
    values.unshift(['title', block.title])
  }
  if (block.name === 'verdict' && block.title && !fields.status) {
    values.push(['status', block.title])
  }

  values.push(...variantProps(block))
  return jsx(jsxName, values)
}

function rowsToItems(block: JournalBlock): Record<string, string>[] {
  if (block.body.format !== 'rows') return []
  const spec = getLayoutModuleSpec(block.name)
  const columns = spec?.columns ?? ['value']

  return block.body.rows.map((row) => {
    const item = Object.fromEntries(
      columns
        .map((column, index) => [column, row[index]] as const)
        .filter(([, value]) => value !== undefined && value !== ''),
    )
    if (block.name === 'checklist' && item.item) {
      const { item: text, ...rest } = item
      return { text, ...rest }
    }
    return item
  })
}

function rowsToJsx(block: JournalBlock, jsxName: string): string {
  if (block.name === 'callout') {
    const rows = block.body.format === 'rows' ? block.body.rows : []
    return jsx(jsxName, [
      ...headingProps(block),
      ['tone', block.modifier],
      ['content', rows.map((row) => row.join(' | ')).join('\n')],
    ])
  }

  return jsx(jsxName, [...headingProps(block), ['items', rowsToItems(block)]])
}

function objectToJsx(block: JournalBlock, jsxName: string): string {
  const value = block.body.format === 'json_object' ? block.body.value : {}
  return jsx(jsxName, [...headingProps(block), ...Object.entries(value)])
}

function arrayToJsx(block: JournalBlock, jsxName: string): string {
  const value = block.body.format === 'json_array' ? block.body.value : []
  return jsx(jsxName, [...headingProps(block), ['items', value]])
}

export function journalBlockToCanonicalJsx(block: JournalBlock): string {
  const spec = getLayoutModuleSpec(block.name)
  if (!spec) throw new Error(`Unknown layout module "${block.name}".`)

  if (block.body.format === 'fields') return fieldsToJsx(block, spec.jsxName)
  if (block.body.format === 'rows') return rowsToJsx(block, spec.jsxName)
  if (block.body.format === 'json_object') return objectToJsx(block, spec.jsxName)
  return arrayToJsx(block, spec.jsxName)
}

export function convertLegacyDirectivesToJsx(source: string): LegacyDirectiveConversion {
  if (!source.includes(':::')) return { source, convertedCount: 0, errors: [] }

  const parsed = parseJournalLayout(source)
  if (!parsed.containsLayout) return { source, convertedCount: 0, errors: [] }

  const errors = parsed.segments.flatMap((segment) =>
    segment.kind === 'error' ? [segment.issue] : [],
  )
  if (errors.length > 0) return { source, convertedCount: 0, errors }

  const blocks = parsed.segments.flatMap((segment) =>
    segment.kind === 'block' ? [segment.block] : [],
  )
  let cursor = 0
  let converted = ''

  for (const block of blocks) {
    const index = source.indexOf(block.source, cursor)
    if (index < 0) {
      return {
        source,
        convertedCount: 0,
        errors: [
          {
            kind: 'runtime',
            message: `Could not locate ${block.name} source during conversion.`,
            hint: 'Re-open the file and run migration again.',
            source: block.source,
            sourceRange: block.sourceRange,
            blockName: block.name,
          },
        ],
      }
    }

    converted += source.slice(cursor, index)
    converted += journalBlockToCanonicalJsx(block)
    cursor = index + block.source.length
  }

  converted += source.slice(cursor)
  return { source: converted, convertedCount: blocks.length, errors: [] }
}
