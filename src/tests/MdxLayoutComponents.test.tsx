import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  Callout,
  Cards,
  Card,
  Checklist,
  Definition,
  Hero,
  ImageText,
  Timeline,
} from '../components/mdx'
import { MdxRuntimeProvider } from '../components/mdx/context'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
}))

describe('canonical MDX layout components', () => {
  it('renders field props through the directive-quality hero renderer', () => {
    const { container } = render(
      <Hero eyebrow="研究结论" title="效果优先" subtitle="效率不是首要矛盾" meta="3 位用户" />,
    )

    expect(container.querySelector('.journal-block-hero')).toBeTruthy()
    expect(screen.getByRole('heading', { name: '效果优先' })).toBeTruthy()
  })

  it('preserves legacy nested cards, timeline desc, callout children, and checklist checked props', () => {
    const { container } = render(
      <>
        <Cards title="关键主题">
          <Card title="效果" description="优先保证质量" />
        </Cards>
        <Timeline items={[{ time: '第 3 轮', title: '答非所问', desc: '需要节点级定位' }]} />
        <Callout type="tip" title="建议">
          先定位偏差节点
        </Callout>
        <Checklist items={[{ text: '补充可观测性', checked: true }]} />
      </>,
    )

    expect(container.querySelector('.journal-block-cards')).toBeTruthy()
    expect(container.querySelector('.journal-block-timeline')).toBeTruthy()
    expect(container.querySelector('.journal-block-callout-tip')).toBeTruthy()
    expect(container.querySelector('[data-state="done"]')).toBeTruthy()
  })

  it('adapts object data and resolves image paths with the MDX runtime entry path', () => {
    const { container } = render(
      <MdxRuntimeProvider entryPath="/tmp/journal/2606/notes/demo.mdx">
        <Definition term="节点级可观测性" description="定位多轮对话偏差发生在哪个节点。" />
        <ImageText image="../raw/trace.png" title="调用链" text="逐节点查看输入与输出。" />
      </MdxRuntimeProvider>,
    )

    expect(screen.getByRole('heading', { name: '节点级可观测性' })).toBeTruthy()
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'asset:///tmp/journal/2606/raw/trace.png',
    )
  })
})
