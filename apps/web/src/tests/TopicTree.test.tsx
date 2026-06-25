import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from './setup'
import { TopicTree } from '../components/TopicTree'
import type { TopicEntry } from '../lib/tauri'

function topic(name: string, isDir = false): TopicEntry {
  return {
    name,
    path: name,
    is_dir: isDir,
    created_secs: 0,
    mtime_secs: 0,
  }
}

function renderTopicTree(entries: TopicEntry[]) {
  return renderWithProviders(
    <TopicTree
      entries={entries}
      dirs={new Map()}
      selectedPath={null}
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
})
