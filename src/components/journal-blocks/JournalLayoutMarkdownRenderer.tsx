import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import type { LayoutParseResult } from '../../lib/journalLayout'
import {
  createMarkdownComponents,
  type MarkdownComponentsOptions,
} from '../../lib/markdownComponents'
import { JournalBlockRenderer } from './JournalBlockRenderer'

function MarkdownSegment({
  value,
  entryPath,
  imgResolver,
}: {
  value: string
  entryPath: string
  imgResolver?: MarkdownComponentsOptions['imgResolver']
}) {
  if (!value.trim()) return null

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeHighlight, { detect: false }]]}
      components={createMarkdownComponents({
        entryPath,
        ...(imgResolver ? { imgResolver } : {}),
      })}
    >
      {value}
    </ReactMarkdown>
  )
}

export function JournalLayoutMarkdownRenderer({
  parseResult,
  entryPath,
  imgResolver,
}: {
  parseResult: LayoutParseResult
  entryPath: string
  imgResolver?: MarkdownComponentsOptions['imgResolver']
}) {
  return (
    <div className="md-content mdx-content journal-layout-content">
      {parseResult.segments.map((segment, index) => {
        if (segment.kind === 'markdown') {
          return (
            <MarkdownSegment
              key={`markdown-${index}`}
              value={segment.value}
              entryPath={entryPath}
              imgResolver={imgResolver}
            />
          )
        }

        if (segment.kind === 'error') {
          return <JournalBlockRenderer key={`error-${index}`} issue={segment.issue} />
        }

        return (
          <JournalBlockRenderer
            key={`block-${segment.block.name}-${segment.block.sourceRange.startLine}-${index}`}
            block={segment.block}
            entryPath={entryPath}
          />
        )
      })}
    </div>
  )
}
