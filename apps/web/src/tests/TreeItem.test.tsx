import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from './setup'
import { TreeItem } from '../components/TreeItem'

describe('TreeItem', () => {
  it('keeps timeline journal titles and tags from hard-clipping when text is long', () => {
    const longTitle =
      '这是一条非常长的 Timeline 日志标题用于确认标题在侧栏内安全截断且不会与标签重叠'
    const longTag = 'research/personal-context-with-a-very-long-suffix'

    renderWithProviders(
      <TreeItem
        itemType="journal"
        entry={{
          filename: '28-long-entry.md',
          path: '/ws/2606/28-long-entry.md',
          title: longTitle,
          summary: '长标题长标签渲染测试',
          tags: [longTag, 'learning', 'weekly-report'],
          sources: [],
          year_month: '2606',
          day: 28,
          created_time: '10:00',
          created_at_secs: 0,
          mtime_secs: 0,
          materials: [],
        }}
        isSelected={false}
        onClick={vi.fn()}
        onAt={vi.fn()}
        onMore={vi.fn()}
      />,
    )

    const title = screen.getByText(longTitle) as HTMLElement
    const titleStyle = window.getComputedStyle(title)
    expect(titleStyle.minWidth).toBe('0px')
    expect(titleStyle.overflow).toBe('hidden')
    expect(titleStyle.textOverflow).toBe('ellipsis')
    expect(titleStyle.whiteSpace).toBe('nowrap')

    const tagChip = screen.getByText(longTag) as HTMLElement
    const tagStyle = window.getComputedStyle(tagChip)
    expect(tagStyle.minWidth).toBe('0px')
    expect(tagStyle.maxWidth).toBe('100%')
    expect(tagStyle.overflow).toBe('hidden')
    expect(tagStyle.textOverflow).toBe('ellipsis')
    expect(tagStyle.whiteSpace).toBe('nowrap')

    const overflowChip = screen.getByText('+2') as HTMLElement
    expect(overflowChip).toBeTruthy()
    expect(screen.queryByText('learning')).toBeNull()
    expect(screen.queryByText('weekly-report')).toBeNull()
  })

  it('collapses hover actions before hover so tags can use the trailing space', () => {
    renderWithProviders(
      <TreeItem
        itemType="journal"
        entry={{
          filename: '05-人力盘点.md',
          path: '/ws/2606/05-人力盘点.md',
          title: '人力盘点-模块分工',
          summary: '人力盘点分工表',
          tags: ['planning', 'headcount'],
          sources: [],
          year_month: '2606',
          day: 5,
          created_time: '10:00',
          created_at_secs: 0,
          mtime_secs: 0,
          materials: [],
        }}
        isSelected={false}
        onClick={vi.fn()}
        onAt={vi.fn()}
        onMore={vi.fn()}
      />,
    )

    const actions = document.querySelector('.tree-item-actions') as HTMLDivElement

    expect(actions).toBeTruthy()
    expect(actions.style.width).toBe('0px')
    expect(actions.style.marginLeft).toBe('-8px')
  })

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
