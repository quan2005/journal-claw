import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SectionGeneral from '../settings/components/SectionGeneral'
import { renderWithProviders as render } from './setup'

const mockGetWorkspacePath = vi.fn()
const mockSetWorkspacePath = vi.fn()
const mockPickFolder = vi.fn()
const mockScanLegacyDirectiveFiles = vi.fn()
const mockPreviewDirectiveMigration = vi.fn()
const mockApplyDirectiveMigrationPreview = vi.fn()

vi.mock('../lib/tauri', () => ({
  getWorkspacePath: (...args: unknown[]) => mockGetWorkspacePath(...args),
  setWorkspacePath: (...args: unknown[]) => mockSetWorkspacePath(...args),
  pickFolder: (...args: unknown[]) => mockPickFolder(...args),
  scanLegacyDirectiveFiles: (...args: unknown[]) => mockScanLegacyDirectiveFiles(...args),
}))

vi.mock('../lib/directiveMigration', () => ({
  previewDirectiveMigration: (...args: unknown[]) => mockPreviewDirectiveMigration(...args),
  applyDirectiveMigrationPreview: (...args: unknown[]) =>
    mockApplyDirectiveMigrationPreview(...args),
}))

describe('SectionGeneral', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetWorkspacePath.mockResolvedValue('/Users/francis/Documents/journal')
    mockSetWorkspacePath.mockResolvedValue(undefined)
    mockPickFolder.mockResolvedValue(null)
    mockScanLegacyDirectiveFiles.mockResolvedValue([])
    mockPreviewDirectiveMigration.mockResolvedValue({
      candidates: [],
      valid: [],
      failed: [],
    })
    mockApplyDirectiveMigrationPreview.mockResolvedValue({
      converted: [],
      skipped: [],
      failed: [],
    })
  })

  it('persists workspace changes only after save is clicked', async () => {
    render(<SectionGeneral />)

    const input = await screen.findByDisplayValue('/Users/francis/Documents/journal')
    const saveButton = screen.getByRole('button', { name: '保存' }) as HTMLButtonElement

    expect(saveButton.disabled).toBe(true)

    fireEvent.change(input, { target: { value: '/Users/francis/Documents/journal-next' } })

    expect(screen.getByText('有未保存修改')).toBeTruthy()
    expect(saveButton.disabled).toBe(false)
    expect(mockSetWorkspacePath).not.toHaveBeenCalled()

    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockSetWorkspacePath).toHaveBeenCalledWith('/Users/francis/Documents/journal-next')
    })

    expect(await screen.findByText('已保存')).toBeTruthy()
  })

  it('previews before explicitly applying a legacy syntax migration', async () => {
    const preview = {
      candidates: [
        {
          path: '/workspace/2606/09-note.md',
          relative_path: '2606/09-note.md',
          extension: 'md',
        },
      ],
      valid: [
        {
          sourcePath: '/workspace/2606/09-note.md',
          destinationPath: '/workspace/2606/09-note.mdx',
          relativePath: '2606/09-note.md',
          content: '<Quote text="converted" />',
          convertedCount: 1,
        },
      ],
      failed: [],
    }
    mockScanLegacyDirectiveFiles.mockResolvedValue(preview.candidates)
    mockPreviewDirectiveMigration.mockResolvedValue(preview)
    mockApplyDirectiveMigrationPreview.mockResolvedValue({
      converted: [
        {
          destination_path: '/workspace/2606/09-note.mdx',
          backup_path:
            '/workspace/.Codex/migrations/directive-to-jsx/20260609-120000/2606/09-note.md',
        },
      ],
      skipped: [],
      failed: [],
    })

    render(<SectionGeneral />)

    const previewButton = await screen.findByRole('button', { name: '预览迁移' })
    fireEvent.click(previewButton)

    expect(mockApplyDirectiveMigrationPreview).not.toHaveBeenCalled()
    const applyButton = await screen.findByRole('button', { name: /迁移 1 个文件/ })
    expect(screen.getByText('1 个可迁移 · 0 个需要处理')).toBeTruthy()

    fireEvent.click(applyButton)

    await waitFor(() => {
      expect(mockApplyDirectiveMigrationPreview).toHaveBeenCalledWith(preview)
    })
    expect(await screen.findByText('已迁移 1 个 · 0 个失败')).toBeTruthy()
    expect(screen.getByText(/备份位置：/)).toBeTruthy()
  })
})
