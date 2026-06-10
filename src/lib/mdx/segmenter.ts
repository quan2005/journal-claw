import type { Block, BlockKind } from './types'

/** PascalCase JSX open tag: <ComponentName or <Component.Sub */
const OPEN_TAG_RE = /^<([A-Z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)*)[\s>/]/
/** Self-closing PascalCase JSX tag on its own line */
const SELF_CLOSE_RE = /^<[A-Z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)*[^>]*\/>/
/** Fenced code block delimiter (``` or ~~~) */
const FENCE_RE = /^(`{3,}|~{3,})/
/** Top-level heading */
const HEADING_RE = /^# /
/** Frontmatter delimiter */
const FRONTMATTER_RE = /^---\s*$/

function classifyBlock(source: string): BlockKind {
  const first = source.trimStart()
  if (first.startsWith('import ') || first.startsWith('export ')) return 'esm'
  if (/^<[A-Z]/.test(first)) return 'jsx'
  return 'markdown'
}

function makeBlock(lines: string[], startLine: number, endLine: number): Block | null {
  const source = lines.join('\n')
  if (source.trim().length === 0) return null
  return { source, startLine, endLine, kind: classifyBlock(source) }
}

export function segmentMdx(source: string): Block[] {
  if (!source) return []

  const lines = source.split('\n')
  const blocks: Block[] = []

  let current: string[] = []
  let blockStart = 1
  let lastContentLine = 0

  // Fence state
  let inFence = false
  let fenceMarker = ''

  // Frontmatter state
  let inFrontmatter = false

  // JSX depth: we track the outermost PascalCase tag
  let jsxDepth = 0
  let jsxBlockStart = 0

  const pushLine = (line: string, lineNum: number) => {
    current.push(line)
    lastContentLine = lineNum
  }

  const flushCurrent = (overrideEnd?: number) => {
    if (current.length > 0) {
      const block = makeBlock(current, blockStart, overrideEnd ?? lastContentLine)
      if (block) blocks.push(block)
      current = []
      lastContentLine = 0
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1
    const line = lines[i]

    // ── Frontmatter handling ──────────────────────────────────────────────
    if (lineNum === 1 && FRONTMATTER_RE.test(line)) {
      inFrontmatter = true
      pushLine(line, lineNum)
      blockStart = 1
      continue
    }
    if (inFrontmatter) {
      pushLine(line, lineNum)
      if (lineNum > 1 && FRONTMATTER_RE.test(line)) {
        inFrontmatter = false
        flushCurrent()
        blockStart = lineNum + 1
      }
      continue
    }

    // ── Fence handling ────────────────────────────────────────────────────
    if (!inFence) {
      const m = FENCE_RE.exec(line)
      if (m) {
        inFence = true
        fenceMarker = m[1]
        pushLine(line, lineNum)
        continue
      }
    } else {
      pushLine(line, lineNum)
      if (line.startsWith(fenceMarker) && FENCE_RE.test(line)) {
        inFence = false
        fenceMarker = ''
      }
      continue
    }

    // ── Forced convergence: unclosed JSX for too long ─────────────────────
    if (jsxDepth > 0) {
      const linesInBlock = lineNum - jsxBlockStart
      const isHeading = HEADING_RE.test(line)
      if (linesInBlock > 50 || isHeading) {
        flushCurrent()
        blockStart = lineNum
        jsxDepth = 0
        jsxBlockStart = 0
        // fall through to process this line normally
      }
    }

    // ── JSX depth tracking ────────────────────────────────────────────────
    if (jsxDepth === 0) {
      // Self-closing: no depth change, treat as atomic block
      if (SELF_CLOSE_RE.test(line)) {
        // flush anything before it
        flushCurrent()
        blockStart = lineNum
        pushLine(line, lineNum)
        flushCurrent()
        blockStart = lineNum + 1
        continue
      }
      // Opening PascalCase tag — start tracking depth
      if (OPEN_TAG_RE.test(line)) {
        jsxDepth = 1
        jsxBlockStart = lineNum
        pushLine(line, lineNum)
        continue
      }
    } else {
      // Inside a JSX container — count nested opens/closes on this line
      const openMatches = line.match(/<[A-Z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)*[\s>/]/g) ?? []
      const selfCloseMatches = line.match(/<[A-Z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)*[^>]*\/>/g) ?? []
      const closeMatches = line.match(/<\/[A-Z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)*\s*>/g) ?? []

      const opens = openMatches.length - selfCloseMatches.length
      const closes = closeMatches.length
      const newDepth = Math.max(0, jsxDepth + opens - closes)

      pushLine(line, lineNum)

      if (newDepth === 0) {
        // JSX container closed — flush immediately with this line as endLine
        flushCurrent(lineNum)
        blockStart = lineNum + 1
        jsxDepth = 0
        jsxBlockStart = 0
      } else {
        jsxDepth = newDepth
      }
      continue
    }

    // ── Blank line splitting (JSX depth is zero here) ─────────────────────
    if (line.trim() === '') {
      flushCurrent()
      blockStart = lineNum + 1
      continue
    }

    pushLine(line, lineNum)
  }

  // Flush remaining
  flushCurrent()

  return blocks
}
