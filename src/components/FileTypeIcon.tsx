import type { CSSProperties } from 'react'
import type { FileTypeIconKind } from '../lib/fileTypeIconKind'

interface FileTypeIconProps {
  kind: FileTypeIconKind
  size?: number
  selected?: boolean
  decorative?: boolean
}

const ICON_LABELS: Record<FileTypeIconKind, string> = {
  folder: '文件夹',
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
  csv: 'CSV 文件',
  archive: '压缩包',
  other: '文件',
}

const ICON_PALETTES: Record<FileTypeIconKind, { fg: string; bg: string; border: string }> = {
  folder: {
    fg: '#b8782a',
    bg: 'color-mix(in srgb, #b8782a 13%, transparent)',
    border: 'color-mix(in srgb, #b8782a 28%, transparent)',
  },
  markdown: {
    fg: '#4f7684',
    bg: 'color-mix(in srgb, #4f7684 13%, transparent)',
    border: 'color-mix(in srgb, #4f7684 26%, transparent)',
  },
  mdx: {
    fg: '#3f7b8a',
    bg: 'color-mix(in srgb, #3f7b8a 13%, transparent)',
    border: 'color-mix(in srgb, #3f7b8a 28%, transparent)',
  },
  text: {
    fg: '#68737b',
    bg: 'color-mix(in srgb, #68737b 11%, transparent)',
    border: 'color-mix(in srgb, #68737b 24%, transparent)',
  },
  html: {
    fg: '#9a6a35',
    bg: 'color-mix(in srgb, #9a6a35 13%, transparent)',
    border: 'color-mix(in srgb, #9a6a35 26%, transparent)',
  },
  pdf: {
    fg: '#a24f42',
    bg: 'color-mix(in srgb, #a24f42 13%, transparent)',
    border: 'color-mix(in srgb, #a24f42 26%, transparent)',
  },
  docx: {
    fg: '#476f9d',
    bg: 'color-mix(in srgb, #476f9d 13%, transparent)',
    border: 'color-mix(in srgb, #476f9d 26%, transparent)',
  },
  spreadsheet: {
    fg: '#4f7a5c',
    bg: 'color-mix(in srgb, #4f7a5c 13%, transparent)',
    border: 'color-mix(in srgb, #4f7a5c 26%, transparent)',
  },
  csv: {
    fg: '#5f7f4f',
    bg: 'color-mix(in srgb, #5f7f4f 13%, transparent)',
    border: 'color-mix(in srgb, #5f7f4f 26%, transparent)',
  },
  presentation: {
    fg: '#a16544',
    bg: 'color-mix(in srgb, #a16544 13%, transparent)',
    border: 'color-mix(in srgb, #a16544 26%, transparent)',
  },
  image: {
    fg: '#657a42',
    bg: 'color-mix(in srgb, #657a42 13%, transparent)',
    border: 'color-mix(in srgb, #657a42 26%, transparent)',
  },
  audio: {
    fg: '#9b7332',
    bg: 'color-mix(in srgb, #9b7332 13%, transparent)',
    border: 'color-mix(in srgb, #9b7332 26%, transparent)',
  },
  video: {
    fg: '#7a678d',
    bg: 'color-mix(in srgb, #7a678d 13%, transparent)',
    border: 'color-mix(in srgb, #7a678d 26%, transparent)',
  },
  code: {
    fg: '#5f6f7a',
    bg: 'color-mix(in srgb, #5f6f7a 13%, transparent)',
    border: 'color-mix(in srgb, #5f6f7a 26%, transparent)',
  },
  archive: {
    fg: '#806b4e',
    bg: 'color-mix(in srgb, #806b4e 13%, transparent)',
    border: 'color-mix(in srgb, #806b4e 26%, transparent)',
  },
  other: {
    fg: '#6a7278',
    bg: 'color-mix(in srgb, #6a7278 10%, transparent)',
    border: 'color-mix(in srgb, #6a7278 22%, transparent)',
  },
}

const GLYPHS: Partial<Record<FileTypeIconKind, string>> = {
  markdown: 'MD',
  mdx: 'MDX',
  text: 'TXT',
  html: '<>',
  pdf: 'PDF',
  docx: 'DOC',
  spreadsheet: 'XLS',
  presentation: 'PPT',
  csv: 'CSV',
  code: '{}',
  archive: 'ZIP',
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
}: FileTypeIconProps) {
  const palette = ICON_PALETTES[kind]
  const glyph = GLYPHS[kind]
  const label = fileTypeIconLabel(kind)
  const style: CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    borderRadius: Math.max(3, Math.round(size * 0.22)),
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: selected ? 'var(--record-btn)' : palette.fg,
    background: selected ? 'var(--record-highlight)' : palette.bg,
    border: `0.5px solid ${selected ? 'color-mix(in srgb, var(--record-btn) 34%, transparent)' : palette.border}`,
    fontFamily: 'var(--font-mono)',
    fontSize: Math.max(6, Math.round(size * 0.36)),
    fontWeight: 700,
    letterSpacing: 0,
    lineHeight: 1,
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
      {glyph ? glyph : <VectorGlyph kind={kind} />}
    </span>
  )
}
