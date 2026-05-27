import { lazy } from 'react'
import { ChartFrame, type ChartLayout, type ChartData } from './chart-impl'

interface ChartProps {
  data: ChartData[]
  title?: string
  color?: string
}

const defaultColor = '#b8782a'

type ChartImplProps = {
  data: ChartData[]
  color: string
  layout: ChartLayout
}

function createLazyChart(
  importer: () => Promise<{ default: React.ComponentType<ChartImplProps> }>,
  type: 'bar' | 'line' | 'pie' | 'radar',
) {
  const LazyComponent = lazy(importer)
  return function ChartWrapper({ data, title, color }: ChartProps) {
    return (
      <ChartFrame title={title} type={type} dataLength={data?.length ?? 0}>
        {(layout) => (
          <LazyComponent data={data} color={color ?? defaultColor} layout={layout} />
        )}
      </ChartFrame>
    )
  }
}

export const BarChart = createLazyChart(
  () => import('./chart-impl').then((m) => ({ default: m.BarChartImpl })),
  'bar',
)
export const LineChart = createLazyChart(
  () => import('./chart-impl').then((m) => ({ default: m.LineChartImpl })),
  'line',
)
export const PieChart = createLazyChart(
  () => import('./chart-impl').then((m) => ({ default: m.PieChartImpl })),
  'pie',
)
export const RadarChart = createLazyChart(
  () => import('./chart-impl').then((m) => ({ default: m.RadarChartImpl })),
  'radar',
)
