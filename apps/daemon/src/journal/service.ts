import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ChangeSetService } from '../changeset/service.js'
import {
  assertInsideRoot,
  createdDisplayTime,
  createdSecs,
  currentYearMonth,
  dayPrefix,
  ensureYearMonthDirs,
  fieldList,
  fieldString,
  mtimeMs,
  mtimeSecs,
  parseInlineList,
  parseYamlishFields,
  readWorkspaceFile,
  removeTracked,
  stripSurroundingQuotes,
  writeTracked,
} from '../local/service.js'
import { memoryDir, memoryMonthDir } from '../workspace/paths.js'

export interface RawMaterial {
  filename: string
  path: string
  kind: string
  size_bytes: number
}

export interface JournalEntry {
  filename: string
  path: string
  title: string
  summary: string
  tags: string[]
  year_month: string
  day: number
  created_time: string
  created_at_secs: number
  mtime_secs: number
  mtime_ms: number
  materials: RawMaterial[]
  sources: string[]
}

const RUN_ID = 'journal-manual'

export interface JournalStateStore {
  sampleEntryCreated(): boolean
  setSampleEntryCreated(created: boolean): void
}

export class JournalService {
  constructor(
    private readonly workspaceRoot: string,
    private readonly changeSetService: ChangeSetService,
    private readonly now = () => new Date(),
    private readonly stateStore: JournalStateStore = inMemoryJournalState(),
  ) {}

  listMonths(): string[] {
    const dir = memoryDir(this.workspaceRoot)
    if (!existsSync(dir)) return []
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^\d{4}$/.test(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => b.localeCompare(a))
  }

  list(yearMonth: string): JournalEntry[] {
    const dir = memoryMonthDir(this.workspaceRoot, yearMonth)
    if (!existsSync(dir)) return []
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => this.toEntry(yearMonth, join(dir, entry.name), entry.name))
      .filter((entry): entry is JournalEntry => entry !== null)
      .sort((a, b) => b.day - a.day || b.created_at_secs - a.created_at_secs)
  }

  listByMonths(months: string[]): JournalEntry[] {
    return months
      .flatMap((month) => this.list(month))
      .sort(
        (a, b) =>
          b.year_month.localeCompare(a.year_month) ||
          b.day - a.day ||
          b.created_at_secs - a.created_at_secs,
      )
  }

  listAll(): JournalEntry[] {
    return this.listByMonths(this.listMonths())
  }

  listPaginated(offset: number, limit: number): [JournalEntry[], number] {
    const all = this.listAll()
    return [all.slice(offset, offset + limit), all.length]
  }

  getContent(path: string): string {
    return readWorkspaceFile(this.workspaceRoot, path)
  }

  saveContent(path: string, content: string): void {
    const abs = assertInsideRoot(this.workspaceRoot, path)
    writeTracked(this.changeSetService, this.workspaceRoot, RUN_ID, abs, content)
  }

  delete(path: string): void {
    const abs = assertInsideRoot(this.workspaceRoot, path)
    removeTracked(this.changeSetService, this.workspaceRoot, RUN_ID, abs)
  }

  createSampleEntry(): void {
    const now = this.now()
    this.writeSampleEntry(currentYearMonth(now), now.getDate())
  }

  createSampleEntryIfNeeded(): boolean {
    if (this.stateStore.sampleEntryCreated()) return false
    if (this.hasAnyEntry()) return false
    this.createSampleEntry()
    this.stateStore.setSampleEntryCreated(true)
    return true
  }

  private writeSampleEntry(yearMonth: string, day: number): string {
    ensureYearMonthDirs(this.workspaceRoot, yearMonth)
    const filename = `${dayPrefix(new Date(2000, 0, day))}-产品评审示例.html`
    const path = join(memoryMonthDir(this.workspaceRoot, yearMonth), filename)
    if (!existsSync(path)) {
      writeTracked(this.changeSetService, this.workspaceRoot, RUN_ID, path, sampleEntryContent())
    }
    return path
  }

  private hasAnyEntry(): boolean {
    return this.listMonths().some((month) =>
      readdirSync(memoryMonthDir(this.workspaceRoot, month), { withFileTypes: true }).some(
        (entry) => entry.isFile() && parseEntryFilename(entry.name) !== null,
      ),
    )
  }

  private toEntry(yearMonth: string, path: string, filename: string): JournalEntry | null {
    const parsed = parseEntryFilename(filename)
    if (!parsed) return null
    const content = readFileSync(path, 'utf8')
    const fm =
      filename.endsWith('.html') || filename.endsWith('.htm')
        ? parseHtmlCommentMetadata(content)
        : parseJournalFrontmatter(content)
    return {
      filename,
      path: resolve(path),
      title: parsed.title,
      summary: stripSurroundingQuotes(fm.summary),
      tags: fm.tags,
      year_month: yearMonth,
      day: parsed.day,
      created_time: createdDisplayTime(path),
      created_at_secs: createdSecs(path),
      mtime_secs: mtimeSecs(path),
      mtime_ms: mtimeMs(path),
      materials: [],
      sources: fm.sources,
    }
  }
}

function inMemoryJournalState(): JournalStateStore {
  let sampleCreated = false
  return {
    sampleEntryCreated: () => sampleCreated,
    setSampleEntryCreated: (created) => {
      sampleCreated = created
    },
  }
}

export function parseEntryFilename(filename: string): { day: number; title: string } | null {
  const stem = filename
    .replace(/\.mdx$/, '')
    .replace(/\.md$/, '')
    .replace(/\.html$/, '')
    .replace(/\.htm$/, '')
  if (stem === filename) return null
  const dash = stem.indexOf('-')
  if (dash < 0) return null
  const day = Number.parseInt(stem.slice(0, dash), 10)
  const title = stem.slice(dash + 1)
  if (!Number.isFinite(day) || !title) return null
  return { day, title }
}

function parseJournalFrontmatter(content: string): {
  summary: string
  tags: string[]
  sources: string[]
} {
  const parsed = parseYamlishFields(content)
  return {
    summary: stripSurroundingQuotes(fieldString(parsed.fields, 'summary')),
    tags: fieldList(parsed.fields, 'tags'),
    sources: fieldList(parsed.fields, 'sources'),
  }
}

function parseHtmlCommentMetadata(content: string): {
  summary: string
  tags: string[]
  sources: string[]
} {
  const trimmed = content.trimStart()
  if (!trimmed.startsWith('<!--')) return { summary: '', tags: [], sources: [] }
  const end = trimmed.indexOf('-->')
  if (end < 0) return { summary: '', tags: [], sources: [] }
  const fields = new Map<string, string>()
  for (const line of trimmed.slice(4, end).split(/\r?\n/)) {
    const idx = line.indexOf(':')
    if (idx < 0) continue
    fields.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim())
  }
  return {
    summary: fields.get('summary') ? stripSurroundingQuotes(fields.get('summary')!) : '',
    tags: parseInlineList(fields.get('tags')),
    sources: parseInlineList(fields.get('sources')),
  }
}

function sampleEntryContent(): string {
  return `<!--
tags: 示例, 产品, 会议
summary: 这是 AI 帮你整理的示例——试着录一段音或粘贴一段会议记录
-->

<h1>产品评审会议纪要</h1>

<h2>会议结论</h2>
<ul>
  <li>下一版本功能优先级已确定，重点投入 AI 摘要功能</li>
  <li>UI 改版方案通过评审，进入设计执行阶段</li>
  <li>技术债处理排期至 Q2 下半段</li>
</ul>

<h2>待办事项</h2>
<ul>
  <li>@设计：输出首页改版高保真稿，截止下周五</li>
  <li>@后端：排期 API 优化，评估工作量</li>
</ul>

<h2>参会人员</h2>
<p>产品、设计、前后端各一名</p>

<hr>

<blockquote>这条记录是示例，展示 AI 整理后的效果。你可以删除它，或拖入文件 / 粘贴文本开始使用。</blockquote>
`
}
