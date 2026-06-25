import type { BlockError, ErrorTranslation } from './types'

const ERROR_PATTERNS: ErrorTranslation[] = [
  {
    pattern: /Expected a closing tag for `<(\w+)>`/,
    friendly: (m) => `<${m[1]}> 标签未闭合，请补全 </${m[1]}>`,
    fixHint: (m) => `在对应位置添加 </${m[1]}>`,
  },
  {
    pattern: /Unexpected closing tag `<\/(\w+)>`/,
    friendly: (m) => `多余的闭合标签 </${m[1]}>，没有与之配对的开始标签`,
    fixHint: (m) => `删除 </${m[1]}> 或添加对应的 <${m[1]}>`,
  },
  {
    pattern: /Unexpected token/,
    friendly: () => '花括号 {} 内的表达式语法有误，请检查 JS 写法',
    fixHint: () => '确保花括号内是合法的 JavaScript 表达式',
  },
  {
    pattern: /Could not parse import\/exports/,
    friendly: () => 'import/export 语句写法有误',
    fixHint: () => '检查 import/export 语句的语法格式',
  },
  {
    pattern: /Unexpected character .+ in name/,
    friendly: () => '标签名包含非法字符（常见于 < 后误跟空格或数字）',
    fixHint: () => '标签名必须以字母开头，只能包含字母、数字和连字符',
  },
  {
    pattern: /opening tag <(\w+)> is not closed/,
    friendly: (m) => `<${m[1]}> 标签未闭合，请补全 </${m[1]}>`,
    fixHint: (m) => `在对应位置添加 </${m[1]}>`,
  },
  {
    pattern: /closing tag <\/(\w+)> has no matching opening tag/,
    friendly: (m) => `多余的闭合标签 </${m[1]}>，没有与之配对的开始标签`,
    fixHint: (m) => `删除 </${m[1]}> 或添加对应的 <${m[1]}>`,
  },
  {
    pattern: /attribute quote is not closed/,
    friendly: () => '属性值的引号未闭合',
    fixHint: () => '检查标签属性中是否有未配对的引号',
  },
  {
    pattern: /expression brace is not closed/,
    friendly: () => '花括号表达式未闭合',
    fixHint: () => '检查 {} 是否配对完整',
  },
]

const LINE_COL_PREFIX = /^(\d+):(\d+):\s*/

export function translateError(raw: string): BlockError {
  let line: number | undefined
  let column: number | undefined
  let message = raw

  const posMatch = raw.match(LINE_COL_PREFIX)
  if (posMatch) {
    line = parseInt(posMatch[1], 10)
    column = parseInt(posMatch[2], 10)
    message = raw.slice(posMatch[0].length)
  }

  for (const translation of ERROR_PATTERNS) {
    const match = message.match(translation.pattern)
    if (match) {
      return {
        raw,
        friendly: translation.friendly(match),
        fixHint: translation.fixHint?.(match),
        line,
        column,
      }
    }
  }

  return {
    raw,
    friendly: '此区块包含无法识别的语法',
    line,
    column,
  }
}
