# MDX Fault-Tolerant Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make MDX rendering block-isolated so a single syntax error only breaks the affected block, not the entire document.

**Architecture:** A frontend pipeline splits MDX content into independent blocks via a line-level state machine, compiles each block separately through the existing Rust `compile_mdx` Tauri command, and renders results with per-block ErrorBoundaries and a graceful degradation ladder (MDX → pure Markdown → source code view).

**Tech Stack:** TypeScript, React, existing `compileMdx` Tauri IPC, `marked` (already in project for MD fallback), existing MDX component registry.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/mdx/types.ts` | Shared types: `Block`, `CompiledBlock`, `BlockDegradation`, `ErrorTranslation` |
| `src/lib/mdx/segmenter.ts` | Line-level state machine that splits MDX source into top-level blocks |
| `src/lib/mdx/scopeManager.ts` | Extracts ESM declarations and link/footnote definitions from blocks |
| `src/lib/mdx/blockCompiler.ts` | Compiles a single block via Tauri IPC with MDX → MD → source fallback |
| `src/lib/mdx/errorTranslation.ts` | Maps raw error strings to friendly Chinese messages + fix hints |
| `src/lib/mdx/cache.ts` | Block-level compilation cache (hash → compiled component) |
| `src/lib/mdx/index.ts` | Pipeline orchestrator: segment → scope → compile → assemble |
| `src/components/mdx/ErrorCard.tsx` | L2 error card (four-section layout) |
| `src/components/mdx/DegradationBadge.tsx` | L1 corner badge (yellow, hover tooltip) |
| `src/components/mdx/BlockErrorBoundary.tsx` | Per-block React ErrorBoundary with fallback to ErrorCard |
| `src/components/mdx/BlockRenderer.tsx` | Renders one compiled block, wrapped in BlockErrorBoundary |
| `src/components/MdxRenderer.tsx` | Refactored to use block pipeline (replaces current whole-file approach) |
| `src/styles/mdx-errors.css` | Styles for error cards, badges, and degradation states |
| `src/tests/mdx-segmenter.test.ts` | Unit tests for the segmenter state machine |
| `src/tests/mdx-block-compiler.test.ts` | Unit tests for block compilation + fallback logic |
| `src/tests/mdx-error-translation.test.ts` | Unit tests for error message translation |
| `src/tests/mdx-scope-manager.test.ts` | Unit tests for scope extraction |
| `src/tests/mdx-pipeline-integration.test.ts` | Integration test: full pipeline with intentional errors |

---

## Task 1: Shared Types

**Files:**
- Create: `src/lib/mdx/types.ts`
- Test: `src/tests/mdx-segmenter.test.ts` (initial file with type imports)

- [ ] **Step 1: Write the types module**

```typescript
// src/lib/mdx/types.ts

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
```

- [ ] **Step 2: Create test file skeleton that imports types**

```typescript
// src/tests/mdx-segmenter.test.ts
import { describe, it, expect } from 'vitest'
import type { Block } from '../lib/mdx/types'

describe('mdx segmenter', () => {
  it('placeholder', () => {
    const block: Block = { source: '# Hi', startLine: 1, endLine: 1, kind: 'markdown' }
    expect(block.kind).toBe('markdown')
  })
})
```

- [ ] **Step 3: Run test to verify setup**

Run: `npx vitest run src/tests/mdx-segmenter.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/mdx/types.ts src/tests/mdx-segmenter.test.ts
git commit -m "feat(mdx): add shared types for fault-tolerant rendering pipeline"
```

---

## Task 2: Segmenter — Line-Level State Machine

**Files:**
- Create: `src/lib/mdx/segmenter.ts`
- Modify: `src/tests/mdx-segmenter.test.ts`

The segmenter is O(n) over lines. It tracks fence state, JSX depth, and splits at blank lines when JSX depth is zero. A convergence limit prevents unclosed tags from swallowing the entire document.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/tests/mdx-segmenter.test.ts
import { describe, it, expect } from 'vitest'
import { segmentMdx } from '../lib/mdx/segmenter'
import type { Block } from '../lib/mdx/types'

describe('mdx segmenter', () => {
  it('splits plain markdown by blank lines', () => {
    const source = '# Title\n\nParagraph one.\n\nParagraph two.'
    const blocks = segmentMdx(source)
    expect(blocks).toHaveLength(3)
    expect(blocks[0].source).toBe('# Title')
    expect(blocks[0].startLine).toBe(1)
    expect(blocks[0].endLine).toBe(1)
    expect(blocks[0].kind).toBe('markdown')
    expect(blocks[1].source).toBe('Paragraph one.')
    expect(blocks[1].startLine).toBe(3)
    expect(blocks[2].source).toBe('Paragraph two.')
    expect(blocks[2].startLine).toBe(5)
  })

  it('keeps fenced code blocks as a single block', () => {
    const source = '# Title\n\n```js\nconst x = 1\n\nconst y = 2\n```\n\nAfter.'
    const blocks = segmentMdx(source)
    expect(blocks).toHaveLength(3)
    expect(blocks[1].source).toContain('const x = 1')
    expect(blocks[1].source).toContain('const y = 2')
    expect(blocks[1].kind).toBe('markdown')
  })

  it('keeps JSX container components as a single block', () => {
    const source = '<Tabs>\n  <Tab label="A">\n    Content A\n  </Tab>\n\n  <Tab label="B">\n    Content B\n  </Tab>\n</Tabs>'
    const blocks = segmentMdx(source)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].kind).toBe('jsx')
    expect(blocks[0].startLine).toBe(1)
    expect(blocks[0].endLine).toBe(8)
  })

  it('identifies ESM blocks (import/export)', () => {
    const source = 'import { Chart } from "./Chart"\n\n# Title\n\n<Chart />'
    const blocks = segmentMdx(source)
    expect(blocks[0].kind).toBe('esm')
    expect(blocks[0].source).toBe('import { Chart } from "./Chart"')
    expect(blocks[1].kind).toBe('markdown')
    expect(blocks[2].kind).toBe('jsx')
  })

  it('forces convergence on unclosed JSX after reaching a heading', () => {
    const source = '<Broken\n  no close here\n\n# Next Section\n\nContent.'
    const blocks = segmentMdx(source)
    // The unclosed JSX should NOT swallow the heading and content
    expect(blocks.length).toBeGreaterThanOrEqual(2)
    const lastBlock = blocks[blocks.length - 1]
    expect(lastBlock.source).toContain('Content.')
  })

  it('does not split inside frontmatter fences', () => {
    const source = '---\nsummary: hello\ntags: [a]\n---\n\n# Title'
    const blocks = segmentMdx(source)
    // Frontmatter is one block, title is another
    expect(blocks).toHaveLength(2)
    expect(blocks[0].source).toContain('---')
    expect(blocks[1].source).toBe('# Title')
  })

  it('handles self-closing JSX tags without tracking depth', () => {
    const source = '<Chart data={x} />\n\nParagraph.'
    const blocks = segmentMdx(source)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].kind).toBe('jsx')
    expect(blocks[1].kind).toBe('markdown')
  })

  it('handles empty input', () => {
    expect(segmentMdx('')).toHaveLength(0)
  })

  it('handles consecutive blank lines as single separator', () => {
    const source = '# A\n\n\n\n# B'
    const blocks = segmentMdx(source)
    expect(blocks).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/tests/mdx-segmenter.test.ts`
Expected: FAIL — module `../lib/mdx/segmenter` not found

- [ ] **Step 3: Implement the segmenter**

```typescript
// src/lib/mdx/segmenter.ts
import type { Block, BlockKind } from './types'

/**
 * Maximum number of lines an unclosed JSX tag can span before
 * the segmenter forces a block boundary (prevents "swallowing" the document).
 */
const MAX_JSX_SPAN = 50

/**
 * Segments MDX source into top-level blocks using a line-level state machine.
 * Never throws — malformed input produces blocks that may fail at compile time.
 */
export function segmentMdx(source: string): Block[] {
  if (!source.trim()) return []

  const lines = source.split('\n')
  const blocks: Block[] = []

  let blockStartLine = 1
  let blockLines: string[] = []
  let inFence = false
  let fenceMarker = ''
  let inFrontmatter = false
  let frontmatterClosed = false
  let jsxDepth = 0
  let jsxSpanStart = -1

  function flushBlock() {
    if (blockLines.length === 0) return
    const src = blockLines.join('\n')
    if (!src.trim()) {
      blockLines = []
      return
    }
    const endLine = blockStartLine + blockLines.length - 1
    const kind = classifyBlock(src)
    blocks.push({ source: src, startLine: blockStartLine, endLine, kind })
    blockLines = []
  }

  function canSplit(): boolean {
    return !inFence && !inFrontmatter && jsxDepth === 0
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNumber = i + 1
    const trimmed = line.trimStart()

    // Frontmatter handling (only at very start of document)
    if (lineNumber === 1 && trimmed === '---') {
      inFrontmatter = true
      blockLines.push(line)
      blockStartLine = lineNumber
      continue
    }

    if (inFrontmatter && !frontmatterClosed) {
      blockLines.push(line)
      if (trimmed === '---' && blockLines.length > 1) {
        inFrontmatter = false
        frontmatterClosed = true
        flushBlock()
        blockStartLine = lineNumber + 1
      }
      continue
    }

    // Fenced code block tracking
    if (!inFrontmatter) {
      const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/)
      if (fenceMatch) {
        if (!inFence) {
          inFence = true
          fenceMarker = fenceMatch[1][0].repeat(fenceMatch[1].length)
        } else if (trimmed.startsWith(fenceMarker) && trimmed.slice(fenceMarker.length).trim() === '') {
          inFence = false
          fenceMarker = ''
        }
        blockLines.push(line)
        if (blockLines.length === 1) blockStartLine = lineNumber
        continue
      }
    }

    if (inFence) {
      blockLines.push(line)
      continue
    }

    // Blank line — potential split point
    if (trimmed === '') {
      if (canSplit() && blockLines.length > 0) {
        flushBlock()
        blockStartLine = lineNumber + 1
      } else if (blockLines.length > 0) {
        blockLines.push(line)
      }
      // else: skip leading blank lines, just advance startLine
      if (blockLines.length === 0) blockStartLine = lineNumber + 1
      continue
    }

    // Force convergence: if JSX depth is stuck open and we hit a top-level heading
    if (jsxDepth > 0 && isTopLevelHeading(trimmed)) {
      const spanLength = lineNumber - jsxSpanStart
      if (spanLength > 3) {
        // Force close: flush current block as-is, reset JSX depth
        jsxDepth = 0
        jsxSpanStart = -1
        flushBlock()
        blockStartLine = lineNumber
      }
    }

    // Force convergence: max span limit
    if (jsxDepth > 0 && jsxSpanStart > 0) {
      const spanLength = lineNumber - jsxSpanStart
      if (spanLength >= MAX_JSX_SPAN) {
        jsxDepth = 0
        jsxSpanStart = -1
        flushBlock()
        blockStartLine = lineNumber
      }
    }

    // Track JSX depth
    if (!inFence && !inFrontmatter) {
      const depthDelta = computeJsxDepthDelta(trimmed)
      const prevDepth = jsxDepth
      jsxDepth = Math.max(0, jsxDepth + depthDelta)
      if (prevDepth === 0 && jsxDepth > 0) {
        jsxSpanStart = lineNumber
      }
      if (jsxDepth === 0) {
        jsxSpanStart = -1
      }
    }

    // Accumulate line
    if (blockLines.length === 0) blockStartLine = lineNumber
    blockLines.push(line)
  }

  // Flush remaining
  flushBlock()

  return blocks
}

function isTopLevelHeading(trimmed: string): boolean {
  return /^#{1,6}\s/.test(trimmed)
}

function classifyBlock(source: string): BlockKind {
  const trimmed = source.trimStart()
  if (/^(import|export)\s/.test(trimmed)) return 'esm'
  if (/^<[A-Z]/.test(trimmed)) return 'jsx'
  return 'markdown'
}

/**
 * Lightweight JSX depth tracking for a single line.
 * Returns the net depth change (positive = more opens, negative = more closes).
 * Only tracks PascalCase tags (MDX components), ignores HTML lowercase tags.
 */
function computeJsxDepthDelta(line: string): number {
  let delta = 0
  const tagPattern = /<\/?([A-Z][A-Za-z0-9_.]*)/g
  let match: RegExpExecArray | null

  while ((match = tagPattern.exec(line))) {
    const fullMatch = match[0]
    const isClosing = fullMatch[1] === '/'

    if (isClosing) {
      delta -= 1
    } else {
      // Check if this opening tag is self-closing on the same line
      const afterTag = line.slice(match.index + fullMatch.length)
      const tagEndMatch = afterTag.match(/^[^>]*(\/>|>)/)
      if (tagEndMatch && tagEndMatch[1] === '/>') {
        // Self-closing, no depth change
      } else {
        delta += 1
      }
    }
  }

  return delta
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/tests/mdx-segmenter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/mdx/segmenter.ts src/tests/mdx-segmenter.test.ts
git commit -m "feat(mdx): implement fault-tolerant block segmenter"
```

---

## Task 3: Error Translation Table

**Files:**
- Create: `src/lib/mdx/errorTranslation.ts`
- Create: `src/tests/mdx-error-translation.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/tests/mdx-error-translation.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/tests/mdx-error-translation.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement error translation**

```typescript
// src/lib/mdx/errorTranslation.ts
import type { BlockError, ErrorTranslation } from './types'

const ERROR_PATTERNS: ErrorTranslation[] = [
  {
    pattern: /Expected a closing tag for `<(\w+)>`/,
    friendly: (m) => `<${m[1]}> 标签未闭合，请补全 </${m[1]}>`,
    fixHint: (m) => `在对应位置添加 </${m[1]}>`,
  },
  {
    pattern: /Unexpected closing tag `<\/(\w+)>`/,
    friendly: (m) => `多余的闭合标签 </${m[1]}>，没有与之配对的开始标签`,
    fixHint: (m) => `删除 </${m[1]}> 或添加对应的 <${m[1]}>`,
  },
  {
    pattern: /Unexpected token/,
    friendly: () => '花括号 {} 内的表达式语法有误，请检查 JS 写法',
    fixHint: () => '确保花括号内是合法的 JavaScript 表达式',
  },
  {
    pattern: /Could not parse import\/exports/,
    friendly: () => 'import/export 语句写法有误',
    fixHint: () => '检查 import/export 语句的语法格式',
  },
  {
    pattern: /Unexpected character .+ in name/,
    friendly: () => '标签名包含非法字符（常见于 < 后误跟空格或数字）',
    fixHint: () => '标签名必须以字母开头，只能包含字母、数字和连字符',
  },
  {
    pattern: /opening tag <(\w+)> is not closed/,
    friendly: (m) => `<${m[1]}> 标签未闭合，请补全 </${m[1]}>`,
    fixHint: (m) => `在对应位置添加 </${m[1]}>`,
  },
  {
    pattern: /closing tag <\/(\w+)> has no matching opening tag/,
    friendly: (m) => `多余的闭合标签 </${m[1]}>，没有与之配对的开始标签`,
    fixHint: (m) => `删除 </${m[1]}> 或添加对应的 <${m[1]}>`,
  },
  {
    pattern: /attribute quote is not closed/,
    friendly: () => '属性值的引号未闭合',
    fixHint: () => '检查标签属性中是否有未配对的引号',
  },
  {
    pattern: /expression brace is not closed/,
    friendly: () => '花括号表达式未闭合',
    fixHint: () => '检查 {} 是否配对完整',
  },
]

/** Line:column prefix pattern — e.g. "3:5: ..." */
const LINE_COL_PREFIX = /^(\d+):(\d+):\s*/

/**
 * Translates a raw MDX compilation error into a user-friendly BlockError.
 */
export function translateError(raw: string): BlockError {
  let line: number | undefined
  let column: number | undefined
  let message = raw

  // Extract line:column prefix if present
  const posMatch = raw.match(LINE_COL_PREFIX)
  if (posMatch) {
    line = parseInt(posMatch[1], 10)
    column = parseInt(posMatch[2], 10)
    message = raw.slice(posMatch[0].length)
  }

  // Try each pattern
  for (const translation of ERROR_PATTERNS) {
    const match = message.match(translation.pattern)
    if (match) {
      return {
        raw,
        friendly: translation.friendly(match),
        fixHint: translation.fixHint?.(match),
        line,
        column,
      }
    }
  }

  // Fallback: generic message
  return {
    raw,
    friendly: '此区块包含无法识别的语法',
    line,
    column,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/tests/mdx-error-translation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/mdx/errorTranslation.ts src/tests/mdx-error-translation.test.ts
git commit -m "feat(mdx): add error translation table for friendly Chinese messages"
```

---

## Task 4: Scope Manager

**Files:**
- Create: `src/lib/mdx/scopeManager.ts`
- Create: `src/tests/mdx-scope-manager.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/tests/mdx-scope-manager.test.ts
import { describe, it, expect } from 'vitest'
import { extractScope } from '../lib/mdx/scopeManager'
import type { Block } from '../lib/mdx/types'

function makeBlock(source: string, kind: 'markdown' | 'jsx' | 'esm' = 'markdown'): Block {
  return { source, startLine: 1, endLine: 1, kind }
}

describe('mdx scope manager', () => {
  it('extracts ESM blocks from block list', () => {
    const blocks: Block[] = [
      makeBlock('import { Chart } from "./Chart"', 'esm'),
      makeBlock('# Title', 'markdown'),
      makeBlock('export const data = [1,2,3]', 'esm'),
    ]
    const scope = extractScope(blocks)
    expect(scope.esmBlocks).toHaveLength(2)
    expect(scope.esmBlocks[0].source).toContain('import')
    expect(scope.esmBlocks[1].source).toContain('export const')
  })

  it('extracts link reference definitions from markdown blocks', () => {
    const blocks: Block[] = [
      makeBlock('[react]: https://react.dev\n[vue]: https://vuejs.org', 'markdown'),
      makeBlock('# Title', 'markdown'),
    ]
    const scope = extractScope(blocks)
    expect(scope.linkDefinitions).toHaveLength(2)
    expect(scope.linkDefinitions[0]).toContain('react')
  })

  it('extracts footnote definitions', () => {
    const blocks: Block[] = [
      makeBlock('[^1]: This is a footnote.', 'markdown'),
      makeBlock('Some text[^1]', 'markdown'),
    ]
    const scope = extractScope(blocks)
    expect(scope.footnoteDefinitions).toHaveLength(1)
    expect(scope.footnoteDefinitions[0]).toContain('footnote')
  })

  it('returns empty scope for blocks with no cross-references', () => {
    const blocks: Block[] = [makeBlock('# Simple', 'markdown')]
    const scope = extractScope(blocks)
    expect(scope.esmBlocks).toHaveLength(0)
    expect(scope.linkDefinitions).toHaveLength(0)
    expect(scope.footnoteDefinitions).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/tests/mdx-scope-manager.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement scope manager**

```typescript
// src/lib/mdx/scopeManager.ts
import type { Block, ScopeInfo } from './types'

/** Pattern for link reference definitions: [label]: url */
const LINK_DEF_PATTERN = /^\[([^\]]+)\]:\s+\S/

/** Pattern for footnote definitions: [^id]: content */
const FOOTNOTE_DEF_PATTERN = /^\[\^([^\]]+)\]:\s/

/**
 * Extracts cross-block scope information from a list of blocks.
 * This information is needed to compile content blocks that reference
 * definitions from other blocks.
 */
export function extractScope(blocks: Block[]): ScopeInfo {
  const esmBlocks: Block[] = []
  const linkDefinitions: string[] = []
  const footnoteDefinitions: string[] = []

  for (const block of blocks) {
    if (block.kind === 'esm') {
      esmBlocks.push(block)
      continue
    }

    // Scan markdown blocks for link/footnote definitions
    if (block.kind === 'markdown') {
      for (const line of block.source.split('\n')) {
        const trimmed = line.trimStart()
        if (LINK_DEF_PATTERN.test(trimmed)) {
          linkDefinitions.push(trimmed)
        } else if (FOOTNOTE_DEF_PATTERN.test(trimmed)) {
          footnoteDefinitions.push(trimmed)
        }
      }
    }
  }

  return { esmBlocks, linkDefinitions, footnoteDefinitions }
}

/**
 * Builds a link/footnote definition preamble to prepend to a block's source
 * before compilation, so cross-block references resolve correctly.
 */
export function buildDefinitionPreamble(scope: ScopeInfo): string {
  const parts: string[] = []

  if (scope.linkDefinitions.length > 0) {
    parts.push(scope.linkDefinitions.join('\n'))
  }

  if (scope.footnoteDefinitions.length > 0) {
    parts.push(scope.footnoteDefinitions.join('\n'))
  }

  return parts.length > 0 ? parts.join('\n') + '\n\n' : ''
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/tests/mdx-scope-manager.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/mdx/scopeManager.ts src/tests/mdx-scope-manager.test.ts
git commit -m "feat(mdx): add scope manager for cross-block dependency resolution"
```

---

## Task 5: Block Compiler with Fallback Chain

**Files:**
- Create: `src/lib/mdx/blockCompiler.ts`
- Create: `src/lib/mdx/cache.ts`
- Create: `src/tests/mdx-block-compiler.test.ts`

This is the core module. It tries MDX compilation first, falls back to Markdown rendering, and finally degrades to source view.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/tests/mdx-block-compiler.test.ts
import { describe, it, expect, vi } from 'vitest'
import { compileBlock } from '../lib/mdx/blockCompiler'
import type { Block, ScopeInfo } from '../lib/mdx/types'

// Mock the Tauri IPC
vi.mock('../lib/tauri', () => ({
  compileMdx: vi.fn(),
}))

import { compileMdx } from '../lib/tauri'
const mockCompileMdx = vi.mocked(compileMdx)

const emptyScope: ScopeInfo = { esmBlocks: [], linkDefinitions: [], footnoteDefinitions: [] }

function makeBlock(source: string, kind: 'markdown' | 'jsx' | 'esm' = 'markdown'): Block {
  return { source, startLine: 1, endLine: 1, kind }
}

describe('mdx block compiler', () => {
  it('returns L0 when MDX compilation succeeds', async () => {
    mockCompileMdx.mockResolvedValue(
      'import {jsx as _jsx} from "react/jsx-runtime"\nfunction MDXContent(){return _jsx("p",{children:"hi"})}\nexport default MDXContent'
    )
    const result = await compileBlock(makeBlock('Hello world'), emptyScope)
    expect(result.level).toBe('L0')
    expect(result.component).toBeDefined()
    expect(result.error).toBeUndefined()
  })

  it('returns L1 when MDX fails but Markdown succeeds', async () => {
    mockCompileMdx.mockRejectedValue(new Error('Unexpected token'))
    const block = makeBlock('<Broken {invalid}>\nSome text content')
    const result = await compileBlock(block, emptyScope)
    expect(result.level).toBe('L1')
    expect(result.markdownHtml).toContain('Some text content')
    expect(result.error).toBeDefined()
    expect(result.error!.friendly).toBeTruthy()
  })

  it('returns L2 when both MDX and Markdown fail', async () => {
    mockCompileMdx.mockRejectedValue(new Error('fatal error'))
    // A block that is pure invalid JSX with no readable text
    const block = makeBlock('<<<>>>{{{')
    const result = await compileBlock(block, emptyScope)
    // Even L2 should never throw — it degrades to source view
    expect(result.level).toBe('L2')
    expect(result.error).toBeDefined()
    expect(result.component).toBeUndefined()
    expect(result.markdownHtml).toBeUndefined()
  })

  it('maps error line numbers to document coordinates', async () => {
    mockCompileMdx.mockRejectedValue(new Error('2:1: Expected a closing tag for `<X>`'))
    const block: Block = { source: '<X>\nunclosed', startLine: 10, endLine: 11, kind: 'jsx' }
    const result = await compileBlock(block, emptyScope)
    // Line 2 in block → line 11 in document (startLine + localLine - 1)
    expect(result.error!.line).toBe(11)
  })

  it('does not throw on any input', async () => {
    mockCompileMdx.mockRejectedValue(new Error('crash'))
    const block = makeBlock('')
    // Should not reject
    const result = await compileBlock(block, emptyScope)
    expect(result).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/tests/mdx-block-compiler.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the block cache**

```typescript
// src/lib/mdx/cache.ts
import type { MdxRuntimeComponent } from '../mdxRuntime'

const MAX_CACHE_SIZE = 200

/** Simple hash for cache key generation */
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  return hash.toString(36)
}

interface CacheEntry {
  component: MdxRuntimeComponent
  timestamp: number
}

const cache = new Map<string, CacheEntry>()

export function getCacheKey(source: string): string {
  return simpleHash(source)
}

export function getCachedBlock(key: string): MdxRuntimeComponent | undefined {
  const entry = cache.get(key)
  if (entry) {
    entry.timestamp = Date.now()
    return entry.component
  }
  return undefined
}

export function setCachedBlock(key: string, component: MdxRuntimeComponent): void {
  cache.set(key, { component, timestamp: Date.now() })
  if (cache.size > MAX_CACHE_SIZE) {
    // Evict oldest entry
    let oldestKey: string | undefined
    let oldestTime = Infinity
    for (const [k, v] of cache) {
      if (v.timestamp < oldestTime) {
        oldestTime = v.timestamp
        oldestKey = k
      }
    }
    if (oldestKey) cache.delete(oldestKey)
  }
}

export function clearBlockCache(): void {
  cache.clear()
}
```

- [ ] **Step 4: Implement the block compiler**

```typescript
// src/lib/mdx/blockCompiler.ts
import type { Block, CompiledBlock, ScopeInfo } from './types'
import { translateError } from './errorTranslation'
import { buildDefinitionPreamble } from './scopeManager'
import { getCacheKey, getCachedBlock, setCachedBlock } from './cache'
import { compileMdx } from '../tauri'
import { createMdxComponent } from '../mdxRuntime'
import { Marked } from 'marked'

const marked = new Marked()

/**
 * Compiles a single block through the degradation chain:
 * MDX (L0) → Markdown (L1) → Source view (L2).
 *
 * NEVER throws. All errors are captured into the CompiledBlock result.
 */
export async function compileBlock(block: Block, scope: ScopeInfo): Promise<CompiledBlock> {
  // Skip empty blocks
  if (!block.source.trim()) {
    return { block, level: 'L0' }
  }

  // Try L0: Full MDX compilation
  const cacheKey = getCacheKey(block.source)
  const cached = getCachedBlock(cacheKey)
  if (cached) {
    return { block, level: 'L0', component: cached }
  }

  try {
    const preamble = buildDefinitionPreamble(scope)
    const sourceToCompile = preamble + block.source
    const compiled = await compileMdx(sourceToCompile)
    const component = createMdxComponent(compiled)
    setCachedBlock(cacheKey, component)
    return { block, level: 'L0', component }
  } catch (mdxError) {
    // MDX failed — try L1: Markdown fallback
    const rawError = mdxError instanceof Error ? mdxError.message : String(mdxError)
    const blockError = translateError(rawError)

    // Remap line number to document coordinates
    if (blockError.line !== undefined) {
      blockError.line = block.startLine + blockError.line - 1
    }

    try {
      const escapedSource = escapeJsxForMarkdown(block.source)
      const html = await marked.parse(escapedSource)
      if (html && html.trim()) {
        return {
          block,
          level: 'L1',
          markdownHtml: html,
          error: blockError,
        }
      }
    } catch {
      // Markdown also failed — fall through to L2
    }

    // L2: Source code view (error card)
    return {
      block,
      level: 'L2',
      error: blockError,
    }
  }
}

/**
 * Escapes JSX-specific syntax so the block can be parsed as plain Markdown.
 * Replaces `<` (when followed by uppercase = component) and `{` with their HTML entities.
 */
function escapeJsxForMarkdown(source: string): string {
  return source
    .replace(/<([A-Z])/g, '&lt;$1')
    .replace(/<\/([A-Z])/g, '&lt;/$1')
    .replace(/\{([^}]*)\}/g, '`{$1}`')
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/tests/mdx-block-compiler.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/mdx/blockCompiler.ts src/lib/mdx/cache.ts src/tests/mdx-block-compiler.test.ts
git commit -m "feat(mdx): implement block compiler with MDX→MD→source fallback chain"
```

---

## Task 6: Pipeline Orchestrator

**Files:**
- Create: `src/lib/mdx/index.ts`
- Create: `src/tests/mdx-pipeline-integration.test.ts`

- [ ] **Step 1: Write the failing integration test**

```typescript
// src/tests/mdx-pipeline-integration.test.ts
import { describe, it, expect, vi } from 'vitest'
import { compileMdxDocument } from '../lib/mdx'
import type { CompiledBlock } from '../lib/mdx/types'

vi.mock('../lib/tauri', () => ({
  compileMdx: vi.fn(),
}))

import { compileMdx } from '../lib/tauri'
const mockCompileMdx = vi.mocked(compileMdx)

const VALID_MDX_OUTPUT = `import {jsx as _jsx} from "react/jsx-runtime"
function MDXContent(){return _jsx("p",{children:"hi"})}
export default MDXContent`

describe('mdx pipeline integration', () => {
  it('compiles a multi-block document with one broken block', async () => {
    // First block compiles fine, second fails
    mockCompileMdx
      .mockResolvedValueOnce(VALID_MDX_OUTPUT)
      .mockRejectedValueOnce(new Error('Expected a closing tag for `<Card>`'))
      .mockResolvedValueOnce(VALID_MDX_OUTPUT)

    const source = '# Title\n\n<Card>\nunclosed\n\n# Footer'
    const result = await compileMdxDocument(source)

    expect(result.blocks.length).toBeGreaterThanOrEqual(3)

    const levels = result.blocks.map((b: CompiledBlock) => b.level)
    // At least one L0 and at least one non-L0
    expect(levels).toContain('L0')
    expect(levels.some((l: string) => l !== 'L0')).toBe(true)
  })

  it('returns all blocks even when entire document is malformed', async () => {
    mockCompileMdx.mockRejectedValue(new Error('fatal'))

    const source = '<Bad>\n\n<Also bad>'
    const result = await compileMdxDocument(source)

    // Should still produce blocks, not throw
    expect(result.blocks.length).toBeGreaterThan(0)
    expect(result.blocks.every((b: CompiledBlock) => b.level !== 'L0')).toBe(true)
  })

  it('passes scope (link definitions) to block compilation', async () => {
    mockCompileMdx.mockResolvedValue(VALID_MDX_OUTPUT)

    const source = '[react]: https://react.dev\n\nSee [react] for more.'
    const result = await compileMdxDocument(source)

    // Verify compileMdx was called with the definition prepended
    expect(mockCompileMdx).toHaveBeenCalled()
    const callArgs = mockCompileMdx.mock.calls
    const hasDefinition = callArgs.some(([src]) => src.includes('[react]:'))
    expect(hasDefinition).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/tests/mdx-pipeline-integration.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the pipeline orchestrator**

```typescript
// src/lib/mdx/index.ts
import type { Block, CompiledBlock, ScopeInfo } from './types'
import { segmentMdx } from './segmenter'
import { extractScope } from './scopeManager'
import { compileBlock } from './blockCompiler'

export type { Block, CompiledBlock, ScopeInfo }
export { segmentMdx } from './segmenter'
export { translateError } from './errorTranslation'
export { clearBlockCache } from './cache'

export interface MdxDocumentResult {
  /** All compiled blocks in document order */
  blocks: CompiledBlock[]
  /** Extracted scope info (for debugging / display) */
  scope: ScopeInfo
  /** Whether any block degraded (L1 or L2) */
  hasDegradation: boolean
}

/**
 * Full pipeline: segment → extract scope → compile each block.
 * Never throws. All errors are captured per-block.
 */
export async function compileMdxDocument(source: string): Promise<MdxDocumentResult> {
  // Step 1: Segment
  let blocks: Block[]
  try {
    blocks = segmentMdx(source)
  } catch {
    // L3 fallback: segmenter itself failed (should never happen)
    blocks = [{ source, startLine: 1, endLine: source.split('\n').length, kind: 'markdown' }]
  }

  if (blocks.length === 0) {
    return { blocks: [], scope: { esmBlocks: [], linkDefinitions: [], footnoteDefinitions: [] }, hasDegradation: false }
  }

  // Step 2: Extract scope
  const scope = extractScope(blocks)

  // Step 3: Compile each block (content blocks only; ESM blocks are scope-only)
  const contentBlocks = blocks.filter((b) => b.kind !== 'esm')
  const compiledBlocks = await Promise.all(
    contentBlocks.map((block) => compileBlock(block, scope))
  )

  const hasDegradation = compiledBlocks.some((b) => b.level !== 'L0')

  return { blocks: compiledBlocks, scope, hasDegradation }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/tests/mdx-pipeline-integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/mdx/index.ts src/tests/mdx-pipeline-integration.test.ts
git commit -m "feat(mdx): add pipeline orchestrator for block-isolated compilation"
```

---

## Task 7: Error Card Component (L2 Visual)

**Files:**
- Create: `src/components/mdx/ErrorCard.tsx`
- Create: `src/styles/mdx-errors.css`

- [ ] **Step 1: Implement the ErrorCard component**

```typescript
// src/components/mdx/ErrorCard.tsx
import { useState, useCallback } from 'react'
import type { BlockError, Block } from '../../lib/mdx/types'

interface ErrorCardProps {
  block: Block
  error: BlockError
}

export function ErrorCard({ block, error }: ErrorCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false)

  const handleCopyError = useCallback(() => {
    const text = `Line ${error.line ?? '?'}: ${error.raw}`
    navigator.clipboard?.writeText(text)
  }, [error])

  const errorLineInBlock = error.line !== undefined
    ? error.line - block.startLine + 1
    : undefined

  return (
    <div className="mdx-error-card" role="alert">
      {/* ① Status bar */}
      <div className="mdx-error-card-status">
        <span className="mdx-error-card-icon">⚠</span>
        <span className="mdx-error-card-message">{error.friendly}</span>
        {error.line && (
          <span className="mdx-error-card-location">· 第 {error.line} 行</span>
        )}
      </div>

      {/* ② Source degradation area */}
      <pre className="mdx-error-card-source">
        <code>
          {block.source.split('\n').map((line, i) => {
            const lineNum = block.startLine + i
            const isErrorLine = lineNum === error.line
            return (
              <span
                key={i}
                className={isErrorLine ? 'mdx-error-card-source-highlight' : undefined}
              >
                <span className="mdx-error-card-line-num">{lineNum}</span>
                {line}
                {'\n'}
              </span>
            )
          })}
        </code>
      </pre>

      {/* ③ Collapsible details */}
      <details
        className="mdx-error-card-details"
        open={detailsOpen}
        onToggle={(e) => setDetailsOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary>查看原始错误信息</summary>
        <pre className="mdx-error-card-raw">{error.raw}</pre>
      </details>

      {/* ④ Action bar */}
      <div className="mdx-error-card-actions">
        <button className="mdx-error-card-btn" onClick={handleCopyError}>
          复制错误
        </button>
        {error.fixHint && (
          <span className="mdx-error-card-hint">{error.fixHint}</span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement the error styles**

```css
/* src/styles/mdx-errors.css */

/* ─── Error Card (L2) ──────────────────────────────────────────── */

.mdx-error-card {
  margin: 12px 0;
  border: 1px solid var(--color-border-error, #e5484d);
  border-radius: 6px;
  overflow: hidden;
  font-size: 13px;
  background: var(--color-surface-error, #fff0f0);
}

[data-theme="dark"] .mdx-error-card {
  background: var(--color-surface-error, #1f1315);
  border-color: var(--color-border-error, #822025);
}

.mdx-error-card-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--color-surface-error-subtle, #fef0f0);
  border-bottom: 1px solid var(--color-border-error, #e5484d);
  font-weight: 500;
}

[data-theme="dark"] .mdx-error-card-status {
  background: var(--color-surface-error-subtle, #291415);
}

.mdx-error-card-icon {
  color: var(--color-text-error, #cd2b31);
  flex-shrink: 0;
}

.mdx-error-card-message {
  color: var(--color-text-primary);
  flex: 1;
}

.mdx-error-card-location {
  color: var(--color-text-secondary);
  font-size: 12px;
  white-space: nowrap;
}

.mdx-error-card-source {
  margin: 0;
  padding: 8px 12px;
  overflow-x: auto;
  font-family: var(--font-mono, 'SF Mono', 'Fira Code', monospace);
  font-size: 12px;
  line-height: 1.5;
  background: var(--color-surface-code, #f6f6f6);
  border-bottom: 1px solid var(--color-border-subtle);
}

[data-theme="dark"] .mdx-error-card-source {
  background: var(--color-surface-code, #1a1a1a);
}

.mdx-error-card-source code {
  display: block;
}

.mdx-error-card-line-num {
  display: inline-block;
  width: 3ch;
  margin-right: 12px;
  color: var(--color-text-tertiary);
  text-align: right;
  user-select: none;
}

.mdx-error-card-source-highlight {
  background: var(--color-highlight-error, rgba(229, 72, 77, 0.12));
  display: block;
  margin: 0 -12px;
  padding: 0 12px;
}

[data-theme="dark"] .mdx-error-card-source-highlight {
  background: var(--color-highlight-error, rgba(229, 72, 77, 0.15));
}

.mdx-error-card-details {
  padding: 0 12px;
  border-bottom: 1px solid var(--color-border-subtle);
}

.mdx-error-card-details summary {
  padding: 6px 0;
  cursor: pointer;
  color: var(--color-text-secondary);
  font-size: 12px;
  user-select: none;
}

.mdx-error-card-raw {
  margin: 0 0 8px;
  padding: 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--color-text-secondary);
  background: var(--color-surface-code);
  border-radius: 4px;
}

.mdx-error-card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
}

.mdx-error-card-btn {
  padding: 3px 8px;
  font-size: 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background 0.15s ease-out;
}

.mdx-error-card-btn:hover {
  background: var(--color-surface-hover);
}

.mdx-error-card-hint {
  font-size: 12px;
  color: var(--color-text-tertiary);
  font-style: italic;
}

/* ─── Degradation Badge (L1) ───────────────────────────────────── */

.mdx-degradation-wrapper {
  position: relative;
}

.mdx-degradation-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-warning, #f5a623);
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.15s ease-out;
}

.mdx-degradation-badge:hover {
  opacity: 1;
}

.mdx-degradation-tooltip {
  position: absolute;
  top: 16px;
  right: 0;
  z-index: 10;
  max-width: 280px;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--color-text-primary);
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  white-space: normal;
}

[data-theme="dark"] .mdx-degradation-tooltip {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

/* ─── Component Placeholder (unregistered) ─────────────────────── */

.mdx-component-placeholder {
  margin: 8px 0;
  padding: 12px;
  border: 1px dashed var(--color-border);
  border-radius: 6px;
  color: var(--color-text-tertiary);
  font-size: 12px;
}

.mdx-component-placeholder-name {
  font-family: var(--font-mono);
  font-weight: 500;
  color: var(--color-text-secondary);
}

.mdx-component-placeholder-label {
  margin-left: 8px;
  font-size: 11px;
  opacity: 0.7;
}
```

- [ ] **Step 3: Import the new stylesheet in the app**

Add to `src/App.tsx` (or wherever styles are imported — check existing pattern):

```typescript
import './styles/mdx-errors.css'
```

- [ ] **Step 4: Commit**

```bash
git add src/components/mdx/ErrorCard.tsx src/styles/mdx-errors.css
git commit -m "feat(mdx): add ErrorCard component and degradation styles"
```

---

## Task 8: DegradationBadge Component (L1 Visual)

**Files:**
- Create: `src/components/mdx/DegradationBadge.tsx`

- [ ] **Step 1: Implement the badge component**

```typescript
// src/components/mdx/DegradationBadge.tsx
import { useState, useCallback, type ReactNode } from 'react'
import type { BlockError } from '../../lib/mdx/types'

interface DegradationBadgeProps {
  children: ReactNode
  error: BlockError
}

/**
 * Wraps an L1 block (Markdown fallback) with a small yellow badge
 * in the top-right corner. Hovering/clicking reveals a tooltip
 * explaining why this block degraded.
 */
export function DegradationBadge({ children, error }: DegradationBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  const handleToggle = useCallback(() => {
    setShowTooltip((prev) => !prev)
  }, [])

  return (
    <div className="mdx-degradation-wrapper">
      {children}
      <div
        className="mdx-degradation-badge"
        onClick={handleToggle}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        role="button"
        aria-label="此区块已降级显示"
        tabIndex={0}
      />
      {showTooltip && (
        <div className="mdx-degradation-tooltip">
          此区块的交互组件未能加载，已按纯文本显示。
          <br />
          原因：{error.friendly}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/mdx/DegradationBadge.tsx
git commit -m "feat(mdx): add DegradationBadge for L1 degraded blocks"
```

---

## Task 9: Block Error Boundary

**Files:**
- Create: `src/components/mdx/BlockErrorBoundary.tsx`

- [ ] **Step 1: Implement the per-block ErrorBoundary**

```typescript
// src/components/mdx/BlockErrorBoundary.tsx
import { Component, type ReactNode } from 'react'
import { ErrorCard } from './ErrorCard'
import { translateError } from '../../lib/mdx/errorTranslation'
import type { Block } from '../../lib/mdx/types'

interface Props {
  block: Block
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

/**
 * Per-block React ErrorBoundary. If a compiled MDX block throws during render,
 * this catches it and displays an ErrorCard (L2) instead of crashing the page.
 */
export class BlockErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      const rawMessage = this.state.error?.message ?? 'Unknown render error'
      const blockError = translateError(rawMessage)
      // Remap to document coordinates if possible
      if (blockError.line !== undefined) {
        blockError.line = this.props.block.startLine + blockError.line - 1
      }
      return <ErrorCard block={this.props.block} error={blockError} />
    }
    return this.props.children
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/mdx/BlockErrorBoundary.tsx
git commit -m "feat(mdx): add BlockErrorBoundary for runtime render failures"
```

---

## Task 10: BlockRenderer Component

**Files:**
- Create: `src/components/mdx/BlockRenderer.tsx`

- [ ] **Step 1: Implement the block renderer**

```typescript
// src/components/mdx/BlockRenderer.tsx
import { Suspense } from 'react'
import type { CompiledBlock } from '../../lib/mdx/types'
import { BlockErrorBoundary } from './BlockErrorBoundary'
import { ErrorCard } from './ErrorCard'
import { DegradationBadge } from './DegradationBadge'

interface BlockRendererProps {
  compiled: CompiledBlock
  components: Record<string, unknown>
}

function BlockLoading() {
  return <div className="mdx-loading" aria-busy="true" />
}

/**
 * Renders a single compiled block according to its degradation level:
 * - L0: Full MDX component render with ErrorBoundary
 * - L1: Markdown HTML with degradation badge
 * - L2: Error card with source view
 */
export function BlockRenderer({ compiled, components }: BlockRendererProps) {
  const { block, level, component: Component, markdownHtml, error } = compiled

  // L2: Error card
  if (level === 'L2' && error) {
    return <ErrorCard block={block} error={error} />
  }

  // L1: Markdown fallback with badge
  if (level === 'L1' && markdownHtml && error) {
    return (
      <DegradationBadge error={error}>
        <div
          className="mdx-block-degraded"
          dangerouslySetInnerHTML={{ __html: markdownHtml }}
        />
      </DegradationBadge>
    )
  }

  // L0: Full MDX render
  if (Component) {
    return (
      <BlockErrorBoundary block={block}>
        <Suspense fallback={<BlockLoading />}>
          <Component components={components} />
        </Suspense>
      </BlockErrorBoundary>
    )
  }

  // Empty block
  return null
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/mdx/BlockRenderer.tsx
git commit -m "feat(mdx): add BlockRenderer dispatching by degradation level"
```

---

## Task 11: Refactor MdxRenderer to Use Block Pipeline

**Files:**
- Modify: `src/components/MdxRenderer.tsx`

This is the integration step. The existing `MdxRenderer` becomes a thin shell that delegates to the block pipeline. We preserve all existing behavior (click handling, loading states, component registry) while replacing the single-shot compilation with block-isolated compilation.

- [ ] **Step 1: Refactor MdxRenderer to use the block pipeline**

Replace the compilation logic in `MdxRenderer.tsx`. Keep the component registry (`wrapMdxComponents`, `withMissingComponentFallback`), click handler, and `MdxRuntimeProvider`. Replace the single `compileMdx` call with `compileMdxDocument`.

The key changes:
1. Replace `CompileState` with a blocks-based state
2. Call `compileMdxDocument` instead of `compileMdx` directly
3. Render blocks sequentially using `BlockRenderer`
4. Keep the outer `MdxErrorBoundary` as L3 fallback (segmenter failure)

```typescript
// src/components/MdxRenderer.tsx — key structural changes:

// Add imports:
import { compileMdxDocument, type CompiledBlock, type MdxDocumentResult } from '../lib/mdx'
import { BlockRenderer } from './mdx/BlockRenderer'

// Replace CompileState with:
interface DocumentState {
  key: string
  status: 'loading' | 'ready' | 'error'
  result?: MdxDocumentResult
  error?: string
}

// In the component body, replace the useEffect that calls compileMdx:
useEffect(() => {
  let cancelled = false

  setDocumentState({ key: cacheKey, status: 'loading' })
  compileMdxDocument(content)
    .then((result) => {
      if (!cancelled) {
        setDocumentState({ key: cacheKey, status: 'ready', result })
      }
    })
    .catch((error) => {
      if (!cancelled) {
        setDocumentState({
          key: cacheKey,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    })

  return () => { cancelled = true }
}, [cacheKey, content])

// Replace the render section with block-based rendering:
{activeState.status === 'ready' && activeState.result && (
  <MdxRuntimeProvider entryPath={entryPath}>
    {activeState.result.blocks.map((compiled, i) => (
      <BlockRenderer
        key={`${compiled.block.startLine}-${i}`}
        compiled={compiled}
        components={components}
      />
    ))}
  </MdxRuntimeProvider>
)}
```

- [ ] **Step 2: Run the frontend build to check for type errors**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Run all existing tests**

Run: `npm test`
Expected: All tests pass (existing MdxRenderer tests may need adjustment — see Step 4).

- [ ] **Step 4: Fix any test failures from the refactor**

If existing tests in `src/tests/` reference the old `CompileState` or mock `compileMdx` differently, update them to match the new pipeline. The old caching behavior is now internal to the block cache.

- [ ] **Step 5: Commit**

```bash
git add src/components/MdxRenderer.tsx
git commit -m "refactor(mdx): integrate block-isolated pipeline into MdxRenderer"
```

---

## Task 12: Import CSS and Wire Up Exports

**Files:**
- Modify: `src/App.tsx` (add CSS import)
- Modify: `src/components/mdx/index.ts` (export new components)

- [ ] **Step 1: Add mdx-errors.css import to App.tsx**

Check the existing style imports in `src/App.tsx` and add:

```typescript
import './styles/mdx-errors.css'
```

Place it near the existing `import './styles/mdx.css'` line.

- [ ] **Step 2: Export new components from mdx/index.ts**

Add to `src/components/mdx/index.ts`:

```typescript
export { ErrorCard } from './ErrorCard'
export { DegradationBadge } from './DegradationBadge'
export { BlockErrorBoundary } from './BlockErrorBoundary'
export { BlockRenderer } from './BlockRenderer'
```

- [ ] **Step 3: Run build to verify everything wires up**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/mdx/index.ts src/styles/mdx-errors.css
git commit -m "feat(mdx): wire up error styles and component exports"
```

---

## Task 13: Manual Smoke Test & Edge Cases

**Files:**
- No new files — verification only

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 2: Run Rust tests to ensure MDX compilation still works**

Run: `cd src-tauri && cargo test mdx`
Expected: All Rust MDX tests pass (the Tauri command interface is unchanged).

- [ ] **Step 3: Run the app in dev mode**

Run: `npm run dev` (Vite only, no Tauri needed for this check)
Expected: App starts without errors. Open browser DevTools and confirm no console errors from the MDX pipeline.

- [ ] **Step 4: Verify with a malformed .mdx file**

Create a test file in the workspace with intentional errors:

```markdown
---
summary: test
tags: [test]
---

# Good section

This paragraph renders fine.

<BrokenComponent
  no closing tag

# This section should still render

And this text should be visible.
```

Expected behavior:
- "Good section" and first paragraph render normally (L0)
- The broken component block shows an error card (L1 or L2)
- "This section should still render" and its content render normally (L0)

- [ ] **Step 5: Commit any fixes discovered during smoke testing**

```bash
git add -A
git commit -m "fix(mdx): address issues found during smoke testing"
```

---

## Summary of Degradation Flow

```
Document
  ├── Block 1: "# Good section"          → L0 ✓ (renders normally)
  ├── Block 2: "<BrokenComponent..."      → L2 ✗ (error card with source)
  ├── Block 3: "# This section..."        → L0 ✓ (renders normally)
  └── Block 4: "And this text..."         → L0 ✓ (renders normally)
```

The user sees 3 out of 4 blocks rendered perfectly. The broken block shows a clear error card with the source code, a friendly Chinese error message, and a fix hint — never losing content.
