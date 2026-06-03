import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('recharts', () => {
  const passthrough =
    (testId: string) =>
    ({ children }: { children?: React.ReactNode }) => (
      <div data-testid={testId}>{children}</div>
    )

  return {
    BarChart: passthrough('bar-chart'),
    Bar: passthrough('bar'),
    LineChart: passthrough('line-chart'),
    Line: passthrough('line'),
    PieChart: passthrough('pie-chart'),
    Pie: passthrough('pie'),
    Cell: passthrough('cell'),
    RadarChart: passthrough('radar-chart'),
    Radar: passthrough('radar'),
    PolarGrid: passthrough('polar-grid'),
    PolarAngleAxis: passthrough('polar-angle-axis'),
    XAxis: passthrough('x-axis'),
    YAxis: passthrough('y-axis'),
    Tooltip: passthrough('tooltip'),
    ResponsiveContainer: ({
      children,
      width,
      height,
    }: {
      children?: React.ReactNode
      width: string | number
      height: string | number
    }) => (
      <div data-testid="responsive-container" data-width={width} data-height={height}>
        {children}
      </div>
    ),
  }
})

import { PieChartImpl } from '../components/mdx/chart-impl'

describe('MDX chart components', () => {
  it('keeps compact pie charts from collapsing the responsive container width', () => {
    render(
      <PieChartImpl
        data={[
          { label: '会议录音', value: 45 },
          { label: '文本粘贴', value: 30 },
        ]}
        layout={{
          height: 300,
          compact: true,
          narrow: true,
          margin: { top: 4, right: 4, bottom: 4, left: 4 },
        }}
      />,
    )

    const responsive = screen.getByTestId('responsive-container')
    const chartColumn = responsive.parentElement as HTMLElement
    const pieLayout = chartColumn.parentElement as HTMLElement

    expect(pieLayout.style.alignItems).toBe('stretch')
    expect(chartColumn.style.width).toBe('100%')
  })
})
