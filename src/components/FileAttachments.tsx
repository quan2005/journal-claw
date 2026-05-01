import { useEffect, useState } from 'react'
import { openFile, getWorkspacePath } from '../lib/tauri'
import type { MessageBlock } from '../types'

export function FileAttachments({ blocks }: { blocks: MessageBlock[] }) {
  const [workspacePath, setWorkspacePath] = useState('')

  useEffect(() => {
    getWorkspacePath()
      .then(setWorkspacePath)
      .catch(() => {})
  }, [])

  const filePaths = new Map<string, string>()
  for (const block of blocks) {
    if (
      block.type === 'tool' &&
      (block.name === 'write' || block.name === 'edit') &&
      !block.isError
    ) {
      const relPath =
        (block.input?.path as string) || block.label.replace(/^(write|edit):\s*/, '') || ''
      if (relPath && !filePaths.has(relPath)) {
        filePaths.set(relPath, relPath.split('/').pop() ?? relPath)
      }
    }
  }

  if (filePaths.size === 0 || !workspacePath) return null

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', paddingTop: 4 }}>
      {[...filePaths.entries()].map(([relPath, filename]) => {
        const absPath = workspacePath + '/' + relPath
        const dotIdx = filename.lastIndexOf('.')
        const namePart = dotIdx > 0 ? filename.slice(0, dotIdx) : filename
        const extLabel = dotIdx > 0 ? filename.slice(dotIdx + 1).toUpperCase() : ''
        return (
          <span
            key={relPath}
            onClick={() => openFile(absPath).catch(() => {})}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.color = 'var(--item-selected-text)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.color = 'var(--item-meta)'
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 'var(--text-xs)',
              padding: '2px 7px',
              borderRadius: 4,
              color: 'var(--item-meta)',
              background: 'var(--item-icon-bg)',
              fontFamily: 'var(--font-mono)',
              maxWidth: 240,
              cursor: 'pointer',
              transition: 'color 0.15s ease-out',
            }}
            title={relPath}
          >
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
              }}
            >
              {namePart}
            </span>
            {extLabel && (
              <span
                style={{
                  flexShrink: 0,
                  fontWeight: 'var(--font-medium)',
                  opacity: 0.5,
                }}
              >
                {extLabel}
              </span>
            )}
          </span>
        )
      })}
    </div>
  )
}
