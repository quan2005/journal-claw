import { useState, useEffect, useRef, type ReactNode } from 'react'
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

export interface ChartData {
  label: string
  value: number
}

// ── ResizeObserver hook ─────────────────────────────────

function useContainerWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return { ref, width }
}

// ── Chart layout calculator ─────────────────────────────

export type ChartType = 'bar' | 'line' | 'pie' | 'radar'

export interface ChartLayout {
  height: number
  compact: boolean
  narrow: boolean
  margin: { top: number; right: number; bottom: number; left: number }
}

export function useChartLayout(type: ChartType, containerWidth: number, _dataLength: number): ChartLayout {
  const compact = containerWidth < 560
  const narrow = containerWidth < 420

  const height = (() => {
    switch (type) {
      case 'bar':
        return Math.max(220, Math.min(Math.round(containerWidth * 0.32), 340))
      case 'line':
        return Math.max(220, Math.min(Math.round(containerWidth * 0.30), 320))
      case 'pie':
        return compact ? 300 : 340
      case 'radar':
        return compact ? 300 : 360
      default:
        return 280
    }
  })()

  const margin = narrow
    ? { top: 4, right: 4, bottom: 4, left: 4 }
    : { top: 8, right: 16, bottom: 8, left: 8 }

  return { height, compact, narrow, margin }
}

// ── ChartFrame component ────────────────────────────────

interface ChartFrameProps {
  title?: string
  type: ChartType
  dataLength: number
  children: (layout: ChartLayout) => ReactNode
}

export function ChartFrame({ title, type, dataLength, children }: ChartFrameProps) {
  const { ref, width } = useContainerWidth()
  const layout = useChartLayout(type, width, dataLength)
  const isEmpty = dataLength === 0

  return (
    <div className="mdx-chart" ref={ref}>
      {title && <div className="mdx-chart-title">{title}</div>}
      {isEmpty ? (
        <div className="mdx-chart-empty">
          <span className="mdx-chart-empty-icon">—</span>
          <span>No chart data</span>
        </div>
      ) : width > 0 ? (
        children(layout)
      ) : (
        <div style={{ minHeight: layout.height }} />
      )}
    </div>
  )
}

function useChartTheme() {
  const resolve = () =>
    document.documentElement.getAttribute('data-theme') === 'dark'

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
    grid: isDark ? '#2c2c2e' : '#e5e5e7',
    text: isDark ? '#8e8e93' : '#6a7278',
    axisLine: isDark ? '#3a3a3c' : '#e5e5e7',
    tooltipBg: isDark ? '#1c1c1e' : '#ffffff',
    tooltipBorder: isDark ? '#3a3a3c' : '#e5e5e7',
    amberLight: isDark ? 'rgba(200, 147, 59, 0.12)' : '#f0e4cc',
    amberLightSolid: isDark ? '#3a3025' : '#f5edd8',
    pieColors: isDark
      ? ['#c8933b', '#b8782a', '#d4a84a', '#e0c080', '#8a6500']
      : ['#b8782a', '#f0e4cc', '#d4b878', '#8a6500', '#f5edd8'],
  }
}

export function BarChartImpl({
  data,
  color = amber,
}: {
  data: ChartData[]
  color?: string
}) {
  const t = useChartTheme()
  return (
    <ResponsiveContainer width="100%" height={240}>
      <RechartsBar data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: t.text }} axisLine={{ stroke: t.axisLine }} tickLine={{ stroke: t.axisLine }} />
        <YAxis tick={{ fontSize: 12, fill: t.text }} axisLine={{ stroke: t.axisLine }} tickLine={{ stroke: t.axisLine }} />
        <Tooltip contentStyle={{ background: t.tooltipBg, border: `1px solid ${t.tooltipBorder}`, borderRadius: 6, fontSize: 13 }} />
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
  const t = useChartTheme()
  return (
    <ResponsiveContainer width="100%" height={240}>
      <RechartsLine data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: t.text }} axisLine={{ stroke: t.axisLine }} tickLine={{ stroke: t.axisLine }} />
        <YAxis tick={{ fontSize: 12, fill: t.text }} axisLine={{ stroke: t.axisLine }} tickLine={{ stroke: t.axisLine }} />
        <Tooltip contentStyle={{ background: t.tooltipBg, border: `1px solid ${t.tooltipBorder}`, borderRadius: 6, fontSize: 13 }} />
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
  const t = useChartTheme()
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
            <Cell key={i} fill={t.pieColors[i % t.pieColors.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ background: t.tooltipBg, border: `1px solid ${t.tooltipBorder}`, borderRadius: 6, fontSize: 13 }} />
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
  const t = useChartTheme()
  return (
    <ResponsiveContainer width="100%" height={240}>
      <RechartsRadar data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <PolarGrid stroke={t.isDark ? '#3a3a3c' : '#e5e5e7'} />
        <PolarAngleAxis dataKey="label" tick={{ fontSize: 12, fill: t.text }} />
        <Tooltip contentStyle={{ background: t.tooltipBg, border: `1px solid ${t.tooltipBorder}`, borderRadius: 6, fontSize: 13 }} />
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
