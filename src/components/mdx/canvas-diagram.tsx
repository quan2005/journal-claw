import { useEffect, useRef, useState, useMemo } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface CanvasNode {
  id: string
  label: string
  type?: 'start' | 'process' | 'decision' | 'input' | 'output'
}

interface CanvasEdge {
  from: string
  to: string
  label?: string
}

interface Props {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  caption?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// Theme
// ═══════════════════════════════════════════════════════════════════════════

interface Theme {
  bg: string
  fg: string
  accent: string
  accentBg: string
  grid: string
  border: string
  text: string
}

function resolveTheme(): Theme {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark'
  return dark
    ? { bg: '#101010', fg: '#e8e8e8', accent: '#c8933b', accentBg: 'rgba(200,147,59,0.12)', grid: '#2c2c2e', border: '#3a3a3c', text: '#a2a6ae' }
    : { bg: '#fafaf8', fg: '#1c1c1e', accent: '#b8782a', accentBg: '#fbf3e5', grid: '#e5e5e7', border: '#d8dce0', text: '#6a7278' }
}

// ═══════════════════════════════════════════════════════════════════════════
// Layout algorithm
// ═══════════════════════════════════════════════════════════════════════════

const NODE_W = 156
const NODE_H = 38
const LAYER_GAP = 56
const NODE_GAP_X = 28
const PAD_X = 40
const PAD_Y = 32

interface LayoutNode {
  id: string
  label: string
  type: string
  x: number
  y: number
  w: number
  h: number
  layer: number
}

interface LayoutEdge {
  from: LayoutNode
  to: LayoutNode
  label?: string
}

function computeLayout(nodes: CanvasNode[], edges: CanvasEdge[]): { layoutNodes: LayoutNode[]; layoutEdges: LayoutEdge[]; canvasW: number; canvasH: number } {
  const nodeMap = new Map<string, CanvasNode>()
  for (const n of nodes) nodeMap.set(n.id, n)

  const inDegree = new Map<string, number>()
  const outEdges = new Map<string, string[]>()
  for (const n of nodes) { inDegree.set(n.id, 0); outEdges.set(n.id, []) }
  for (const e of edges) {
    inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1)
    outEdges.get(e.from)?.push(e.to)
  }

  // Assign layers via BFS from root nodes (inDegree === 0)
  const layer = new Map<string, number>()
  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) { layer.set(id, 0); queue.push(id) }
  }
  // If all nodes have incoming edges (cycle), pick first node
  if (queue.length === 0 && nodes.length > 0) {
    layer.set(nodes[0].id, 0)
    queue.push(nodes[0].id)
  }

  while (queue.length > 0) {
    const cur = queue.shift()!
    const curLayer = layer.get(cur)!
    for (const next of outEdges.get(cur) || []) {
      if (!layer.has(next)) {
        layer.set(next, curLayer + 1)
        queue.push(next)
      } else {
        layer.set(next, Math.max(layer.get(next)!, curLayer + 1))
      }
    }
  }

  // Assign remaining unlayered nodes
  let maxLayer = 0
  for (const n of nodes) {
    if (!layer.has(n.id)) layer.set(n.id, 0)
    maxLayer = Math.max(maxLayer, layer.get(n.id)!)
  }

  // Group nodes by layer
  const layerGroups = new Map<number, CanvasNode[]>()
  for (const n of nodes) {
    const l = layer.get(n.id) || 0
    if (!layerGroups.has(l)) layerGroups.set(l, [])
    layerGroups.get(l)!.push(n)
  }

  // Position nodes
  const layoutNodes: LayoutNode[] = []
  let maxRowWidth = 0

  for (let l = 0; l <= maxLayer; l++) {
    const group = layerGroups.get(l) || []
    const rowW = group.length * NODE_W + (group.length - 1) * NODE_GAP_X
    maxRowWidth = Math.max(maxRowWidth, rowW)

    for (let i = 0; i < group.length; i++) {
      const n = group[i]
      layoutNodes.push({
        id: n.id,
        label: n.label,
        type: n.type || 'process',
        x: PAD_X + (rowW / 2 - (group.length * (NODE_W + NODE_GAP_X) - NODE_GAP_X) / 2) + i * (NODE_W + NODE_GAP_X),
        y: PAD_Y + l * (NODE_H + LAYER_GAP),
        w: NODE_W,
        h: NODE_H,
        layer: l,
      })
    }
  }

  const canvasW = Math.max(520, Math.ceil(PAD_X * 2 + maxRowWidth))
  const canvasH = Math.ceil(PAD_Y * 2 + (maxLayer + 1) * NODE_H + maxLayer * LAYER_GAP)

  const lnMap = new Map<string, LayoutNode>()
  for (const ln of layoutNodes) lnMap.set(ln.id, ln)

  const layoutEdges: LayoutEdge[] = []
  for (const e of edges) {
    const from = lnMap.get(e.from)
    const to = lnMap.get(e.to)
    if (from && to) layoutEdges.push({ from, to, label: e.label })
  }

  return { layoutNodes, layoutEdges, canvasW, canvasH }
}

// ═══════════════════════════════════════════════════════════════════════════
// Drawing helpers
// ═══════════════════════════════════════════════════════════════════════════

function drawNode(ctx: CanvasRenderingContext2D, t: Theme, n: LayoutNode) {
  const { x, y, w, h } = n

  if (n.type === 'decision') {
    // Diamond
    const cx = x + w / 2, cy = y + h / 2
    const dw = w * 0.75, dh = h * 1.2
    ctx.fillStyle = t.accentBg
    ctx.beginPath()
    ctx.moveTo(cx, cy - dh / 2)
    ctx.lineTo(cx + dw / 2, cy)
    ctx.lineTo(cx, cy + dh / 2)
    ctx.lineTo(cx - dw / 2, cy)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = t.accent
    ctx.lineWidth = 1.25
    ctx.stroke()
    ctx.fillStyle = t.fg
    ctx.font = '13px system-ui'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(n.label, cx, cy)
  } else if (n.type === 'start' || n.type === 'output') {
    // Strong accent background
    ctx.fillStyle = t.accent
    roundRect(ctx, x, y, w, h, 8)
    ctx.fill()
    ctx.fillStyle = n.type === 'start' ? t.bg : t.bg
    ctx.font = '600 13px system-ui'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(n.label, x + w / 2, y + h / 2)
  } else {
    // Default process node
    ctx.fillStyle = t.accentBg
    roundRect(ctx, x, y, w, h, 8)
    ctx.fill()
    ctx.strokeStyle = t.border
    ctx.lineWidth = 1.25
    roundRect(ctx, x, y, w, h, 8)
    ctx.stroke()
    ctx.fillStyle = t.fg
    ctx.font = '13px system-ui'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(n.label, x + w / 2, y + h / 2)
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function drawArrowHead(ctx: CanvasRenderingContext2D, toX: number, toY: number, angle: number, size: number) {
  ctx.beginPath()
  ctx.moveTo(toX, toY)
  ctx.lineTo(toX - size * Math.cos(angle - Math.PI / 7), toY - size * Math.sin(angle - Math.PI / 7))
  ctx.lineTo(toX - size * Math.cos(angle + Math.PI / 7), toY - size * Math.sin(angle + Math.PI / 7))
  ctx.closePath()
  ctx.fill()
}

function drawEdge(ctx: CanvasRenderingContext2D, t: Theme, edge: LayoutEdge) {
  const fromCx = edge.from.x + edge.from.w / 2
  const fromCy = edge.from.y + edge.from.h
  const toCx = edge.to.x + edge.to.w / 2
  const toCy = edge.to.y

  ctx.strokeStyle = t.border
  ctx.lineWidth = 1.25
  ctx.fillStyle = t.border

  const midY = (fromCy + toCy) / 2

  // Orthogonal path: down → across → down
  ctx.beginPath()
  ctx.moveTo(fromCx, fromCy)
  if (Math.abs(fromCx - toCx) < 4 && edge.from.layer + 1 === edge.to.layer) {
    // Direct vertical when aligned
    ctx.lineTo(toCx, toCy)
  } else {
    ctx.lineTo(fromCx, midY)
    ctx.lineTo(toCx, midY)
    ctx.lineTo(toCx, toCy)
  }
  ctx.stroke()

  // Arrowhead at endpoint
  const angle = Math.PI / 2 // pointing down
  ctx.fillStyle = t.border
  drawArrowHead(ctx, toCx, toCy - 1, angle, 7)

  // Edge label
  if (edge.label) {
    ctx.fillStyle = t.text
    ctx.font = '11px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText(edge.label, (fromCx + toCx) / 2 + 40, midY - 5)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export function CanvasDiagram({ nodes, edges, caption }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [, setTick] = useState(0)

  // Re-render on theme change
  useEffect(() => {
    const observer = new MutationObserver(() => setTick((n) => n + 1))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  const { layoutNodes, layoutEdges, canvasW, canvasH } = useMemo(
    () => computeLayout(nodes, edges),
    [nodes, edges],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = canvasW * dpr
    canvas.height = canvasH * dpr
    canvas.style.width = `${canvasW}px`
    canvas.style.height = `${canvasH}px`

    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)

    const t = resolveTheme()

    // Background
    ctx.fillStyle = t.bg
    ctx.fillRect(0, 0, canvasW, canvasH)

    // Edges
    for (const edge of layoutEdges) {
      drawEdge(ctx, t, edge)
    }

    // Nodes (drawn after edges so they're on top)
    for (const node of layoutNodes) {
      drawNode(ctx, t, node)
    }
  }, [layoutNodes, layoutEdges, canvasW, canvasH])

  return (
    <div className="mdx-diagram-frame">
      <div className="mdx-diagram-body" ref={containerRef} style={{ overflow: 'auto' }}>
        <canvas ref={canvasRef} style={{ display: 'block', margin: '0 auto' }} />
      </div>
      {caption && <div className="mdx-diagram-caption">{caption}</div>}
    </div>
  )
}
