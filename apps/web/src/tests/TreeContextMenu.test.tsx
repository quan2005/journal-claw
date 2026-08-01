import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from './setup'
import { TreeContextMenu } from '../components/TreeContextMenu'

const { mockHostAsk, mockHostConfirm } = vi.hoisted(() => ({
  mockHostAsk: vi.fn(),
  mockHostConfirm: vi.fn(),
}))

vi.mock('../lib/hostBridge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/hostBridge')>()),
  hostAsk: mockHostAsk,
  hostConfirm: mockHostConfirm,
}))

const workspaceDeleteCases = [
  {
    itemType: 'topic-file' as const,
    name: 'AGENTS.md',
    path: 'AGENTS.md',
    deleteLabel: '删除条目',
  },
  {
    itemType: 'topic-folder' as const,
    name: 'System',
    path: 'System',
    deleteLabel: '删除文件夹',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
})

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

describe('TreeContextMenu — delete confirmation', () => {
  it.each(workspaceDeleteCases)(
    'uses explicit Web-capable confirmation before deleting $itemType',
    async ({ itemType, name, path, deleteLabel }) => {
      mockHostConfirm.mockResolvedValue(true)
      mockHostAsk.mockResolvedValue(false)
      const onDelete = vi.fn()

      renderWithProviders(
        <TreeContextMenu
          state={{ x: 0, y: 0, itemType, name, path, isPinned: false }}
          onClose={vi.fn()}
          onPin={vi.fn()}
          onUnpin={vi.fn()}
          onDelete={onDelete}
        />,
      )

      fireEvent.click(screen.getByText(deleteLabel))

      await waitFor(() => expect(onDelete).toHaveBeenCalledWith(itemType, path))
      expect(mockHostConfirm).toHaveBeenCalledWith(`确认删除「${name}」？`, {
        title: '删除确认',
        kind: 'warning',
      })
      expect(mockHostAsk).not.toHaveBeenCalled()
    },
  )

  it.each(workspaceDeleteCases)(
    'keeps $itemType when explicit Web-capable confirmation is cancelled',
    async ({ itemType, name, path, deleteLabel }) => {
      mockHostConfirm.mockResolvedValue(false)
      mockHostAsk.mockResolvedValue(true)
      const onDelete = vi.fn()

      renderWithProviders(
        <TreeContextMenu
          state={{ x: 0, y: 0, itemType, name, path, isPinned: false }}
          onClose={vi.fn()}
          onPin={vi.fn()}
          onUnpin={vi.fn()}
          onDelete={onDelete}
        />,
      )

      fireEvent.click(screen.getByText(deleteLabel))

      await waitFor(() =>
        expect(mockHostConfirm).toHaveBeenCalledWith(`确认删除「${name}」？`, {
          title: '删除确认',
          kind: 'warning',
        }),
      )
      expect(onDelete).not.toHaveBeenCalled()
      expect(mockHostAsk).not.toHaveBeenCalled()
    },
  )

  it('keeps journal deletion on the generic native-only confirmation bridge', async () => {
    mockHostAsk.mockResolvedValue(true)
    mockHostConfirm.mockResolvedValue(true)
    const onDelete = vi.fn()

    renderWithProviders(
      <TreeContextMenu
        state={{
          x: 0,
          y: 0,
          itemType: 'journal',
          name: '日志',
          path: '2607/31-日志.md',
          isPinned: false,
        }}
        onClose={vi.fn()}
        onPin={vi.fn()}
        onUnpin={vi.fn()}
        onDelete={onDelete}
      />,
    )

    fireEvent.click(screen.getByText('删除条目'))

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('journal', '2607/31-日志.md'))
    expect(mockHostAsk).toHaveBeenCalledWith('确认删除「日志」？', {
      title: '删除确认',
      kind: 'warning',
    })
    expect(mockHostConfirm).not.toHaveBeenCalled()
  })
})
