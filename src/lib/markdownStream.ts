// Ported from claw-code render.rs:652-845
// Handles two LLM output problems:
// 1. Nested code fences (LLM emits ``` inside ```) — normalizeNestedFences
// 2. Streaming splits mid-fence causing render flicker — MarkdownStreamBuffer

interface FenceLine {
  char: string
  len: number
  hasInfo: boolean
  indent: number
}

interface FenceMarker {
  char: string
  length: number
}

function parseFenceLine(line: string): FenceLine | null {
  const trimmed = line.replace(/[\r\n]+$/, '')
  const indent = trimmed.search(/[^ ]/)
  if (indent < 0 || indent > 3) return null
  const rest = trimmed.slice(indent)
  const ch = rest[0]
  if (ch !== '`' && ch !== '~') return null
  let len = 0
  while (len < rest.length && rest[len] === ch) len++
  if (len < 3) return null
  const after = rest.slice(len)
  if (ch === '`' && after.includes('`')) return null
  const hasInfo = after.trim().length > 0
  return { char: ch, len, hasInfo, indent }
}

/**
 * Pre-process markdown so that fenced code blocks whose body contains
 * fence markers of equal or greater length are wrapped with a longer fence.
 * Ported from claw-code render.rs:652-813.
 */
export function normalizeNestedFences(markdown: string): string {
  const lines = markdown.split('\n')
  const fenceInfo: (FenceLine | null)[] = lines.map((l) => parseFenceLine(l))

  // Pass 1: pair openers with closers using a stack
  const stack: { lineIdx: number; fence: FenceLine }[] = []
  const pairs: [number, number, number][] = [] // [opener, closer, innerMax]

  for (let i = 0; i < fenceInfo.length; i++) {
    const fl = fenceInfo[i]
    if (!fl) continue

    if (fl.hasInfo) {
      stack.push({ lineIdx: i, fence: fl })
    } else {
      const top = stack[stack.length - 1]
      if (top && top.fence.char === fl.char && fl.len >= top.fence.len) {
        stack.pop()
        let innerMax = 0
        for (let j = top.lineIdx + 1; j < i; j++) {
          if (fenceInfo[j]) innerMax = Math.max(innerMax, fenceInfo[j]!.len)
        }
        pairs.push([top.lineIdx, i, innerMax])
      } else {
        stack.push({ lineIdx: i, fence: fl })
      }
    }
  }

  // Pass 2: determine which lines need rewriting
  const rewrites = new Map<number, { char: string; newLen: number; indent: number }>()

  for (const [openerIdx, closerIdx, innerMax] of pairs) {
    const openerFl = fenceInfo[openerIdx]!
    if (openerFl.len <= innerMax) {
      const newLen = innerMax + 1
      rewrites.set(openerIdx, { char: openerFl.char, newLen, indent: openerFl.indent })
      const closerFl = fenceInfo[closerIdx]!
      rewrites.set(closerIdx, { char: closerFl.char, newLen, indent: closerFl.indent })
    }
  }

  if (rewrites.size === 0) return markdown

  // Rebuild
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const rw = rewrites.get(i)
    if (rw) {
      const indentStr = ' '.repeat(rw.indent)
      const fenceStr = rw.char.repeat(rw.newLen)
      const fi = fenceInfo[i]!
      const info = lines[i].replace(/[\r\n]+$/, '').slice(fi.indent + fi.len)
      out.push(indentStr + fenceStr + info)
    } else {
      out.push(lines[i])
    }
  }
  return out.join('\n')
}

// --- Streaming safe boundary ---

function parseFenceOpener(line: string): FenceMarker | null {
  const indent = line.search(/[^ ]/)
  if (indent < 0 || indent > 3) return null
  const rest = line.slice(Math.max(0, indent))
  const ch = rest[0]
  if (ch !== '`' && ch !== '~') return null
  let length = 0
  while (length < rest.length && rest[length] === ch) length++
  if (length < 3) return null
  const infoString = rest.slice(length)
  if (ch === '`' && infoString.includes('`')) return null
  return { char: ch, length }
}

function lineClosesFence(line: string, opener: FenceMarker): boolean {
  const indent = line.search(/[^ ]/)
  if (indent < 0 || indent > 3) return false
  const rest = line.slice(Math.max(0, indent))
  let length = 0
  while (length < rest.length && rest[length] === opener.char) length++
  if (length < opener.length) return false
  return rest.slice(length).trim().length === 0
}

/**
 * Find a safe byte offset to split streaming markdown without breaking
 * code fences. Returns null if no safe boundary exists yet.
 * Ported from claw-code render.rs:816-845.
 */
function findStreamSafeBoundary(markdown: string): number | null {
  let openFence: FenceMarker | null = null
  let lastBoundary: number | null = null
  let cursor = 0

  const parts = markdown.split('\n')
  for (let i = 0; i < parts.length; i++) {
    const line = parts[i]
    const lineLen = line.length + (i < parts.length - 1 ? 1 : 0) // +1 for \n except last

    const lineWithoutNewline = line
    if (openFence) {
      if (lineClosesFence(lineWithoutNewline, openFence)) {
        openFence = null
        lastBoundary = cursor + lineLen
      }
      cursor += lineLen
      continue
    }

    const opener = parseFenceOpener(lineWithoutNewline)
    if (opener) {
      openFence = opener
      cursor += lineLen
      continue
    }

    if (lineWithoutNewline.trim().length === 0) {
      lastBoundary = cursor + lineLen
    }
    cursor += lineLen
  }

  return lastBoundary
}

/**
 * Buffers streaming markdown deltas and only releases text at safe
 * boundaries (blank lines or closed code fences) to prevent render flicker.
 * Ported from claw-code render.rs:600-625.
 */
export class MarkdownStreamBuffer {
  private pending = ''

  push(delta: string): string | null {
    this.pending += delta
    const boundary = findStreamSafeBoundary(this.pending)
    if (boundary === null) return null
    const ready = this.pending.slice(0, boundary)
    this.pending = this.pending.slice(boundary)
    return ready
  }

  flush(): string | null {
    if (!this.pending.trim()) {
      this.pending = ''
      return null
    }
    const out = this.pending
    this.pending = ''
    return out
  }

  get hasPending(): boolean {
    return this.pending.length > 0
  }
}
