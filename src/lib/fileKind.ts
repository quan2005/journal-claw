export type FileKind =
  | 'audio'
  | 'text'
  | 'markdown'
  | 'pdf'
  | 'docx'
  | 'image'
  | 'html'
  | 'code'
  | 'csv'
  | 'other'

/** Classify a file by its extension (mirrors Rust material_kind) */
export function fileKindFromName(filename: string): FileKind {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  switch (ext) {
    case 'm4a':
    case 'wav':
    case 'mp3':
    case 'aac':
    case 'ogg':
    case 'flac':
      return 'audio'
    case 'txt':
      return 'text'
    case 'md':
    case 'markdown':
      return 'markdown'
    case 'pdf':
      return 'pdf'
    case 'docx':
    case 'doc':
      return 'docx'
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'svg':
    case 'bmp':
      return 'image'
    case 'html':
    case 'htm':
      return 'html'
    case 'csv':
      return 'csv'
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'rs':
    case 'py':
    case 'css':
    case 'json':
    case 'xml':
    case 'yaml':
    case 'yml':
    case 'toml':
    case 'sh':
    case 'bash':
    case 'zsh':
    case 'sql':
    case 'go':
    case 'java':
    case 'kt':
    case 'kts':
    case 'swift':
    case 'c':
    case 'cpp':
    case 'h':
    case 'rb':
    case 'php':
    case 'lua':
    case 'scss':
    case 'less':
    case 'vue':
    case 'svelte':
      return 'code'
    default:
      return 'other'
  }
}
