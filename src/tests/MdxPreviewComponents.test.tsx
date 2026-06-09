import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HtmlPreview, MacPreview, PhonePreview, mdxComponents } from '../components/mdx'
import { getJournalEntryContent } from '../lib/tauri'

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
  it('exposes the three official Preview components only', () => {
    expect(mdxComponents.HtmlPreview).toBe(HtmlPreview)
    expect(mdxComponents.PhonePreview).toBe(PhonePreview)
    expect(mdxComponents.MacPreview).toBe(MacPreview)

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

  it('renders phone and mac preview shells with distinct classes', () => {
    const { container } = render(
      <>
        <PhonePreview size="sm">Mobile content</PhonePreview>
        <MacPreview title="Desktop content">Desktop content</MacPreview>
      </>,
    )

    expect(container.querySelector('.mdx-device-v2')).toBeTruthy()
    expect(container.querySelector('.mdx-mac-preview')).toBeTruthy()
    expect(screen.getAllByText('Desktop content')).toHaveLength(2)
  })
})
