import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from './setup'
import { TopicTree } from '../components/TopicTree'
import type { TopicEntry } from '../lib/tauri'

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
  return renderWithProviders(
    <TopicTree
      entries={entries}
      dirs={dirs}
      selectedPath={selectedPath}
      onToggleDir={vi.fn()}
      onSelectFile={vi.fn()}
      onAt={vi.fn()}
      onMore={vi.fn()}
    />,
  )
}

describe('TopicTree', () => {
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

    expect(screen.getByLabelText('文件夹')).toBeTruthy()
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
    // assets 目录被过滤，仅「研究材料」是文件夹
    expect(screen.getAllByLabelText('文件夹')).toHaveLength(1)
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
})
