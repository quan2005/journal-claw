import type { Block, CompiledBlock, ScopeInfo } from './types'
import { translateError } from './errorTranslation'
import { buildDefinitionPreamble } from './scopeManager'
import { getCacheKey, getCachedBlock, setCachedBlock } from './cache'
import { compileMdx } from '../tauri'
import { createMdxComponent } from '../mdxRuntime'
import { Marked } from 'marked'

const marked = new Marked()

/**
 * Compiles a single block through the degradation chain:
 * MDX (L0) → Markdown (L1) → Source view (L2).
 *
 * NEVER throws. All errors are captured into the CompiledBlock result.
 */
export async function compileBlock(block: Block, scope: ScopeInfo): Promise<CompiledBlock> {
  if (!block.source.trim()) {
    return { block, level: 'L0' }
  }

  const cacheKey = getCacheKey(block.source)
  const cached = getCachedBlock(cacheKey)
  if (cached) {
    return { block, level: 'L0', component: cached }
  }

  try {
    const preamble = buildDefinitionPreamble(scope)
    const sourceToCompile = preamble + block.source
    const compiled = await compileMdx(sourceToCompile)
    const component = createMdxComponent(compiled)
    setCachedBlock(cacheKey, component)
    return { block, level: 'L0', component }
  } catch (mdxError) {
    const rawError = mdxError instanceof Error ? mdxError.message : String(mdxError)
    const blockError = translateError(rawError)

    // Remap line number to document coordinates
    if (blockError.line !== undefined) {
      blockError.line = block.startLine + blockError.line - 1
    }

    try {
      const escapedSource = escapeJsxForMarkdown(block.source)
      const html = await marked.parse(escapedSource)
      if (html && html.trim()) {
        return {
          block,
          level: 'L1',
          markdownHtml: html,
          error: blockError,
        }
      }
    } catch {
      // Markdown also failed — fall through to L2
    }

    return {
      block,
      level: 'L2',
      error: blockError,
    }
  }
}

function escapeJsxForMarkdown(source: string): string {
  return source
    .replace(/<([A-Z])/g, '&lt;$1')
    .replace(/<\/([A-Z])/g, '&lt;/$1')
    .replace(/\{([^}]*)\}/g, '`{$1}`')
}
