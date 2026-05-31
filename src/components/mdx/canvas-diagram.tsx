import { useEffect, useRef, useState, useMemo, useCallback } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

type NodeType = 'start' | 'process' | 'decision' | 'input' | 'output' | 'junction'

export interface CanvasNode {
  id: string
  label: string
  type?: NodeType
}

export interface CanvasEdge {
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
  edgeStroke: string
  labelBg: string
}

function resolveTheme(): Theme {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark'
  return dark
    ? {
        bg: '#101010',
        fg: '#e8e8e8',
        accent: '#c8933b',
        accentBg: 'rgba(200,147,59,0.12)',
        grid: '#2c2c2e',
        border: '#3a3a3c',
        text: '#a2a6ae',
        edgeStroke: 'rgba(255,255,255,0.22)',
        labelBg: '#1c1c1e',
      }
    : {
        bg: '#fafaf8',
        fg: '#1c1c1e',
        accent: '#b8782a',
        accentBg: '#fbf3e5',
        grid: '#e5e5e7',
        border: '#d8dce0',
        text: '#6a7278',
        edgeStroke: 'rgba(0,0,0,0.18)',
        labelBg: '#ffffff',
      }
}

// ═══════════════════════════════════════════════════════════════════════════
// Layout
// ═══════════════════════════════════════════════════════════════════════════

const NODE_W = 156
const NODE_H = 38
const DIAMOND_W = 112
const DIAMOND_H = 56
const LAYER_GAP = 60
const NODE_GAP_X = 28
const PAD_X = 48
const PAD_Y = 36
const MIN_CANVAS_W = 480
const MIN_CANVAS_H = 320
const MAX_CANVAS_H = 720

interface LayoutNode {
  id: string
  label: string
  type: string
  x: number
  y: number
  w: number
  h: number
  layer: number
  visible: boolean
}

interface LayoutEdge {
  from: LayoutNode
  to: LayoutNode
  label?: string
}

function computeLayout(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
): {
  layoutNodes: LayoutNode[]
  layoutEdges: LayoutEdge[]
  canvasW: number
  canvasH: number
} {
  const nodeMap = new Map<string, CanvasNode>()
  for (const n of nodes) nodeMap.set(n.id, n)

  // ── Layer assignment (BFS from roots) ──
  const inDegree = new Map<string, number>()
  const outEdges = new Map<string, string[]>()
  for (const n of nodes) {
    inDegree.set(n.id, 0)
    outEdges.set(n.id, [])
  }
  for (const e of edges) {
    inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1)
    outEdges.get(e.from)?.push(e.to)
  }

  const layer = new Map<string, number>()
  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) {
      layer.set(id, 0)
      queue.push(id)
    }
  }
  if (queue.length === 0 && nodes.length > 0) {
    layer.set(nodes[0].id, 0)
    queue.push(nodes[0].id)
  }

  while (queue.length > 0) {
    const cur = queue.shift()!
    const curLayer = layer.get(cur)!
    for (const next of outEdges.get(cur) || []) {
      const nextLayer = layer.get(next) ?? -1
      if (nextLayer < curLayer + 1) {
        layer.set(next, curLayer + 1)
        queue.push(next)
      }
    }
  }

  let maxLayer = 0
  for (const n of nodes) {
    if (!layer.has(n.id)) layer.set(n.id, 0)
    maxLayer = Math.max(maxLayer, layer.get(n.id)!)
  }

  // ── Junction insertion for convergence points ──
  // When multiple nodes at same layer converge to one target, insert a junction
  const junctionNodes: CanvasNode[] = []
  const junctionEdges: CanvasEdge[] = []
  let jid = 0

  for (const n of nodes) {
    const incoming = edges.filter((e) => e.to === n.id)
    if (incoming.length >= 2) {
      const sources = incoming.map((e) => e.from)
      const sourceLayers = sources.map((s) => layer.get(s) ?? 0)
      const maxSourceLayer = Math.max(...sourceLayers)
      const targetLayer = layer.get(n.id)!

      // Only insert junction if sources are in same layer and target is directly below
      const allSameLayer = sourceLayers.every((l) => l === maxSourceLayer)
      if (allSameLayer && maxSourceLayer === targetLayer - 1) {
        const jId = `__junction_${jid++}`
        junctionNodes.push({ id: jId, label: '', type: 'junction' })
        layer.set(jId, targetLayer) // junction at target's layer

        // Rewire: sources → junction, junction → target
        for (const e of incoming) {
          junctionEdges.push({ from: e.from, to: jId, label: e.label })
        }
        junctionEdges.push({ from: jId, to: n.id })

        // Original incoming edges will be filtered out below
      }
    }
  }

  // Build final edge list: keep non-convergent edges, add junction edges
  const convergentTargets = new Set<string>()
  for (const n of nodes) {
    const incoming = edges.filter((e) => e.to === n.id)
    if (incoming.length >= 2) {
      const sourceLayers = incoming.map((e) => layer.get(e.from) ?? 0)
      const maxSourceLayer = Math.max(...sourceLayers)
      const targetLayer = layer.get(n.id)!
      if (sourceLayers.every((l) => l === maxSourceLayer) && maxSourceLayer === targetLayer - 1) {
        convergentTargets.add(n.id)
      }
    }
  }

  const finalEdges: CanvasEdge[] = []
  for (const e of edges) {
    if (convergentTargets.has(e.to)) continue // replaced by junction
    finalEdges.push(e)
  }
  for (const je of junctionEdges) finalEdges.push(je)

  const allNodes = [...nodes, ...junctionNodes]

  // ── Position nodes ──
  const layerGroups = new Map<number, CanvasNode[]>()
  for (const n of allNodes) {
    const l = layer.get(n.id) || 0
    if (!layerGroups.has(l)) layerGroups.set(l, [])
    layerGroups.get(l)!.push(n)
  }

  const layoutNodes: LayoutNode[] = []

  for (let l = 0; l <= maxLayer; l++) {
    const group = layerGroups.get(l) || []
    const nonJunction = group.filter((n) => n.type !== 'junction')
    const rowW = nonJunction.length * NODE_W + (nonJunction.length - 1) * NODE_GAP_X

    // Position visible nodes
    let vi = 0
    for (const n of group) {
      if (n.type === 'junction') {
        // Junction position will be set after visible nodes
        layoutNodes.push({
          id: n.id,
          label: n.label,
          type: 'junction',
          x: 0,
          y: 0,
          w: 8,
          h: 8,
          layer: l,
          visible: false,
        })
        continue
      }
      const startX = rowW / 2 - ((nonJunction.length - 1) * (NODE_W + NODE_GAP_X)) / 2
      const isDiamond = n.type === 'decision'
      layoutNodes.push({
        id: n.id,
        label: n.label,
        type: n.type || 'process',
        x: startX + vi * (NODE_W + NODE_GAP_X),
        y: l * (NODE_H + LAYER_GAP),
        w: isDiamond ? DIAMOND_W : NODE_W,
        h: isDiamond ? DIAMOND_H : NODE_H,
        layer: l,
        visible: true,
      })
      vi++
    }

    // Position junction at the center of its source nodes
    for (const ln of layoutNodes.filter((n) => n.type === 'junction' && n.layer === l)) {
      const sources = junctionEdges.filter((je) => je.to === ln.id).map((je) => je.from)
      const sourceNodes = layoutNodes.filter((n) => sources.includes(n.id) && n.visible)
      if (sourceNodes.length >= 2) {
        const minX = Math.min(...sourceNodes.map((n) => n.x + n.w / 2))
        const maxX = Math.max(...sourceNodes.map((n) => n.x + n.w / 2))
        ln.x = (minX + maxX) / 2
        ln.y = l * (NODE_H + LAYER_GAP) + NODE_H / 2
      } else {
        ln.x = 240
        ln.y = l * (NODE_H + LAYER_GAP) + NODE_H / 2
      }
    }
  }

  // ── Bounding box of all visible nodes ──
  const visibleNodes = layoutNodes.filter((n) => n.visible)
  if (visibleNodes.length === 0) {
    return { layoutNodes, layoutEdges: [], canvasW: MIN_CANVAS_W, canvasH: MIN_CANVAS_H }
  }

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const n of visibleNodes) {
    minX = Math.min(minX, n.x)
    minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x + n.w)
    maxY = Math.max(maxY, n.y + n.h)
  }

  // Include edge labels in bounds estimate (rough: add 60px right margin per label)
  const hasEdgeLabels = finalEdges.some((e) => e.label)
  const labelMargin = hasEdgeLabels ? 60 : 0

  const boundsW = maxX - minX + labelMargin
  const boundsH = maxY - minY

  const canvasW = Math.max(MIN_CANVAS_W, Math.ceil(boundsW + PAD_X * 2))
  const canvasH = Math.max(MIN_CANVAS_H, Math.min(Math.ceil(boundsH + PAD_Y * 2), MAX_CANVAS_H))

  // ── Center nodes horizontally ──
  const offsetX = (canvasW - (maxX - minX)) / 2 - minX
  const offsetY = (canvasH - boundsH) / 2 - minY

  for (const n of layoutNodes) {
    n.x += offsetX
    n.y += offsetY
  }

  // ── Map edge references to layout nodes ──
  const lnMap = new Map<string, LayoutNode>()
  for (const ln of layoutNodes) lnMap.set(ln.id, ln)

  const layoutEdges: LayoutEdge[] = []
  for (const e of finalEdges) {
    const from = lnMap.get(e.from)
    const to = lnMap.get(e.to)
    if (from && to) layoutEdges.push({ from, to, label: e.label })
  }

  return { layoutNodes, layoutEdges, canvasW, canvasH }
}

// ═══════════════════════════════════════════════════════════════════════════
// Drawing
// ═══════════════════════════════════════════════════════════════════════════

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
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

function drawNode(ctx: CanvasRenderingContext2D, t: Theme, n: LayoutNode) {
  if (n.type === 'junction') {
    // Small filled dot at junction point
    ctx.fillStyle = t.edgeStroke
    ctx.beginPath()
    ctx.arc(n.x, n.y, 4, 0, Math.PI * 2)
    ctx.fill()
    return
  }

  const { x, y, w, h } = n

  if (n.type === 'decision') {
    const cx = x + w / 2,
      cy = y + h / 2
    const dw = w,
      dh = h
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
    ctx.fillStyle = t.accent
    roundRect(ctx, x, y, w, h, 8)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = '600 13px system-ui'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(n.label, x + w / 2, y + h / 2)
  } else {
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

function drawArrow(
  ctx: CanvasRenderingContext2D,
  toX: number,
  toY: number,
  angle: number,
  size: number,
  color: string,
) {
  ctx.fillStyle = color
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

  ctx.strokeStyle = t.edgeStroke
  ctx.lineWidth = 1.4

  const midY = (fromCy + toCy) / 2

  ctx.beginPath()
  ctx.moveTo(fromCx, fromCy)

  if (Math.abs(fromCx - toCx) < 4 && edge.from.layer + 1 <= edge.to.layer) {
    // Direct vertical
    ctx.lineTo(toCx, toCy)
  } else {
    ctx.lineTo(fromCx, midY)
    ctx.lineTo(toCx, midY)
    ctx.lineTo(toCx, toCy)
  }
  ctx.stroke()

  // Arrowhead
  drawArrow(ctx, toCx, toCy - 1, Math.PI / 2, 7, t.edgeStroke)

  // Edge label — above horizontal segment with background
  if (edge.label) {
    const labelX = (fromCx + toCx) / 2
    const labelY = midY - 7

    ctx.font = '11px system-ui'
    const metrics = ctx.measureText(edge.label)
    const lw = metrics.width + 12
    const lh = 18

    // Background pill
    ctx.fillStyle = t.labelBg
    roundRect(ctx, labelX - lw / 2, labelY - lh / 2, lw, lh, 9)
    ctx.fill()

    // Text
    ctx.fillStyle = t.text
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(edge.label, labelX, labelY)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export function CanvasDiagram({ nodes, edges, caption }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [, setTick] = useState(0)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [scale, setScale] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [renderError, setRenderError] = useState<string | null>(null)
  const draggingRef = useRef(false)
  const dragRef = useRef({ startX: 0, startY: 0, panStartX: 0, panStartY: 0 })
  const pinchRef = useRef({
    startDist: 0,
    startScale: 1,
    midX: 0,
    midY: 0,
    panStartX: 0,
    panStartY: 0,
  })

  useEffect(() => {
    const observer = new MutationObserver(() => setTick((n) => n + 1))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
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
    // CSS sizing handled by .mdx-diagram-body canvas { max-width: 100%; height: auto; }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setRenderError('Canvas 2D context is unavailable.')
      return
    }

    setRenderError(null)
    ctx.save()
    try {
      ctx.scale(dpr, dpr)
      ctx.translate(panX, panY)
      ctx.scale(scale, scale)

      const t = resolveTheme()

      // Background — extend beyond viewport to cover pan + zoom offset
      const margin = 200 / scale
      ctx.fillStyle = t.bg
      ctx.fillRect(
        -panX / scale - margin,
        -panY / scale - margin,
        canvasW / scale + margin * 2,
        canvasH / scale + margin * 2,
      )

      // Edges
      for (const edge of layoutEdges) {
        drawEdge(ctx, t, edge)
      }

      // Nodes (on top)
      for (const node of layoutNodes) {
        drawNode(ctx, t, node)
      }
    } catch (error) {
      setRenderError(error instanceof Error ? error.message : String(error))
    } finally {
      ctx.restore()
    }
  }, [layoutNodes, layoutEdges, canvasW, canvasH, panX, panY, scale])

  // ── Pan & Zoom handlers ──

  const getCanvasPos = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect()
    return { left: rect?.left ?? 0, top: rect?.top ?? 0 }
  }, [])

  // Mouse drag pan
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      setIsDragging(true)
      draggingRef.current = true
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        panStartX: panX,
        panStartY: panY,
      }
    },
    [panX, panY],
  )

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setPanX(dragRef.current.panStartX + dx)
    setPanY(dragRef.current.panStartY + dy)
  }, [])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    draggingRef.current = false
  }, [])

  // Wheel: Ctrl/Cmd = zoom-to-cursor. Normal scroll handled by overflow:auto.
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const { left, top } = getCanvasPos()
        const mx = e.clientX - left
        const my = e.clientY - top
        const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08
        setScale((s) => {
          const ns = Math.max(0.2, Math.min(4, s * factor))
          setPanX((px) => mx - (mx - px) * (ns / s))
          setPanY((py) => my - (my - py) * (ns / s))
          return ns
        })
      }
    },
    [getCanvasPos],
  )

  // Touch: single finger pan, two finger pinch zoom
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        const t = e.touches[0]
        dragRef.current = {
          startX: t.clientX,
          startY: t.clientY,
          panStartX: panX,
          panStartY: panY,
        }
        draggingRef.current = true
        setIsDragging(true)
      } else if (e.touches.length === 2) {
        draggingRef.current = false
        const t1 = e.touches[0]
        const t2 = e.touches[1]
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
        const { left, top } = getCanvasPos()
        const mx = (t1.clientX + t2.clientX) / 2 - left
        const my = (t1.clientY + t2.clientY) / 2 - top
        pinchRef.current = {
          startDist: dist,
          startScale: scale,
          midX: mx,
          midY: my,
          panStartX: panX,
          panStartY: panY,
        }
      }
    },
    [panX, panY, scale, getCanvasPos],
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault()
      if (e.touches.length === 1 && draggingRef.current) {
        const t = e.touches[0]
        const dx = t.clientX - dragRef.current.startX
        const dy = t.clientY - dragRef.current.startY
        setPanX(dragRef.current.panStartX + dx)
        setPanY(dragRef.current.panStartY + dy)
      } else if (e.touches.length === 2) {
        const t1 = e.touches[0]
        const t2 = e.touches[1]
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
        const { left, top } = getCanvasPos()
        const mx = (t1.clientX + t2.clientX) / 2 - left
        const my = (t1.clientY + t2.clientY) / 2 - top
        const p = pinchRef.current
        const ns = Math.max(0.2, Math.min(4, p.startScale * (dist / p.startDist)))
        setScale(ns)
        setPanX(mx - (mx - p.panStartX) * (ns / p.startScale))
        setPanY(my - (my - p.panStartY) * (ns / p.startScale))
      }
    },
    [getCanvasPos],
  )

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
    draggingRef.current = false
  }, [])

  return (
    <div className="mdx-diagram-frame">
      <div
        ref={containerRef}
        className="mdx-diagram-body"
        style={{
          overflow: 'auto',
          cursor: isDragging ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {renderError && (
          <div className="mdx-diagram-error">
            <div className="mdx-diagram-error-title">Canvas render failed</div>
            <div className="mdx-diagram-error-message">{renderError}</div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={{ pointerEvents: 'none', display: renderError ? 'none' : undefined }}
        />
      </div>
      {caption && <div className="mdx-diagram-caption">{caption}</div>}
    </div>
  )
}
