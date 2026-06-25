import mermaid from 'mermaid'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeMermaidSource, renderMermaidToElement } from '../components/mdx/mermaidRuntime'

const mermaidMockState = vi.hoisted(() => ({
  firstRunNode: null as HTMLElement | null,
  config: null as { deterministicIds?: boolean; deterministicIDSeed?: string } | null,
  runTargetsBySeed: new Map<number, HTMLElement>(),
}))

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn((config: { deterministicIds?: boolean; deterministicIDSeed?: string }) => {
      mermaidMockState.config = config
    }),
    render: vi.fn(async (id: string, source: string, container?: HTMLElement) => {
      if (container) {
        throw new Error("null is not an object (evaluating 'element.firstChild')")
      }
      return {
        svg: `<svg data-render-id="${id}"><text>${source}</text></svg>`,
      }
    }),
    run: vi.fn(async ({ nodes }: { nodes?: ArrayLike<HTMLElement> }) => {
      const [node] = Array.from(nodes ?? [])
      if (!node) return
      const seedLength = mermaidMockState.config?.deterministicIDSeed?.length ?? 0
      const existingTarget = mermaidMockState.runTargetsBySeed.get(seedLength)
      const target = existingTarget ?? node
      mermaidMockState.runTargetsBySeed.set(seedLength, target)
      target.innerHTML += `<svg><text>${node.textContent}</text></svg>`
      if (node !== target) node.innerHTML = ''
    }),
  },
}))

describe('mermaidRuntime', () => {
  afterEach(() => {
    vi.clearAllMocks()
    mermaidMockState.firstRunNode = null
    mermaidMockState.config = null
    mermaidMockState.runTargetsBySeed.clear()
  })

  it('renders through mermaid.run with a unique deterministic id seed', async () => {
    const element = document.createElement('div')

    await renderMermaidToElement({
      element,
      source: 'flowchart TD\nA[输入] --> B[输出]',
      isDark: false,
    })

    expect(mermaid.initialize).toHaveBeenCalled()
    expect(mermaid.run).toHaveBeenCalledOnce()
    expect(mermaid.render).not.toHaveBeenCalled()
    expect(mermaidMockState.config?.deterministicIds).toBe(true)
    expect(mermaidMockState.config?.deterministicIDSeed?.length).toBeGreaterThan(0)
    expect(element.querySelector('svg')).toBeTruthy()
  })

  it('keeps simultaneous Mermaid diagrams isolated in their own containers', async () => {
    const first = document.createElement('div')
    const second = document.createElement('div')

    await Promise.all([
      renderMermaidToElement({ element: first, source: 'flowchart TD\nA --> B', isDark: false }),
      renderMermaidToElement({ element: second, source: 'flowchart TD\nC --> D', isDark: false }),
    ])

    expect(first.querySelectorAll('svg')).toHaveLength(1)
    expect(second.querySelectorAll('svg')).toHaveLength(1)
    expect(first.textContent).toContain('A --> B')
    expect(second.textContent).toContain('C --> D')

    const renderIds = vi.mocked(mermaid.render).mock.calls.map(([id]) => id)
    expect(renderIds).toHaveLength(0)
    const seeds = vi
      .mocked(mermaid.initialize)
      .mock.calls.map(([config]) => config.deterministicIDSeed?.length)
    expect(new Set(seeds).size).toBe(2)
  })

  it('repairs mdx whitespace joins between adjacent mermaid statements', () => {
    const source = `flowchart TB
User["👤 用户1-4 句提示"] --> Planner
Planner["📋 Planner（规划者）扩展为完整产品规格16 features, 10 sprints"] --> Spec["📄 产品规格"]
Spec --> Contractsubgraph Loop["🔄 逐 Sprint 迭代"]
Contract["🤝 Sprint ContractGenerator ↔ Evaluator 谈判'什么叫做完' 达成一致"] --> Gen
Eval -->|"全部通过"| Done["✅ Sprint 完成"]
endDone --> Final["🎯 最终产物完整全栈应用"]`

    const normalized = normalizeMermaidSource(source)

    expect(normalized).toContain('Spec --> Contract\nsubgraph Loop')
    expect(normalized).toContain('end\nDone --> Final')
  })

  it('repairs subgraph blocks joined directly after end statements', () => {
    const source = `graph TD
subgraph Encoder["Encoder (N=6层)"]
direction TB
E3 --> E6["Layer 6"]
endsubgraph Decoder["Decoder (N=6层)"]
direction TB
D3 --> D6["Layer 6"]
endsubgraph LayerEnc["每个 Encoder Layer"]
direction TB
SA --> ADD1["Add & Norm"]
end
E6 --> CROSS`

    const normalized = normalizeMermaidSource(source)

    expect(normalized).toContain('E3 --> E6["Layer 6"]\nend\nsubgraph Decoder')
    expect(normalized).toContain('D3 --> D6["Layer 6"]\nend\nsubgraph LayerEnc')
  })
})
