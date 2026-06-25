import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MdxRuntimeProvider } from '../components/mdx/context'
import { useMdxAsset, useMdxRuntime } from '../components/mdx/runtimeContext'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
}))

function RuntimeProbe() {
  const { entryPath } = useMdxRuntime()
  const asset = useMdxAsset('../raw/demo.png')

  return <output>{`${entryPath}|${asset}`}</output>
}

describe('MDX runtime context', () => {
  it('resolves relative assets from the current MDX entry path', () => {
    render(
      <MdxRuntimeProvider entryPath="/tmp/journal/2606/notes/demo.mdx">
        <RuntimeProbe />
      </MdxRuntimeProvider>,
    )

    expect(
      screen.getByText('/tmp/journal/2606/notes/demo.mdx|asset:///tmp/journal/2606/raw/demo.png'),
    ).toBeTruthy()
  })
})
