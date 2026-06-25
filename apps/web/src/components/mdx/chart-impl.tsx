import { useState, useEffect, useMemo } from 'react'
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
import type { ChartData, ChartLayout } from './chart-frame'

// Agentic chart palette — primary orange first, categorical series follow.
const amber = '#FF5701'
const AGENTIC_SERIES = [
  '#FF5701',
  '#16A34A',
  '#D97706',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#6B7280',
]

function useChartTheme() {
  const resolve = () => document.documentElement.getAttribute('data-theme') === 'dark'

  const [isDark, setIsDark] = useState(resolve)

  useEffect(() => {
    const observer = new MutationObserver(() => setIsDark(resolve()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  return {
    isDark,
    grid: isDark ? '#374151' : '#E5E7EB',
    text: isDark ? '#9CA3AF' : '#6B7280',
    axisLine: isDark ? '#374151' : '#E5E7EB',
    tooltipBg: isDark ? '#1c1c1e' : '#FFFFFF',
    tooltipBorder: isDark ? '#374151' : '#E5E7EB',
    amberLight: isDark ? 'rgba(255, 87, 1, 0.12)' : '#FFEDD9',
    amberLightSolid: isDark ? '#3a3025' : '#FFF4ED',
    pieColors: AGENTIC_SERIES,
  }
}

export function BarChartImpl({
  data,
  color = amber,
  layout,
}: {
  data: ChartData[]
  color?: string
  layout: ChartLayout
}) {
  const t = useChartTheme()
  const maxBarWidth = layout.compact ? 48 : 72

  return (
    <ResponsiveContainer width="100%" height={layout.height}>
      <RechartsBar data={data} margin={layout.margin}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: layout.narrow ? 10 : 12, fill: t.text }}
          axisLine={{ stroke: t.axisLine }}
          tickLine={{ stroke: t.axisLine }}
        />
        <YAxis
          tick={{ fontSize: layout.narrow ? 10 : 12, fill: t.text }}
          axisLine={{ stroke: t.axisLine }}
          tickLine={{ stroke: t.axisLine }}
          width={layout.compact ? 32 : 40}
        />
        <Tooltip
          contentStyle={{
            background: t.tooltipBg,
            border: `1px solid ${t.tooltipBorder}`,
            borderRadius: 10,
            fontSize: 13,
            color: t.isDark ? '#FFFFFF' : '#111827',
          }}
          cursor={{ fill: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}
        />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={maxBarWidth} />
      </RechartsBar>
    </ResponsiveContainer>
  )
}

export function LineChartImpl({
  data,
  color = amber,
  layout,
}: {
  data: ChartData[]
  color?: string
  layout: ChartLayout
}) {
  const t = useChartTheme()

  const values = data.map((d) => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const padding = (max - min) * 0.1 || 1

  return (
    <ResponsiveContainer width="100%" height={layout.height}>
      <RechartsLine data={data} margin={layout.margin}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: layout.narrow ? 10 : 12, fill: t.text }}
          axisLine={{ stroke: t.axisLine }}
          tickLine={{ stroke: t.axisLine }}
        />
        <YAxis
          domain={[min - padding, max + padding]}
          tick={{ fontSize: layout.narrow ? 10 : 12, fill: t.text }}
          axisLine={{ stroke: t.axisLine }}
          tickLine={{ stroke: t.axisLine }}
          width={layout.compact ? 32 : 40}
        />
        <Tooltip
          contentStyle={{
            background: t.tooltipBg,
            border: `1px solid ${t.tooltipBorder}`,
            borderRadius: 10,
            fontSize: 13,
            color: t.isDark ? '#FFFFFF' : '#111827',
          }}
          cursor={{ stroke: t.axisLine, strokeWidth: 1 }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={{ fill: color, r: 3, strokeWidth: 0 }}
          activeDot={{ fill: color, r: 5, strokeWidth: 0 }}
        />
      </RechartsLine>
    </ResponsiveContainer>
  )
}

export function PieChartImpl({
  data,
  layout,
}: {
  data: ChartData[]
  color?: string
  layout: ChartLayout
}) {
  const t = useChartTheme()

  const displayData = useMemo(() => {
    if (data.length <= 6) return data
    const total = data.reduce((s, d) => s + d.value, 0)
    const threshold = total * 0.03
    const main = data.filter((d) => d.value >= threshold)
    const otherSum = data.filter((d) => d.value < threshold).reduce((s, d) => s + d.value, 0)
    if (otherSum > 0) {
      main.push({ label: 'Other', value: Math.round(otherSum) })
    }
    return main
  }, [data])

  const innerRadius = layout.compact ? '48%' : '52%'
  const outerRadius = layout.compact ? '68%' : '76%'
  const total = displayData.reduce((s, d) => s + d.value, 0)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: layout.compact ? 'column' : 'row',
        alignItems: layout.compact ? 'stretch' : 'center',
        gap: layout.compact ? 16 : 32,
      }}
    >
      <div
        style={{
          flex: layout.compact ? 'none' : '0 0 55%',
          width: layout.compact ? '100%' : undefined,
          minWidth: 0,
        }}
      >
        <ResponsiveContainer width="100%" height={layout.height}>
          <RechartsPie margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Pie
              data={displayData}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              label={false}
            >
              {displayData.map((_, i) => (
                <Cell key={i} fill={t.pieColors[i % t.pieColors.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: t.tooltipBg,
                border: `1px solid ${t.tooltipBorder}`,
                borderRadius: 10,
                fontSize: 13,
                color: t.isDark ? '#FFFFFF' : '#111827',
              }}
              formatter={(value, name) => [
                `${value ?? ''} (${total > 0 ? Math.round((Number(value ?? 0) / total) * 100) : 0}%)`,
                name,
              ]}
            />
          </RechartsPie>
        </ResponsiveContainer>
      </div>
      <div
        style={{
          flex: layout.compact ? 'none' : '0 0 auto',
          display: 'flex',
          flexDirection: layout.compact ? 'row' : 'column',
          flexWrap: 'wrap',
          gap: layout.compact ? 12 : 8,
        }}
      >
        {displayData.map((d, i) => (
          <div
            key={d.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              color: t.isDark ? '#9CA3AF' : '#111827',
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: t.pieColors[i % t.pieColors.length],
                flexShrink: 0,
              }}
            />
            <span>{d.label}</span>
            <span style={{ color: t.text, fontSize: 12 }}>
              {total > 0 ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RadarChartImpl({
  data,
  color = amber,
  layout,
}: {
  data: ChartData[]
  color?: string
  layout: ChartLayout
}) {
  const t = useChartTheme()

  return (
    <ResponsiveContainer width="100%" height={layout.height}>
      <RechartsRadar data={data} margin={{ top: 16, right: 16, bottom: 16, left: 16 }}>
        <PolarGrid stroke={t.grid} />
        <PolarAngleAxis
          dataKey="label"
          tick={{ fontSize: layout.compact ? 11 : 12, fill: t.text }}
        />
        <Tooltip
          contentStyle={{
            background: t.tooltipBg,
            border: `1px solid ${t.tooltipBorder}`,
            borderRadius: 10,
            fontSize: 13,
            color: t.isDark ? '#FFFFFF' : '#111827',
          }}
        />
        <Radar dataKey="value" stroke={color} fill={color} fillOpacity={0.18} />
      </RechartsRadar>
    </ResponsiveContainer>
  )
}
