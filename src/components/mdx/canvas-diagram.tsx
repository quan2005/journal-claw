import { useEffect, useRef, useState } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// Canvas theme
// ═══════════════════════════════════════════════════════════════════════════

export interface CanvasTheme {
  bg: string
  fg: string
  accent: string
  accentBg: string
  grid: string
  border: string
  text: string
  danger: string
  success: string
}

function resolveTheme(): CanvasTheme {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark'
  return dark
    ? {
        bg: '#0f0f0f',
        fg: '#e8e8e8',
        accent: '#c8933b',
        accentBg: 'rgba(200, 147, 59, 0.12)',
        grid: '#2c2c2e',
        border: '#3a3a3c',
        text: '#a2a6ae',
        danger: '#e06c60',
        success: '#5ba67a',
      }
    : {
        bg: '#ffffff',
        fg: '#1c1c1e',
        accent: '#b8782a',
        accentBg: '#fbf3e5',
        grid: '#e5e5e7',
        border: '#d8dce0',
        text: '#6a7278',
        danger: '#b5312a',
        success: '#266b45',
      }
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper functions — injected into AI drawing scope
// ═══════════════════════════════════════════════════════════════════════════

const helpers = `
function roundRect(ctx, x, y, w, h, r) {
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

function arrowHead(ctx, fromX, fromY, toX, toY, size) {
  size = size || 8
  var angle = Math.atan2(toY - fromY, toX - fromX)
  ctx.beginPath()
  ctx.moveTo(toX, toY)
  ctx.lineTo(
    toX - size * Math.cos(angle - Math.PI / 6),
    toY - size * Math.sin(angle - Math.PI / 6)
  )
  ctx.lineTo(
    toX - size * Math.cos(angle + Math.PI / 6),
    toY - size * Math.sin(angle + Math.PI / 6)
  )
  ctx.closePath()
  ctx.fill()
}

function drawArrow(ctx, x1, y1, x2, y2, label, color) {
  ctx.strokeStyle = color || t.grid
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.fillStyle = color || t.grid
  arrowHead(ctx, x1, y1, x2, y2, 7)
  if (label) {
    var mx = (x1 + x2) / 2
    var my = (y1 + y2) / 2 - 6
    ctx.fillStyle = t.text
    ctx.font = '11px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText(label, mx, my)
  }
}

function nodeBox(ctx, x, y, w, h, label, fillColor) {
  ctx.fillStyle = fillColor || t.accentBg
  roundRect(ctx, x, y, w, h, 6)
  ctx.fill()
  ctx.strokeStyle = t.grid
  ctx.lineWidth = 1
  roundRect(ctx, x, y, w, h, 6)
  ctx.stroke()
  ctx.fillStyle = t.fg
  ctx.font = '13px system-ui'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, x + w / 2, y + h / 2)
}

function diamondNode(ctx, cx, cy, w, h, label, fillColor) {
  ctx.fillStyle = fillColor || t.accentBg
  ctx.beginPath()
  ctx.moveTo(cx, cy - h / 2)
  ctx.lineTo(cx + w / 2, cy)
  ctx.lineTo(cx, cy + h / 2)
  ctx.lineTo(cx - w / 2, cy)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = t.grid
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = t.fg
  ctx.font = '12px system-ui'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, cx, cy)
}

function pillarNode(ctx, x, y, w, h, label, fillColor) {
  ctx.fillStyle = fillColor || t.accentBg
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = t.grid
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, w, h)
  ctx.strokeStyle = t.accent
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(x + 3, y)
  ctx.lineTo(x + 3, y + h)
  ctx.stroke()
  ctx.fillStyle = t.fg
  ctx.font = '13px system-ui'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, x + w / 2, y + h / 2)
}
`

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  code: string
  width?: number
  height?: number
  caption?: string
}

export function CanvasDiagram({ code, width = 800, height = 400, caption }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [, setTick] = useState(0)

  // Re-render on theme change
  useEffect(() => {
    const observer = new MutationObserver(() => setTick((n) => n + 1))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr

    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    const t = resolveTheme()

    try {
      const draw = new Function('ctx', 'w', 'h', 't', helpers + code)
      draw(ctx, width, height, t)
    } catch (e) {
      ctx.fillStyle = t.danger
      ctx.font = '13px system-ui'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText('Diagram render error: ' + (e instanceof Error ? e.message : String(e)), 20, 20)
    }
  }, [code, width, height])

  return (
    <div className="mdx-diagram-frame">
      <div className="mdx-diagram-body" style={{ overflow: 'auto' }}>
        <canvas
          ref={canvasRef}
          style={{ display: 'block', maxWidth: '100%', height: 'auto', margin: '0 auto' }}
        />
      </div>
      {caption && <div className="mdx-diagram-caption">{caption}</div>}
    </div>
  )
}
