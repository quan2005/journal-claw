/**
 * Path helpers for agent detection.
 *
 * Mirrors open-design runtimes/paths.ts (expandHomePath), trimmed to what
 * executables.ts needs to resolve `*_BIN` overrides that may start with `~`.
 */

export function expandHomePath(raw: string): string {
  if (typeof raw !== 'string') return ''
  if (raw === '~') return process.env.HOME ?? ''
  if (raw.startsWith('~/')) return `${process.env.HOME ?? ''}${raw.slice(1)}`
  return raw
}
