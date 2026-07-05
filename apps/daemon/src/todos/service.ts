import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ChangeSetService } from '../changeset/service.js'
import { writeTracked } from '../local/service.js'

export interface TodoItem {
  text: string
  done: boolean
  due: string | null
  done_date: string | null
  source: string | null
  path: string | null
  session_id: string | null
  line_index: number
  done_file: boolean
}

const RUN_ID = 'todos-manual'

export class TodosService {
  constructor(
    private readonly workspaceRoot: string,
    private readonly changeSetService: ChangeSetService,
    private readonly today = () => new Date(),
  ) {}

  list(): TodoItem[] {
    const items = parseTodos(this.readTodos(), false)
    const done = parseTodos(this.readDone(), true)
    return [...items, ...done]
  }

  add(text: string, due?: string | null, source?: string | null, path?: string | null): TodoItem {
    let content = this.readTodos()
    if (!existsSync(this.todosPath())) content = defaultTodosContent()
    let line = `- [ ] ${renderTodoTextSegment(text)}`
    if (due) line += ` <!-- due:${due} -->`
    if (source) line += ` <!-- source:${source} -->`
    if (path) line += ` <!-- path:${path} -->`
    if (!content.endsWith('\n')) content += '\n'
    content += `${line}\n`
    this.writeTodos(content)
    const found = [...this.list()]
      .reverse()
      .find((item) => !item.done && item.text === normalizeTodoText(text))
    if (!found) throw new Error('添加后未找到该待办')
    return found
  }

  toggle(lineIndex: number, checked: boolean, doneFile: boolean): void {
    if (checked && !doneFile) {
      const lines = this.readTodos().split(/\r?\n/)
      if (lineIndex >= lines.length) throw new Error(`行号 ${lineIndex} 超出范围`)
      const line = lines[lineIndex]
      if (!line.trimStart().startsWith('- [ ] ')) throw new Error('该行不是未完成待办项')
      const doneLine = `${line.replace('- [ ] ', '- [x] ')} <!-- done:${formatDate(this.today())} -->`
      this.writeTodos(removeLine(lines, lineIndex))
      const doneContent = this.readDone()
      if (!doneContent) {
        this.writeDone(`${doneLine}\n`)
        return
      }
      const doneLines = doneContent
        .split(/\r?\n/)
        .filter((_, i, arr) => i < arr.length - 1 || arr[i] !== '')
      const insertPos = firstLineAfterFrontmatter(doneLines)
      doneLines.splice(insertPos, 0, doneLine)
      this.writeDone(`${doneLines.join('\n')}\n`)
    } else if (!checked && doneFile) {
      const doneLines = this.readDone().split(/\r?\n/)
      if (lineIndex >= doneLines.length) throw new Error(`行号 ${lineIndex} 超出范围`)
      const unchecked = removeComment(
        doneLines[lineIndex].replace('- [x] ', '- [ ] ').replace('- [X] ', '- [ ] '),
        'done:',
      )
      this.writeDone(removeLine(doneLines, lineIndex))
      let content = this.readTodos()
      if (!content.endsWith('\n')) content += '\n'
      content += `${unchecked}\n`
      this.writeTodos(content)
    }
  }

  delete(lineIndex: number, doneFile: boolean): void {
    const lines = (doneFile ? this.readDone() : this.readTodos()).split(/\r?\n/)
    if (lineIndex >= lines.length) throw new Error(`行号 ${lineIndex} 超出范围`)
    this.writeFile(doneFile, removeLine(lines, lineIndex))
  }

  setDue(lineIndex: number, due: string | null | undefined, doneFile: boolean): void {
    this.updateLine(doneFile, lineIndex, (line) => {
      const cleaned = removeComment(line, 'due:')
      return due ? `${cleaned} <!-- due:${due} -->` : cleaned
    })
  }

  setPath(lineIndex: number, path: string | null | undefined, doneFile: boolean): void {
    this.updateLine(doneFile, lineIndex, (line) => {
      const cleaned = removeComment(line, 'path:')
      return path ? `${cleaned} <!-- path:${path} -->` : cleaned
    })
  }

  removePath(lineIndex: number, doneFile: boolean): void {
    this.setPath(lineIndex, null, doneFile)
  }

  setSessionId(lineIndex: number, sessionId: string | null | undefined, doneFile: boolean): void {
    this.updateLine(doneFile, lineIndex, (line) => {
      const cleaned = removeComment(line, 'sid:')
      return sessionId ? `${cleaned} <!-- sid:${sessionId} -->` : cleaned
    })
  }

  updateText(lineIndex: number, text: string, doneFile: boolean): void {
    this.updateLine(doneFile, lineIndex, (line) => {
      const trimmed = line.trimStart()
      const prefix =
        trimmed.startsWith('- [x] ') || trimmed.startsWith('- [X] ')
          ? '- [x] '
          : trimmed.startsWith('- [ ] ')
            ? '- [ ] '
            : null
      if (!prefix) throw new Error('该行不是待办项')
      const comments: string[] = []
      let tmp = trimmed.slice(6)
      while (true) {
        const start = tmp.indexOf('<!--')
        if (start < 0) break
        const end = tmp.indexOf('-->', start)
        if (end < 0) break
        const full = tmp.slice(start, end + 3)
        const body = tmp.slice(start + 4, end).trim()
        if (!body.startsWith('text:')) comments.push(full)
        tmp = `${tmp.slice(0, start)}${tmp.slice(end + 3)}`
      }
      return [prefix + renderTodoTextSegment(text), ...comments].join(' ')
    })
  }

  private updateLine(doneFile: boolean, lineIndex: number, fn: (line: string) => string): void {
    const lines = (doneFile ? this.readDone() : this.readTodos()).split(/\r?\n/)
    if (lineIndex >= lines.length) throw new Error(`行号 ${lineIndex} 超出范围`)
    lines[lineIndex] = fn(lines[lineIndex])
    this.writeFile(doneFile, `${trimTrailingEmptyLine(lines).join('\n')}\n`)
  }

  private todosPath(): string {
    return join(this.workspaceRoot, 'todos.md')
  }

  private donePath(): string {
    return join(this.workspaceRoot, 'todos.done.md')
  }

  private readTodos(): string {
    return existsSync(this.todosPath()) ? readFileSync(this.todosPath(), 'utf8') : ''
  }

  private readDone(): string {
    return existsSync(this.donePath()) ? readFileSync(this.donePath(), 'utf8') : ''
  }

  private writeTodos(content: string): void {
    writeTracked(this.changeSetService, this.workspaceRoot, RUN_ID, this.todosPath(), content)
  }

  private writeDone(content: string): void {
    writeTracked(this.changeSetService, this.workspaceRoot, RUN_ID, this.donePath(), content)
  }

  private writeFile(doneFile: boolean, content: string): void {
    if (doneFile) this.writeDone(content)
    else this.writeTodos(content)
  }
}

export function parseTodos(content: string, doneFile = false): TodoItem[] {
  return content
    .split(/\r?\n/)
    .map((line, i) => parseTodoLine(line, i, doneFile))
    .filter((item): item is TodoItem => item !== null)
}

function parseTodoLine(line: string, lineIndex: number, doneFile: boolean): TodoItem | null {
  const trimmed = line.trimStart()
  let done: boolean
  let rest: string
  if (trimmed.startsWith('- [ ] ')) {
    done = false
    rest = trimmed.slice(6)
  } else if (trimmed.startsWith('- [x] ') || trimmed.startsWith('- [X] ')) {
    done = true
    rest = trimmed.slice(6)
  } else {
    return null
  }
  let text = rest
  let due: string | null = null
  let doneDate: string | null = null
  let source: string | null = null
  let path: string | null = null
  let sessionId: string | null = null
  let fullText: string | null = null
  while (true) {
    const start = text.indexOf('<!--')
    if (start < 0) break
    const end = text.indexOf('-->', start)
    if (end < 0) break
    const comment = text.slice(start + 4, end).trim()
    if (comment.startsWith('due:')) due = comment.slice(4).trim()
    else if (comment.startsWith('done:')) doneDate = comment.slice(5).trim()
    else if (comment.startsWith('source:')) source = comment.slice(7).trim()
    else if (comment.startsWith('path:')) path = comment.slice(5).trim()
    else if (comment.startsWith('sid:')) sessionId = comment.slice(4).trim()
    else if (comment.startsWith('text:')) fullText = percentDecodeText(comment.slice(5).trim())
    text = `${text.slice(0, start)}${text.slice(end + 3)}`
  }
  return {
    text: fullText ?? text.trim(),
    done,
    due,
    done_date: doneDate,
    source,
    path,
    session_id: sessionId,
    line_index: lineIndex,
    done_file: doneFile,
  }
}

function normalizeTodoText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
}

function renderTodoTextSegment(text: string): string {
  const normalized = normalizeTodoText(text)
  if (normalized.includes('\n') || normalized.includes('<!--') || normalized.includes('-->')) {
    return `${todoTextPreview(normalized)} <!-- text:${percentEncodeText(normalized)} -->`
  }
  return normalized
}

function todoTextPreview(text: string): string {
  const preview = (text.split('\n')[0] ?? '').trim().replace(/<!--/g, '').replace(/-->/g, '')
  return preview || '多行想法'
}

function percentEncodeText(text: string): string {
  return Array.from(Buffer.from(text, 'utf8'))
    .map((byte) =>
      (byte >= 0x41 && byte <= 0x5a) ||
      (byte >= 0x61 && byte <= 0x7a) ||
      (byte >= 0x30 && byte <= 0x39) ||
      [0x2d, 0x2e, 0x5f, 0x7e].includes(byte)
        ? String.fromCharCode(byte)
        : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`,
    )
    .join('')
}

function percentDecodeText(text: string): string | null {
  try {
    return decodeURIComponent(text)
  } catch {
    return null
  }
}

function firstLineAfterFrontmatter(lines: string[]): number {
  if (lines[0]?.trim() !== '---') return 0
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---')
  return end >= 0 ? end + 1 : 0
}

function removeComment(line: string, prefix: string): string {
  const pattern = `<!-- ${prefix}`
  const start = line.indexOf(pattern)
  if (start < 0) return line.trimEnd()
  const end = line.indexOf('-->', start)
  if (end < 0) return line.trimEnd()
  return `${line.slice(0, start).trimEnd()}${line.slice(end + 3)}`.trimEnd()
}

function removeLine(lines: string[], index: number): string {
  const next = trimTrailingEmptyLine(lines).filter((_, i) => i !== index)
  return `${next.join('\n')}\n`
}

function trimTrailingEmptyLine(lines: string[]): string[] {
  return lines.length > 0 && lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function defaultTodosContent(): string {
  return `---
description: 待办清单（仅未完成项），由用户手动添加或 AI 自动提取
format: GFM task list
rules:
  - 每行一条待办，\`- [ ]\` 未完成
  - 截止日期用 HTML 注释 \`<!-- due:YYYY-MM-DD -->\` 附在行尾（可选）
  - 来源用 \`<!-- source:filename.md -->\` 附在行尾（可选）
  - 新条目追加到文件末尾
  - 勾选后自动移入 todos.done.md，不要在此文件写 \`- [x]\`
  - 不要重复已存在的条目
---

# 待办

`
}
