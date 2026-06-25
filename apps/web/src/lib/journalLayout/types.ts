export type LayoutCategory =
  | 'opening'
  | 'infographic'
  | 'judgment'
  | 'evidence'
  | 'conversion'
  | 'brand'
  | 'enhanced'

export type LayoutBodyFormat = 'fields' | 'rows' | 'json_object' | 'json_array'

export type LayoutPrimitive = string | number | boolean
export type LayoutAttrs = Record<string, LayoutPrimitive | LayoutPrimitive[]>

export interface LayoutModuleSpec {
  name: string
  jsxName: string
  category: LayoutCategory
  bodyFormat: LayoutBodyFormat
  renderer: string
  implemented: boolean
  aliases?: string[]
  modifiers?: string[]
  requiredFields?: string[]
  optionalFields?: string[]
  columns?: string[]
  minColumns?: number
  variants?: string[]
  description: string
  whenToUse?: string
  antiPattern?: string
}

export type ParsedBlockBody =
  | { format: 'fields'; fields: Record<string, string> }
  | { format: 'rows'; rows: string[][] }
  | { format: 'json_object'; value: Record<string, unknown> }
  | { format: 'json_array'; value: unknown[] }

export interface SourceRange {
  startLine: number
  endLine: number
}

export interface RawJournalBlock {
  name: string
  title?: string
  modifier?: string
  attrs: LayoutAttrs
  bodyRaw: string
  source: string
  sourceRange: SourceRange
}

export interface JournalBlock {
  name: string
  title?: string
  modifier?: string
  attrs: LayoutAttrs
  body: ParsedBlockBody
  source: string
  sourceRange: SourceRange
}

export interface LayoutIssue {
  kind: 'syntax' | 'catalog' | 'schema' | 'runtime'
  message: string
  hint: string
  source?: string
  sourceRange: SourceRange
  blockName?: string
}

export type LayoutSegment =
  | { kind: 'markdown'; value: string; sourceRange: SourceRange }
  | { kind: 'block'; block: JournalBlock }
  | { kind: 'error'; issue: LayoutIssue }

export type RawLayoutSegment =
  | { kind: 'markdown'; value: string; sourceRange: SourceRange }
  | { kind: 'raw_block'; block: RawJournalBlock }
  | { kind: 'error'; issue: LayoutIssue }

export interface RawLayoutParseResult {
  segments: RawLayoutSegment[]
  containsLayout: boolean
}

export interface LayoutParseResult {
  segments: LayoutSegment[]
  containsLayout: boolean
}
