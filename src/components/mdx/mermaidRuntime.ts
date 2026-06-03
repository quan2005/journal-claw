import type mermaidType from 'mermaid'

export function detectMermaidType(chart: string): string {
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

function decodeHtmlEntities(value: string): string {
  if (!/[&][a-zA-Z#0-9]+;/.test(value)) return value
  if (typeof document === 'undefined') return value
  const textarea = document.createElement('textarea')
  textarea.innerHTML = value
  return textarea.value
}

function unwrapFence(value: string): string {
  const trimmed = value.trim()
  const fence = trimmed.match(/^(```|~~~)\s*(?:mermaid|mmd)?[^\n]*\n([\s\S]*?)\n?\1\s*$/i)
  if (fence) return fence[2]
  return trimmed.replace(/^\s*(?:mermaid|mmd)\s*\n/i, '')
}

function repairJoinedStatements(value: string): string {
  return value
    .replace(/\b((?:flowchart|graph)\s+(?:TB|TD|BT|LR|RL))(?=[A-Za-z_])/g, '$1\n')
    .replace(/\bendsubgraph\b/g, 'end\nsubgraph')
    .replace(
      /((?:-->|---|==>|-.->|--x|--o|--)\s*[A-Za-z_][\w-]*?)(subgraph\b)/g,
      '$1\n$2',
    )
    .replace(/\bend(?=[A-Za-z_][\w-]*\s*(?:-->|---|==>|-.->|--x|--o|--))/g, 'end\n')
}

export function normalizeMermaidSource(source: string): string {
  return repairJoinedStatements(unwrapFence(decodeHtmlEntities(source).replace(/\\r\\n|\\n|\\r/g, '\n')))
    .replace(/^\uFEFF/, '')
    .trim()
}

export function getMermaidErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (typeof error === 'object' && error !== null) {
    if ('message' in error && typeof error.message === 'string') return error.message
    if ('str' in error && typeof error.str === 'string') return error.str
    try {
      return JSON.stringify(error)
    } catch {
      return String(error)
    }
  }
  return String(error)
}

let mermaidModule: typeof mermaidType | null = null

type MermaidThemeVariables = Record<string, string | number | boolean>
type MermaidConfig = {
  startOnLoad: boolean
  theme: 'base'
  securityLevel: 'strict'
  htmlLabels: boolean
  fontFamily: string
  deterministicIds: boolean
  deterministicIDSeed: string
  themeVariables: MermaidThemeVariables
  gantt?: Record<string, string | number | boolean>
}

async function getMermaid(isDark: boolean, type: string, renderSequence: number) {
  if (!mermaidModule) {
    mermaidModule = (await import('mermaid')).default
  }

  const base: MermaidConfig = {
    startOnLoad: false,
    theme: 'base',
    securityLevel: 'strict',
    htmlLabels: false,
    fontFamily: 'Inter, ui-sans-serif, system-ui',
    deterministicIds: true,
    deterministicIDSeed: 'm'.repeat(renderSequence + 1),
    themeVariables: isDark
      ? {
          primaryColor: '#c8933b',
          primaryBorderColor: '#c8933b',
          lineColor: '#3a3a3c',
          textColor: '#a2a6ae',
          primaryTextColor: '#e8e8e8',
          mainBkg: '#1c1c1e',
          secondBkg: '#2c2c2e',
          tertiaryColor: '#101010',
          background: '#101010',
          fontSize: '13px',
          titleColor: '#e8e8e8',
          tertiaryTextColor: '#a2a6ae',
        }
      : {
          primaryColor: '#b8782a',
          primaryBorderColor: '#b8782a',
          lineColor: '#d8dce0',
          textColor: '#4a5058',
          primaryTextColor: '#1c1c1e',
          mainBkg: '#ffffff',
          secondBkg: '#f7f8f9',
          tertiaryColor: '#f5f6f7',
          background: '#fafaf8',
          fontSize: '13px',
          titleColor: '#1c1c1e',
          tertiaryTextColor: '#6a7278',
        },
  }

  if (type === 'gantt') {
    base.gantt = {
      useWidth: 960,
      leftPadding: 100,
      topPadding: 40,
      barHeight: 28,
      barGap: 8,
      gridLineStartPadding: 24,
      fontSize: 13,
      numberSectionStyles: 4,
      axisFormat: '%m-%d',
      titleTopMargin: 20,
    }
    base.themeVariables = {
      ...base.themeVariables,
      taskBkgColor: isDark ? '#d4d4d4' : '#d8d8d8',
      taskTextColor: '#1a1a1a',
      taskTextDarkColor: '#1a1a1a',
      taskTextOutsideColor: isDark ? '#b0b0b0' : '#3a3a3a',
      taskBorderColor: isDark ? '#888888' : '#a0a0a0',
      activeTaskBkgColor: isDark ? '#c8933b' : '#b8782a',
      activeTaskBorderColor: isDark ? '#a07820' : '#8a6500',
      activeTaskTextColor: '#0f0f0f',
      activeTaskTextDarkColor: '#0f0f0f',
      sectionBkgColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)',
      sectionBkgColor2: isDark ? 'rgba(200,147,59,0.04)' : 'rgba(184,120,42,0.03)',
      altSectionBkgColor: isDark ? 'rgba(200,147,59,0.04)' : 'rgba(184,120,42,0.03)',
      gridColor: isDark ? '#2c2c2e' : '#e5e5e7',
      todayLineColor: isDark ? '#c8933b' : '#b8782a',
      titleColor: isDark ? '#d0d0d0' : '#2a2a2a',
    }
  }

  mermaidModule.initialize(base)
  return mermaidModule
}

let renderId = 0
let renderQueue: Promise<void> = Promise.resolve()

function enqueueMermaidRender<T>(task: () => Promise<T>): Promise<T> {
  const queued = renderQueue.then(task, task)
  renderQueue = queued.then(
    () => undefined,
    () => undefined,
  )
  return queued
}

export async function renderMermaidToElement({
  element,
  source,
  isDark,
}: {
  element: HTMLElement
  source: string
  isDark: boolean
}) {
  const normalizedSource = normalizeMermaidSource(source)
  const diagramType = detectMermaidType(normalizedSource)
  const renderSequence = renderId++

  await enqueueMermaidRender(async () => {
    const mermaid = await getMermaid(isDark, diagramType, renderSequence)

    element.replaceChildren()

    const target = document.createElement('pre')
    target.className = 'mermaid'
    target.textContent = normalizedSource
    element.appendChild(target)

    await mermaid.run({ nodes: [target] })
  })

  return { diagramType, source: normalizedSource }
}
