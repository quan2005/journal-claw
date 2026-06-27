import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { MarkdownRenderer } from '../components/MarkdownRenderer'
import { createMarkdownComponents, type MarkdownComponentsOptions } from './markdownComponents'
import { stripFrontmatter } from './markdownUtils'

export { stripFrontmatter, resolveRelativePath } from './markdownUtils'
export { createMarkdownComponents } from './markdownComponents'
export type { MarkdownComponentsOptions } from './markdownComponents'

export interface RenderMarkdownOptions {
  /** Custom image resolver, used for IdentityDetail to resolve relative image paths */
  imgResolver?: (src: string, baseDir: string) => string
}

const LARGE_FILE_THRESHOLD = 100_000

/**
 * Render markdown content.
 * - Automatically strips YAML frontmatter
 * - Uses ReactMarkdown for content <= 100KB, MarkdownRenderer for larger files
 */
export function renderMarkdown(
  content: string,
  absolutePath: string,
  options?: RenderMarkdownOptions,
): React.JSX.Element {
  const cleaned = stripFrontmatter(content)
  const isLarge = content.length > LARGE_FILE_THRESHOLD

  const componentsOpts: MarkdownComponentsOptions = {
    entryPath: absolutePath,
    ...(options?.imgResolver ? { imgResolver: options.imgResolver } : {}),
  }

  if (isLarge) {
    return (
      <div className="md-body">
        <MarkdownRenderer content={cleaned} entryPath={absolutePath} />
      </div>
    )
  }

  return (
    <div className="md-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: false }]]}
        components={createMarkdownComponents(componentsOpts)}
      >
        {cleaned}
      </ReactMarkdown>
    </div>
  )
}
