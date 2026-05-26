// Streaming XML artifact parser adapted from Open Design
// apps/web/src/artifacts/parser.ts
//
// Parses <artifact type="..." title="...">...</artifact> tags from
// incremental text streams, handling streaming edge cases (partial tags,
// code fences, inline code spans).

export type ArtifactEvent =
  | { type: 'text'; text: string }
  | { type: 'artifact:start'; artifactType: string; title: string }
  | { type: 'artifact:chunk'; text: string }
  | { type: 'artifact:end'; fullContent: string }

const OPEN_PREFIX = '<artifact'
const CLOSE_TAG = '</artifact>'
const FENCE_RE = /^`{3,}\s*\S*/ // opening or closing fence line

interface SkipRange {
  start: number
  end: number
}

/**
 * Identify code-fence and inline-code ranges that the parser must skip.
 * Returns the skip ranges, plus the position of any unclosed fence opener
 * (which may close in a future chunk).
 */
function computeSkipRanges(text: string): {
  ranges: SkipRange[]
  unclosedFenceStart: number | null
} {
  const ranges: SkipRange[] = []
  let unclosedFenceStart: number | null = null

  const lines = text.split('\n')
  let pos = 0
  let inFence = false

  for (const line of lines) {
    const lineLen = line.length + 1 // include \n
    if (FENCE_RE.test(line.trimStart())) {
      if (inFence) {
        ranges.push({ start: unclosedFenceStart!, end: pos + line.length })
        unclosedFenceStart = null
        inFence = false
      } else {
        unclosedFenceStart = pos
        inFence = true
      }
    }
    pos += lineLen
  }

  return { ranges, unclosedFenceStart: inFence ? unclosedFenceStart : null }
}

function rangeContains(ranges: SkipRange[], pos: number): boolean {
  for (const r of ranges) {
    if (pos >= r.start && pos < r.end) return true
  }
  return false
}

/**
 * Find the next <artifact open tag in the buffer, respecting code fences.
 *
 * Returns:
 *   { kind: 'complete', start, end, attrs } — a fully parsable open tag
 *   { kind: 'partial', start } — the buffer contains a partial or mid-stream tag
 *   { kind: 'none' } — no relevant tag material in the buffer
 */
type OpenTagResult =
  | { kind: 'complete'; start: number; end: number; attrs: string }
  | { kind: 'partial'; start: number }
  | { kind: 'none' }

function findOpenTag(buffer: string): OpenTagResult {
  const { ranges, unclosedFenceStart } = computeSkipRanges(buffer)

  // Scan for a complete open tag outside skip ranges
  let from = 0
  while (from < buffer.length) {
    const idx = buffer.indexOf(OPEN_PREFIX, from)
    if (idx === -1) break
    if (rangeContains(ranges, idx)) {
      from = idx + OPEN_PREFIX.length
      continue
    }
    // Past an unclosed fence — everything after is inside a code block
    if (unclosedFenceStart !== null && idx >= unclosedFenceStart) break

    // Check this is a real artifact tag (not "<artifactual" etc.)
    const after = idx + OPEN_PREFIX.length
    const next = buffer.charAt(after)
    if (next === '') {
      // `<artifact` at end of buffer — partial, may complete next chunk
      return { kind: 'partial', start: idx }
    }
    // Real tag must be followed by whitespace or '>'
    if (next !== ' ' && next !== '\t' && next !== '\n' && next !== '>') {
      from = after
      continue
    }

    // Scan for closing '>'
    let j = after
    let quote: '"' | "'" | null = null
    while (j < buffer.length) {
      const c = buffer.charAt(j)
      if (quote !== null) {
        if (c === quote) quote = null
      } else if (c === '"' || c === "'") {
        quote = c
      } else if (c === '>') {
        return {
          kind: 'complete',
          start: idx,
          end: j + 1,
          attrs: buffer.slice(after, j),
        }
      }
      j++
    }
    // Ran out before '>' — partial, wait for next chunk
    return { kind: 'partial', start: idx }
  }

  // Check for partial `<art` at the tail that could become a tag later
  const lastLt = buffer.lastIndexOf('<')
  if (lastLt !== -1 && !rangeContains(ranges, lastLt)) {
    const slice = buffer.slice(lastLt)
    if (OPEN_PREFIX.startsWith(slice) && slice.length < OPEN_PREFIX.length) {
      // Also check it's not inside an inline code span
      let backtickParity = 0
      for (let k = lastLt; k >= 0; k--) {
        if (buffer.charAt(k) === '`') backtickParity++
      }
      if (backtickParity % 2 === 0) {
        return { kind: 'partial', start: lastLt }
      }
    }
  }

  return { kind: 'none' }
}

function parseAttrs(raw: string): Record<string, string> {
  const re = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  const out: Record<string, string> = {}
  let m: RegExpExecArray | null = re.exec(raw)
  while (m !== null) {
    out[m[1]] = m[2] ?? m[3] ?? ''
    m = re.exec(raw)
  }
  return out
}

/**
 * Create a streaming artifact parser.
 *
 * Usage:
 *   const parser = createArtifactParser()
 *   const events = parser.feed(delta) // process each text chunk
 *   const finalEvents = parser.flush() // drain remaining content at end
 */
export function createArtifactParser() {
  let state: 'idle' | 'inside' = 'idle'
  let buffer = ''
  let artifactType = ''
  let title = ''
  let content = ''

  function feed(delta: string): ArtifactEvent[] {
    buffer += delta
    const events: ArtifactEvent[] = []

    while (buffer.length > 0) {
      if (state === 'idle') {
        const open = findOpenTag(buffer)
        if (open.kind === 'none') {
          events.push({ type: 'text', text: buffer })
          buffer = ''
          return events
        }
        if (open.kind === 'partial') {
          if (open.start > 0) {
            events.push({ type: 'text', text: buffer.slice(0, open.start) })
            buffer = buffer.slice(open.start)
          }
          return events
        }
        // Complete open tag found
        if (open.start > 0) {
          events.push({ type: 'text', text: buffer.slice(0, open.start) })
        }
        const attrs = parseAttrs(open.attrs)
        artifactType = attrs['type'] ?? 'html'
        title = attrs['title'] ?? ''
        content = ''
        state = 'inside'
        buffer = buffer.slice(open.end)
        events.push({ type: 'artifact:start', artifactType, title })
        continue
      }

      // state === 'inside'
      const closeIdx = buffer.indexOf(CLOSE_TAG)
      if (closeIdx === -1) {
        // Hold back tail bytes that could start a partial close tag
        const holdback = CLOSE_TAG.length - 1
        const flushUpTo = buffer.length - holdback
        if (flushUpTo > 0) {
          const chunk = buffer.slice(0, flushUpTo)
          content += chunk
          buffer = buffer.slice(flushUpTo)
          events.push({ type: 'artifact:chunk', text: chunk })
        }
        return events
      }

      // Close tag found
      const finalChunk = buffer.slice(0, closeIdx)
      if (finalChunk.length > 0) {
        content += finalChunk
        events.push({ type: 'artifact:chunk', text: finalChunk })
      }
      events.push({ type: 'artifact:end', fullContent: content })
      buffer = buffer.slice(closeIdx + CLOSE_TAG.length)
      state = 'idle'
      artifactType = ''
      title = ''
      content = ''
    }

    return events
  }

  function flush(): ArtifactEvent[] {
    const events: ArtifactEvent[] = []
    if (state === 'inside') {
      if (buffer.length > 0) {
        content += buffer
        events.push({ type: 'artifact:chunk', text: buffer })
      }
      events.push({ type: 'artifact:end', fullContent: content })
      buffer = ''
      state = 'idle'
      artifactType = ''
      title = ''
      content = ''
    } else if (buffer.length > 0) {
      events.push({ type: 'text', text: buffer })
      buffer = ''
    }
    return events
  }

  return { feed, flush }
}
