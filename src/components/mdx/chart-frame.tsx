import { useEffect, useRef, useState, type ReactNode } from 'react'

export interface ChartData {
  label: string
  value: number
}

export type ChartType = 'bar' | 'line' | 'pie' | 'radar'

export interface ChartLayout {
  height: number
  compact: boolean
  narrow: boolean
  margin: { top: number; right: number; bottom: number; left: number }
}

function useContainerWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (typeof ResizeObserver === 'undefined') {
      setWidth(el.getBoundingClientRect().width || el.clientWidth || 640)
      return
    }

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

function useChartLayout(type: ChartType, containerWidth: number, _dataLength: number): ChartLayout {
  const compact = containerWidth < 560
  const narrow = containerWidth < 420

  const height = (() => {
    switch (type) {
      case 'bar':
        return Math.max(220, Math.min(Math.round(containerWidth * 0.32), 340))
      case 'line':
        return Math.max(220, Math.min(Math.round(containerWidth * 0.3), 320))
      case 'pie':
        return compact ? 300 : 340
      case 'radar':
        return compact ? 300 : 360
    }
  })()

  const margin = narrow
    ? { top: 4, right: 4, bottom: 4, left: 4 }
    : { top: 8, right: 16, bottom: 8, left: 8 }

  return { height, compact, narrow, margin }
}

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
          <span className="mdx-chart-empty-icon">-</span>
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
