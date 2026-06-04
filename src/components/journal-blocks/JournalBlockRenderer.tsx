import type { JournalBlock, LayoutIssue } from '../../lib/journalLayout'
import { getLayoutModuleSpec } from '../../lib/journalLayout'
import '../../styles/journal-blocks.css'
import { BlockError } from './BlockError'
import { ComingSoonBlock } from './ComingSoonBlock'
import { FaqBlock } from './conversion'
import { CalloutBlock } from './enhanced'
import { ImageTextBlock, QuoteBlock } from './evidence'
import { MetricsBlock, StepsBlock, TimelineBlock } from './infographic'
import { VerdictBlock } from './judgment'
import { CardsBlock, HeroBlock } from './opening'
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
    case 'callout':
      return <CalloutBlock block={block} />
    case 'hero':
      return <HeroBlock block={block} />
    case 'cards':
      return <CardsBlock block={block} />
    case 'metrics':
      return <MetricsBlock block={block} />
    case 'steps':
      return <StepsBlock block={block} />
    case 'timeline':
      return <TimelineBlock block={block} />
    case 'verdict':
      return <VerdictBlock block={block} />
    case 'quote':
      return <QuoteBlock block={block} />
    case 'image-text':
      return <ImageTextBlock block={block} entryPath={entryPath} />
    case 'faq':
      return <FaqBlock block={block} />
    default:
      return <ComingSoonBlock block={block} />
  }
}
