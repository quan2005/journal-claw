import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MdxRenderer } from '../components/MdxRenderer'
import { createMdxComponent, toRunnableFunctionBody } from '../lib/mdxRuntime'
import { compileMdx } from '../lib/tauri'

vi.mock('../lib/tauri', () => ({
  compileMdx: vi.fn(),
  getWorkspacePath: vi.fn(async () => '/tmp/journal'),
  openFile: vi.fn(),
}))

const writeClipboardText = vi.fn()

const compiledParagraph = `import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function _createMdxContent(props) {
  const _components = Object.assign({p: "p", strong: "strong"}, props.components);
  return _jsxs(_components.p, {children: ["Hello ", _jsx(_components.strong, {children: "world"})]});
}
function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || {};
  return MDXLayout ? _jsx(MDXLayout, Object.assign({}, props, {children: _jsx(_createMdxContent, props)})) : _createMdxContent(props);
}
export default MDXContent;`

const compiledUnknown = `import { jsx as _jsx } from "react/jsx-runtime";
function _missingMdxReference(id) {
  throw new Error("Expected component \`" + id + "\` to be defined");
}
function _createMdxContent(props) {
  const {UnknownThing} = props.components || {};
  if (!UnknownThing) _missingMdxReference("UnknownThing");
  return _jsx(UnknownThing, {children: "test"});
}
function MDXContent(props = {}) {
  return _createMdxContent(props);
}
export default MDXContent;`

describe('mdxRuntime', () => {
  it('turns mdxjs output into a callable component', () => {
    const Component = createMdxComponent(compiledParagraph)
    const { container } = render(<Component components={{}} />)

    expect(container.textContent).toContain('Hello world')
  })

  it('rejects unsupported module output', () => {
    expect(() => toRunnableFunctionBody('export const x = 1')).toThrow('unsupported module shape')
  })
})

describe('MdxRenderer', () => {
  beforeEach(() => {
    vi.mocked(compileMdx).mockReset()
    writeClipboardText.mockReset()
    writeClipboardText.mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeClipboardText },
      configurable: true,
    })
  })

  it('renders compiled MDX content', async () => {
    vi.mocked(compileMdx).mockResolvedValue(compiledParagraph)

    const { container } = render(<MdxRenderer content="Hello **world**" />)

    await waitFor(() => {
      expect(container.textContent).toContain('Hello world')
    })
  })

  it('shows an error for unknown components', async () => {
    vi.mocked(compileMdx).mockResolvedValue(compiledUnknown)

    render(<MdxRenderer content="<UnknownThing>test</UnknownThing>" />)

    await waitFor(() => {
      expect(screen.getByText(/MDX render failed/)).toBeTruthy()
    })
  })

  it('dispatches media seek events from timestamp links', async () => {
    const compiledTimestamp = `import { jsx as _jsx } from "react/jsx-runtime";
function _createMdxContent(props) {
  const {TimestampLink} = props.components || {};
  return _jsx(TimestampLink, {src: "2605/raw/meeting.m4a", time: "00:12", children: "jump"});
}
function MDXContent(props = {}) {
  return _createMdxContent(props);
}
export default MDXContent;`
    vi.mocked(compileMdx).mockResolvedValue(compiledTimestamp)
    const handler = vi.fn()
    window.addEventListener('mdx-media-seek', handler)

    render(
      <MdxRenderer content="<TimestampLink src='2605/raw/meeting.m4a' time='00:12'>jump</TimestampLink>" />,
    )

    await waitFor(() => screen.getByText('jump'))
    screen.getByText('jump').click()

    expect(handler).toHaveBeenCalled()
    expect(handler.mock.calls[0][0].detail.seconds).toBe(12)
    window.removeEventListener('mdx-media-seek', handler)
  })

  it('copies read-only MDX text affordances', async () => {
    const compiledCopy = `import { jsx as _jsx } from "react/jsx-runtime";
function _createMdxContent() {
  return _jsx("button", {"data-copy-text": "关键结论", children: "复制"});
}
function MDXContent(props = {}) {
  return _createMdxContent(props);
}
export default MDXContent;`
    vi.mocked(compileMdx).mockResolvedValue(compiledCopy)
    const handler = vi.fn()
    window.addEventListener('mdx-copy', handler)

    render(<MdxRenderer content="<button data-copy-text='关键结论'>复制</button>" />)

    await waitFor(() => screen.getByText('复制'))
    screen.getByText('复制').click()

    await waitFor(() => {
      expect(writeClipboardText).toHaveBeenCalledWith('关键结论')
    })
    expect(handler).toHaveBeenCalled()
    expect(handler.mock.calls[0][0].detail.text).toBe('关键结论')
    window.removeEventListener('mdx-copy', handler)
  })
})
