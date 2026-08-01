import type { CSSProperties } from 'react'
import type { FileTypeIconKind } from '../lib/fileTypeIconKind'

interface FileTypeIconProps {
  kind: FileTypeIconKind
  size?: number
  selected?: boolean
  decorative?: boolean
  variant?: 'glyph-tile'
}

const ICON_LABELS: Record<FileTypeIconKind, string> = {
  folder: '文件夹',
  'folder-open': '已展开的文件夹',
  audio: '音频文件',
  video: '视频文件',
  text: '文本文件',
  mdx: 'MDX 文件',
  markdown: 'Markdown 文件',
  pdf: 'PDF 文件',
  docx: 'Word 文件',
  spreadsheet: '表格文件',
  presentation: '演示文件',
  image: '图片文件',
  html: 'HTML 文件',
  code: '代码文件',
  config: '配置文件',
  csv: 'CSV 文件',
  archive: '压缩包',
  other: '文件',
}

const FOLDER_PALETTE = {
  fg: 'var(--file-default)',
  bg: 'color-mix(in srgb, var(--file-default) 13%, transparent)',
  border: 'color-mix(in srgb, var(--file-default) 28%, transparent)',
}

const HTML_TILE_PALETTE = {
  fg: 'var(--file-html)',
  bg: 'color-mix(in srgb, var(--file-html) 13%, transparent)',
  border: 'color-mix(in srgb, var(--file-html) 26%, transparent)',
}

const ICON_PALETTES: Record<FileTypeIconKind, { fg: string; bg: string; border: string }> = {
  folder: FOLDER_PALETTE,
  'folder-open': FOLDER_PALETTE,
  markdown: {
    fg: 'var(--file-markdown)',
    bg: 'color-mix(in srgb, var(--file-markdown) 13%, transparent)',
    border: 'color-mix(in srgb, var(--file-markdown) 26%, transparent)',
  },
  mdx: {
    fg: 'var(--file-markdown)',
    bg: 'color-mix(in srgb, var(--file-markdown) 13%, transparent)',
    border: 'color-mix(in srgb, var(--file-markdown) 28%, transparent)',
  },
  text: {
    fg: 'var(--file-default)',
    bg: 'color-mix(in srgb, var(--file-default) 11%, transparent)',
    border: 'color-mix(in srgb, var(--file-default) 24%, transparent)',
  },
  html: {
    fg: 'var(--file-default)',
    bg: 'color-mix(in srgb, var(--file-default) 13%, transparent)',
    border: 'color-mix(in srgb, var(--file-default) 26%, transparent)',
  },
  pdf: {
    fg: 'var(--file-pdf)',
    bg: 'color-mix(in srgb, var(--file-pdf) 13%, transparent)',
    border: 'color-mix(in srgb, var(--file-pdf) 26%, transparent)',
  },
  docx: {
    fg: 'var(--file-docx)',
    bg: 'color-mix(in srgb, var(--file-docx) 13%, transparent)',
    border: 'color-mix(in srgb, var(--file-docx) 26%, transparent)',
  },
  spreadsheet: {
    fg: 'var(--file-image)',
    bg: 'color-mix(in srgb, var(--file-image) 13%, transparent)',
    border: 'color-mix(in srgb, var(--file-image) 26%, transparent)',
  },
  csv: {
    fg: 'var(--file-image)',
    bg: 'color-mix(in srgb, var(--file-image) 13%, transparent)',
    border: 'color-mix(in srgb, var(--file-image) 26%, transparent)',
  },
  presentation: {
    fg: 'var(--file-default)',
    bg: 'color-mix(in srgb, var(--file-default) 13%, transparent)',
    border: 'color-mix(in srgb, var(--file-default) 26%, transparent)',
  },
  image: {
    fg: 'var(--file-image)',
    bg: 'color-mix(in srgb, var(--file-image) 13%, transparent)',
    border: 'color-mix(in srgb, var(--file-image) 26%, transparent)',
  },
  audio: {
    fg: 'var(--file-audio)',
    bg: 'color-mix(in srgb, var(--file-audio) 13%, transparent)',
    border: 'color-mix(in srgb, var(--file-audio) 26%, transparent)',
  },
  video: {
    fg: 'var(--file-audio)',
    bg: 'color-mix(in srgb, var(--file-audio) 13%, transparent)',
    border: 'color-mix(in srgb, var(--file-audio) 26%, transparent)',
  },
  code: {
    fg: 'var(--file-default)',
    bg: 'color-mix(in srgb, var(--file-default) 13%, transparent)',
    border: 'color-mix(in srgb, var(--file-default) 26%, transparent)',
  },
  config: {
    fg: 'var(--file-default)',
    bg: 'color-mix(in srgb, var(--file-default) 13%, transparent)',
    border: 'color-mix(in srgb, var(--file-default) 26%, transparent)',
  },
  archive: {
    fg: 'var(--file-default)',
    bg: 'color-mix(in srgb, var(--file-default) 13%, transparent)',
    border: 'color-mix(in srgb, var(--file-default) 26%, transparent)',
  },
  other: {
    fg: 'var(--file-default)',
    bg: 'color-mix(in srgb, var(--file-default) 10%, transparent)',
    border: 'color-mix(in srgb, var(--file-default) 22%, transparent)',
  },
}

const svgBase = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function fileTypeIconLabel(kind: FileTypeIconKind): string {
  return ICON_LABELS[kind]
}

function VectorGlyph({ kind }: { kind: FileTypeIconKind }) {
  if (kind === 'folder') {
    return (
      <svg {...svgBase} width="72%" height="72%" aria-hidden="true">
        <path d="M3 6.5h6l2 2H21v9.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <path d="M3 9h18" />
      </svg>
    )
  }

  if (kind === 'folder-open') {
    return (
      <svg {...svgBase} width="72%" height="72%" aria-hidden="true">
        <path d="M3 8.5V6.5a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2H8.5a1.5 1.5 0 0 0-1.4 1L4 18.5" />
        <path d="M4 18.5 6 10h14.5a1 1 0 0 1 .97 1.24L20 18.5a2 2 0 0 1-2 1.5H6a2 2 0 0 1-2-1.5Z" />
      </svg>
    )
  }

  if (kind === 'image') {
    return (
      <svg {...svgBase} width="72%" height="72%" aria-hidden="true">
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <circle cx="9" cy="10" r="1.5" />
        <path d="M6.5 18 12 13l2.5 2.5L17 12l3 4" />
      </svg>
    )
  }

  if (kind === 'audio') {
    return (
      <svg viewBox="0 0 24 24" width="72%" height="72%" fill="currentColor" aria-hidden="true">
        <rect x="4" y="10" width="2.2" height="4" rx="1.1" />
        <rect x="8" y="7" width="2.2" height="10" rx="1.1" />
        <rect x="12" y="4" width="2.2" height="16" rx="1.1" />
        <rect x="16" y="8" width="2.2" height="8" rx="1.1" />
        <rect x="20" y="11" width="2.2" height="2" rx="1" />
      </svg>
    )
  }

  if (kind === 'video') {
    return (
      <svg {...svgBase} width="72%" height="72%" aria-hidden="true">
        <rect x="4" y="6" width="16" height="12" rx="2" />
        <path d="m11 10 4 2-4 2z" fill="currentColor" stroke="none" />
      </svg>
    )
  }

  if (kind === 'markdown' || kind === 'mdx' || kind === 'text') {
    return (
      <svg {...svgBase} width="72%" height="72%" aria-hidden="true">
        <path d="M4 6h16M4 12h10M4 18h7" />
      </svg>
    )
  }
  if (kind === 'code') {
    return (
      <svg {...svgBase} width="72%" height="72%" aria-hidden="true">
        <path d="m9 8-4 4 4 4M15 8l4 4-4 4" />
      </svg>
    )
  }
  if (kind === 'config') {
    return (
      <svg {...svgBase} width="72%" height="72%" aria-hidden="true">
        <path d="M8 4h8M8 20h8M6 4c0 4-3 4-3 8s3 4 3 8M18 4c0 4 3 4 3 8s-3 4-3 8" />
      </svg>
    )
  }
  if (kind === 'html') {
    return (
      <svg {...svgBase} width="72%" height="72%" aria-hidden="true">
        <path d="m8 7-5 5 5 5M16 7l5 5-5 5M13 6l-2 12" />
      </svg>
    )
  }
  if (kind === 'pdf' || kind === 'docx') {
    return (
      <svg {...svgBase} width="72%" height="72%" aria-hidden="true">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5M8 13h8M8 17h5" />
      </svg>
    )
  }
  if (kind === 'spreadsheet' || kind === 'csv') {
    return (
      <svg {...svgBase} width="72%" height="72%" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M4 10h16M4 15h16M10 4v16M15 4v16" />
      </svg>
    )
  }
  if (kind === 'presentation') {
    return (
      <svg {...svgBase} width="72%" height="72%" aria-hidden="true">
        <rect x="3" y="5" width="18" height="12" rx="1" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    )
  }
  if (kind === 'archive') {
    return (
      <svg {...svgBase} width="72%" height="72%" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M12 4v16M9 8h1M9 12h1M9 16h1" />
      </svg>
    )
  }

  return (
    <svg {...svgBase} width="72%" height="72%" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  )
}

export function FileTypeIcon({
  kind,
  size = 18,
  selected = false,
  decorative = false,
  variant,
}: FileTypeIconProps) {
  const palette =
    variant === 'glyph-tile' && kind === 'html' ? HTML_TILE_PALETTE : ICON_PALETTES[kind]
  const label = fileTypeIconLabel(kind)

  if (variant === 'glyph-tile') {
    const foreground = selected ? 'var(--item-selected-text)' : palette.fg
    const background = selected
      ? 'color-mix(in srgb, var(--item-selected-text) 12%, transparent)'
      : palette.bg
    const border = selected
      ? '1px solid color-mix(in srgb, var(--item-selected-text) 28%, transparent)'
      : `1px solid ${palette.border}`
    const tileStyle: CSSProperties = {
      width: size,
      height: size,
      minWidth: size,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      border,
      borderRadius: 'var(--radius-sm)',
      color: foreground,
      background,
      userSelect: 'none',
    }

    return (
      <span
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : label}
        aria-hidden={decorative ? true : undefined}
        title={decorative ? undefined : label}
        data-file-kind={kind}
        data-file-icon-variant={variant}
        style={tileStyle}
      >
        <VectorGlyph kind={kind} />
      </span>
    )
  }

  const style: CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: selected ? 'var(--record-btn)' : palette.fg,
    userSelect: 'none',
  }

  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      title={decorative ? undefined : label}
      style={style}
    >
      <VectorGlyph kind={kind} />
    </span>
  )
}
