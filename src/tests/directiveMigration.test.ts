import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyDirectiveMigrationPreview,
  previewDirectiveMigration,
} from '../lib/directiveMigration'

const mockScan = vi.fn()
const mockRead = vi.fn()
const mockCompile = vi.fn()
const mockApply = vi.fn()

vi.mock('../lib/tauri', () => ({
  scanLegacyDirectiveFiles: (...args: unknown[]) => mockScan(...args),
  getJournalEntryContent: (...args: unknown[]) => mockRead(...args),
  compileMdx: (...args: unknown[]) => mockCompile(...args),
  applyDirectiveMigration: (...args: unknown[]) => mockApply(...args),
}))

describe('directive migration orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockScan.mockResolvedValue([
      {
        path: '/workspace/2606/09-note.md',
        relative_path: '2606/09-note.md',
        extension: 'md',
      },
      {
        path: '/workspace/topics/broken.mdx',
        relative_path: 'topics/broken.mdx',
        extension: 'mdx',
      },
    ])
    mockRead.mockImplementation(async (path: string) =>
      path.endsWith('09-note.md')
        ? ':::quote\ntext: 可迁移\n:::'
        : ':::hero\nsubtitle: 缺少标题\n:::',
    )
    mockCompile.mockResolvedValue('compiled')
    mockApply.mockResolvedValue({
      destination_path: '/workspace/2606/09-note.mdx',
      backup_path: '/workspace/.Codex/migrations/directive-to-jsx/20260609-120000/2606/09-note.md',
    })
  })

  it('previews candidates without writing and reports invalid files', async () => {
    const preview = await previewDirectiveMigration()

    expect(mockApply).not.toHaveBeenCalled()
    expect(preview.valid).toHaveLength(1)
    expect(preview.failed).toHaveLength(1)
    expect(preview.valid[0]).toMatchObject({
      sourcePath: '/workspace/2606/09-note.md',
      destinationPath: '/workspace/2606/09-note.mdx',
      convertedCount: 1,
    })
    expect(preview.failed[0].relativePath).toBe('topics/broken.mdx')
    expect(mockCompile).toHaveBeenCalledWith(
      expect.stringContaining('<Quote'),
      '/workspace/2606/09-note.mdx',
    )
  })

  it('applies only selected valid files and preserves per-file failures', async () => {
    const preview = await previewDirectiveMigration()
    mockApply.mockRejectedValueOnce(new Error('destination exists'))

    const result = await applyDirectiveMigrationPreview(preview, ['/workspace/2606/09-note.md'])

    expect(mockApply).toHaveBeenCalledTimes(1)
    expect(mockApply).toHaveBeenCalledWith({
      source_path: '/workspace/2606/09-note.md',
      destination_path: '/workspace/2606/09-note.mdx',
      content: expect.stringContaining('<Quote'),
    })
    expect(result.converted).toEqual([])
    expect(result.failed).toEqual([
      {
        path: '/workspace/2606/09-note.md',
        error: 'destination exists',
      },
    ])
    expect(result.skipped).toContain('/workspace/topics/broken.mdx')
  })
})
