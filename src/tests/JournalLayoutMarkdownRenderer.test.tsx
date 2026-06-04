import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../lib/markdown'

describe('Journal layout directives in Markdown', () => {
  it('renders markdown before and after a layout block', () => {
    render(
      renderMarkdown(
        `# Plain heading

:::callout tip[Careful]
Keep this renderer quiet.
:::

After block`,
        '/tmp/journal/2606/04-layout.md',
      ),
    )

    expect(screen.getByText('Plain heading')).toBeTruthy()
    expect(screen.getByText('Careful')).toBeTruthy()
    expect(screen.getByText('Keep this renderer quiet.')).toBeTruthy()
    expect(screen.getByText('After block')).toBeTruthy()
  })

  it('keeps directive-looking text inside code fences on the markdown path', () => {
    const { container } = render(
      renderMarkdown(
        `\`\`\`md
:::callout tip
not a block
:::
\`\`\``,
        '/tmp/journal/2606/04-code.md',
      ),
    )

    expect(container.querySelector('.journal-block')).toBeFalsy()
    expect(container.textContent).toContain('not a block')
  })

  it('renders local errors without dropping the rest of the document', () => {
    render(
      renderMarkdown(
        `Before

:::metrics
Only label | one value
:::

After`,
        '/tmp/journal/2606/04-error.md',
      ),
    )

    expect(screen.getByText('Before')).toBeTruthy()
    expect(screen.getByText('metrics block failed')).toBeTruthy()
    expect(screen.getByText('After')).toBeTruthy()
  })
})
