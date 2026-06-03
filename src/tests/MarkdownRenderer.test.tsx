import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MarkdownRenderer } from '../components/MarkdownRenderer'

vi.mock('../components/mdx/mermaidRuntime', async () => {
  const actual =
    await vi.importActual<typeof import('../components/mdx/mermaidRuntime')>(
      '../components/mdx/mermaidRuntime',
    )

  return {
    ...actual,
    renderMermaidToElement: vi.fn(
      async ({ element, source }: { element: HTMLElement; source: string }) => {
        const normalizedSource = actual.normalizeMermaidSource(source)
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        svg.textContent = normalizedSource
        element.replaceChildren(svg)
        return {
          diagramType: actual.detectMermaidType(normalizedSource),
          source: normalizedSource,
        }
      },
    ),
  }
})

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
}))

vi.mock('../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../lib/tauri')>('../lib/tauri')
  return {
    ...actual,
    getWorkspacePath: vi.fn().mockResolvedValue('/tmp/journal'),
    openFile: vi.fn().mockResolvedValue(undefined),
  }
})

describe('MarkdownRenderer', () => {
  it('renders fenced mermaid code blocks as diagrams', async () => {
    const { container } = render(
      <MarkdownRenderer
        content={`# Diagram

\`\`\`mermaid
flowchart TD
  A[输入] --> B[输出]
\`\`\``}
      />,
    )

    await waitFor(() => {
      expect(screen.queryByText('Diagram render failed')).toBeFalsy()
      expect(container.querySelector('.mdx-mermaid-svg svg')).toBeTruthy()
    })
  })
})
