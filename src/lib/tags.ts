// ── Deterministic tag → style mapping ────────────────────────────────────────
// Colors come from CSS custom properties (--tag-text, --tag-bg) so they
// automatically follow the current theme. No runtime color computation needed.

export interface TagStyle {
  label: string
}

/**
 * Pick display tags from the tags array, filtering 'journal'.
 * Returns up to `max` tag labels (default 1 for list, Infinity for detail).
 */
export function pickDisplayTags(tags: string[], max = 1): TagStyle[] {
  const result: TagStyle[] = []
  for (const tag of tags) {
    if (tag === 'journal') continue
    result.push({ label: tag })
    if (result.length >= max) break
  }
  return result
}
