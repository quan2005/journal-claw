import type { FileKind } from '../lib/fileKind'

interface FileChipProps {
  filename: string
  kind: FileKind
  onRemove: () => void
}

const svgBase = {
  width: 12, height: 12, viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor', strokeWidth: 1.5,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
}

function FileKindIcon({ kind }: { kind: FileKind }) {
  switch (kind) {
    case 'pdf':
      return (
        <svg {...svgBase}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="12" y2="17" />
        </svg>
      )
    case 'docx':
      return (
        <svg {...svgBase}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="16" y2="17" />
        </svg>
      )
    case 'text':
    case 'markdown':
      return (
        <svg {...svgBase}>
          <rect x="4" y="4" rx="2" width="16" height="16" />
          <line x1="8" y1="9" x2="16" y2="9" />
          <line x1="8" y1="13" x2="14" y2="13" />
          <line x1="8" y1="17" x2="12" y2="17" />
        </svg>
      )
    case 'audio':
      return (
        <svg {...svgBase} fill="currentColor" stroke="none">
          <rect x="4" y="10" width="2" height="4" rx="1" />
          <rect x="8" y="6" width="2" height="12" rx="1" />
          <rect x="12" y="8" width="2" height="8" rx="1" />
          <rect x="16" y="4" width="2" height="16" rx="1" />
          <rect x="20" y="9" width="2" height="6" rx="1" />
        </svg>
      )
    case 'image':
      return (
        <svg {...svgBase}>
          <rect x="3" y="3" rx="2" width="18" height="18" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      )
    default:
      return (
        <svg {...svgBase}>
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
          <polyline points="13 2 13 9 20 9" />
        </svg>
      )
  }
}

function chipColors(kind: FileKind) {
  switch (kind) {
    case 'audio':
      return { bg: 'var(--badge-voice-bg)', color: 'var(--badge-voice-text)', border: 'var(--badge-voice-border)' }
    case 'pdf':
    case 'docx':
    case 'text':
    case 'markdown':
      return { bg: 'var(--badge-doc-bg)', color: 'var(--badge-doc-text)', border: 'var(--badge-doc-border)' }
    default:
      return { bg: 'var(--badge-ai-bg)', color: 'var(--badge-ai-text)', border: 'var(--badge-ai-border)' }
  }
}

export function FileChip({ filename, kind, onRemove }: FileChipProps) {
  const colors = chipColors(kind)

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 8px',
        borderRadius: 5,
        border: `0.5px solid ${colors.border}`,
        background: colors.bg,
        color: colors.color,
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 13,
        lineHeight: 1,
        maxWidth: 200,
      }}
    >
      <FileKindIcon kind={kind} />
      <span style={{
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: 140,
      }}>
        {filename}
      </span>
      <span
        role="button"
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        style={{
          cursor: 'pointer',
          opacity: 0.4,
          display: 'inline-flex',
          flexShrink: 0,
          marginLeft: 2,
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8' }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.4' }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </span>
    </span>
  )
}
