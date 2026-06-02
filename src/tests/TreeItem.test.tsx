import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from './setup'
import { TreeItem } from '../components/TreeItem'

describe('TreeItem', () => {
  it('uses the shared file type icon for topic files', () => {
    renderWithProviders(
      <TreeItem
        itemType="topic-file"
        topicEntry={{
          name: 'brief.pdf',
          path: 'brief.pdf',
          is_dir: false,
          created_secs: 0,
          mtime_secs: 0,
        }}
        isSelected={false}
        onClick={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('PDF 文件')).toBeTruthy()
  })

  it('shows mdx topic files as MDX, not generic markdown', () => {
    renderWithProviders(
      <TreeItem
        itemType="topic-file"
        topicEntry={{
          name: 'component-guide.mdx',
          path: 'component-guide.mdx',
          is_dir: false,
          created_secs: 0,
          mtime_secs: 0,
        }}
        isSelected={false}
        onClick={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('MDX 文件')).toBeTruthy()
    expect(screen.queryByLabelText('Markdown 文件')).toBeNull()
  })
})
