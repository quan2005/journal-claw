import { useEffect } from 'react'
import type { CSSProperties, DragEvent } from 'react'
import type { TopicEntry } from '../lib/apiTypes'
import { filterCuration } from '../lib/topicCuration'
import type { WorkspaceTreeSort } from '../lib/sortTopics'
import { sortEntries } from '../lib/sortTopics'
import { WorkspaceTreeRow } from './WorkspaceTreeRow'

interface TopicTreeProps {
  entries: TopicEntry[]
  dirs: Map<string, { entries: TopicEntry[]; expanded: boolean; loading: boolean }>
  selectedPath: string | null
  indent?: number
  parentPath: string
  sortStrategy: WorkspaceTreeSort
  manualOrder?: Record<string, string[]>
  editingPath?: string | null
  focusedPath?: string | null
  focusTreeLabel?: string
  onCommitEdit?: (originalPath: string | null, newName: string, isDir: boolean) => void
  onCancelEdit?: () => void
  onToggleDir: (path: string) => void
  onSelectFile: (entry: TopicEntry) => void
  onAt: (path: string) => void
  onMore: (entry: TopicEntry, x: number, y: number) => void
  onReorder?: (parentPath: string, orderedNames: string[]) => void
}

export function TopicTree({
  entries,
  dirs,
  selectedPath,
  indent = 0,
  parentPath,
  sortStrategy,
  manualOrder,
  editingPath,
  focusedPath,
  focusTreeLabel,
  onCommitEdit,
  onCancelEdit,
  onToggleDir,
  onSelectFile,
  onAt,
  onMore,
  onReorder,
}: TopicTreeProps) {
  const sorted = sortEntries(filterCuration(entries), sortStrategy, manualOrder?.[parentPath])
  const workspaceDepthStyle = { '--workspace-tree-depth': indent } as CSSProperties
  const placeholderStyle = {
    ...workspaceDepthStyle,
    paddingBlock: 'var(--space-1)',
    paddingInlineStart:
      'calc(var(--workspace-tree-inline) + var(--workspace-tree-depth) * var(--workspace-tree-indent) + var(--workspace-tree-marker) + var(--workspace-tree-marker-gap))',
    color: 'var(--text-tertiary)',
    fontSize: '0.75rem',
  } as CSSProperties

  useEffect(() => {
    if (!focusedPath) return
    const scope = focusTreeLabel
      ? document.querySelector<HTMLElement>(
          `[role="tree"][aria-label="${CSS.escape(focusTreeLabel)}"]`,
        )
      : document
    scope
      ?.querySelector<HTMLElement>(`[role="treeitem"][data-path="${CSS.escape(focusedPath)}"]`)
      ?.focus()
  }, [focusedPath, focusTreeLabel])

  return sorted.map((entry) => {
    const isDir = entry.is_dir
    const childState = dirs.get(entry.path)
    const isExpanded = childState?.expanded ?? false
    const isLoading = childState?.loading ?? false
    const isSelected = entry.path === selectedPath
    const dragHandlers =
      sortStrategy === 'manual'
        ? {
            onDragStart: (event: DragEvent<HTMLSpanElement>) => {
              event.dataTransfer.setData('text/plain', entry.name)
              event.stopPropagation()
            },
            onDragOver: (event: DragEvent<HTMLSpanElement>) => event.preventDefault(),
            onDrop: (event: DragEvent<HTMLSpanElement>) => {
              event.preventDefault()
              event.stopPropagation()
              const draggedName = event.dataTransfer.getData('text/plain')
              if (!draggedName || draggedName === entry.name) return
              const names = sorted.map((item) => item.name)
              const from = names.indexOf(draggedName)
              const to = names.indexOf(entry.name)
              if (from === -1 || to === -1) return
              const next = [...names]
              const [moved] = next.splice(from, 1)
              next.splice(to, 0, moved)
              onReorder?.(parentPath, next)
            },
          }
        : undefined

    return (
      <div key={entry.path}>
        <WorkspaceTreeRow
          entry={entry}
          depth={indent}
          expanded={isExpanded}
          selected={isSelected}
          focused={entry.path === focusedPath}
          editing={entry.path === editingPath}
          manualSort={sortStrategy === 'manual'}
          onActivate={() => (isDir ? onToggleDir(entry.path) : onSelectFile(entry))}
          onAt={() => onAt(entry.path)}
          onMore={(x, y) => onMore(entry, x, y)}
          onCommitEdit={(newName) => onCommitEdit?.(entry.path, newName, isDir)}
          onCancelEdit={onCancelEdit}
          drag={dragHandlers}
        />

        {/* Recursive children */}
        {isDir && isExpanded && childState && (
          <div
            className="workspace-tree-children"
            data-testid="workspace-tree-children"
            data-workspace-depth={indent}
            style={workspaceDepthStyle}
          >
            {isLoading ? (
              <div data-workspace-depth={indent} style={placeholderStyle}>
                加载中…
              </div>
            ) : childState.entries.length === 0 ? (
              <div
                data-workspace-depth={indent}
                style={{ ...placeholderStyle, fontStyle: 'italic' }}
              >
                空文件夹
              </div>
            ) : (
              <TopicTree
                entries={childState.entries}
                dirs={dirs}
                selectedPath={selectedPath}
                indent={indent + 1}
                parentPath={entry.path}
                sortStrategy={sortStrategy}
                manualOrder={manualOrder}
                editingPath={editingPath}
                focusedPath={focusedPath}
                focusTreeLabel={focusTreeLabel}
                onCommitEdit={onCommitEdit}
                onCancelEdit={onCancelEdit}
                onToggleDir={onToggleDir}
                onSelectFile={onSelectFile}
                onAt={onAt}
                onMore={onMore}
                onReorder={onReorder}
              />
            )}
          </div>
        )}
      </div>
    )
  })
}
