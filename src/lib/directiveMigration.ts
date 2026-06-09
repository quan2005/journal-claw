import type { ApplyDirectiveMigrationResult, LegacyDirectiveFile } from '../types'
import {
  applyDirectiveMigration,
  compileMdx,
  getJournalEntryContent,
  scanLegacyDirectiveFiles,
} from './tauri'
import { convertLegacyDirectivesToJsx } from './legacyDirectives'

export interface DirectiveMigrationPreviewFile {
  sourcePath: string
  destinationPath: string
  relativePath: string
  content: string
  convertedCount: number
}

export interface DirectiveMigrationFailure {
  path: string
  relativePath: string
  error: string
}

export interface DirectiveMigrationPreview {
  candidates: LegacyDirectiveFile[]
  valid: DirectiveMigrationPreviewFile[]
  failed: DirectiveMigrationFailure[]
}

export interface DirectiveMigrationApplyResult {
  converted: ApplyDirectiveMigrationResult[]
  skipped: string[]
  failed: Array<{ path: string; error: string }>
}

function destinationFor(candidate: LegacyDirectiveFile): string {
  return candidate.extension === 'md' ? candidate.path.replace(/\.md$/i, '.mdx') : candidate.path
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function previewDirectiveMigration(): Promise<DirectiveMigrationPreview> {
  const candidates = await scanLegacyDirectiveFiles()
  const valid: DirectiveMigrationPreviewFile[] = []
  const failed: DirectiveMigrationFailure[] = []

  for (const candidate of candidates) {
    try {
      const source = await getJournalEntryContent(candidate.path)
      const converted = convertLegacyDirectivesToJsx(source)
      if (converted.errors.length > 0 || converted.convertedCount === 0) {
        failed.push({
          path: candidate.path,
          relativePath: candidate.relative_path,
          error:
            converted.errors.map((issue) => issue.message).join('; ') ||
            'No supported legacy directives were found.',
        })
        continue
      }

      const destinationPath = destinationFor(candidate)
      await compileMdx(converted.source, destinationPath)
      valid.push({
        sourcePath: candidate.path,
        destinationPath,
        relativePath: candidate.relative_path,
        content: converted.source,
        convertedCount: converted.convertedCount,
      })
    } catch (error) {
      failed.push({
        path: candidate.path,
        relativePath: candidate.relative_path,
        error: errorMessage(error),
      })
    }
  }

  return { candidates, valid, failed }
}

export async function applyDirectiveMigrationPreview(
  preview: DirectiveMigrationPreview,
  selectedSourcePaths = preview.valid.map((file) => file.sourcePath),
): Promise<DirectiveMigrationApplyResult> {
  const selected = new Set(selectedSourcePaths)
  const converted: ApplyDirectiveMigrationResult[] = []
  const failed: Array<{ path: string; error: string }> = []

  for (const file of preview.valid) {
    if (!selected.has(file.sourcePath)) continue
    try {
      converted.push(
        await applyDirectiveMigration({
          source_path: file.sourcePath,
          destination_path: file.destinationPath,
          content: file.content,
        }),
      )
    } catch (error) {
      failed.push({ path: file.sourcePath, error: errorMessage(error) })
    }
  }

  const attempted = new Set(
    preview.valid.filter((file) => selected.has(file.sourcePath)).map((file) => file.sourcePath),
  )
  const skipped = preview.candidates.map((file) => file.path).filter((path) => !attempted.has(path))

  return { converted, skipped, failed }
}
