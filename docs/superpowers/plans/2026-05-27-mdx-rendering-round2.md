# MDX Rendering System Round 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade MDX component library from "renders" to "product-grade content display system" — fixing Mermaid rendering, adding Chart adaptive layout, and rebuilding Phone mockup with polished CSS.

**Architecture:** Three independent modules: (1) Mermaid rendering pipeline fix with error fallback and type detection, (2) ChartFrame wrapper with ResizeObserver-driven adaptive layout, donut+legend PieChart, and adaptive RadarChart, (3) Pure-CSS Phone mockup v2 with device density context. All modules share existing `useChartTheme()` / `useMermaidTheme()` MutationObserver pattern for dark mode.

**Tech Stack:** React 19, TypeScript, Recharts, Mermaid, CSS custom properties, MutationObserver

---

## File Map

| File | Change | Purpose |
|---|---|---|
| `src/components/mdx/mermaid.tsx` | Rewrite | Fix render pipeline, add DiagramFrame, error fallback, type detection |
| `src/components/mdx/chart-impl.tsx` | Major edit | Add ChartFrame, useChartLayout, adaptive heights, empty/error states, donut PieChart |
| `src/components/mdx/charts.tsx` | Edit | Wire ChartFrame into chart wrappers |
| `src/components/mdx/device-mockups.tsx` | Rewrite | Pure-CSS iPhone 15 Pro with gradient shell, island, buttons |
| `src/components/mdx/layout.tsx` | Edit | Add DeviceShowcase component |
| `src/styles/mdx.css` | Major edit | Device v2 styles, ChartFrame styles, DiagramFrame styles, device-content density rules |
| `src/components/mdx/index.ts` | Edit | Export new components |
| `src/components/mdx/cards.tsx` | Edit | Card reads DeviceDensity context for auto-compact |
| `src/components/mdx/display.tsx` | Edit | Stat/Progress read DeviceDensity context |

---

### Task 1: Fix Mermaid rendering pipeline + add error fallback

**Files:**
- Modify: `src/components/mdx/mermaid.tsx` (rewrite)
- Modify: `src/styles/mdx.css` (DiagramFrame + Mermaid SVG styles)

**Context:** The current Mermaid component uses async `mermaid.render()` with `theme: 'base'` and MutationObserver-driven theme variables. The demo MDX file shows captions but no SVG diagrams. The render logic looks structurally correct, so the bug is likely: (a) Mermaid parse errors swallowed by the catch but displayed as tiny red text that's easy to miss, (b) chart string indentation causing parse failures, (c) `theme: 'base'` not applying themeVariables correctly for all diagram types. The fix: switch to `theme: 'default'` (which fully respects themeVariables), add dedent normalization, make error state prominent with expandable source view, add loading state, and add DiagramFrame wrapper.

- [ ] **Step 1: Rewrite `src/components/mdx/mermaid.tsx`**

Replace entire file with:

```tsx
import { useEffect, useState, useRef, useMemo } from 'react'
import type mermaidType from 'mermaid'

interface Props {
  chart: string
  caption?: string
}

// ── Theme hook (unchanged from current) ─────────────────

function useMermaidTheme() {
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
    themeVariables: isDark
      ? {
          primaryColor: '#c8933b',
          primaryBorderColor: '#c8933b',
          lineColor: '#8e8e93',
          textColor: '#a8acb4',
          primaryTextColor: '#e8e8e8',
          mainBkg: '#1c1c1e',
          secondBkg: '#2c2c2e',
          tertiaryColor: '#0f0f0f',
          background: '#0f0f0f',
        }
      : {
          primaryColor: '#b8782a',
          primaryBorderColor: '#b8782a',
          lineColor: '#6a7278',
          textColor: '#2a3038',
          primaryTextColor: '#1c1c1e',
          mainBkg: '#ffffff',
          secondBkg: '#f7f8f9',
          tertiaryColor: '#f5f6f7',
          background: '#ffffff',
        },
  }
}

// ── Type detection ──────────────────────────────────────

function detectMermaidType(chart: string): string {
  const first = chart.trim().split('\n')[0]?.trim() ?? ''
  if (first.startsWith('flowchart') || first.startsWith('graph')) return 'flowchart'
  if (first.startsWith('sequenceDiagram')) return 'sequence'
  if (first.startsWith('gantt')) return 'gantt'
  if (first.startsWith('classDiagram')) return 'class'
  if (first.startsWith('erDiagram')) return 'er'
  if (first.startsWith('pie')) return 'pie'
  if (first.startsWith('stateDiagram')) return 'state'
  return 'unknown'
}

// ── Mermaid module singleton ────────────────────────────

let mermaidModule: typeof mermaidType | null = null

async function getMermaid(themeVars: Record<string, string>) {
  if (!mermaidModule) {
    mermaidModule = (await import('mermaid')).default
  }
  mermaidModule.initialize({
    startOnLoad: false,
    theme: 'default',
    themeVariables: themeVars,
    securityLevel: 'strict',
    htmlLabels: false,
  })
  return mermaidModule
}

// ── Normalize chart string (dedent) ─────────────────────

function dedent(str: string): string {
  const lines = str.split('\n')
  const minIndent = lines
    .filter((l) => l.trim().length > 0)
    .reduce((min, l) => Math.min(min, l.match(/^ */)?.[0].length ?? 0), Infinity)
  if (minIndent === Infinity || minIndent === 0) return str
  return lines.map((l) => l.slice(minIndent)).join('\n')
}

// ── Main component ──────────────────────────────────────

export function Mermaid({ chart, caption }: Props) {
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const { themeVariables, isDark } = useMermaidTheme()
  const renderId = useRef(`mermaid-${Math.random().toString(36).slice(2, 8)}`)
  const diagramType = useMemo(() => detectMermaidType(chart), [chart])

  const normalizedChart = useMemo(() => dedent(chart), [chart])

  useEffect(() => {
    let cancelled = false
    setSvg(null)
    setError(null)
    setLoading(true)

    getMermaid(themeVariables)
      .then(async (mermaid) => {
        const { svg: rendered } = await mermaid.render(renderId.current, normalizedChart)
        if (!cancelled) {
          setSvg(rendered)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [normalizedChart, themeVariables])

  return (
    <div className={`mdx-diagram-frame${diagramType === 'gantt' ? ' mdx-diagram-frame--gantt' : ''}`}>
      <div className="mdx-diagram-body">
        {error ? (
          <div className="mdx-diagram-error">
            <div className="mdx-diagram-error-title">Diagram render failed</div>
            <div className="mdx-diagram-error-message">{error}</div>
            <details className="mdx-diagram-error-source">
              <summary>View Mermaid source</summary>
              <pre>{normalizedChart}</pre>
            </details>
          </div>
        ) : svg ? (
          <div
            className="mdx-mermaid-svg"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : loading ? (
          <div className="mdx-diagram-loading" style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>
            Rendering diagram...
          </div>
        ) : null}
      </div>
      {caption && <div className="mdx-diagram-caption">{caption}</div>}
    </div>
  )
}
```

- [ ] **Step 2: Replace Mermaid CSS in `src/styles/mdx.css`**

Find the existing `/* ── Task 12: Mermaid ── */` section (around line 719) and the `/* ── Mermaid ── */` block. Replace both with:

```css
/* ── Diagram Frame (Mermaid) ── */

.mdx-diagram-frame {
  border: 1px solid var(--divider);
  border-radius: 10px;
  background: var(--bg-secondary);
  overflow: hidden;
  margin: var(--space-4) 0;
}

.mdx-diagram-body {
  padding: 24px;
  overflow: auto;
  min-height: 220px;
}

.mdx-diagram-caption {
  border-top: 1px solid var(--divider);
  padding: 10px 14px;
  color: var(--text-tertiary);
  font-size: 12px;
  text-align: center;
}

/* Mermaid SVG */
.mdx-mermaid-svg svg {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0 auto;
}

.mdx-mermaid-svg .node rect,
.mdx-mermaid-svg .node polygon,
.mdx-mermaid-svg .node circle {
  rx: 4px;
}

.mdx-mermaid-svg text {
  font-family: Inter, ui-sans-serif, system-ui;
}

/* Gantt: allow horizontal scroll */
.mdx-diagram-frame--gantt .mdx-mermaid-svg svg {
  max-width: none;
  min-width: 860px;
}

/* Error state */
.mdx-diagram-error {
  padding: var(--space-4);
  color: var(--status-danger);
  font-size: var(--text-sm);
}
.mdx-diagram-error-title {
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-1);
}
.mdx-diagram-error-message {
  font-size: var(--text-xs);
  opacity: 0.8;
  margin-bottom: var(--space-3);
}
.mdx-diagram-error-source {
  font-size: var(--text-xs);
}
.mdx-diagram-error-source summary {
  cursor: pointer;
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
}
.mdx-diagram-error-source pre {
  background: var(--md-pre-bg);
  color: var(--md-pre-text);
  padding: var(--space-3);
  border-radius: 6px;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  white-space: pre-wrap;
  word-break: break-word;
}
```

Also find and remove the old `.mdx-mermaid` and `.mdx-mermaid-caption` rules (lines 720-733 in current file).

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/mdx/mermaid.tsx src/styles/mdx.css
git commit -m "fix: rewrite Mermaid component with error fallback, dedent, and DiagramFrame

- Switch from theme:base to theme:default for reliable themeVariables
- Add dedent() to normalize indented chart strings from MDX
- Add detectMermaidType() for gantt horizontal scroll
- Add prominent error state with expandable source view
- Add loading state during async render
- Replace bare mdx-mermaid div with DiagramFrame (border, caption footer)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: Add ChartFrame with ResizeObserver and adaptive height

**Files:**
- Modify: `src/components/mdx/chart-impl.tsx` (add ChartFrame, useChartLayout, useContainerWidth)
- Modify: `src/components/mdx/charts.tsx` (wire ChartFrame into wrappers)
- Modify: `src/styles/mdx.css` (ChartFrame styles, empty/error states)

- [ ] **Step 1: Add ChartFrame, useContainerWidth, useChartLayout to `src/components/mdx/chart-impl.tsx`**

Add these new exports at the top of the file (keep existing `useChartTheme` and all 4 chart impls, but they will be refactored in later tasks):

```tsx
import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'

// ... keep existing imports from recharts ...

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

type ChartType = 'bar' | 'line' | 'pie' | 'radar'

interface ChartLayout {
  height: number
  compact: boolean
  narrow: boolean
  margin: { top: number; right: number; bottom: number; left: number }
}

function useChartLayout(type: ChartType, containerWidth: number, dataLength: number): ChartLayout {
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
```

Update the existing imports at the top of the file — replace the existing `import { useState, useEffect } from 'react'` with:

```tsx
import { useState, useEffect, useRef, type ReactNode } from 'react'
```

- [ ] **Step 2: Add ChartFrame CSS to `src/styles/mdx.css`**

Find the existing `/* ── Task 11: Charts ── */` section and replace with:

```css
/* ── Charts ── */

.mdx-chart {
  margin: var(--space-4) 0;
  padding: var(--space-4);
  border: 1px solid var(--divider);
  border-radius: 10px;
  background: var(--bg-secondary);
}

.mdx-chart-title {
  font-weight: var(--font-medium);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-bottom: var(--space-4);
}

/* Empty state */
.mdx-chart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 200px;
  color: var(--text-tertiary);
  font-size: var(--text-sm);
}

.mdx-chart-empty-icon {
  font-size: var(--text-2xl);
  opacity: 0.3;
}

/* Error state */
.mdx-chart-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 200px;
  color: var(--status-danger);
  font-size: var(--text-sm);
}

.mdx-chart-error-icon {
  font-size: var(--text-xl);
  opacity: 0.5;
}
```

- [ ] **Step 3: Update chart wrappers in `src/components/mdx/charts.tsx`**

Replace the entire file with wrappers that use ChartFrame. The lazy-loaded impl components now receive `height` and `compact` from ChartFrame:

```tsx
import { lazy } from 'react'
import { ChartFrame } from './chart-impl'
import type { ChartLayout } from './chart-impl'

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
```

- [ ] **Step 4: Export ChartLayout type from `src/components/mdx/chart-impl.tsx`**

Add to the file (after the `useChartLayout` function):

```tsx
export type { ChartLayout }
```

And update the `useChartLayout` export to be exported:

```tsx
export function useChartLayout(...)
```

- [ ] **Step 5: TypeScript check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/mdx/chart-impl.tsx src/components/mdx/charts.tsx src/styles/mdx.css
git commit -m "feat: add ChartFrame with ResizeObserver, adaptive height, and empty state

- useContainerWidth hook with ResizeObserver for responsive charts
- useChartLayout computes height/compact/narrow/margin from container width
- ChartFrame renders title, empty state, and children as render prop
- Chart wrappers pass layout to lazy-loaded impl components

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: Update BarChart and LineChart to use layout props

**Files:**
- Modify: `src/components/mdx/chart-impl.tsx`

- [ ] **Step 1: Update BarChartImpl to accept layout prop**

Replace the existing `BarChartImpl` function with:

```tsx
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
  const minPlotWidth = Math.max(0, data.length * maxBarWidth)

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
            color: t.isDark ? '#e8e8e8' : '#1c1c1e',
          }}
          cursor={{ fill: t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}
        />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={maxBarWidth} />
      </RechartsBar>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 2: Update LineChartImpl to accept layout prop**

Replace the existing `LineChartImpl` function with:

```tsx
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

  // Y-axis breathing room
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
            color: t.isDark ? '#e8e8e8' : '#1c1c1e',
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
```

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/mdx/chart-impl.tsx
git commit -m "feat: adapt BarChart and LineChart to ChartFrame layout props

- BarChart: maxBarWidth adapts to compact/narrow, dynamic bar sizing
- LineChart: Y-axis domain auto-padding (10% breathing room)
- Both: tooltip cursor and contentStyle use theme tokens

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: PieChart donut + legend and RadarChart adaptive radius

**Files:**
- Modify: `src/components/mdx/chart-impl.tsx`

- [ ] **Step 1: Rewrite PieChartImpl as donut with legend**

Replace the existing `PieChartImpl` function with:

```tsx
export function PieChartImpl({
  data,
  layout,
}: {
  data: ChartData[]
  color?: string
  layout: ChartLayout
}) {
  const t = useChartTheme()

  // Collapse small slices when > 6 items
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

  // Build legend items with percentage
  const total = displayData.reduce((s, d) => s + d.value, 0)

  return (
    <div style={{ display: 'flex', flexDirection: layout.compact ? 'column' : 'row', alignItems: 'center', gap: layout.compact ? 16 : 32 }}>
      <div style={{ flex: layout.compact ? 'none' : '0 0 55%', minWidth: 0 }}>
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
                color: t.isDark ? '#e8e8e8' : '#1c1c1e',
              }}
              formatter={(value: number, name: string) => [`${value} (${total > 0 ? Math.round((value / total) * 100) : 0}%)`, name]}
            />
          </RechartsPie>
        </ResponsiveContainer>
      </div>
      <div style={{ flex: layout.compact ? 'none' : '0 0 auto', display: 'flex', flexDirection: layout.compact ? 'row' : 'column', flexWrap: 'wrap', gap: layout.compact ? 12 : 8 }}>
        {displayData.map((d, i) => (
          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: t.isDark ? '#a8acb4' : '#2a3038' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: t.pieColors[i % t.pieColors.length], flexShrink: 0 }} />
            <span>{d.label}</span>
            <span style={{ color: t.text, fontSize: 12 }}>{total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

Add `useMemo` to the React imports at the top of the file:

```tsx
import { useState, useEffect, useRef, useMemo, type ReactNode } from 'react'
```

- [ ] **Step 2: Rewrite RadarChartImpl with adaptive radius**

Replace the existing `RadarChartImpl` function with:

```tsx
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
  const outerRadius = layout.compact ? '64%' : '76%'

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
            color: t.isDark ? '#e8e8e8' : '#1c1c1e',
          }}
        />
        <Radar
          dataKey="value"
          stroke={color}
          fill={color}
          fillOpacity={0.18}
        />
      </RechartsRadar>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/mdx/chart-impl.tsx
git commit -m "feat: donut PieChart with legend and adaptive RadarChart radius

- PieChart: donut (48-52% inner radius), right/below legend, no labels
- PieChart: auto-collapse slices < 3% into 'Other' when > 6 items
- PieChart: horizontal layout on desktop, stacked on compact
- RadarChart: outerRadius 64% compact / 76% desktop
- Both: unified tooltip styling

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5: Phone Mockup v2 — Pure CSS rebuild

**Files:**
- Modify: `src/components/mdx/device-mockups.tsx` (complete rewrite)
- Modify: `src/styles/mdx.css` (replace device styles)

- [ ] **Step 1: Rewrite `src/components/mdx/device-mockups.tsx`**

Replace entire file with:

```tsx
import { createContext, useContext, type ReactNode } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// Device Density Context
// ═══════════════════════════════════════════════════════════════════════════

type Density = 'default' | 'compact' | 'presentation'

const DeviceDensityContext = createContext<Density>('default')

export function useDeviceDensity(): Density {
  return useContext(DeviceDensityContext)
}

// ═══════════════════════════════════════════════════════════════════════════
// Iphone — Pure CSS iPhone 15 Pro mockup
// ═══════════════════════════════════════════════════════════════════════════

export interface IphoneProps {
  src?: string
  alt?: string
  children?: ReactNode
  model?: 'iphone-15-pro' | 'iphone-15' | 'generic'
  size?: 'sm' | 'md' | 'lg' | 'auto'
  tone?: 'graphite' | 'titanium' | 'black'
  density?: Density
  showIsland?: boolean
  showButtons?: boolean
  showSpeaker?: boolean
  screenPadding?: 'none' | 'sm' | 'md' | 'lg'
  fit?: 'contain' | 'cover'
  className?: string
}

const sizeMap: Record<string, string> = {
  sm: '280px',
  md: '320px',
  lg: '380px',
  auto: '100%',
}

const screenPaddingMap: Record<string, string> = {
  none: '0',
  sm: '8px',
  md: '16px',
  lg: '24px',
}

export function Iphone({
  src,
  alt,
  children,
  size = 'md',
  density = 'default',
  showIsland = true,
  showButtons = true,
  showSpeaker = true,
  screenPadding = 'md',
  fit = 'contain',
  className,
}: IphoneProps) {
  const deviceWidth = sizeMap[size]
  const contentPadding = screenPaddingMap[screenPadding]

  return (
    <DeviceDensityContext.Provider value={density}>
      <div
        className={`mdx-device-v2 ${className ?? ''}`}
        data-density={density}
        style={{ '--device-width': deviceWidth } as React.CSSProperties}
      >
        <div className="device-frame-v2">
          {/* Side buttons */}
          {showButtons && (
            <>
              <div className="device-btn-v2 device-btn-v2--left-top" />
              <div className="device-btn-v2 device-btn-v2--left-mid" />
              <div className="device-btn-v2 device-btn-v2--left-bottom" />
              <div className="device-btn-v2 device-btn-v2--right" />
            </>
          )}

          <div className="device-screen-v2">
            {/* Dynamic Island */}
            {showIsland && <div className="device-island-v2">{showSpeaker && <div className="device-speaker-v2" />}</div>}

            {/* Screen content */}
            <div
              className="device-content-v2"
              style={{ padding: screenPaddingMap[screenPadding] !== '0' ? undefined : 0 }}
              data-screen-padding={screenPadding}
            >
              {src ? (
                <img
                  src={src}
                  alt={alt ?? ''}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: fit,
                    objectPosition: 'top',
                  }}
                />
              ) : (
                children
              )}
            </div>
          </div>
        </div>
      </div>
    </DeviceDensityContext.Provider>
  )
}
```

- [ ] **Step 2: Replace device CSS in `src/styles/mdx.css`**

Find the existing `/* ── Device Mockups ── */` section (starts around line 736) and replace everything from there to the end of the file with:

```css
/* ── Device Mockups v2 ── */

.mdx-device-v2 {
  --device-width: 320px;
  width: var(--device-width);
  max-width: 100%;
  margin: 0 auto;
}

/* ── Frame (outer shell) ── */

.device-frame-v2 {
  position: relative;
  aspect-ratio: 393 / 852;
  width: 100%;
  border-radius: 54px;
  padding: 10px;
  background:
    linear-gradient(145deg, #3a3a3a, #1f1f1f 45%, #0f0f0f);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.12),
    inset 0 0 0 3px rgba(0, 0, 0, 0.45),
    0 24px 80px rgba(0, 0, 0, 0.32),
    0 8px 24px rgba(0, 0, 0, 0.2);
}

/* Dark mode frame — lighter gradient */
[data-theme='dark'] .device-frame-v2 {
  background:
    linear-gradient(145deg, #4a4a4a, #2a2a2a 45%, #1a1a1a);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .device-frame-v2 {
    background:
      linear-gradient(145deg, #4a4a4a, #2a2a2a 45%, #1a1a1a);
  }
}

/* ── Side buttons ── */

.device-btn-v2 {
  position: absolute;
  background: #2a2a2a;
  border-radius: 3px 0 0 3px;
  z-index: 1;
}

.device-btn-v2--left-top {
  left: -2px;
  top: 150px;
  width: 2.5px;
  height: 36px;
  border-radius: 2px 0 0 2px;
}

.device-btn-v2--left-mid {
  left: -2px;
  top: 210px;
  width: 2.5px;
  height: 64px;
  border-radius: 2px 0 0 2px;
}

.device-btn-v2--left-bottom {
  left: -2px;
  top: 295px;
  width: 2.5px;
  height: 36px;
  border-radius: 2px 0 0 2px;
}

.device-btn-v2--right {
  right: -2px;
  top: 260px;
  width: 2.5px;
  height: 72px;
  border-radius: 0 2px 2px 0;
}

/* ── Screen ── */

.device-screen-v2 {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 44px;
  background: #202020;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.06),
    inset 0 18px 40px rgba(255, 255, 255, 0.025);
}

/* ── Dynamic Island ── */

.device-island-v2 {
  position: absolute;
  top: 12px;
  left: 50%;
  width: 88px;
  height: 24px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: #080808;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.04),
    0 1px 2px rgba(255, 255, 255, 0.06);
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
}

.device-speaker-v2 {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
}

/* ── Content area ── */

.device-content-v2 {
  height: 100%;
  padding: 72px 22px 24px;
  font-size: 12px;
  line-height: 1.55;
  overflow-y: auto;
  overflow-x: hidden;
}

/* Density: presentation */
.mdx-device-v2[data-density='presentation'] .device-content-v2 {
  padding: 72px 28px 28px;
  font-size: 13px;
  line-height: 1.7;
}

/* Density: compact */
.mdx-device-v2[data-density='compact'] .device-content-v2 {
  padding: 72px 18px 20px;
  font-size: 10px;
  line-height: 1.6;
}

/* ── Device-content density rules for child components ── */

.device-content-v2 .mdx-card {
  padding: 14px;
  border-radius: 12px;
}

.device-content-v2 .mdx-card h3 {
  font-size: 11px;
}

.device-content-v2 .mdx-card p {
  font-size: 10px;
}

.device-content-v2 .mdx-stat-value {
  font-size: 24px;
}

.device-content-v2 .mdx-stat-label {
  font-size: 10px;
}

.device-content-v2 .mdx-progress-bar {
  height: 4px;
}

.device-content-v2 .mdx-progress-label {
  font-size: 10px;
}

.device-content-v2 .mdx-tag {
  font-size: 9px;
  padding: 2px 6px;
}

.device-content-v2 .mdx-cards {
  grid-template-columns: 1fr;
  gap: 8px;
}

/* ── Device Showcase (dual phone layout) ── */

.mdx-device-showcase {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: clamp(40px, 8vw, 96px);
  align-items: start;
  justify-items: center;
  padding: 24px 0 8px;
  margin: var(--space-4) 0;
}
```

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/mdx/device-mockups.tsx src/styles/mdx.css
git commit -m "feat: rebuild Phone mockup with pure CSS gradient shell and DeviceDensity context

- Replace SVG-based iPhone with pure CSS: gradient frame, box-shadow depth
- Dynamic Island with optional speaker dot
- Side buttons as positioned pseudo-elements
- DeviceDensityContext for auto-compact child components
- CSS density rules for Card/Stat/Progress/TagList inside device-content
- Screen content padding and overflow handling

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6: Add DeviceShowcase component

**Files:**
- Modify: `src/components/mdx/layout.tsx`
- Modify: `src/components/mdx/index.ts`

- [ ] **Step 1: Add DeviceShowcase to `src/components/mdx/layout.tsx`**

Append to the end of the file:

```tsx
export function DeviceShowcase({ children }: { children: React.ReactNode }) {
  return <div className="mdx-device-showcase">{children}</div>
}
```

- [ ] **Step 2: Export DeviceShowcase and useDeviceDensity from `src/components/mdx/index.ts`**

Add to the device mockups export line (line 37):

```tsx
export { Iphone, useDeviceDensity } from './device-mockups'
```

Add to the layout export line (line 2):

```tsx
export { Split, Columns, Column, Mockup, Placeholder, DeviceShowcase } from './layout'
```

Add DeviceShowcase to the import block (around line 44):

```tsx
import { Split, Columns, Column, Mockup, Placeholder, DeviceShowcase } from './layout'
```

Add DeviceShowcase to the `mdxComponents` map — insert `DeviceShowcase,` on its own line after the `Iphone,` line (around line 64):

```tsx
  DeviceShowcase,
```

Note: `useDeviceDensity` is a hook, not a component — it should NOT be added to `mdxComponents`.

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/mdx/layout.tsx src/components/mdx/index.ts
git commit -m "feat: add DeviceShowcase layout and export useDeviceDensity

- DeviceShowcase: responsive grid for dual phone displays
- useDeviceDensity: React context hook for reading device density

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 7: Demo MDX cleanup — use new component APIs

**Files:**
- Modify: `~/Documents/journal/2605/26-全组件展示-设计系统验证.mdx`

- [ ] **Step 1: Update the MDX file to use DeviceShowcase and v2 Iphone**

Replace the iPhone split section (lines 487-505) — the two Iphone blocks inside Split — with DeviceShowcase:

```mdx
### Iphone — iPhone 15 Pro

手机模型支持 `src` 截图或 `children` 自定义内容。内置灵动岛和侧边按钮细节。

<DeviceShowcase>
  <Iphone density="compact">
    <Stack gap={2}>
      <Stat label="今日日志" value={5} suffix="篇" />
      <Progress value={72} label="周目标完成度" />
      <TagList tags={['会议', '设计', '开发']} />
    </Stack>
  </Iphone>
  <Iphone density="compact">
    <Cards>
      <Card title="晨会纪要" description="3 项待办 · 1 项决议" />
      <Card title="设计走查" description="5 条反馈 · 已修复" />
    </Cards>
  </Iphone>
</DeviceShowcase>
```

Remove the wrapping `<Split>` and `<Column>` elements that were around the two Iphones. Keep the preceding description paragraph and heading.

- [ ] **Step 2: Verify the file is valid**

Read the file to confirm no orphaned tags.

- [ ] **Step 3: Commit**

```bash
git add ~/Documents/journal/2605/26-全组件展示-设计系统验证.mdx
git commit -m "refactor: use DeviceShowcase and v2 Iphone in demo MDX

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 8: Final integration — type check and visual verification

- [ ] **Step 1: Full TypeScript check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: successful build.

- [ ] **Step 3: Start dev server for visual verification**

Run: `npm run dev`
Then open the demo MDX file in the app to verify:
- Mermaid flowchart and gantt render (not just captions)
- Charts adapt to container width
- PieChart shows donut + legend
- RadarChart fills container
- iPhone mockup has gradient shell, island, buttons
- DeviceShowcase shows two phones side-by-side
- Dark mode toggle works for all components

- [ ] **Step 4: Commit if any minor fixes were needed**

```bash
git add -A
git commit -m "chore: final integration fixes for MDX rendering round 2

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Verification Checklist

- [ ] `npx tsc --noEmit` — zero TypeScript errors
- [ ] `npm run build` — successful production build
- [ ] Mermaid flowchart renders (not just caption)
- [ ] Mermaid gantt renders with horizontal scroll
- [ ] Mermaid error state shows expandable source
- [ ] Charts use adaptive height (ResizeObserver)
- [ ] PieChart shows donut with side/bottom legend
- [ ] PieChart collapses >6 items into "Other"
- [ ] RadarChart fills container (adaptive outerRadius)
- [ ] BarChart bars have max width limit
- [ ] LineChart Y-axis has breathing room
- [ ] Chart empty state shows message
- [ ] iPhone v2 has gradient shell, Dynamic Island, side buttons
- [ ] DeviceShowcase arranges phones in responsive grid
- [ ] Card/Stat/Progress/TagList auto-compact inside iPhone
- [ ] Dark mode works for all new components
- [ ] Demo MDX file renders without inline styles on Iphone
