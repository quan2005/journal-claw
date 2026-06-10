import { describe, it, expect, vi } from 'vitest'
import { compileMdxDocument } from '../lib/mdx'
import type { CompiledBlock } from '../lib/mdx/types'

vi.mock('../lib/tauri', () => ({
  compileMdx: vi.fn(),
}))

import { compileMdx } from '../lib/tauri'
const mockCompileMdx = vi.mocked(compileMdx)

const VALID_MDX_OUTPUT = `import {jsx as _jsx} from "react/jsx-runtime"
function MDXContent(){return _jsx("p",{children:"hi"})}
export default MDXContent`

describe('mdx pipeline integration', () => {
  it('compiles a multi-block document with one broken block', async () => {
    mockCompileMdx
      .mockResolvedValueOnce(VALID_MDX_OUTPUT)
      .mockRejectedValueOnce(new Error('Expected a closing tag for `<Card>`'))
      .mockResolvedValueOnce(VALID_MDX_OUTPUT)

    const source = '# Title\n\n<Card>\nunclosed\n\n# Footer'
    const result = await compileMdxDocument(source)

    expect(result.blocks.length).toBeGreaterThanOrEqual(2)

    const levels = result.blocks.map((b: CompiledBlock) => b.level)
    expect(levels).toContain('L0')
    expect(levels.some((l: string) => l !== 'L0')).toBe(true)
  })

  it('returns all blocks even when entire document is malformed', async () => {
    mockCompileMdx.mockRejectedValue(new Error('fatal'))

    const source = '<Bad>\n\n<Also bad>'
    const result = await compileMdxDocument(source)

    expect(result.blocks.length).toBeGreaterThan(0)
    expect(result.blocks.every((b: CompiledBlock) => b.level !== 'L0')).toBe(true)
  })

  it('passes scope (link definitions) to block compilation', async () => {
    mockCompileMdx.mockResolvedValue(VALID_MDX_OUTPUT)

    const source = '[react]: https://react.dev\n\nSee [react] for more.'
    const result = await compileMdxDocument(source)

    expect(mockCompileMdx).toHaveBeenCalled()
    const callArgs = mockCompileMdx.mock.calls
    const hasDefinition = callArgs.some(([src]) => src.includes('[react]:'))
    expect(hasDefinition).toBe(true)
  })

  it('handles empty document', async () => {
    const result = await compileMdxDocument('')
    expect(result.blocks).toHaveLength(0)
    expect(result.hasDegradation).toBe(false)
  })
})
