import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import {
  CopyButton,
  DecisionRecord,
  StatusBadge,
  RACI,
  ComparisonMatrix,
  MilestoneTimeline,
  InsightCard,
  InlineMath,
  BlockMath,
  Mermaid,
  Stat,
  StatGroup,
  Table,
  ReferenceList,
} from '../components/mdx'

vi.mock('../components/mdx/mermaidRuntime', async () => {
  const actual = await vi.importActual<typeof import('../components/mdx/mermaidRuntime')>(
    '../components/mdx/mermaidRuntime',
  )

  return {
    ...actual,
    renderMermaidToElement: vi.fn(
      async ({ element, source }: { element: HTMLElement; source: string }) => {
        const normalizedSource = actual.normalizeMermaidSource(source)
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        svg.textContent = normalizedSource
        element.replaceChildren(svg)
        return {
          diagramType: actual.detectMermaidType(normalizedSource),
          source: normalizedSource,
        }
      },
    ),
  }
})

describe('semantic MDX components', () => {
  it('renders compact metric groups from Stat children', () => {
    const { container } = render(
      <StatGroup>
        <Stat label="完成项" value={12} />
        <Stat label="风险" value={3} trend="down" />
      </StatGroup>,
    )

    expect(container.querySelector('.mdx-stat-group')).toBeTruthy()
    expect(screen.getByText('完成项')).toBeTruthy()
    expect(screen.getByText('12')).toBeTruthy()
    expect(screen.getByText('风险')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('renders generated action rows with the retained table primitive', () => {
    render(
      <Table
        headers={['行动', '负责人', '截止', '来源', '状态']}
        rows={[['补齐权限说明', '张三', '周三', '评审会', 'open']]}
      />,
    )

    expect(screen.getByText('补齐权限说明')).toBeTruthy()
    expect(screen.getByText('张三')).toBeTruthy()
    expect(screen.getByText('周三')).toBeTruthy()
    expect(screen.getByText('评审会')).toBeTruthy()
    expect(screen.getByText('open')).toBeTruthy()
  })

  it('renders a decision record with options and rationale', () => {
    render(
      <DecisionRecord
        question="是否采用方案 B"
        decision="先做两周试点"
        owner="李四"
        due="下周五"
        options={[
          { label: '方案 A', tradeoff: '快，但审计不足' },
          { label: '方案 B', tradeoff: '慢，但覆盖审计' },
        ]}
        rationale="企业客户审计需求优先。"
      />,
    )

    expect(screen.getByText('是否采用方案 B')).toBeTruthy()
    expect(screen.getByText('先做两周试点')).toBeTruthy()
    expect(screen.getByText('企业客户审计需求优先。')).toBeTruthy()
  })

  it('renders status badges and risk rows without a dedicated risk matrix component', () => {
    render(
      <>
        <StatusBadge status="blocked" />
        <Table
          headers={['风险', '概率', '影响', '应对']}
          rows={[['上线延期', 'medium', 'high', '缩小首版范围']]}
        />
      </>,
    )

    expect(screen.getByText('blocked')).toBeTruthy()
    expect(screen.getByText('上线延期')).toBeTruthy()
    expect(screen.getByText('缩小首版范围')).toBeTruthy()
  })

  it('renders RACI, milestone timelines, and comparison matrices', () => {
    render(
      <>
        <RACI
          rows={[
            {
              work: '发布审批',
              responsible: '张三',
              accountable: '李四',
              consulted: '王五',
              informed: '团队',
            },
          ]}
        />
        <ComparisonMatrix
          columns={['价格', '风险']}
          rows={[
            { label: '方案 A', values: ['低', '高'] },
            { label: '方案 B', values: ['中', '低'] },
          ]}
        />
        <MilestoneTimeline items={[{ time: 'M1', title: '发布审批', desc: '确认灰度计划' }]} />
      </>,
    )

    expect(screen.getAllByText('发布审批')).toHaveLength(2)
    expect(screen.getByText('方案 B')).toBeTruthy()
    expect(screen.getByText('确认灰度计划')).toBeTruthy()
  })

  it('renders insight cards for interpretation', () => {
    render(<InsightCard title="导入进度需要更明确">用户关注处理是否卡住。</InsightCard>)

    expect(screen.getByText('导入进度需要更明确')).toBeTruthy()
    expect(screen.getByText('用户关注处理是否卡住。')).toBeTruthy()
  })

  it('renders reference lists for source traceability', () => {
    render(
      <ReferenceList
        sources={[{ path: '2605/raw/meeting.m4a', label: '会议录音', type: 'audio' }]}
      />,
    )

    expect(screen.getByText('会议录音')).toBeTruthy()
  })

  it('renders a copy affordance without editing note content', () => {
    render(<CopyButton text="关键结论" label="复制结论" />)

    const button = screen.getByRole('button', { name: '复制结论' })
    expect(button.getAttribute('data-copy-text')).toBe('关键结论')
  })

  it('renders table headers as the first and only header row', () => {
    const { container } = render(
      <Table
        headers={['Prop', 'Type', '说明']}
        rows={[['meeting-collaboration', '会议协作', '15']]}
      />,
    )

    const thead = container.querySelector('thead')
    const tbody = container.querySelector('tbody')

    expect(thead?.querySelectorAll('tr')).toHaveLength(1)
    expect(within(thead as HTMLElement).getAllByRole('columnheader')).toHaveLength(3)
    expect(tbody?.querySelectorAll('th')).toHaveLength(0)
    expect(container.querySelector('thead')?.textContent).toBe('PropType说明')
  })

  it('omits the header section when a table has no headers', () => {
    const { container } = render(
      <Table headers={[]} rows={[['meeting-collaboration', '会议协作', '15']]} />,
    )

    expect(container.querySelector('thead')).toBeNull()
    expect(screen.getByText('meeting-collaboration')).toBeTruthy()
  })

  it('accepts generated table columns with object rows', () => {
    render(
      <Table
        columns={[
          { key: 'model', title: '模型' },
          { key: 'bleu', title: 'BLEU' },
        ]}
        rows={[
          { model: 'Transformer (base)', bleu: '27.3' },
          { model: 'Transformer (big)', bleu: '28.4' },
        ]}
      />,
    )

    expect(screen.getByText('模型')).toBeTruthy()
    expect(screen.getByText('Transformer (big)')).toBeTruthy()
    expect(screen.getByText('28.4')).toBeTruthy()
  })

  it('keeps empty mermaid diagrams as local component errors', () => {
    render(<Mermaid />)

    expect(screen.getByText('Diagram render failed')).toBeTruthy()
    expect(screen.getByText('Mermaid chart source is empty.')).toBeTruthy()
  })

  it('accepts mermaid source as children', () => {
    const { container } = render(
      <Mermaid>{`
graph TD
  A --> B
`}</Mermaid>,
    )

    expect(container.querySelector('.mdx-diagram-frame')).toBeTruthy()
    expect(screen.queryByText('Mermaid chart source is empty.')).toBeFalsy()
  })

  it('renders generated transformer flowcharts instead of showing diagram failure', async () => {
    const chart = `graph TD
    subgraph Encoder["Encoder (N=6层)"]
        direction TB
        E_IN["Input Embedding"] --> E_PE["+ Positional Encoding"]
        E_PE --> E1["Layer 1"]
        E1 --> E2["Layer 2"]
        E2 --> E3["..."]
        E3 --> E6["Layer 6"]
    end

    subgraph Decoder["Decoder (N=6层)"]
        direction TB
        D_IN["Output Embedding"] --> D_PE["+ Positional Encoding"]
        D_PE --> D1["Layer 1"]
        D1 --> D2["Layer 2"]
        D2 --> D3["..."]
        D3 --> D6["Layer 6"]
    end

    subgraph LayerEnc["每个 Encoder Layer"]
        direction TB
        SA["Multi-Head Self-Attention"]
        SA --> ADD1["Add & Norm"]
        ADD1 --> FFN["Feed Forward"]
        FFN --> ADD2["Add & Norm"]
    end

    subgraph LayerDec["每个 Decoder Layer"]
        direction TB
        MSA["Masked Multi-Head Self-Attention"]
        MSA --> A1["Add & Norm"]
        A1 --> CROSS["Encoder-Decoder Attention"]
        CROSS --> A2["Add & Norm"]
        A2 --> FFN2["Feed Forward"]
        FFN2 --> A3["Add & Norm"]
    end

    E6 --> CROSS
    D6 --> Linear["Linear"]
    Linear --> Softmax["Softmax → Output"]`

    const { container } = render(<Mermaid>{chart}</Mermaid>)

    await waitFor(
      () => {
        expect(screen.queryByText('Diagram render failed')).toBeFalsy()
        expect(container.querySelector('.mdx-mermaid-svg svg')).toBeTruthy()
      },
      { timeout: 3000 },
    )
  })

  it('unwraps fenced mermaid source before rendering', async () => {
    const { container } = render(
      <Mermaid
        chart={`\`\`\`mermaid
flowchart TD
  A[输入] --> B[输出]
\`\`\``}
      />,
    )

    await waitFor(() => {
      expect(screen.queryByText('Diagram render failed')).toBeFalsy()
      expect(container.querySelector('.mdx-mermaid-svg svg')).toBeTruthy()
    })
  })

  it('normalizes escaped newline mermaid source before rendering', async () => {
    const { container } = render(<Mermaid chart={'flowchart TD\\n  A[输入] --> B[输出]'} />)

    await waitFor(() => {
      expect(screen.queryByText('Diagram render failed')).toBeFalsy()
      expect(container.querySelector('.mdx-mermaid-svg svg')).toBeTruthy()
    })
  })

  it('renders generated flowcharts with html line breaks and edge labels', async () => {
    const chart = `flowchart TB
    User["👤 用户<br/>1-4 句提示"] --> Planner
    Planner["📋 Planner（规划者）<br/>扩展为完整产品规格"] --> Spec["📄 产品规格"]
    Spec --> Contract
    Contract["🤝 Sprint Contract<br/>Generator ↔ Evaluator 谈判"] --> Gen
    Gen["🔧 Generator（构建者）<br/>逐 sprint 构建"] --> Eval
    Eval["🔍 Evaluator（评估者）<br/>四维标准 + Bug 清单打分"] -->|"任一维度低于阈值 → sprint 失败<br/>详细反馈"| Gen`

    const { container } = render(<Mermaid>{chart}</Mermaid>)

    await waitFor(() => {
      expect(screen.queryByText('Diagram render failed')).toBeFalsy()
      expect(container.querySelector('.mdx-mermaid-svg svg')).toBeTruthy()
    })
  })

  it('preserves mermaid line boundaries when mdx turns br tags into react elements', async () => {
    const { container } = render(
      <Mermaid>
        {`flowchart TB
User["👤 用户`}
        <br />
        {`1-4 句提示"] --> Planner
Planner["📋 Planner（规划者）`}
        <br />
        {`扩展为完整产品规格`}
        <br />
        {`16 features, 10 sprints"] --> Spec["📄 产品规格"]
Spec --> Contract
subgraph Loop["🔄 逐 Sprint 迭代"]
Contract["🤝 Sprint Contract`}
        <br />
        {`Generator ↔ Evaluator 谈判`}
        <br />
        {`'什么叫做完' 达成一致"] --> Gen
Gen["🔧 Generator（构建者）`}
        <br />
        {`逐 sprint 构建`}
        <br />
        {`自评后交接"] --> Eval
Eval["🔍 Evaluator（评估者）`}
        <br />
        {`Playwright 实际操作应用`}
        <br />
        {`四维标准 + Bug 清单打分"] -->|"任一维度低于阈值 → sprint 失败`}
        <br />
        {`详细反馈"| Gen
Eval -->|"全部通过"| Done["✅ Sprint 完成"]
end
Done --> Final["🎯 最终产物`}
        <br />
        {`完整全栈应用"]`}
      </Mermaid>,
    )

    await waitFor(() => {
      expect(screen.queryByText('Diagram render failed')).toBeFalsy()
      expect(container.querySelector('.mdx-mermaid-svg svg')).toBeTruthy()
    })
  })

  it('repairs adjacent mermaid statements that mdx whitespace normalization joined together', async () => {
    const chart = `flowchart TB
User["👤 用户1-4 句提示"] --> Planner
Planner["📋 Planner（规划者）扩展为完整产品规格16 features, 10 sprints"] --> Spec["📄 产品规格"]
Spec --> Contractsubgraph Loop["🔄 逐 Sprint 迭代"]
Contract["🤝 Sprint ContractGenerator ↔ Evaluator 谈判'什么叫做完' 达成一致"] --> Gen
Gen["🔧 Generator（构建者）逐 sprint 构建自评后交接"] --> Eval
Eval["🔍 Evaluator（评估者）Playwright 实际操作应用四维标准 + Bug 清单打分"] -->|"任一维度低于阈值 → sprint 失败详细反馈"| Gen
Eval -->|"全部通过"| Done["✅ Sprint 完成"]
endDone --> Final["🎯 最终产物完整全栈应用"]`

    const { container } = render(<Mermaid chart={chart} />)

    await waitFor(() => {
      expect(screen.queryByText('Diagram render failed')).toBeFalsy()
      expect(container.querySelector('.mdx-mermaid-svg svg')).toBeTruthy()
    })
  })

  it('renders inline and block math with KaTeX', () => {
    const { container } = render(
      <>
        <InlineMath math="d_{model}" />
        <BlockMath math="PE_{pos}=\\sin(x)" />
      </>,
    )

    expect(container.querySelectorAll('.katex').length).toBeGreaterThanOrEqual(2)
    expect(container.querySelector('.mdx-math--inline')).toBeTruthy()
    expect(container.querySelector('.mdx-math--block')).toBeTruthy()
  })

  it('keeps invalid math formulas as local fallbacks', () => {
    render(<BlockMath math="\\frac{" />)

    expect(screen.getByText('Formula render failed')).toBeTruthy()
    expect(screen.getAllByText(/frac/).length).toBeGreaterThan(0)
  })
})
