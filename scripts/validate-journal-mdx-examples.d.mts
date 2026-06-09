export interface JournalMdxTagIssue {
  file: string
  tags: string[]
}

export interface JournalMdxRecommendationIssue {
  file: string
  line: number
  names: string[]
}

export interface JournalMdxValidationResult {
  repoRoot: string
  publicComponents: string[]
  ownedFileCount: number
  unknownTags: JournalMdxTagIssue[]
  unknownRecommendations: JournalMdxRecommendationIssue[]
  missingCatalogComponents: string[]
  extraCatalogComponents: string[]
  duplicateCatalogComponents: string[]
  missingDemoComponents: string[]
}

export function extractPascalCaseJsxTags(source: string): string[]

export function validateJournalMdxExamples(options?: {
  repoRoot?: string
}): JournalMdxValidationResult

export function formatJournalMdxValidation(result: JournalMdxValidationResult): string
