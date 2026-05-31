import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CanvasDiagram } from '../components/mdx/canvas-diagram'

describe('MDX browser-backed components', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows a local canvas error when 2D rendering is unavailable', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)

    render(
      <CanvasDiagram nodes={[{ id: 'a', label: 'Start' }]} edges={[]} caption="Canvas fallback" />,
    )

    await waitFor(() => {
      expect(screen.getByText(/Canvas render failed/)).toBeTruthy()
    })
    expect(screen.getByText('Canvas fallback')).toBeTruthy()
  })
})
