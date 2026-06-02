import { resolveRelativePath } from './markdownUtils'

export interface JournalFileOpenDetail {
  path: string
  name: string
}

export function fileBasename(path: string): string {
  return path.split(/[\\/]/).pop() || path
}

export function isAbsoluteFilePath(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path)
}

export function resolveWorkspaceFilePath(workspacePath: string, filePath: string): string {
  const decoded = decodeURIComponent(filePath)
  if (isAbsoluteFilePath(decoded)) return decoded
  return resolveRelativePath(workspacePath, decoded)
}

export function dispatchJournalFileOpen(path: string, name = fileBasename(path)) {
  window.dispatchEvent(
    new CustomEvent<JournalFileOpenDetail>('journal-file-open', {
      detail: { path, name },
    }),
  )
}
