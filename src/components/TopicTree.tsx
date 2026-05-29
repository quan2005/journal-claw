// src/components/TopicTree.tsx
import { type TopicEntry } from '../lib/tauri'

interface TopicTreeProps {
  entries: TopicEntry[]
  dirs: Map<string, { entries: TopicEntry[]; expanded: boolean; loading: boolean }>
  selectedPath: string | null
  indent?: number
  onToggleDir: (path: string) => void
  onSelectFile: (entry: TopicEntry) => void
  onAt: (path: string) => void
  onMore: (entry: TopicEntry, x: number, y: number) => void
}

export function TopicTree({
  entries,
  dirs,
  selectedPath,
  indent = 0,
  onToggleDir,
  onSelectFile,
  onAt,
  onMore,
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

  return entries.map((entry) => {
    const isDir = entry.is_dir
    const childState = dirs.get(entry.path)
    const isExpanded = childState?.expanded ?? false
    const isLoading = childState?.loading ?? false
    const isSelected = entry.path === selectedPath
    const rowIndent = 8 + indent * 16

    return (
      <div key={entry.path}>
        <div
          className="tree-item-row"
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
            transition: 'background-color 0.15s var(--ease-out)',
          }}
          onClick={() => (isDir ? onToggleDir(entry.path) : onSelectFile(entry))}
          onContextMenu={(e) => {
            e.preventDefault()
            onMore(entry, e.clientX, e.clientY)
          }}
        >
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

          {/* Folder or File icon */}
          {isDir ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0, opacity: 0.5 }}
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0, opacity: 0.5 }}
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          )}

          {/* Name */}
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {entry.name}
          </span>

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
                color: 'var(--text-tertiary, #5c5852)',
                fontSize: '0.75rem',
                paddingTop: 4,
                paddingBottom: 4,
              }}
            >
              加载中…
            </div>
          ) : (
            <TopicTree
              entries={childState.entries}
              dirs={dirs}
              selectedPath={selectedPath}
              indent={indent + 1}
              onToggleDir={onToggleDir}
              onSelectFile={onSelectFile}
              onAt={onAt}
              onMore={onMore}
            />
          ))}
      </div>
    )
  })
}
