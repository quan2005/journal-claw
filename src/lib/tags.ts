// ── Deterministic tag → color mapping ────────────────────────────────────────
// No hardcoded tag list. Same string always produces the same color.

export interface TagStyle {
  label: string
  color: string
  bg: string
  /** Raw "r,g,b" string for components that need theme-aware alpha */
  rgb: string
}

// Curated palette — high contrast on dark backgrounds, muted on light.
// Hues spread evenly to minimize collision between common tags.
const PALETTE = [
  [255, 149,   0],  // orange
  [ 88,  86, 214],  // indigo
  [ 48, 176, 199],  // teal
  [ 52, 199,  89],  // green
  [255,  59,  48],  // red
  [  0, 122, 255],  // blue
  [124,  58, 237],  // purple
  [255, 159,  10],  // amber
  [ 50, 173, 230],  // sky
  [175, 82,  222],  // violet
]

/** Simple string hash → stable unsigned 32-bit integer. */
function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0
  }
  return h >>> 0
}

/** Resolve any tag string to a deterministic label + color. */
export function resolveTag(tag: string): TagStyle {
  const [r, g, b] = PALETTE[hashString(tag) % PALETTE.length]
  const rgb = `${r},${g},${b}`
  // Detect current theme from document attribute
  const dark = typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-theme') === 'dark'
  const textAlpha = dark ? 0.72 : 0.78
  const bgAlpha = dark ? 0.12 : 0.13
  return {
    label: tag,
    color: `rgba(${rgb},${textAlpha})`,
    bg: `rgba(${rgb},${bgAlpha})`,
    rgb,
  }
}

/**
 * Pick display tags from the tags array, filtering 'journal'.
 * Returns up to `max` resolved styles (default 1 for list, 2 for detail).
 */
export function pickDisplayTags(tags: string[], max = 1): TagStyle[] {
  const result: TagStyle[] = []
  for (const tag of tags) {
    if (tag === 'journal') continue
    result.push(resolveTag(tag))
    if (result.length >= max) break
  }
  return result
}
