import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from './setup'
import { TreeContextMenu } from '../components/TreeContextMenu'

describe('TreeContextMenu — create & rename', () => {
  it('shows 新建文件/新建文件夹 for a folder and calls the callbacks', () => {
    const onCreateFile = vi.fn()
    const onCreateFolder = vi.fn()
    renderWithProviders(
      <TreeContextMenu
        state={{
          x: 0,
          y: 0,
          itemType: 'topic-folder',
          name: '专题',
          path: '专题',
          isPinned: false,
        }}
        onClose={vi.fn()}
        onPin={vi.fn()}
        onUnpin={vi.fn()}
        onDelete={vi.fn()}
        onCreateFile={onCreateFile}
        onCreateFolder={onCreateFolder}
      />,
    )
    fireEvent.click(screen.getByText('新建文件'))
    expect(onCreateFile).toHaveBeenCalledWith('专题')

    fireEvent.click(screen.getByText('新建文件夹'))
    expect(onCreateFolder).toHaveBeenCalledWith('专题')
  })

  it('shows 重命名 for a topic file and calls onRename', () => {
    const onRename = vi.fn()
    renderWithProviders(
      <TreeContextMenu
        state={{
          x: 0,
          y: 0,
          itemType: 'topic-file',
          name: 'note.md',
          path: 'note.md',
          isPinned: false,
        }}
        onClose={vi.fn()}
        onPin={vi.fn()}
        onUnpin={vi.fn()}
        onDelete={vi.fn()}
        onRename={onRename}
      />,
    )
    fireEvent.click(screen.getByText('重命名'))
    expect(onRename).toHaveBeenCalledWith('note.md')
  })
})
