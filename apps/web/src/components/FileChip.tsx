import type { FileKind } from '../lib/fileKind'
import { fileTypeIconKindFromName } from '../lib/fileTypeIconKind'
import { FileTypeIcon } from './FileTypeIcon'

interface FileChipProps {
  filename: string
  kind: FileKind
  onRemove: () => void
}

function chipColors(kind: FileKind) {
  switch (kind) {
    case 'audio':
      return {
        bg: 'var(--badge-voice-bg)',
        color: 'var(--badge-voice-text)',
        border: 'var(--badge-voice-border)',
      }
    case 'pdf':
    case 'docx':
    case 'spreadsheet':
    case 'presentation':
    case 'text':
    case 'markdown':
    case 'html':
    case 'csv':
    case 'code':
    case 'image':
    case 'video':
    case 'archive':
      return {
        bg: 'var(--badge-doc-bg)',
        color: 'var(--badge-doc-text)',
        border: 'var(--badge-doc-border)',
      }
    default:
      return {
        bg: 'var(--badge-ai-bg)',
        color: 'var(--badge-ai-text)',
        border: 'var(--badge-ai-border)',
      }
  }
}

export function FileChip({ filename, kind, onRemove }: FileChipProps) {
  const colors = chipColors(kind)
  const extIdx = filename.lastIndexOf('.')
  const namePart = extIdx > 0 ? filename.slice(0, extIdx) : filename
  const extPart = extIdx > 0 ? filename.slice(extIdx) : ''

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 8px',
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        color: colors.color,
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-xs)',
        lineHeight: 1,
        maxWidth: 200,
      }}
    >
      <FileTypeIcon kind={fileTypeIconKindFromName(filename)} size={14} decorative />
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
      {extPart && <span style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>{extPart}</span>}
      <span
        role="button"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        style={{
          cursor: 'pointer',
          opacity: 0.4,
          display: 'inline-flex',
          flexShrink: 0,
          marginLeft: 2,
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '0.8'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.4'
        }}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </span>
    </span>
  )
}
