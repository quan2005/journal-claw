// Ported from claw-code main.rs:8103-8534
// Tool call display formatting, diff preview, and output truncation.

export interface ToolSummary {
  icon: string
  title: string
  detail: string
}

function truncate(text: string | undefined | null, limit: number): string {
  if (!text) return ''
  if (text.length <= limit) return text
  return text.slice(0, limit) + '…'
}

function extractPath(input: Record<string, unknown>): string {
  return String(input.file_path ?? input.filePath ?? input.path ?? '?')
}

function countLines(content: unknown): number {
  if (typeof content !== 'string') return 0
  return content.split('\n').length
}

function firstVisibleLine(text: string): string {
  return text.split('\n').find((l) => l.trim().length > 0) ?? text
}

/**
 * Generate a structured summary for a tool call based on its type.
 * Ported from claw-code main.rs:8103-8148.
 */
export function formatToolSummary(
  name: string,
  input: Record<string, unknown> | undefined,
): ToolSummary {
  if (!input) return { icon: '🔧', title: name, detail: '' }

  switch (name) {
    case 'bash':
    case 'Bash':
      return { icon: '⌘', title: 'bash', detail: `$ ${truncate(String(input.command ?? ''), 120)}` }
    case 'read_file':
    case 'Read':
      return { icon: '📄', title: 'read', detail: extractPath(input) }
    case 'write_file':
    case 'Write':
      return {
        icon: '✏️',
        title: 'write',
        detail: `${extractPath(input)} (${countLines(input.content)} lines)`,
      }
    case 'edit_file':
    case 'Edit':
      return { icon: '📝', title: 'edit', detail: extractPath(input) }
    case 'grep_search':
    case 'Grep':
      return {
        icon: '🔎',
        title: 'grep',
        detail: `${input.pattern ?? '?'} in ${input.path ?? '.'}`,
      }
    case 'glob_search':
    case 'Glob':
      return { icon: '🔎', title: 'glob', detail: String(input.pattern ?? '?') }
    case 'web_search':
    case 'WebSearch':
      return { icon: '🌐', title: 'search', detail: String(input.query ?? '') }
    case 'load_skill':
      return { icon: '📚', title: 'skill', detail: String(input.name ?? input.skill_name ?? '') }
    default:
      return { icon: '🔧', title: name, detail: truncate(JSON.stringify(input), 96) }
  }
}

/**
 * Generate a single-line diff preview for edit operations.
 * Ported from claw-code main.rs:8213-8221.
 */
export function formatPatchPreview(
  oldStr: string | undefined,
  newStr: string | undefined,
): { removed: string; added: string } | null {
  if (!oldStr && !newStr) return null
  return {
    removed: truncate(firstVisibleLine(oldStr ?? ''), 72),
    added: truncate(firstVisibleLine(newStr ?? ''), 72),
  }
}

const TOOL_MAX_LINES = 60
const TOOL_MAX_CHARS = 4000
const READ_MAX_LINES = 80
const READ_MAX_CHARS = 6000

/**
 * Truncate output by both line count and character count.
 * Ported from claw-code main.rs:8492-8534.
 */
export function truncateForDisplay(
  content: string,
  toolName?: string,
): { text: string; truncated: boolean } {
  const isRead = toolName === 'read_file' || toolName === 'Read'
  const maxLines = isRead ? READ_MAX_LINES : TOOL_MAX_LINES
  const maxChars = isRead ? READ_MAX_CHARS : TOOL_MAX_CHARS

  const original = content.replace(/\n+$/, '')
  if (!original) return { text: '', truncated: false }

  const previewLines: string[] = []
  let usedChars = 0
  let truncated = false

  for (const [index, line] of original.split('\n').entries()) {
    if (index >= maxLines) {
      truncated = true
      break
    }
    const newlineCost = previewLines.length > 0 ? 1 : 0
    const available = maxChars - usedChars - newlineCost
    if (available <= 0) {
      truncated = true
      break
    }
    if (line.length > available) {
      previewLines.push(line.slice(0, available))
      truncated = true
      break
    }
    previewLines.push(line)
    usedChars += newlineCost + line.length
  }

  return { text: previewLines.join('\n'), truncated }
}
