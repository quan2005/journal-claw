import {
  BarChart as RechartsBar,
  Bar,
  LineChart as RechartsLine,
  Line,
  PieChart as RechartsPie,
  Pie,
  Cell,
  RadarChart as RechartsRadar,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { PieLabelRenderProps } from 'recharts'

const amber = '#b8782a'
const amberLight = '#f0e4cc'

interface ChartData {
  label: string
  value: number
}

export function BarChartImpl({
  data,
  color = amber,
}: {
  data: ChartData[]
  color?: string
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <RechartsBar data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
      </RechartsBar>
    </ResponsiveContainer>
  )
}

export function LineChartImpl({
  data,
  color = amber,
}: {
  data: ChartData[]
  color?: string
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <RechartsLine data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={{ fill: color, r: 3 }}
        />
      </RechartsLine>
    </ResponsiveContainer>
  )
}

export function PieChartImpl({
  data,
}: {
  data: ChartData[]
  color?: string
}) {
  const colors = [amber, amberLight, '#d4b878', '#8a6500', '#f5edd8']
  return (
    <ResponsiveContainer width="100%" height={240}>
      <RechartsPie margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="50%"
          outerRadius={80}
          label={(props: PieLabelRenderProps) => props.name || ''}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip />
      </RechartsPie>
    </ResponsiveContainer>
  )
}

export function RadarChartImpl({
  data,
  color = amber,
}: {
  data: ChartData[]
  color?: string
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <RechartsRadar data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <PolarGrid stroke={amberLight} />
        <PolarAngleAxis dataKey="label" tick={{ fontSize: 12 }} />
        <Radar
          dataKey="value"
          stroke={color}
          fill={color}
          fillOpacity={0.2}
        />
      </RechartsRadar>
    </ResponsiveContainer>
  )
}
