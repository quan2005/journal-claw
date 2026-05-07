import { useState, useEffect, useRef } from 'react'
import {
  revealInFinder,
  openFile,
  workspaceDuplicateFile,
  workspaceRenameFile,
  workspaceDeleteFile,
} from '../lib/tauri'
import { useTranslation } from '../contexts/I18nContext'

interface FileTreeContextMenuProps {
  x: number
  y: number
  name: string
  relativePath: string
  absolutePath: string
  isDir: boolean
  onClose: () => void
  onRefresh: () => void
  onReference?: () => void
}

type MenuItem =
  | { type: 'action'; label: string; icon: string; danger?: boolean; onClick: () => void }
  | { type: 'divider' }

export function FileTreeContextMenu({
  x,
  y,
  name,
  relativePath,
  absolutePath,
  isDir,
  onClose,
  onRefresh,
  onReference,
}: FileTreeContextMenuProps) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(name)
  const renameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [onClose])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (rect.right > vw) ref.current.style.left = `${Math.max(4, vw - rect.width - 8)}px`
    if (rect.bottom > vh) ref.current.style.top = `${Math.max(4, vh - rect.height - 8)}px`
  }, [])

  useEffect(() => {
    if (renaming && renameRef.current) {
      renameRef.current.focus()
      const dotIdx = renameValue.lastIndexOf('.')
      renameRef.current.setSelectionRange(0, dotIdx > 0 ? dotIdx : renameValue.length)
    }
  }, [renaming, renameValue])

  const handleRenameSubmit = async () => {
    const trimmed = renameValue.trim()
    if (!trimmed || trimmed === name) {
      onClose()
      return
    }
    try {
      await workspaceRenameFile(relativePath, trimmed)
      onRefresh()
    } catch (e) {
      console.error('[rename]', e)
    }
    onClose()
  }

  if (renaming) {
    return (
      <div
        ref={ref}
        style={{
          position: 'fixed',
          top: y,
          left: x,
          zIndex: 9999,
          background: 'var(--context-menu-bg)',
          border: '1px solid var(--context-menu-border)',
          borderRadius: 8,
          boxShadow: '0 4px 20px var(--context-menu-shadow)',
          padding: '8px 10px',
          minWidth: 200,
        }}
      >
        <input
          ref={renameRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRenameSubmit()
            if (e.key === 'Escape') onClose()
          }}
          onBlur={handleRenameSubmit}
          style={{
            width: '100%',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-body)',
            color: 'var(--item-text)',
            background: 'var(--input-bg, transparent)',
            border: '1px solid var(--divider)',
            borderRadius: 4,
            padding: '4px 8px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>
    )
  }

  const items: MenuItem[] = [
    ...(onReference && !isDir
      ? [
          {
            type: 'action' as const,
            label: t('referenceEntry'),
            icon: 'reference',
            onClick: () => {
              onReference()
              onClose()
            },
          },
        ]
      : []),
    {
      type: 'action',
      label: t('openInEditor'),
      icon: 'edit',
      onClick: async () => {
        await openFile(absolutePath)
        onClose()
      },
    },
    {
      type: 'action',
      label: t('showInFinder'),
      icon: 'finder',
      onClick: async () => {
        await revealInFinder(absolutePath)
        onClose()
      },
    },
    { type: 'divider' },
    ...(!isDir
      ? [
          {
            type: 'action' as const,
            label: t('duplicate'),
            icon: 'duplicate',
            onClick: async () => {
              try {
                await workspaceDuplicateFile(relativePath)
                onRefresh()
              } catch (e) {
                console.error('[duplicate]', e)
              }
              onClose()
            },
          },
        ]
      : []),
    {
      type: 'action',
      label: t('rename'),
      icon: 'rename',
      onClick: () => {
        setRenaming(true)
      },
    },
    { type: 'divider' },
    {
      type: 'action',
      label: t('copyFilePath'),
      icon: 'path',
      onClick: async () => {
        await navigator.clipboard.writeText(absolutePath)
        onClose()
      },
    },
    {
      type: 'action',
      label: t('copyFileName'),
      icon: 'copy',
      onClick: async () => {
        await navigator.clipboard.writeText(name)
        onClose()
      },
    },
    { type: 'divider' },
    {
      type: 'action',
      label: t('delete'),
      icon: 'delete',
      danger: true,
      onClick: async () => {
        if (!window.confirm(`${t('delete')} "${name}"?`)) return
        try {
          await workspaceDeleteFile(relativePath)
          onRefresh()
        } catch (e) {
          console.error('[delete]', e)
        }
        onClose()
      },
    },
  ]

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: y,
        left: x,
        zIndex: 9999,
        background: 'var(--context-menu-bg)',
        border: '1px solid var(--context-menu-border)',
        borderRadius: 8,
        boxShadow: '0 4px 20px var(--context-menu-shadow)',
        minWidth: 180,
        overflow: 'hidden',
        padding: '4px 0',
      }}
    >
      {items.map((item, i) => {
        if (item.type === 'divider') {
          return (
            <div key={i} style={{ height: 1, background: 'var(--divider)', margin: '4px 0' }} />
          )
        }
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 12px',
              fontSize: 'var(--text-sm)',
              cursor: 'pointer',
              color: item.danger ? 'var(--status-danger)' : 'var(--item-text)',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLDivElement).style.background = item.danger
                ? 'rgba(255,59,48,0.06)'
                : 'var(--item-hover-bg)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
            }}
            onClick={item.onClick}
          >
            <MenuIcon icon={item.icon} danger={item.danger} />
            <span>{item.label}</span>
          </div>
        )
      })}
    </div>
  )
}

function MenuIcon({ icon, danger }: { icon: string; danger?: boolean }) {
  const color = danger ? 'var(--status-danger)' : 'var(--item-meta)'
  const props = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  switch (icon) {
    case 'reference':
      return (
        <svg {...props}>
          <text
            x="12"
            y="18"
            textAnchor="middle"
            fontSize="22"
            fontWeight="700"
            fill={color}
            stroke="none"
          >
            @
          </text>
        </svg>
      )
    case 'edit':
      return (
        <svg {...props}>
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      )
    case 'finder':
      return (
        <svg {...props}>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      )
    case 'duplicate':
      return (
        <svg {...props}>
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          <line x1="15" y1="12" x2="15" y2="18" />
          <line x1="12" y1="15" x2="18" y2="15" />
        </svg>
      )
    case 'rename':
      return (
        <svg {...props}>
          <path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
      )
    case 'path':
      return (
        <svg {...props}>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      )
    case 'copy':
      return (
        <svg {...props}>
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )
    case 'delete':
      return (
        <svg {...props}>
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      )
    default:
      return null
  }
}
