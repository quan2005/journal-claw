import type { MdxRuntimeComponent } from '../mdxRuntime'

const MAX_CACHE_SIZE = 200

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
