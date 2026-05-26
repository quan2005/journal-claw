import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MdxRenderer } from '../components/MdxRenderer'

// Mock @mdx-js/mdx evaluate
vi.mock('@mdx-js/mdx', () => ({
  evaluate: vi.fn(),
}))

describe('MdxRenderer', () => {
  it('renders simple MDX content', async () => {
    const { evaluate } = await import('@mdx-js/mdx')
    const MockContent = () => 'Hello MDX'
    ;(evaluate as ReturnType<typeof vi.fn>).mockResolvedValue({
      default: MockContent,
    })

    render(<MdxRenderer content="# Hello" />)
    await waitFor(() => {
      expect(screen.getByText('Hello MDX')).toBeTruthy()
    })
  })

  it('falls back to raw text on evaluate error', async () => {
    const { evaluate } = await import('@mdx-js/mdx')
    ;(evaluate as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('MDX compile error'),
    )

    render(<MdxRenderer content="# Hello World" />)
    await waitFor(() => {
      expect(screen.getByText('# Hello World')).toBeTruthy()
    })
  })

  it('shows fallback when MDX component throws at runtime', async () => {
    const { evaluate } = await import('@mdx-js/mdx')
    const ThrowingContent = () => {
      throw new Error('Runtime render error')
    }
    ;(evaluate as ReturnType<typeof vi.fn>).mockResolvedValue({
      default: ThrowingContent,
    })

    render(<MdxRenderer content="# Safe fallback" />)
    await waitFor(() => {
      // ErrorBoundary catches the runtime error and shows the raw content fallback
      expect(screen.getByText('# Safe fallback')).toBeTruthy()
    })
  })

  it('shows loading state while evaluate is pending', async () => {
    const { evaluate } = await import('@mdx-js/mdx')
    let resolveEvaluate: (value: unknown) => void
    const evaluatePromise = new Promise((resolve) => {
      resolveEvaluate = resolve
    })
    ;(evaluate as ReturnType<typeof vi.fn>).mockReturnValue(evaluatePromise)

    render(<MdxRenderer content="# Loading test" />)

    // Loading state should be visible before evaluate resolves
    expect(document.querySelector('.md-content--loading')).toBeTruthy()

    // Resolve evaluate
    const MockContent = () => 'Loaded'
    resolveEvaluate!({ default: MockContent })

    // Content should appear after resolve
    await waitFor(() => {
      expect(screen.getByText('Loaded')).toBeTruthy()
    })
  })
})
