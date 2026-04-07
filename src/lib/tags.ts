// ── Deterministic tag → color mapping ────────────────────────────────────────
// No hardcoded tag list. Same string always produces the same color.

export interface TagStyle {
  label: string
  color: string
  bg: string
  /** Raw "r,g,b" string for components that need theme-aware alpha */
  rgb: string
}

// Monochrome tinted-neutral palette — ink-cyan tones, subtle and cohesive.
// All entries are close blue-gray values; hash provides slight variation only.
const PALETTE = [
  [100, 110, 120],  // ink-cyan neutral 1
  [110, 118, 128],  // ink-cyan neutral 2
  [ 90, 100, 112],  // ink-cyan neutral 3
  [105, 112, 122],  // ink-cyan neutral 4
  [ 95, 105, 116],  // ink-cyan neutral 5
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
  // Dark mode: use amber-tinted neutrals to match theme color
  if (dark) {
    const amberR = Math.min(255, r + 80)
    const amberG = Math.min(255, g + 40)
    const amberB = Math.max(0, b - 20)
    const amberRgb = `${amberR},${amberG},${amberB}`
    return {
      label: tag,
      color: `rgba(${amberRgb},0.65)`,
      bg: `rgba(${amberRgb},0.10)`,
      rgb: amberRgb,
    }
  }
  const textAlpha = 0.80
  const bgAlpha = 0.12
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
