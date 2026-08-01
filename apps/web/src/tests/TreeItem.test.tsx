import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from './setup'
import { TreeItem } from '../components/TreeItem'

describe('TreeItem', () => {
  it('renders pinned topic files with the shared selected workspace row and isolated actions', () => {
    const onClick = vi.fn()
    const onAt = vi.fn()
    const onMore = vi.fn()

    renderWithProviders(
      <TreeItem
        itemType="topic-file"
        topicEntry={{
          name: 'pinned-brief.pdf',
          path: 'pinned-brief.pdf',
          is_dir: false,
          created_secs: 0,
          mtime_secs: 0,
        }}
        isSelected
        onClick={onClick}
        onAt={onAt}
        onMore={onMore}
      />,
    )

    const row = screen.getByRole('treeitem')
    expect(row.classList.contains('workspace-tree-row')).toBe(true)
    expect(row.getAttribute('data-depth')).toBe('0')
    expect(row.getAttribute('aria-selected')).toBe('true')
    expect(row.closest('.workspace-tree')).toBeTruthy()
    expect(screen.getByText('pinned brief.pdf')).toBeTruthy()

    const actions = screen.getAllByRole('button')
    expect(actions.map((action) => action.getAttribute('aria-label'))).toEqual(['更多', '引用'])

    const more = screen.getByRole('button', { name: '更多' })
    vi.spyOn(more, 'getBoundingClientRect').mockReturnValue({
      left: 17,
      bottom: 29,
    } as DOMRect)
    fireEvent.click(more, { clientX: 301, clientY: 401 })
    fireEvent.click(screen.getByRole('button', { name: '引用' }))

    expect(onClick).not.toHaveBeenCalled()
    expect(onMore).toHaveBeenCalledWith(17, 29)
    expect(onAt).toHaveBeenCalledOnce()
  })

  it('delegates a pinned directory expansion state to the shared chevron', () => {
    const onClick = vi.fn()

    renderWithProviders(
      <TreeItem
        itemType="topic-file"
        topicEntry={{
          name: 'projects',
          path: 'projects',
          is_dir: true,
          created_secs: 0,
          mtime_secs: 0,
        }}
        indent={1}
        expanded
        isSelected={false}
        onClick={onClick}
      />,
    )

    const row = screen.getByRole('treeitem')
    expect(row.getAttribute('data-depth')).toBe('1')
    expect(row.querySelector('[data-workspace-chevron]')).toBeTruthy()
    expect(row.querySelector('[data-workspace-chevron]')?.getAttribute('data-expanded')).toBe(
      'true',
    )
    expect(screen.queryByLabelText('文件夹')).toBeNull()

    fireEvent.click(row)
    expect(onClick).toHaveBeenCalledOnce()
  })

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
    expect(document.querySelector('.workspace-tree-row')).toBeNull()
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

  it('keeps identity rows outside the workspace-tree presentation', () => {
    renderWithProviders(
      <TreeItem
        itemType="identity"
        identity={{
          filename: 'mina.md',
          path: '/ws/identity/mina.md',
          name: 'Mina',
          region: 'Hong Kong',
          summary: 'A distinct identity list entry.',
          tags: ['research'],
          aliases: [],
          expert_skill: '',
          is_expert: false,
          speaker_id: '',
          mtime_secs: 0,
          archived: false,
        }}
        isSelected={false}
        onClick={vi.fn()}
      />,
    )

    expect(screen.getByText('Mina')).toBeTruthy()
    expect(document.querySelector('.workspace-tree-row')).toBeNull()
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
