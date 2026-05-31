import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import {
  ActionTable,
  DecisionRecord,
  RiskMatrix,
  StatusBadge,
  RACI,
  ComparisonMatrix,
  InsightCard,
  EvidenceCard,
} from '../components/mdx'
import { ReferenceList, Transcript, TimestampLink } from '../components/mdx'

describe('semantic MDX components', () => {
  it('renders actions with owner, due date, source, and status', () => {
    render(
      <ActionTable
        items={[
          { action: '补齐权限说明', owner: '张三', due: '周三', source: '评审会', status: 'open' },
        ]}
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

  it('renders risk matrix and status badge', () => {
    render(
      <>
        <StatusBadge status="blocked" />
        <RiskMatrix
          risks={[
            { risk: '上线延期', likelihood: 'medium', impact: 'high', mitigation: '缩小首版范围' },
          ]}
        />
      </>,
    )

    expect(screen.getByText('blocked')).toBeTruthy()
    expect(screen.getByText('上线延期')).toBeTruthy()
    expect(screen.getByText('缩小首版范围')).toBeTruthy()
  })

  it('renders RACI and comparison matrices', () => {
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
      </>,
    )

    expect(screen.getByText('发布审批')).toBeTruthy()
    expect(screen.getByText('方案 B')).toBeTruthy()
  })

  it('renders insight and evidence cards', () => {
    render(
      <>
        <InsightCard title="导入进度需要更明确">用户关注处理是否卡住。</InsightCard>
        <EvidenceCard title="访谈证据" source="用户访谈 03">
          3 位用户提到导入反馈不足。
        </EvidenceCard>
      </>,
    )

    expect(screen.getByText('导入进度需要更明确')).toBeTruthy()
    expect(screen.getByText('用户访谈 03')).toBeTruthy()
  })

  it('renders references, transcript, and timestamp links', () => {
    render(
      <>
        <ReferenceList
          sources={[{ path: '2605/raw/meeting.m4a', label: '会议录音', type: 'audio' }]}
        />
        <Transcript items={[{ speaker: '张三', time: '00:12', text: '这里需要先试点。' }]} />
        <TimestampLink src="2605/raw/meeting.m4a" time="00:12">
          跳到 00:12
        </TimestampLink>
      </>,
    )

    expect(screen.getByText('会议录音')).toBeTruthy()
    expect(screen.getByText('张三')).toBeTruthy()
    expect(screen.getByText('这里需要先试点。')).toBeTruthy()
    expect(screen.getByText('跳到 00:12')).toBeTruthy()
  })

  it('allows transcript details to expand and collapse', () => {
    render(
      <Transcript items={[{ speaker: '张三', time: '00:12', text: '长转写内容' }]} collapsible />,
    )
    const details = screen.getByText('转写片段').closest('details')
    expect(details?.hasAttribute('open')).toBe(false)
    fireEvent.click(screen.getByText('转写片段'))
    expect(details?.hasAttribute('open')).toBe(true)
  })
})
