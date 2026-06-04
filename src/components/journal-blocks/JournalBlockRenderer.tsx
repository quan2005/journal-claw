import type { JournalBlock, LayoutIssue } from '../../lib/journalLayout'
import { getLayoutModuleSpec } from '../../lib/journalLayout'
import '../../styles/journal-blocks.css'
import { AuthorCardBlock, PeopleBlock, SeriesBlock, SubscribeBlock } from './brand'
import { BlockError } from './BlockError'
import { ComingSoonBlock } from './ComingSoonBlock'
import {
  CasesBlock,
  ChecklistBlock,
  CtaBlock,
  FaqBlock,
  LogosBlock,
  NoticeBlock,
  PricingBlock,
  SpecsBlock,
  SummaryBlock,
  ToolboxBlock,
} from './conversion'
import {
  CalloutBlock,
  ChangelogBlock,
  ComparisonTableBlock,
  DefinitionBlock,
  QuestionBlock,
  QuoteCardBlock,
  ResourceListBlock,
  StatRowBlock,
  TweetBlock,
} from './enhanced'
import {
  ImageAnnotateBlock,
  ImageCompareBlock,
  ImageStepsBlock,
  ImageTextBlock,
  QuoteBlock,
} from './evidence'
import {
  CompareBlock,
  InfographicBlock,
  MetricsBlock,
  StepsBlock,
  TimelineBlock,
} from './infographic'
import {
  AudienceFitBlock,
  BridgeBlock,
  ManifestoBlock,
  MythFactBlock,
  VerdictBlock,
} from './judgment'
import { CardsBlock, HeroBlock, LabelTitleBlock, PartBlock, TocBlock } from './opening'
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
    case 'hero':
      return <HeroBlock block={block} />
    case 'toc':
      return <TocBlock block={block} />
    case 'cards':
      return <CardsBlock block={block} />
    case 'part':
      return <PartBlock block={block} />
    case 'label-title':
      return <LabelTitleBlock block={block} />
    case 'metrics':
      return <MetricsBlock block={block} />
    case 'compare':
      return <CompareBlock block={block} />
    case 'steps':
      return <StepsBlock block={block} />
    case 'timeline':
      return <TimelineBlock block={block} />
    case 'infographic':
      return <InfographicBlock block={block} />
    case 'verdict':
      return <VerdictBlock block={block} />
    case 'audience-fit':
      return <AudienceFitBlock block={block} />
    case 'myth-fact':
      return <MythFactBlock block={block} />
    case 'manifesto':
      return <ManifestoBlock block={block} />
    case 'bridge':
      return <BridgeBlock block={block} />
    case 'quote':
      return <QuoteBlock block={block} />
    case 'image-text':
      return <ImageTextBlock block={block} entryPath={entryPath} />
    case 'image-compare':
      return <ImageCompareBlock block={block} entryPath={entryPath} />
    case 'image-annotate':
      return <ImageAnnotateBlock block={block} entryPath={entryPath} />
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
    case 'notice':
      return <NoticeBlock block={block} />
    case 'logos':
      return <LogosBlock block={block} />
    case 'pricing':
      return <PricingBlock block={block} />
    case 'specs':
      return <SpecsBlock block={block} />
    case 'toolbox':
      return <ToolboxBlock block={block} />
    case 'author-card':
      return <AuthorCardBlock block={block} />
    case 'subscribe':
      return <SubscribeBlock block={block} />
    case 'people':
      return <PeopleBlock block={block} />
    case 'series':
      return <SeriesBlock block={block} />
    case 'callout':
      return <CalloutBlock block={block} />
    case 'definition':
      return <DefinitionBlock block={block} />
    case 'quote-card':
      return <QuoteCardBlock block={block} />
    case 'tweet':
      return <TweetBlock block={block} />
    case 'stat-row':
      return <StatRowBlock block={block} />
    case 'question':
      return <QuestionBlock block={block} />
    case 'resource-list':
      return <ResourceListBlock block={block} />
    case 'comparison-table':
      return <ComparisonTableBlock block={block} />
    case 'changelog':
      return <ChangelogBlock block={block} />
    default:
      return <ComingSoonBlock block={block} />
  }
}
