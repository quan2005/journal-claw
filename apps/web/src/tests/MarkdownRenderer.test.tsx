import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderMarkdown } from '../lib/markdown'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (p: string) => `asset://${p}`,
}))

vi.mock('../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../lib/tauri')>('../lib/tauri')
  return {
    ...actual,
    getWorkspacePath: vi.fn().mockResolvedValue('/tmp/journal'),
    openFile: vi.fn().mockResolvedValue(undefined),
  }
})

describe('renderMarkdown journal detail rendering', () => {
  it('renders plain Markdown with headings and lists', () => {
    const { container } = render(
      renderMarkdown(
        `# Title

Some paragraph text with **bold**.

- item one
- item two`,
        '2026-06/2026-06-27.md',
      ),
    )

    expect(container.querySelector('h1')?.textContent).toBe('Title')
    expect(container.querySelectorAll('ul li')).toHaveLength(2)
    expect(container.querySelector('strong')?.textContent).toBe('bold')
  })

  it('strips YAML frontmatter so it never renders as prose', () => {
    const { container } = render(
      renderMarkdown(
        `---
title: Hidden
tags: [a, b]
---

# Visible heading

Body after frontmatter.`,
        '2026-06/2026-06-27.md',
      ),
    )

    expect(container.textContent).not.toContain('title: Hidden')
    expect(container.textContent).not.toContain('tags')
    expect(container.querySelector('h1')?.textContent).toBe('Visible heading')
    expect(container.textContent).toContain('Body after frontmatter.')
  })

  it('degrades legacy MDX notes to readable Markdown (Gate G)', () => {
    // A pre-retire .mdx note: frontmatter + prose + an MDX component block.
    // After MDX removal it must render without crashing, keep frontmatter out,
    // and leave the prose readable. The <Callout> JSX block is not rendered as a
    // component but the surrounding text remains legible.
    const { container } = render(
      renderMarkdown(
        `---
summary: Old MDX note
---

# Mixed note

Plain intro paragraph.

<Callout title="Note">
This used to be a rich block.
</Callout>

Trailing paragraph after the block.`,
        '2026-06/2026-06-27.mdx',
      ),
    )

    // frontmatter stripped
    expect(container.textContent).not.toContain('summary: Old MDX note')
    // heading + surrounding prose are readable
    expect(container.querySelector('h1')?.textContent).toBe('Mixed note')
    expect(container.textContent).toContain('Plain intro paragraph.')
    expect(container.textContent).toContain('Trailing paragraph after the block.')
    // the component block text degrades but does not throw
    expect(container.textContent).toContain('This used to be a rich block.')
  })
})
