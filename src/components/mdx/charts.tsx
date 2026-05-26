import { Suspense, lazy } from 'react'

interface ChartData {
  label: string
  value: number
}

interface ChartProps {
  data: ChartData[]
  title?: string
  color?: string
}

const defaultColor = '#b8782a'

function ChartFallback() {
  return <div className="mdx-chart" style={{ minHeight: 200 }} />
}

function createLazyChart(
  importer: () => Promise<{ default: React.ComponentType<{ data: ChartData[]; color: string }> }>,
) {
  const LazyComponent = lazy(importer)
  return function ChartWrapper({ data, title, color }: ChartProps) {
    return (
      <div className="mdx-chart">
        {title && <div className="mdx-chart-title">{title}</div>}
        <Suspense fallback={<ChartFallback />}>
          <LazyComponent data={data} color={color ?? defaultColor} />
        </Suspense>
      </div>
    )
  }
}

export const BarChart = createLazyChart(() =>
  import('./chart-impl').then((m) => ({ default: m.BarChartImpl })),
)
export const LineChart = createLazyChart(() =>
  import('./chart-impl').then((m) => ({ default: m.LineChartImpl })),
)
export const PieChart = createLazyChart(() =>
  import('./chart-impl').then((m) => ({ default: m.PieChartImpl })),
)
export const RadarChart = createLazyChart(() =>
  import('./chart-impl').then((m) => ({ default: m.RadarChartImpl })),
)
