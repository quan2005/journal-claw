import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MdxRenderer } from '../components/MdxRenderer'
import { createMdxComponent, toRunnableFunctionBody } from '../lib/mdxRuntime'
import { openFile } from '../lib/tauri'
import type { MdxDocumentResult } from '../lib/mdx'

vi.mock('../lib/tauri', () => ({
  compileMdx: vi.fn(),
  getWorkspacePath: vi.fn(async () => '/tmp/journal'),
  openFile: vi.fn(),
}))

vi.mock('../lib/mdx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/mdx')>()
  return {
    ...actual,
    compileMdxDocument: vi.fn(),
  }
})

import { compileMdxDocument } from '../lib/mdx'

/** Build a single-block MdxDocumentResult from a compiled JS string */
function makeDocResult(compiledJs: string): MdxDocumentResult {
  const component = createMdxComponent(compiledJs)
  return {
    blocks: [
      {
        block: { source: '', startLine: 1, endLine: 1, kind: 'jsx' },
        level: 'L0',
        component,
      },
    ],
    scope: { esmBlocks: [], linkDefinitions: [], footnoteDefinitions: [] },
    hasDegradation: false,
  }
}

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
    vi.mocked(compileMdxDocument).mockReset()
    vi.mocked(openFile).mockReset()
    writeClipboardText.mockReset()
    writeClipboardText.mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeClipboardText },
      configurable: true,
    })
  })

  it('renders compiled MDX content', async () => {
    vi.mocked(compileMdxDocument).mockResolvedValue(makeDocResult(compiledParagraph))

    const { container } = render(<MdxRenderer content="Hello **world**" />)

    await waitFor(() => {
      expect(container.textContent).toContain('Hello world')
    })
  })

  it('keeps unknown components localized instead of failing the whole document', async () => {
    const compiledUnknownAmongMarkdown = `import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function _missingMdxReference(id) {
  throw new Error("Expected component \`" + id + "\` to be defined");
}
function _createMdxContent(props) {
  const _components = Object.assign({p: "p"}, props.components), {UnknownThing} = _components;
  if (!UnknownThing) _missingMdxReference("UnknownThing");
  return _jsxs(_Fragment, {children: [
    _jsx(_components.p, {children: "before"}),
    _jsx(UnknownThing, {children: "test"}),
    _jsx(_components.p, {children: "after"})
  ]});
}
function MDXContent(props = {}) {
  return _createMdxContent(props);
}
export default MDXContent;`
    vi.mocked(compileMdxDocument).mockResolvedValue(makeDocResult(compiledUnknownAmongMarkdown))

    render(
      <MdxRenderer
        content={`before

<UnknownThing>test</UnknownThing>

after`}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('before')).toBeTruthy()
      expect(screen.getByText('after')).toBeTruthy()
      expect(screen.getByText(/UnknownThing component is not available/)).toBeTruthy()
      expect(screen.getByText('<UnknownThing>test</UnknownThing>')).toBeTruthy()
      expect(screen.queryByText(/MDX render failed/)).toBeFalsy()
    })
  })

  it('localizes removed showcase components and shows their source code', async () => {
    const compiledRemovedComponents = `import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function _missingMdxReference(id) {
  throw new Error("Expected component \`" + id + "\` to be defined");
}
function _createMdxContent(props) {
  const _components = Object.assign({p: "p"}, props.components);
  const {CanvasDiagram, DeviceShowcase, Phone} = _components;
  if (!CanvasDiagram) _missingMdxReference("CanvasDiagram");
  if (!DeviceShowcase) _missingMdxReference("DeviceShowcase");
  if (!Phone) _missingMdxReference("Phone");
  return _jsxs(_Fragment, {children: [
    _jsx(_components.p, {children: "before"}),
    _jsx(CanvasDiagram, {caption: "旧图示"}),
    _jsx(DeviceShowcase, {children: _jsx(Phone, {size: "sm", children: "old phone"})}),
    _jsx(_components.p, {children: "after"})
  ]});
}
function MDXContent(props = {}) {
  return _createMdxContent(props);
}
export default MDXContent;`
    vi.mocked(compileMdxDocument).mockResolvedValue(makeDocResult(compiledRemovedComponents))

    render(
      <MdxRenderer
        content={`before

<CanvasDiagram caption="旧图示" />

<DeviceShowcase>
  <Phone size="sm">old phone</Phone>
</DeviceShowcase>

after`}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('before')).toBeTruthy()
      expect(screen.getByText('after')).toBeTruthy()
      expect(screen.getByText(/CanvasDiagram component is not available/)).toBeTruthy()
      expect(screen.getByText(/DeviceShowcase component is not available/)).toBeTruthy()
      expect(screen.getByText('<CanvasDiagram caption="旧图示" />')).toBeTruthy()
      expect(screen.getByText(/<DeviceShowcase>/)).toBeTruthy()
      expect(screen.queryByText(/MDX render failed/)).toBeFalsy()
    })
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
    vi.mocked(compileMdxDocument).mockResolvedValue(makeDocResult(compiledCopy))
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

  it('renders lazy chart components from compiled MDX', async () => {
    const compiledChart = `import { jsx as _jsx } from "react/jsx-runtime";
function _createMdxContent(props) {
  const {BarChart} = props.components || {};
  return _jsx(BarChart, {title: "测试图表", data: [{label: "A", value: 1}]});
}
function MDXContent(props = {}) {
  return _createMdxContent(props);
}
export default MDXContent;`
    vi.mocked(compileMdxDocument).mockResolvedValue(makeDocResult(compiledChart))

    render(<MdxRenderer content="<BarChart title='测试图表' data={[{label:'A', value:1}]} />" />)

    await waitFor(() => {
      expect(screen.queryByText(/MDX render failed/)).toBeFalsy()
    })
  })

  it('renders compiled dollar math through KaTeX components', async () => {
    const compiledMath = `import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function _createMdxContent(props) {
  const _components = Object.assign({p: "p", code: "code", pre: "pre"}, props.components);
  return _jsxs(_Fragment, {children: [
    _jsxs(_components.p, {children: ["Inline ", _jsx(_components.code, {className: "language-math math-inline", children: "d_{model}"})]}),
    _jsx(_components.pre, {children: _jsx(_components.code, {className: "language-math math-display", children: "PE_{pos}=\\\\sin(x)"})})
  ]});
}
function MDXContent(props = {}) {
  return _createMdxContent(props);
}
export default MDXContent;`
    vi.mocked(compileMdxDocument).mockResolvedValue(makeDocResult(compiledMath))

    const { container } = render(<MdxRenderer content="$d_{model}$" />)

    await waitFor(() => {
      expect(container.querySelectorAll('.katex').length).toBeGreaterThanOrEqual(2)
      expect(screen.queryByText(/MDX render failed/)).toBeFalsy()
    })
  })

  it('renders generated latex delimiter components without a whole-document failure', async () => {
    const compiledMathComponent = `import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function _createMdxContent(props) {
  const {InlineMath, BlockMath} = props.components || {};
  return _jsxs(_Fragment, {children: [
    _jsx(InlineMath, {math: "d_{model} = 512"}),
    _jsx(BlockMath, {math: "\\\\text{Attention}(Q,K,V)"})
  ]});
}
function MDXContent(props = {}) {
  return _createMdxContent(props);
}
export default MDXContent;`
    vi.mocked(compileMdxDocument).mockResolvedValue(makeDocResult(compiledMathComponent))

    const { container } = render(<MdxRenderer content="\\(d_{model}\\)" />)

    await waitFor(() => {
      expect(container.querySelectorAll('.katex').length).toBeGreaterThanOrEqual(2)
      expect(screen.queryByText(/MDX render failed/)).toBeFalsy()
    })
  })

  it('opens local file cards inside JournalClaw instead of the system app', async () => {
    const compiledLocalFile = `import { jsx as _jsx } from "react/jsx-runtime";
function _createMdxContent() {
  return _jsx("a", {"data-filepath": "topics/mdx-support-manual/components/HtmlPreview.mdx", children: "HtmlPreview.mdx"});
}
function MDXContent(props = {}) {
  return _createMdxContent(props);
}
export default MDXContent;`
    vi.mocked(compileMdxDocument).mockResolvedValue(makeDocResult(compiledLocalFile))
    const handler = vi.fn()
    window.addEventListener('journal-file-open', handler)

    render(
      <MdxRenderer
        content="<FileCard path='topics/mdx-support-manual/components/HtmlPreview.mdx' />"
        entryPath="/tmp/journal/topics/mdx-support-manual/components/HtmlPreview.mdx"
      />,
    )

    await waitFor(() => screen.getByText('HtmlPreview.mdx'))
    screen.getByText('HtmlPreview.mdx').click()

    await waitFor(() => {
      expect(handler).toHaveBeenCalled()
    })
    expect(handler.mock.calls[0][0].detail).toMatchObject({
      path: '/tmp/journal/topics/mdx-support-manual/components/HtmlPreview.mdx',
      name: 'HtmlPreview.mdx',
    })
    expect(openFile).not.toHaveBeenCalled()
    window.removeEventListener('journal-file-open', handler)
  })

  it('passes MDX source to the compiler without legacy directive transforms', async () => {
    vi.mocked(compileMdxDocument).mockResolvedValue(makeDocResult(compiledParagraph))

    const content = `Before

:::callout tip[Legacy syntax]
This must not be transformed at render time.
:::

After`
    render(<MdxRenderer content={content} entryPath="/tmp/journal/2606/04-layout.mdx" />)

    await waitFor(() => {
      expect(compileMdxDocument).toHaveBeenCalled()
    })

    expect(vi.mocked(compileMdxDocument).mock.calls[0][0]).toBe(content)
  })
})
