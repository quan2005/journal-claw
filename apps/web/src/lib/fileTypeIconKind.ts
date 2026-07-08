import { fileKindFromName, type FileKind } from './fileKind'

export type FileTypeIconKind = FileKind | 'folder' | 'folder-open' | 'mdx'

export function fileTypeIconKindFromName(filename: string): FileTypeIconKind {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'mdx') return 'mdx'
  return fileKindFromName(filename)
}
