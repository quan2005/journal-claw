import { useEffect, useRef } from 'react'
import type React from 'react'
import { AtSign, Ellipsis } from 'lucide-react'
import type { TopicEntry } from '../lib/apiTypes'
import { fileTypeIconKindFromName } from '../lib/fileTypeIconKind'
import { displayTopicName } from '../lib/topicCuration'
import { FileTypeIcon } from './FileTypeIcon'
import '../styles/workspace-tree.css'

export interface WorkspaceTreeRowProps {
  entry: TopicEntry
  depth: number
  expanded?: boolean
  selected: boolean
  focused?: boolean
  editing?: boolean
  manualSort?: boolean
  onActivate: () => void
  onAt?: () => void
  onMore?: (x: number, y: number) => void
  onCommitEdit?: (newName: string) => void
  onCancelEdit?: () => void
  drag?: {
    onDragStart: React.DragEventHandler<HTMLSpanElement>
    onDragOver: React.DragEventHandler<HTMLSpanElement>
    onDrop: React.DragEventHandler<HTMLSpanElement>
  }
}

export function WorkspaceTreeRow({
  entry,
  depth,
  expanded,
  selected,
  focused = false,
  editing = false,
  manualSort = false,
  onActivate,
  onAt,
  onMore,
  onCommitEdit,
  onCancelEdit,
  drag,
}: WorkspaceTreeRowProps) {
  const renameHandledRef = useRef(false)
  const isDirectory = entry.is_dir
  const displayName = displayTopicName(entry)

  useEffect(() => {
    renameHandledRef.current = false
  }, [editing, entry.path])

  return (
    <div
      className="workspace-tree-row tree-item-row"
      role="treeitem"
      data-depth={depth}
      data-path={entry.path}
      aria-expanded={isDirectory ? expanded : undefined}
      aria-selected={selected}
      tabIndex={focused ? 0 : -1}
      style={{ '--workspace-tree-depth': depth } as React.CSSProperties}
      onClick={onActivate}
      onContextMenu={(event) => {
        event.preventDefault()
        onMore?.(event.clientX, event.clientY)
      }}
    >
      <span className="workspace-tree-marker" data-workspace-marker>
        {isDirectory ? (
          <span
            className="workspace-tree-chevron"
            data-workspace-chevron
            aria-hidden="true"
            data-expanded={expanded ? 'true' : 'false'}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              width="12"
              height="12"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
        ) : (
          <FileTypeIcon
            kind={fileTypeIconKindFromName(entry.name)}
            size={16}
            selected={selected}
            variant="glyph-tile"
          />
        )}
      </span>

      {editing ? (
        <input
          className="workspace-tree-rename"
          autoFocus
          defaultValue={entry.name}
          aria-label="重命名"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              renameHandledRef.current = true
              onCommitEdit?.(event.currentTarget.value.trim())
            }
            if (event.key === 'Escape') {
              renameHandledRef.current = true
              onCancelEdit?.()
            }
          }}
          onBlur={(event) => {
            if (renameHandledRef.current) return
            renameHandledRef.current = true
            onCommitEdit?.(event.currentTarget.value.trim())
          }}
        />
      ) : (
        <span className="workspace-tree-name" title={displayName}>
          {displayName}
        </span>
      )}

      <div className="workspace-tree-trailing">
        {manualSort && drag ? (
          <span
            className="workspace-tree-drag-handle"
            aria-label="拖拽排序"
            draggable
            onClick={(event) => event.stopPropagation()}
            onDragStart={drag.onDragStart}
            onDragOver={drag.onDragOver}
            onDrop={drag.onDrop}
          >
            ⠿
          </span>
        ) : null}
        <div className="workspace-tree-actions" data-workspace-actions>
          <button
            type="button"
            aria-label="更多"
            onClick={(event) => {
              event.stopPropagation()
              const rect = event.currentTarget.getBoundingClientRect()
              onMore?.(rect.left, rect.bottom)
            }}
          >
            <Ellipsis aria-hidden="true" size={14} strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="引用"
            onClick={(event) => {
              event.stopPropagation()
              onAt?.()
            }}
          >
            <AtSign aria-hidden="true" size={14} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  )
}
