import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import * as path from 'node:path'
import { renderWithProviders } from './setup'
import { TopicTree } from '../components/TopicTree'
import type { TopicEntry } from '../lib/apiTypes'

declare const __dirname: string

const workspaceTreeCss = readFileSync(
  (path as unknown as { resolve: (...segments: string[]) => string }).resolve(
    __dirname,
    '../styles/workspace-tree.css',
  ),
  'utf-8',
)

let workspaceTreeCssInstalled = false

function installWorkspaceTreeCss() {
  if (workspaceTreeCssInstalled) return
  const style = document.createElement('style')
  style.textContent = workspaceTreeCss
  document.head.appendChild(style)
  workspaceTreeCssInstalled = true
}

function getWorkspaceTreeRule(selectorFragment: string): CSSStyleRule {
  const stylesheet = [...document.head.querySelectorAll('style')].find((style) =>
    style.textContent?.includes('.workspace-tree'),
  )?.sheet
  const rule = [...(stylesheet?.cssRules ?? [])].find(
    (candidate): candidate is CSSStyleRule =>
      candidate instanceof CSSStyleRule && candidate.selectorText.includes(selectorFragment),
  )

  if (!rule) throw new Error(`Missing workspace tree CSS rule: ${selectorFragment}`)
  return rule
}

function topic(name: string, isDir = false, extra: Partial<TopicEntry> = {}): TopicEntry {
  return {
    name,
    path: name,
    is_dir: isDir,
    created_secs: 0,
    mtime_secs: 0,
    ...extra,
  }
}

function renderTopicTree(
  entries: TopicEntry[],
  dirs: Map<string, { entries: TopicEntry[]; expanded: boolean; loading: boolean }> = new Map(),
  selectedPath: string | null = null,
) {
  installWorkspaceTreeCss()
  return renderWithProviders(
    <div className="workspace-tree">
      <TopicTree
        entries={entries}
        dirs={dirs}
        selectedPath={selectedPath}
        parentPath=""
        sortStrategy="name-asc"
        onToggleDir={vi.fn()}
        onSelectFile={vi.fn()}
        onAt={vi.fn()}
        onMore={vi.fn()}
      />
    </div>,
  )
}

describe('TopicTree', () => {
  it('uses shared rows with aligned recursive depths, guide wrappers, and ordered actions', () => {
    const rootFolder = topic('root-folder', true, { name: '根目录', path: 'root-folder' })
    const rootFile = topic('root.md', false, { path: 'root.md' })
    const levelOneFolder = topic('level-one', true, {
      name: '一级目录',
      path: 'root-folder/level-one',
    })
    const levelTwoFile = topic('page.html', false, { path: 'root-folder/level-one/page.html' })
    const dirs = new Map([
      [rootFolder.path, { entries: [levelOneFolder], expanded: true, loading: false }],
      [levelOneFolder.path, { entries: [levelTwoFile], expanded: true, loading: false }],
    ])

    renderTopicTree([rootFolder, rootFile], dirs)

    const rootFolderRow = screen.getByText('根目录').closest('[role="treeitem"]') as HTMLElement
    const rootFileRow = screen.getByText('root').closest('[role="treeitem"]') as HTMLElement
    const levelOneFolderRow = screen
      .getByText('一级目录')
      .closest('[role="treeitem"]') as HTMLElement
    const levelTwoFileRow = screen
      .getByText('page.html')
      .closest('[role="treeitem"]') as HTMLElement

    expect(rootFolderRow.getAttribute('data-depth')).toBe('0')
    expect(rootFileRow.getAttribute('data-depth')).toBe('0')
    expect(levelOneFolderRow.getAttribute('data-depth')).toBe('1')
    expect(levelTwoFileRow.getAttribute('data-depth')).toBe('2')
    const childWrappers = screen.getAllByTestId('workspace-tree-children')
    expect(childWrappers).toHaveLength(2)
    expect(childWrappers.map((wrapper) => wrapper.getAttribute('data-workspace-depth'))).toEqual([
      '0',
      '1',
    ])
    expect(
      childWrappers.map((wrapper) => wrapper.style.getPropertyValue('--workspace-tree-depth')),
    ).toEqual(['0', '1'])
    expect(rootFolderRow.querySelector('[data-workspace-marker]')).toBeTruthy()
    expect(rootFileRow.querySelector('[data-workspace-marker]')).toBeTruthy()
    expect(
      within(rootFileRow.querySelector('[data-workspace-actions]') as HTMLElement)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['更多', '引用'])
  })

  it('labels topic icons by folder and file type', () => {
    renderTopicTree([
      topic('研究材料', true),
      topic('manual.mdx'),
      topic('notes.md'),
      topic('draft.txt'),
      topic('deck.html'),
      topic('brief.pdf'),
      topic('memo.docx'),
      topic('photo.png'),
      topic('voice.m4a'),
      topic('demo.mp4'),
      topic('data.csv'),
      topic('budget.xlsx'),
      topic('roadmap.pptx'),
      topic('component.tsx'),
      topic('archive.zip'),
      topic('unknown.bin'),
    ])

    // folder-no-icon: folders show no icon (AC-1), so no '文件夹' aria-label
    expect(screen.queryByLabelText('文件夹')).toBeNull()
    expect(screen.getByLabelText('MDX 文件')).toBeTruthy()
    expect(screen.getAllByLabelText('Markdown 文件')).toHaveLength(1)
    expect(screen.getByLabelText('文本文件')).toBeTruthy()
    expect(screen.getByLabelText('HTML 文件')).toBeTruthy()
    expect(screen.getByLabelText('PDF 文件')).toBeTruthy()
    expect(screen.getByLabelText('Word 文件')).toBeTruthy()
    expect(screen.getByLabelText('图片文件')).toBeTruthy()
    expect(screen.getByLabelText('音频文件')).toBeTruthy()
    expect(screen.getByLabelText('视频文件')).toBeTruthy()
    expect(screen.getByLabelText('CSV 文件')).toBeTruthy()
    expect(screen.getByLabelText('表格文件')).toBeTruthy()
    expect(screen.getByLabelText('演示文件')).toBeTruthy()
    expect(screen.getByLabelText('代码文件')).toBeTruthy()
    expect(screen.getByLabelText('压缩包')).toBeTruthy()
    expect(screen.getByLabelText('文件')).toBeTruthy()
  })

  // story 20260708-tree-row-hover · AC-1/AC-2 · hover 底纹
  // jsdom cannot calculate :hover; Task 5 Playwright covers the visual state in a real browser.
  it('uses scoped stylesheet rules for hover and selected backgrounds without conflating them', () => {
    renderTopicTree([topic('user-note.md'), topic('picked.md')], new Map(), 'picked.md')

    const unselectedRow = screen.getByText('user note').closest('.tree-item-row') as HTMLElement
    expect(unselectedRow.classList.contains('workspace-tree-row')).toBe(true)
    expect(unselectedRow.getAttribute('aria-selected')).toBe('false')

    const selectedRow = screen.getByText('picked').closest('.tree-item-row') as HTMLElement
    expect(selectedRow.classList.contains('workspace-tree-row')).toBe(true)
    expect(selectedRow.getAttribute('aria-selected')).toBe('true')

    const hoverRule = getWorkspaceTreeRule('.workspace-tree .workspace-tree-row:hover')
    const selectedRule = getWorkspaceTreeRule('.workspace-tree .workspace-tree-row[aria-selected')
    expect(hoverRule.style.background).toBeTruthy()
    expect(selectedRule.style.background).toBeTruthy()
    expect(hoverRule.style.background).not.toBe(selectedRule.style.background)
    expect(getComputedStyle(selectedRow).background).toBe(selectedRule.style.background)
  })

  // story 20260708-tree-select-regression · AC-2 · 选中底色瞬时出现，无淡入过渡
  it('does not animate row background changes', () => {
    renderTopicTree([topic('user-note.md')])
    const row = screen.getByText('user note').closest('.tree-item-row') as HTMLElement
    expect(row.style.transition).not.toContain('background')
  })

  // AC-1 · 基础设施文件被过滤
  it('hides infrastructure entries (assets dir, 00-index.md, *-readme.md) from the tree', () => {
    renderTopicTree([
      topic('assets', true),
      topic('00-index.md'),
      topic('00-index.mdx'),
      topic('me-export-readme.md'),
      topic('TOPIC-README.md'),
      topic('user-note.md'),
      topic('研究材料', true),
    ])

    // user-note.md → humanized "user note"；研究材料 保留
    expect(screen.getByText('user note')).toBeTruthy()
    expect(screen.getByText('研究材料')).toBeTruthy()
    expect(screen.queryByText('00-index.md')).toBeNull()
    expect(screen.queryByText('00 index')).toBeNull()
    expect(screen.queryByText('me export readme')).toBeNull()
    expect(screen.queryByText('TOPIC README')).toBeNull()
    // assets 目录被过滤：只应看到 user-note.md 和 研究材料 两行，assets 不在列表里
    expect(screen.queryByText('assets')).toBeNull()
  })

  // AC-2 · frontmatter title 优先，无 title 回退到可读化文件名
  it('shows frontmatter title when present and falls back to humanized filename', () => {
    renderTopicTree([
      topic('interview-story-framework.md', false, { title: '访谈故事框架' }),
      topic('ai-research-notes.md', false, { title: '  ' }), // 空白 title 应回退
      topic('raw_idea.md', false), // 无 title
    ])

    expect(screen.getByText('访谈故事框架')).toBeTruthy()
    expect(screen.getByText('ai research notes')).toBeTruthy()
    expect(screen.getByText('raw idea')).toBeTruthy()
    // 不应出现原始 slug
    expect(screen.queryByText('interview-story-framework.md')).toBeNull()
  })

  // AC-3 · 默认展开深度=1：顶层目录折叠时，子条目不渲染
  it('keeps deeper levels collapsed by default (expand depth = 1)', () => {
    const childEntry = topic('deep-note.md')
    const topDir = topic('topic-a', true)
    const dirs = new Map<string, { entries: TopicEntry[]; expanded: boolean; loading: boolean }>([
      [topDir.path, { entries: [childEntry], expanded: false, loading: false }],
    ])

    renderTopicTree([topDir, topic('top-level-note.md')], dirs)

    // 顶层可见（topic-a → humanized "topic a"；deep-note.md → "deep note"，折叠时不可见）
    expect(screen.getByText('topic a')).toBeTruthy()
    expect(screen.getByText('top level note')).toBeTruthy()
    expect(screen.queryByText('deep note')).toBeNull()
  })

  // AC-3 · 手动展开后深层可见
  it('reveals deeper levels once a directory is expanded', () => {
    const childEntry = topic('deep-note.md')
    const topDir = topic('topic-a', true)
    const dirs = new Map<string, { entries: TopicEntry[]; expanded: boolean; loading: boolean }>([
      [topDir.path, { entries: [childEntry], expanded: true, loading: false }],
    ])

    renderTopicTree([topDir], dirs)

    expect(screen.getByText('deep note')).toBeTruthy()
  })

  // story 20260708-folder-no-icon · AC-1: folders show no icon, expanded or not
  it('shows no folder icon whether collapsed or expanded', () => {
    const dirs = new Map([['专题', { entries: [], expanded: true, loading: false }]])
    renderTopicTree([topic('专题', true)], dirs)
    expect(screen.queryByLabelText('文件夹')).toBeNull()
    expect(screen.queryByLabelText('已展开的文件夹')).toBeNull()
    expect(screen.getByText('专题')).toBeTruthy()
  })

  // story 20260708-tree-create-rename · inline 编辑态
  it('renders an inline input for the entry matching editingPath and commits on Enter', () => {
    const onCommitEdit = vi.fn()
    renderWithProviders(
      <TopicTree
        entries={[topic('note.md')]}
        dirs={new Map()}
        selectedPath={null}
        parentPath=""
        sortStrategy="name-asc"
        editingPath="note.md"
        onCommitEdit={onCommitEdit}
        onToggleDir={vi.fn()}
        onSelectFile={vi.fn()}
        onAt={vi.fn()}
        onMore={vi.fn()}
      />,
    )
    const input = screen.getByDisplayValue('note.md') as HTMLInputElement
    input.value = 'renamed.md'
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onCommitEdit).toHaveBeenCalledWith('note.md', 'renamed.md', false)
  })

  // story 20260708-workspace-tree-enhancements · AC-7 · 手动排序拖拽把手
  it('shows a drag handle only when sortStrategy is manual', () => {
    const { rerender } = renderWithProviders(
      <TopicTree
        entries={[topic('a.md'), topic('b.md')]}
        dirs={new Map()}
        selectedPath={null}
        parentPath=""
        sortStrategy="name-asc"
        onToggleDir={vi.fn()}
        onSelectFile={vi.fn()}
        onAt={vi.fn()}
        onMore={vi.fn()}
      />,
    )
    expect(screen.queryAllByLabelText('拖拽排序')).toHaveLength(0)

    rerender(
      <TopicTree
        entries={[topic('a.md'), topic('b.md')]}
        dirs={new Map()}
        selectedPath={null}
        parentPath=""
        sortStrategy="manual"
        onToggleDir={vi.fn()}
        onSelectFile={vi.fn()}
        onAt={vi.fn()}
        onMore={vi.fn()}
      />,
    )
    expect(screen.getAllByLabelText('拖拽排序')).toHaveLength(2)
  })

  it('does not show a child count for an expanded folder with children', () => {
    const dirs = new Map([
      [
        '专题',
        {
          entries: [topic('a.md'), topic('b.md'), topic('sub', true)],
          expanded: true,
          loading: false,
        },
      ],
    ])
    renderTopicTree([topic('专题', true)], dirs)
    expect(document.querySelector('.workspace-tree-child-count')).toBeNull()
    expect(screen.queryByText('3')).toBeNull()
  })

  it('shows an empty-folder placeholder row when an expanded folder has no children', () => {
    const dirs = new Map([['专题', { entries: [], expanded: true, loading: false }]])
    renderTopicTree([topic('专题', true)], dirs)
    const placeholder = screen.getByText('空文件夹')
    expect(placeholder.getAttribute('data-workspace-depth')).toBe('0')
    expect(placeholder.style.getPropertyValue('--workspace-tree-depth')).toBe('0')
  })

  it('shows a loading placeholder at the expanded directory depth', () => {
    const dirs = new Map([['专题', { entries: [], expanded: true, loading: true }]])
    renderTopicTree([topic('专题', true)], dirs)

    const placeholder = screen.getByText('加载中…')
    expect(placeholder.getAttribute('data-workspace-depth')).toBe('0')
    expect(placeholder.style.getPropertyValue('--workspace-tree-depth')).toBe('0')
  })

  it('keeps recursive loading and empty placeholders at their real depths', () => {
    const root = topic('root', true, { path: 'root' })
    const loadingDirectory = topic('loading', true, { path: 'root/loading' })
    const levelOneDirectory = topic('level-one', true, { path: 'root/level-one' })
    const emptyDirectory = topic('empty', true, { path: 'root/level-one/empty' })
    const dirs = new Map([
      [
        root.path,
        { entries: [loadingDirectory, levelOneDirectory], expanded: true, loading: false },
      ],
      [loadingDirectory.path, { entries: [], expanded: true, loading: true }],
      [levelOneDirectory.path, { entries: [emptyDirectory], expanded: true, loading: false }],
      [emptyDirectory.path, { entries: [], expanded: true, loading: false }],
    ])

    renderTopicTree([root], dirs)

    const loadingPlaceholder = screen.getByText('加载中…')
    const emptyPlaceholder = screen.getByText('空文件夹')
    expect(loadingPlaceholder.getAttribute('data-workspace-depth')).toBe('1')
    expect(loadingPlaceholder.style.getPropertyValue('--workspace-tree-depth')).toBe('1')
    expect(emptyPlaceholder.getAttribute('data-workspace-depth')).toBe('2')
    expect(emptyPlaceholder.style.getPropertyValue('--workspace-tree-depth')).toBe('2')
  })
})
