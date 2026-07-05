import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../lib/markdown'

describe('legacy directive syntax in Markdown', () => {
  it('treats directive-looking text as plain Markdown instead of layout components', () => {
    const { container } = render(
      renderMarkdown(
        `# Plain heading

:::callout tip[Careful]
Legacy syntax stays plain text.
:::

After block`,
        '/tmp/journal/2606/04-layout.md',
      ),
    )

    expect(screen.getByText('Plain heading')).toBeTruthy()
    expect(container.querySelector('.journal-block')).toBeFalsy()
    expect(container.textContent).toContain(':::callout tip[Careful]')
    expect(container.textContent).toContain('Legacy syntax stays plain text.')
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
})
