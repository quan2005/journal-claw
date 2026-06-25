import { describe, expect, it } from 'vitest'
import {
  formatJournalMdxValidation,
  validateJournalMdxExamples,
} from '../../scripts/validate-journal-mdx-examples.mjs'

const result = validateJournalMdxExamples()

describe('Journal MDX examples', () => {
  it('uses only components from the public manifest', () => {
    expect(result.unknownTags, formatJournalMdxValidation(result)).toEqual([])
  })

  it('recommends only public components in family routing guides', () => {
    expect(result.unknownRecommendations, formatJournalMdxValidation(result)).toEqual([])
  })

  it('documents every public component exactly once in the catalog', () => {
    expect(result.missingCatalogComponents, formatJournalMdxValidation(result)).toEqual([])
    expect(result.extraCatalogComponents, formatJournalMdxValidation(result)).toEqual([])
    expect(result.duplicateCatalogComponents, formatJournalMdxValidation(result)).toEqual([])
  })

  it('covers every public component in the all-components demo', () => {
    expect(result.missingDemoComponents, formatJournalMdxValidation(result)).toEqual([])
  })
})
