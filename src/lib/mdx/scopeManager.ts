import type { Block, ScopeInfo } from './types'

const LINK_DEF_PATTERN = /^\[([^\]]+)\]:\s+\S/
const FOOTNOTE_DEF_PATTERN = /^\[\^([^\]]+)\]:\s/

export function extractScope(blocks: Block[]): ScopeInfo {
  const esmBlocks: Block[] = []
  const linkDefinitions: string[] = []
  const footnoteDefinitions: string[] = []

  for (const block of blocks) {
    if (block.kind === 'esm') {
      esmBlocks.push(block)
      continue
    }

    if (block.kind === 'markdown') {
      for (const line of block.source.split('\n')) {
        const trimmed = line.trimStart()
        if (FOOTNOTE_DEF_PATTERN.test(trimmed)) {
          footnoteDefinitions.push(trimmed)
        } else if (LINK_DEF_PATTERN.test(trimmed)) {
          linkDefinitions.push(trimmed)
        }
      }
    }
  }

  return { esmBlocks, linkDefinitions, footnoteDefinitions }
}

export function buildDefinitionPreamble(scope: ScopeInfo): string {
  const parts: string[] = []

  if (scope.linkDefinitions.length > 0) {
    parts.push(scope.linkDefinitions.join('\n'))
  }

  if (scope.footnoteDefinitions.length > 0) {
    parts.push(scope.footnoteDefinitions.join('\n'))
  }

  return parts.length > 0 ? parts.join('\n') + '\n\n' : ''
}
