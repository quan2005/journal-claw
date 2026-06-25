import React from 'react'

export function stripFrontmatter(md: string): string {
  return md.replace(/^---[\s\S]*?---\n?/, '').trim()
}

export function resolveRelativePath(baseDir: string, relative: string): string {
  const parts = baseDir.split('/')
  for (const segment of relative.split('/')) {
    if (segment === '..') parts.pop()
    else if (segment !== '.') parts.push(segment)
  }
  return parts.join('/')
}

export function extractCodeText(children: React.ReactNode): string {
  if (typeof children === 'string') return children
  if (Array.isArray(children)) return children.map(extractCodeText).join('')
  if (children && typeof children === 'object' && 'props' in (children as object)) {
    const el = children as React.ReactElement<{ children?: React.ReactNode }>
    return extractCodeText(el.props.children)
  }
  return ''
}

export function highlightMarkdown(text: string): React.ReactNode[] {
  return text.split('\n').map((line, i) => {
    if (/^# /.test(line))
      return (
        <div key={i} style={{ color: 'var(--item-text)' }}>
          {line}
        </div>
      )
    if (/^## /.test(line))
      return (
        <div key={i} style={{ color: 'var(--item-meta)' }}>
          {line}
        </div>
      )
    const bulletMatch = line.match(/^(\s*)(- )(.*)/)
    if (bulletMatch) {
      return (
        <div key={i}>
          {bulletMatch[1]}
          <span style={{ color: 'var(--record-btn)' }}>{bulletMatch[2]}</span>
          <span style={{ color: 'var(--md-text, var(--item-meta))' }}>{bulletMatch[3]}</span>
        </div>
      )
    }
    return (
      <div key={i} style={{ color: 'var(--md-text, var(--item-meta))' }}>
        {line || ' '}
      </div>
    )
  })
}
