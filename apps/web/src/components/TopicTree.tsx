// src/components/TopicTree.tsx
import type { TopicEntry } from '../lib/apiTypes'
import { fileTypeIconKindFromName } from '../lib/fileTypeIconKind'
import { displayTopicName, filterCuration } from '../lib/topicCuration'
import type { WorkspaceTreeSort } from '../lib/sortTopics'
import { sortEntries } from '../lib/sortTopics'
import { FileTypeIcon } from './FileTypeIcon'

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
  onCommitEdit,
  onCancelEdit,
  onToggleDir,
  onSelectFile,
  onAt,
  onMore,
  onReorder,
}: TopicTreeProps) {
  const actBtnStyle: React.CSSProperties = {
    width: 22,
    height: 22,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    cursor: 'pointer',
    color: 'var(--duration-text)',
    background: 'transparent',
    border: 'none',
    fontSize: '0.75rem',
    fontWeight: 500,
    fontFamily: 'inherit',
  }

  const sorted = sortEntries(filterCuration(entries), sortStrategy, manualOrder?.[parentPath])

  return sorted.map((entry) => {
    const isDir = entry.is_dir
    const childState = dirs.get(entry.path)
    const isExpanded = childState?.expanded ?? false
    const isLoading = childState?.loading ?? false
    const isSelected = entry.path === selectedPath
    const rowIndent = 8 + indent * 16
    // folder-no-icon: folders render no icon at all, so no folder/folder-open
    // kind is needed here — only file rows resolve a FileTypeIcon kind.
    const iconKind = isDir ? undefined : fileTypeIconKindFromName(entry.name)
    const displayName = displayTopicName(entry)

    return (
      <div key={entry.path}>
        <div
          className="tree-item-row"
          role="treeitem"
          data-path={entry.path}
          aria-selected={isSelected}
          tabIndex={-1}
          ref={(el) => {
            if (el && entry.path === focusedPath) el.focus()
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: `5px 4px 5px ${rowIndent}px`,
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: '0.8125rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            background: isSelected ? 'var(--item-selected-bg)' : 'transparent',
            color: isSelected ? 'var(--item-selected-text)' : 'var(--item-text)',
            outline: entry.path === focusedPath ? 'var(--focus-ring)' : 'none',
            outlineOffset: -1,
          }}
          onMouseEnter={(e) => {
            if (!isSelected)
              (e.currentTarget as HTMLDivElement).style.background = 'var(--item-hover-bg)'
          }}
          onMouseLeave={(e) => {
            if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
          }}
          onClick={() => (isDir ? onToggleDir(entry.path) : onSelectFile(entry))}
          onContextMenu={(e) => {
            e.preventDefault()
            onMore(entry, e.clientX, e.clientY)
          }}
        >
          {/* Drag handle (manual sort only) */}
          {sortStrategy === 'manual' && (
            <span
              aria-label="拖拽排序"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', entry.name)
                e.stopPropagation()
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const draggedName = e.dataTransfer.getData('text/plain')
                if (!draggedName || draggedName === entry.name) return
                const names = sorted.map((it) => it.name)
                const from = names.indexOf(draggedName)
                const to = names.indexOf(entry.name)
                if (from === -1 || to === -1) return
                const next = [...names]
                const [moved] = next.splice(from, 1)
                next.splice(to, 0, moved)
                onReorder?.(parentPath, next)
              }}
              style={{
                width: 12,
                height: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'grab',
                color: 'var(--text-tertiary, #9CA3AF)',
                flexShrink: 0,
              }}
            >
              <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor">
                <circle cx="2" cy="2" r="1" />
                <circle cx="6" cy="2" r="1" />
                <circle cx="2" cy="6" r="1" />
                <circle cx="6" cy="6" r="1" />
                <circle cx="2" cy="10" r="1" />
                <circle cx="6" cy="10" r="1" />
              </svg>
            </span>
          )}

          {/* Chevron or gap */}
          {isDir ? (
            <span
              style={{
                width: 10,
                height: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transform: isExpanded ? 'rotate(90deg)' : 'none',
                transition: 'transform 0.15s ease-out',
                color: 'var(--duration-text)',
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                width="10"
                height="10"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </span>
          ) : (
            <span style={{ width: 10, flexShrink: 0 }} />
          )}

          {/* AC-1 (folder-no-icon): folders show no icon — the chevron already
              identifies them, so the name sits flush against it. AC-2: file rows
              keep their icon slot, so within a level, folder names start further
              left than file names by design (chevron+gap vs chevron+gap+icon). */}
          {isDir ? null : <FileTypeIcon kind={iconKind!} selected={isSelected} />}

          {/* Name */}
          {entry.path === editingPath ? (
            <input
              autoFocus
              defaultValue={entry.name}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter')
                  onCommitEdit?.(entry.path, e.currentTarget.value.trim(), isDir)
                if (e.key === 'Escape') onCancelEdit?.()
              }}
              onBlur={(e) => onCommitEdit?.(entry.path, e.currentTarget.value.trim(), isDir)}
              style={{
                flex: 1,
                font: 'inherit',
                color: 'inherit',
                background: 'transparent',
                border: '1px solid var(--record-btn)',
                borderRadius: 'var(--radius-sm)',
                padding: '0 4px',
              }}
            />
          ) : (
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }} title={displayName}>
              {displayName}
            </span>
          )}

          {isDir && childState && childState.entries.length > 0 && (
            <span
              style={{
                fontSize: '0.6875rem',
                color: 'var(--text-tertiary, #9CA3AF)',
                marginRight: 4,
                flexShrink: 0,
              }}
            >
              {childState.entries.length}
            </span>
          )}

          {/* Action buttons: @ and … */}
          <div
            className="tree-item-actions"
            style={{
              display: 'flex',
              gap: 2,
              flexShrink: 0,
              width: 48,
              overflow: 'hidden',
              opacity: 0,
              pointerEvents: 'none',
              transform: 'translateX(4px)',
              transition: 'opacity 0.15s var(--ease-out), transform 0.15s var(--ease-out)',
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation()
                onAt(entry.path)
              }}
              style={actBtnStyle}
            >
              @
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMore(entry, e.clientX, e.clientY)
              }}
              style={actBtnStyle}
            >
              <svg
                width="14"
                height="4"
                viewBox="0 0 16 4"
                fill="currentColor"
                style={{ display: 'block' }}
              >
                <circle cx="2" cy="2" r="1.5" />
                <circle cx="8" cy="2" r="1.5" />
                <circle cx="14" cy="2" r="1.5" />
              </svg>
            </button>
          </div>
        </div>

        {/* Recursive children */}
        {isDir &&
          isExpanded &&
          childState &&
          (isLoading ? (
            <div
              style={{
                paddingLeft: rowIndent + 20,
                color: 'var(--text-tertiary, #9CA3AF)',
                fontSize: '0.75rem',
                paddingTop: 4,
                paddingBottom: 4,
              }}
            >
              加载中…
            </div>
          ) : childState.entries.length === 0 ? (
            <div
              style={{
                paddingLeft: rowIndent + 20,
                color: 'var(--text-tertiary, #9CA3AF)',
                fontSize: '0.75rem',
                fontStyle: 'italic',
                paddingTop: 4,
                paddingBottom: 4,
              }}
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
              onCommitEdit={onCommitEdit}
              onCancelEdit={onCancelEdit}
              onToggleDir={onToggleDir}
              onSelectFile={onSelectFile}
              onAt={onAt}
              onMore={onMore}
              onReorder={onReorder}
            />
          ))}
      </div>
    )
  })
}
