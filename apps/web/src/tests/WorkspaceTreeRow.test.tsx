import { describe, expect, it, vi } from 'vitest'
import { createEvent, fireEvent, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import * as path from 'node:path'
import { renderWithProviders } from './setup'
import { FileTypeIcon } from '../components/FileTypeIcon'
import { WorkspaceTreeRow } from '../components/WorkspaceTreeRow'
import type { TopicEntry } from '../lib/apiTypes'

declare const __dirname: string

const workspaceTreeCss = readFileSync(
  (path as unknown as { resolve: (...segments: string[]) => string }).resolve(
    __dirname,
    '../styles/workspace-tree.css',
  ),
  'utf-8',
)

const globalsCss = readFileSync(
  (path as unknown as { resolve: (...segments: string[]) => string }).resolve(
    __dirname,
    '../styles/globals.css',
  ),
  'utf-8',
)

function fileColorTokenValues(token: string): string[] {
  return [...globalsCss.matchAll(new RegExp(`--${token}:\\s*([^;]+);`, 'g'))].map((match) =>
    match[1].trim().toLowerCase(),
  )
}

let workspaceTreeCssInstalled = false

function installWorkspaceTreeCss() {
  if (workspaceTreeCssInstalled) return
  const style = document.createElement('style')
  style.textContent = workspaceTreeCss
  document.head.appendChild(style)
  workspaceTreeCssInstalled = true
}

function topic(name: string, isDir = false): TopicEntry {
  return {
    name,
    path: `workspace/${name}`,
    is_dir: isDir,
    mtime_secs: 0,
  }
}

function renderRow(
  entry: TopicEntry,
  overrides: Partial<React.ComponentProps<typeof WorkspaceTreeRow>> = {},
) {
  installWorkspaceTreeCss()
  const onActivate = vi.fn()
  const onAt = vi.fn()
  const onMore = vi.fn()

  renderWithProviders(
    <div className="workspace-tree">
      <WorkspaceTreeRow
        entry={entry}
        depth={2}
        selected
        onActivate={onActivate}
        onAt={onAt}
        onMore={onMore}
        {...overrides}
      />
    </div>,
  )

  return { onActivate, onAt, onMore }
}

const workspaceGlyphTileCases = [
  { filename: 'recording.mp3', kind: 'audio', label: '音频文件' },
  { filename: 'clip.mp4', kind: 'video', label: '视频文件' },
  { filename: 'notes.txt', kind: 'text', label: '文本文件' },
  { filename: 'notes.md', kind: 'markdown', label: 'Markdown 文件' },
  { filename: 'notes.mdx', kind: 'mdx', label: 'MDX 文件' },
  { filename: 'document.pdf', kind: 'pdf', label: 'PDF 文件' },
  { filename: 'document.docx', kind: 'docx', label: 'Word 文件' },
  { filename: 'workbook.xlsx', kind: 'spreadsheet', label: '表格文件' },
  { filename: 'slides.pptx', kind: 'presentation', label: '演示文件' },
  { filename: 'photo.png', kind: 'image', label: '图片文件' },
  { filename: 'index.html', kind: 'html', label: 'HTML 文件' },
  { filename: 'component.tsx', kind: 'code', label: '代码文件' },
  { filename: 'settings.json', kind: 'config', label: '配置文件' },
  { filename: 'export.csv', kind: 'csv', label: 'CSV 文件' },
  { filename: 'bundle.zip', kind: 'archive', label: '压缩包' },
  { filename: 'unknown.bin', kind: 'other', label: '文件' },
] as const

describe('WorkspaceTreeRow', () => {
  it('exposes its workspace geometry and selected state with more then mention actions', () => {
    renderRow(topic('note.md'))

    const row = screen.getByRole('treeitem')
    const actions = row.querySelector('[data-workspace-actions]') as HTMLElement

    expect(row.getAttribute('data-depth')).toBe('2')
    expect(row.getAttribute('aria-selected')).toBe('true')
    expect(row.querySelector('[data-workspace-marker]')).toBeTruthy()
    expect(row.querySelector('[data-workspace-selection-bar]')).toBeNull()
    expect(
      within(actions)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['更多', '引用'])
    expect(
      within(actions)
        .getAllByRole('button')
        .every((button) => button.querySelector('svg')),
    ).toBe(true)
    expect(within(actions).getByRole('button', { name: '引用' }).textContent).not.toContain('@')

    const workspaceStyle = [...document.head.querySelectorAll('style')].find((style) =>
      style.textContent?.includes('.workspace-tree'),
    )
    expect(workspaceStyle?.sheet?.cssRules.length).toBeGreaterThan(0)
    const treeStyles = getComputedStyle(row.parentElement as HTMLElement)
    const styles = getComputedStyle(row)
    expect(treeStyles.getPropertyValue('--workspace-tree-row-height').trim()).toBe('34px')
    expect(styles.height).toBe('var(--workspace-tree-row-height)')
    expect(styles.background).toBe('var(--item-selected-bg)')
    expect(styles.borderRadius).toBe('var(--radius-pill)')
    expect(styles.getPropertyValue('--workspace-tree-depth').trim()).toBe('2')
  })

  it.each([false, true])('uses only a chevron for folders when expanded is %s', (expanded) => {
    renderRow(topic('notes', true), { selected: false, expanded })

    const folderRow = screen.getByRole('treeitem')
    const chevron = folderRow.querySelector('[data-workspace-chevron]')
    expect(folderRow.getAttribute('aria-expanded')).toBe(String(expanded))
    expect(chevron?.getAttribute('data-expanded')).toBe(String(expanded))
    expect(screen.queryByLabelText('文件夹')).toBeNull()
    expect(screen.queryByLabelText('已展开的文件夹')).toBeNull()
    expect(folderRow.querySelector('[data-file-icon-variant]')).toBeNull()
    expect(folderRow.querySelector('[data-file-kind]')).toBeNull()
    expect(folderRow.querySelector('.workspace-tree-child-count')).toBeNull()
  })

  it('uses glyph tiles for workspace files', () => {
    installWorkspaceTreeCss()
    const { rerender } = renderWithProviders(
      <div className="workspace-tree">
        <WorkspaceTreeRow entry={topic('notes.md')} depth={0} selected onActivate={vi.fn()} />
      </div>,
    )

    const markdownIcon = screen.getByLabelText('Markdown 文件')
    expect(markdownIcon.getAttribute('data-file-kind')).toBe('markdown')
    expect(markdownIcon.getAttribute('data-file-icon-variant')).toBe('glyph-tile')
    expect(markdownIcon.style.color).toBe('var(--item-selected-text)')
    expect(screen.getByRole('treeitem').querySelector('.workspace-tree-child-count')).toBeNull()

    rerender(
      <div className="workspace-tree">
        <WorkspaceTreeRow
          entry={topic('index.html')}
          depth={0}
          selected={false}
          onActivate={vi.fn()}
        />
      </div>,
    )
    const htmlIcon = screen.getByLabelText('HTML 文件')
    expect(htmlIcon.getAttribute('data-file-kind')).toBe('html')
    expect(htmlIcon.getAttribute('data-file-icon-variant')).toBe('glyph-tile')
  })

  it.each(workspaceGlyphTileCases)(
    'renders $kind workspace files with the glyph-tile contract',
    ({ filename, kind, label }) => {
      renderRow(topic(filename), { selected: false })

      const icon = within(screen.getByRole('treeitem')).getByRole('img', { name: label })
      expect(icon.getAttribute('data-file-icon-variant')).toBe('glyph-tile')
      expect(icon.getAttribute('data-file-kind')).toBe(kind)
    },
  )

  it('gives HTML glyph tiles their own non-signal-orange semantic color in every theme block', () => {
    const htmlColors = fileColorTokenValues('file-html')
    const markdownColors = fileColorTokenValues('file-markdown')

    expect(htmlColors).toEqual(['#d97706', '#fbbf24', '#fbbf24', '#d97706'])
    expect(htmlColors).not.toContain('#ff5701')
    expect(htmlColors).not.toEqual(markdownColors)

    renderRow(topic('index.html'), { selected: false })
    const htmlIcon = screen.getByLabelText('HTML 文件')
    expect(htmlIcon.style.color).toBe('var(--file-html)')
    expect(htmlIcon.getAttribute('style')).toContain('var(--file-html)')
  })

  it('preserves the default HTML icon palette while glyph tiles use the HTML semantic palette', () => {
    renderWithProviders(
      <>
        <FileTypeIcon kind="html" />
        <FileTypeIcon kind="html" size={16} variant="glyph-tile" />
      </>,
    )

    const [defaultIcon, tileIcon] = screen.getAllByLabelText('HTML 文件')
    expect(defaultIcon.style.color).toBe('var(--file-default)')
    expect(defaultIcon.getAttribute('data-file-icon-variant')).toBeNull()
    expect(tileIcon.style.color).toBe('var(--file-html)')
    expect(tileIcon.getAttribute('data-file-icon-variant')).toBe('glyph-tile')
  })

  it('renders the complete 16 px glyph-tile palette and selection contract', () => {
    const { rerender } = renderWithProviders(
      <div className="workspace-tree">
        <WorkspaceTreeRow
          entry={topic('notes.md')}
          depth={0}
          selected={false}
          onActivate={vi.fn()}
        />
      </div>,
    )

    const unselectedIcon = screen.getByLabelText('Markdown 文件')
    expect(unselectedIcon.style.width).toBe('16px')
    expect(unselectedIcon.style.height).toBe('16px')
    expect(unselectedIcon.style.borderRadius).toBe('var(--radius-sm)')
    expect(unselectedIcon.style.color).toBe('var(--file-markdown)')
    expect(unselectedIcon.getAttribute('style')).toContain(
      'color-mix(in srgb, var(--file-markdown) 13%, transparent)',
    )
    expect(unselectedIcon.getAttribute('style')).toContain(
      '1px solid color-mix(in srgb, var(--file-markdown) 26%, transparent)',
    )
    expect(unselectedIcon.querySelector('svg')?.getAttribute('width')).toBe('72%')
    expect(unselectedIcon.querySelector('svg')?.getAttribute('height')).toBe('72%')

    rerender(
      <div className="workspace-tree">
        <WorkspaceTreeRow entry={topic('notes.md')} depth={0} selected onActivate={vi.fn()} />
      </div>,
    )

    const selectedIcon = screen.getByLabelText('Markdown 文件')
    expect(selectedIcon.style.color).toBe('var(--item-selected-text)')
    expect(selectedIcon.getAttribute('style')).toContain(
      'color-mix(in srgb, var(--item-selected-text) 12%, transparent)',
    )
    expect(selectedIcon.getAttribute('style')).toContain(
      '1px solid color-mix(in srgb, var(--item-selected-text) 28%, transparent)',
    )
  })

  it('keeps trailing action clicks from activating the row', () => {
    const { onActivate, onAt, onMore } = renderRow(topic('note.md'))
    const buttons = screen.getAllByRole('button')
    vi.spyOn(buttons[0], 'getBoundingClientRect').mockReturnValue({
      left: 31,
      bottom: 47,
    } as DOMRect)

    fireEvent.click(buttons[0], { clientX: 301, clientY: 401 })
    fireEvent.click(buttons[1])

    expect(onMore).toHaveBeenCalledWith(31, 47)
    expect(onAt).toHaveBeenCalledOnce()
    expect(onActivate).not.toHaveBeenCalled()
  })

  it('commits renamed input on Enter exactly once when blur follows', () => {
    const onCommitEdit = vi.fn()
    renderRow(topic('note.md'), { editing: true, onCommitEdit })

    const input = screen.getByDisplayValue('note.md')
    fireEvent.change(input, { target: { value: 'renamed.md' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.blur(input)

    expect(onCommitEdit).toHaveBeenCalledTimes(1)
    expect(onCommitEdit).toHaveBeenCalledWith('renamed.md')
  })

  it('does not commit renamed input when Escape is followed by blur', () => {
    const onCommitEdit = vi.fn()
    const onCancelEdit = vi.fn()
    renderRow(topic('note.md'), { editing: true, onCommitEdit, onCancelEdit })

    const input = screen.getByDisplayValue('note.md')
    fireEvent.change(input, { target: { value: 'discarded.md' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    fireEvent.blur(input)

    expect(onCancelEdit).toHaveBeenCalledOnce()
    expect(onCommitEdit).not.toHaveBeenCalled()
  })

  it('reveals the action area while an action button has keyboard focus', () => {
    renderRow(topic('note.md'), { selected: false })

    const actions = screen
      .getByRole('treeitem')
      .querySelector('[data-workspace-actions]') as HTMLElement
    const moreButton = within(actions).getByRole('button', { name: '更多' })
    moreButton.focus()

    const workspaceStyle = [...document.head.querySelectorAll('style')].find((style) =>
      style.textContent?.includes('.workspace-tree'),
    )
    expect(actions.matches(':focus-within')).toBe(true)
    expect(document.activeElement).toBe(moreButton)
    expect(
      [...(workspaceStyle?.sheet?.cssRules ?? [])].some((rule) =>
        rule.cssText.includes('.workspace-tree-actions:focus-within'),
      ),
    ).toBe(true)
  })

  it('declares concrete token-based focus outlines for workspace rows and action buttons', () => {
    installWorkspaceTreeCss()
    const workspaceStyle = [...document.head.querySelectorAll('style')].find((style) =>
      style.textContent?.includes('.workspace-tree'),
    )
    const rules = [...(workspaceStyle?.sheet?.cssRules ?? [])]
    const rowFocusRule = rules.find((rule) =>
      rule.cssText.includes('.workspace-tree .workspace-tree-row:focus-visible'),
    )
    const actionFocusRule = rules.find((rule) =>
      rule.cssText.includes('.workspace-tree .workspace-tree-actions button:focus-visible'),
    )

    expect(rowFocusRule?.cssText).toContain('outline: 2px solid var(--focus-ring)')
    expect(actionFocusRule?.cssText).toContain('outline: 2px solid var(--focus-ring)')
  })

  it('omits child counts and forwards manual drag callbacks', () => {
    const onDragStart = vi.fn()
    const onDragOver = vi.fn()
    const onDrop = vi.fn()
    renderRow(topic('note.md'), {
      manualSort: true,
      drag: { onDragStart, onDragOver, onDrop },
    })

    const dragHandle = screen.getByLabelText('拖拽排序')
    fireEvent.dragStart(dragHandle)
    fireEvent.dragOver(dragHandle)
    fireEvent.drop(dragHandle)

    expect(screen.getByRole('treeitem').querySelector('.workspace-tree-child-count')).toBeNull()
    expect(onDragStart).toHaveBeenCalledOnce()
    expect(onDragOver).toHaveBeenCalledOnce()
    expect(onDrop).toHaveBeenCalledOnce()
  })

  it('prevents the native context menu and forwards its coordinates', () => {
    const { onMore } = renderRow(topic('note.md'))
    const row = screen.getByRole('treeitem')
    const event = createEvent.contextMenu(row, { clientX: 67, clientY: 89 })

    fireEvent(row, event)

    expect(event.defaultPrevented).toBe(true)
    expect(onMore).toHaveBeenCalledWith(67, 89)
  })
})
