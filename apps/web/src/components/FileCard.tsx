import { FileText, Music, Image, X, type LucideIcon } from 'lucide-react'
import type { FileKind } from '../lib/fileKind'

interface FileCardProps {
  filename: string
  kind: FileKind
  onRemove: () => void
  onOpen?: () => void
}

function iconColor(kind: FileKind): string {
  switch (kind) {
    case 'pdf':
      return 'var(--file-pdf)'
    case 'docx':
      return 'var(--file-docx)'
    case 'text':
    case 'markdown':
      return 'var(--file-markdown)'
    case 'audio':
      return 'var(--file-audio)'
    case 'image':
      return 'var(--file-image)'
    default:
      return 'var(--file-default)'
  }
}

function iconLucide(kind: FileKind): LucideIcon {
  switch (kind) {
    case 'audio':
      return Music
    case 'image':
      return Image
    default:
      return FileText
  }
}

export function FileCard({ filename, kind, onRemove, onOpen }: FileCardProps) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const Icon = iconLucide(kind)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        width: 56,
        padding: '4px 4px',
        borderRadius: 8,
        position: 'relative',
        flexShrink: 0,
      }}
      className="file-card-wrap"
    >
      {/* Icon — click opens file */}
      <div
        data-testid="file-card-icon"
        onClick={onOpen}
        style={{
          width: 44,
          height: 46,
          borderRadius: 9,
          background: iconColor(kind),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: onOpen ? 'pointer' : 'default',
          position: 'relative',
          flexShrink: 0,
          userSelect: 'none',
        }}
      >
        <Icon size={20} strokeWidth={1.5} color="var(--status-on-fill)" />
        {ext && (
          <span
            style={{
              position: 'absolute',
              bottom: 4,
              right: 4,
              fontSize: 7 /* micro badge — below token scale, intentional */,
              fontWeight: 'var(--font-semibold)',
              letterSpacing: '0.03em',
              color: 'rgba(255,255,255,0.7)',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              lineHeight: 1,
            }}
          >
            {ext}
          </span>
        )}
      </div>

      {/* Filename */}
      <span
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--item-meta)',
          textAlign: 'center',
          maxWidth: 58,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: 1.3,
          userSelect: 'none',
        }}
      >
        {filename}
      </span>

      {/* Remove button */}
      <span
        data-testid="file-card-remove"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="file-card-remove"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: 'var(--file-badge-bg)',
          color: 'var(--status-on-fill)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        <X size={8} strokeWidth={2} />
      </span>
    </div>
  )
}
