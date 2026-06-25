import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  compileMdx: vi.fn(),
}))

vi.mock('../lib/tauri', () => ({
  compileMdx: mocks.compileMdx,
  getWorkspacePath: vi.fn(async () => '/tmp/journal'),
  openFile: vi.fn(),
}))

vi.mock('../components/mdx', async () => {
  const React = await import('react')
  const LazyBlock = React.lazy(async () => ({
    default: () => React.createElement('div', null, 'lazy MDX component loaded'),
  }))
  const BrokenBlock = () => {
    throw new Error('boom')
  }

  return {
    mdxComponents: { LazyBlock, BrokenBlock },
  }
})

import { MdxRenderer } from '../components/MdxRenderer'

const compiledLazyComponent = `import { jsx as _jsx } from "react/jsx-runtime";
function _createMdxContent(props) {
  const {LazyBlock} = props.components || {};
  return _jsx(LazyBlock, {});
}
function MDXContent(props = {}) {
  return _createMdxContent(props);
}
export default MDXContent;`

const compiledBrokenComponent = `import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function _createMdxContent(props) {
  const _components = Object.assign({p: "p"}, props.components);
  const {BrokenBlock} = props.components || {};
  return _jsxs(_Fragment, {children: [
    _jsx(_components.p, {children: "before"}),
    _jsx(BrokenBlock, {}),
    _jsx(_components.p, {children: "after"})
  ]});
}
function MDXContent(props = {}) {
  return _createMdxContent(props);
}
export default MDXContent;`

describe('MdxRenderer lazy MDX components', () => {
  beforeEach(() => {
    mocks.compileMdx.mockReset()
  })

  it('renders MDX components that suspend while loading', async () => {
    mocks.compileMdx.mockResolvedValue(compiledLazyComponent)

    render(<MdxRenderer content="<LazyBlock />" />)

    await waitFor(() => {
      expect(screen.getByText('lazy MDX component loaded')).toBeTruthy()
    })
    expect(screen.queryByText(/MDX render failed/)).toBeFalsy()
  })

  it('isolates component render failures without replacing the whole note', async () => {
    mocks.compileMdx.mockResolvedValue(compiledBrokenComponent)

    render(<MdxRenderer content="<BrokenBlock />" />)

    await waitFor(() => {
      expect(screen.getByText('before')).toBeTruthy()
      expect(screen.getByText('after')).toBeTruthy()
    })
    expect(screen.getByText(/BrokenBlock render failed/)).toBeTruthy()
    expect(screen.getByText('<BrokenBlock />')).toBeTruthy()
    expect(screen.queryByText(/MDX render failed/)).toBeFalsy()
  })
})
