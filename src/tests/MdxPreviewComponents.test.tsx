import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HtmlPreview, ImageViewer, mdxComponents } from '../components/mdx'
import { getJournalEntryContent } from '../lib/tauri'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
}))

vi.mock('../components/SandboxPreview', () => ({
  SandboxPreview: ({
    html,
    title,
    style,
  }: {
    html: string
    title?: string
    style?: React.CSSProperties
  }) => (
    <div data-testid="sandbox-preview" data-title={title} data-height={style?.height}>
      {html}
    </div>
  ),
}))

vi.mock('../lib/tauri', () => ({
  getWorkspacePath: vi.fn(async () => '/tmp/journal'),
  getJournalEntryContent: vi.fn(async (path: string) => `<main>${path}</main>`),
}))

describe('MDX preview components', () => {
  it('exposes HtmlPreview as the only official Preview component', () => {
    expect(mdxComponents.HtmlPreview).toBe(HtmlPreview)

    expect(mdxComponents).not.toHaveProperty('PhonePreview')
    expect(mdxComponents).not.toHaveProperty('MacPreview')
    expect(mdxComponents).not.toHaveProperty('Phone')
    expect(mdxComponents).not.toHaveProperty('Mockup')
    expect(mdxComponents).not.toHaveProperty('DeviceShowcase')
    expect(mdxComponents).not.toHaveProperty('CanvasDiagram')
  })

  it('renders inline HTML through the sandbox preview without a device shell', () => {
    render(
      <HtmlPreview title="Inline preview" height={360}>
        {'<main><h1>Inline HTML</h1></main>'}
      </HtmlPreview>,
    )

    expect(screen.getByTestId('sandbox-preview').getAttribute('data-title')).toBe('Inline preview')
    expect(screen.getByTestId('sandbox-preview').getAttribute('data-height')).toBe('360')
    expect(screen.getByText(/Inline HTML/)).toBeTruthy()
  })

  it('resolves absolute local image paths through the Tauri asset protocol', () => {
    render(<ImageViewer src="/tmp/journal/raw/demo.png" alt="demo" />)

    expect(screen.getByRole('img', { name: 'demo' }).getAttribute('src')).toBe(
      'asset:///tmp/journal/raw/demo.png',
    )
  })

  it('loads workspace-relative HTML sources before rendering the sandbox preview', async () => {
    render(<HtmlPreview src="2606/raw/note_component_library.html" height={420} />)

    await waitFor(() => {
      expect(
        screen.getByText(/\/tmp\/journal\/2606\/raw\/note_component_library\.html/),
      ).toBeTruthy()
    })

    expect(getJournalEntryContent).toHaveBeenCalledWith(
      '/tmp/journal/2606/raw/note_component_library.html',
    )
  })
})
