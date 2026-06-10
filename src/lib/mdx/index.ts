import type { Block, CompiledBlock, ScopeInfo } from './types'
import { segmentMdx } from './segmenter'
import { extractScope } from './scopeManager'
import { compileBlock } from './blockCompiler'

export type { Block, CompiledBlock, ScopeInfo }
export { segmentMdx } from './segmenter'
export { translateError } from './errorTranslation'
export { clearBlockCache } from './cache'

export interface MdxDocumentResult {
  /** All compiled blocks in document order */
  blocks: CompiledBlock[]
  /** Extracted scope info (for debugging / display) */
  scope: ScopeInfo
  /** Whether any block degraded (L1 or L2) */
  hasDegradation: boolean
}

/**
 * Full pipeline: segment → extract scope → compile each block.
 * Never throws. All errors are captured per-block.
 */
export async function compileMdxDocument(source: string): Promise<MdxDocumentResult> {
  let blocks: Block[]
  try {
    blocks = segmentMdx(source)
  } catch {
    // L3 fallback: segmenter itself failed (should never happen)
    blocks = [{ source, startLine: 1, endLine: source.split('\n').length, kind: 'markdown' }]
  }

  if (blocks.length === 0) {
    return { blocks: [], scope: { esmBlocks: [], linkDefinitions: [], footnoteDefinitions: [] }, hasDegradation: false }
  }

  const scope = extractScope(blocks)

  // Compile content blocks (ESM blocks are scope-only, skip them)
  const contentBlocks = blocks.filter((b) => b.kind !== 'esm')
  const compiledBlocks = await Promise.all(
    contentBlocks.map((block) => compileBlock(block, scope))
  )

  const hasDegradation = compiledBlocks.some((b) => b.level !== 'L0')

  return { blocks: compiledBlocks, scope, hasDegradation }
}
