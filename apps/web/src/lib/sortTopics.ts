import type { TopicEntry } from './apiTypes'

export type WorkspaceTreeSort = 'name-asc' | 'name-desc' | 'mtime-desc' | 'type-first' | 'manual'

function byNameAsc(a: TopicEntry, b: TopicEntry): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
}

export function sortEntries(
  entries: TopicEntry[],
  strategy: WorkspaceTreeSort,
  manualOrder?: string[],
): TopicEntry[] {
  const copy = [...entries]
  switch (strategy) {
    case 'name-asc':
      return copy.sort(byNameAsc)
    case 'name-desc':
      return copy.sort((a, b) => byNameAsc(b, a))
    case 'mtime-desc':
      return copy.sort((a, b) => b.mtime_secs - a.mtime_secs)
    case 'type-first':
      return copy.sort((a, b) => {
        if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1
        return byNameAsc(a, b)
      })
    case 'manual': {
      if (!manualOrder || manualOrder.length === 0) return copy.sort(byNameAsc)
      const rank = new Map(manualOrder.map((name, i) => [name, i]))
      return copy.sort((a, b) => {
        const ra = rank.has(a.name) ? rank.get(a.name)! : Number.MAX_SAFE_INTEGER
        const rb = rank.has(b.name) ? rank.get(b.name)! : Number.MAX_SAFE_INTEGER
        if (ra !== rb) return ra - rb
        return byNameAsc(a, b)
      })
    }
  }
}
