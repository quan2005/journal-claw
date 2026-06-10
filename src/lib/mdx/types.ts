/** Kind of top-level block identified by the segmenter */
export type BlockKind = 'markdown' | 'jsx' | 'esm'

/** Degradation level after compilation attempt */
export type DegradationLevel = 'L0' | 'L1' | 'L2'

/** A segment of the source identified by the segmenter */
export interface Block {
  /** The raw source text of this block (no trailing newline normalization) */
  source: string
  /** 1-based start line in the original full document */
  startLine: number
  /** 1-based end line (inclusive) in the original full document */
  endLine: number
  /** Block classification */
  kind: BlockKind
}

/** Result of compiling a single block */
export interface CompiledBlock {
  /** Original block metadata */
  block: Block
  /** Degradation level achieved */
  level: DegradationLevel
  /** Compiled React component (present for L0 and L1) */
  component?: React.ComponentType<{ components?: Record<string, unknown> }>
  /** HTML string from Markdown fallback (L1 only) */
  markdownHtml?: string
  /** Error information (present for L1 and L2) */
  error?: BlockError
}

/** Structured error from a failed block compilation */
export interface BlockError {
  /** Raw error message from compiler */
  raw: string
  /** Friendly translated message (Chinese) */
  friendly: string
  /** Fix suggestion for the user */
  fixHint?: string
  /** Line number within the original document (1-based) */
  line?: number
  /** Column number (1-based) */
  column?: number
}

/** Extracted scope information for cross-block dependency resolution */
export interface ScopeInfo {
  /** ESM blocks (import/export) extracted from the document */
  esmBlocks: Block[]
  /** Link reference definitions: [label]: url */
  linkDefinitions: string[]
  /** Footnote definitions: [^id]: content */
  footnoteDefinitions: string[]
}

/** A translated error pattern */
export interface ErrorTranslation {
  /** Regex pattern to match against raw error */
  pattern: RegExp
  /** Function that produces the friendly message (can use capture groups) */
  friendly: (match: RegExpMatchArray) => string
  /** Optional fix hint */
  fixHint?: (match: RegExpMatchArray) => string
}
