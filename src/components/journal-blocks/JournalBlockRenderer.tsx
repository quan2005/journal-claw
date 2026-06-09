import type { JournalBlock, LayoutIssue } from '../../lib/journalLayout'
import { getLayoutModuleSpec } from '../../lib/journalLayout'
import '../../styles/journal-blocks.css'
import { AuthorCardBlock, SubscribeBlock } from './brand'
import { BlockError } from './BlockError'
import { ComingSoonBlock } from './ComingSoonBlock'
import {
  CasesBlock,
  ChecklistBlock,
  CtaBlock,
  FaqBlock,
  SummaryBlock,
  ToolboxBlock,
} from './conversion'
import { CalloutBlock, ComparisonTableBlock, DefinitionBlock, ResourceListBlock } from './enhanced'
import { ImageStepsBlock, ImageTextBlock, QuoteBlock, QuoteCardBlock } from './evidence'
import { MetricsBlock, StepsBlock, TimelineBlock } from './infographic'
import { MythFactBlock, VerdictBlock } from './judgment'
import { CardsBlock, HeroBlock, TocBlock } from './opening'
import { UnknownBlock } from './UnknownBlock'

export function JournalBlockRenderer({
  block,
  issue,
  entryPath,
}: {
  block?: JournalBlock
  issue?: LayoutIssue
  entryPath?: string
}) {
  if (issue) return <BlockError issue={issue} />
  if (!block) return null

  const spec = getLayoutModuleSpec(block.name)
  if (!spec) return <UnknownBlock block={block} />
  if (!spec.implemented) return <ComingSoonBlock block={block} />

  switch (block.name) {
    case 'toc':
      return <TocBlock block={block} />
    case 'cards':
      return <CardsBlock block={block} />
    case 'hero':
      return <HeroBlock block={block} />
    case 'metrics':
      return <MetricsBlock block={block} />
    case 'steps':
      return <StepsBlock block={block} />
    case 'timeline':
      return <TimelineBlock block={block} />
    case 'verdict':
      return <VerdictBlock block={block} />
    case 'myth-fact':
      return <MythFactBlock block={block} />
    case 'quote':
      return <QuoteBlock block={block} />
    case 'quote-card':
      return <QuoteCardBlock block={block} />
    case 'image-text':
      return <ImageTextBlock block={block} entryPath={entryPath} />
    case 'image-steps':
      return <ImageStepsBlock block={block} entryPath={entryPath} />
    case 'cta':
      return <CtaBlock block={block} />
    case 'faq':
      return <FaqBlock block={block} />
    case 'checklist':
      return <ChecklistBlock block={block} />
    case 'cases':
      return <CasesBlock block={block} />
    case 'summary':
      return <SummaryBlock block={block} />
    case 'toolbox':
      return <ToolboxBlock block={block} />
    case 'author-card':
      return <AuthorCardBlock block={block} />
    case 'subscribe':
      return <SubscribeBlock block={block} />
    case 'callout':
      return <CalloutBlock block={block} />
    case 'definition':
      return <DefinitionBlock block={block} />
    case 'resource-list':
      return <ResourceListBlock block={block} />
    case 'comparison-table':
      return <ComparisonTableBlock block={block} />
    default:
      return <ComingSoonBlock block={block} />
  }
}
