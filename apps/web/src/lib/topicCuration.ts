import type { TopicEntry } from './tauri'

/**
 * AC-1 · 基础设施文件过滤（专题浏览视图专用）
 *
 * 这些条目仍存在于磁盘、可被索引/正文内部链接引用，仅不占据浏览视图。
 * 修改清单只需改这一处——single source of truth。
 */
const INFRASTRUCTURE_DIR_NAMES = new Set<string>(['assets'])

const INFRASTRUCTURE_FILE_EXACT = new Set<string>(['00-index.md', '00-index.mdx'])

// 后缀型 readme：me-export-readme.md / TOPIC-README.md 等
const INFRASTRUCTURE_FILE_PATTERNS: readonly RegExp[] = [/-(?:readme)\.md[x]?$/i]

/** 判断一个条目是否为「基础设施」条目（默认不在专题树展示）。 */
export function isInfrastructureEntry(entry: { name: string; is_dir: boolean }): boolean {
  if (entry.is_dir) return INFRASTRUCTURE_DIR_NAMES.has(entry.name)
  if (INFRASTRUCTURE_FILE_EXACT.has(entry.name)) return true
  return INFRASTRUCTURE_FILE_PATTERNS.some((re) => re.test(entry.name))
}

/** 过滤掉基础设施条目，返回仅含用户笔记的列表。 */
export function filterCuration(entries: TopicEntry[]): TopicEntry[] {
  return entries.filter((entry) => !isInfrastructureEntry(entry))
}

/**
 * AC-2 · 显示名回退：去扩展名 + 可读化文件名。
 *
 * 仅剥离 markdown 扩展名（笔记类）；其它文件保留扩展名以保留信息。
 * 连字符 / 下划线 → 空格，折叠连续空白。
 */
export function humanizeEntryName(name: string): string {
  const stem = name.replace(/\.(?:md|mdx)$/i, '')
  const humanized = stem.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  return humanized || name
}

/**
 * AC-2 · 优先使用 frontmatter title；无 title 时回退到可读化文件名。
 *
 * title 由 daemon 在 listDir 时解析 frontmatter 填入（见 topics/service.ts）。
 */
export function displayTopicName(entry: TopicEntry): string {
  const title = typeof entry.title === 'string' ? entry.title.trim() : ''
  return title || humanizeEntryName(entry.name)
}
