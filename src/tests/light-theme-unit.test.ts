import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

const GLOBALS_CSS_PATH = path.resolve(__dirname, '../styles/globals.css')
const MARKDOWN_CSS_PATH = path.resolve(__dirname, '../styles/markdown.css')
const MDX_CSS_PATH = path.resolve(__dirname, '../styles/mdx.css')
const DETAIL_VIEW_PATH = path.resolve(__dirname, '../components/DetailView.tsx')
const CHAT_PANEL_PATH = path.resolve(__dirname, '../components/ChatPanel.tsx')
const css = fs.readFileSync(GLOBALS_CSS_PATH, 'utf-8')
const markdownCss = fs.readFileSync(MARKDOWN_CSS_PATH, 'utf-8')
const mdxCss = fs.readFileSync(MDX_CSS_PATH, 'utf-8')
const detailViewSource = fs.readFileSync(DETAIL_VIEW_PATH, 'utf-8')
const chatPanelSource = fs.readFileSync(CHAT_PANEL_PATH, 'utf-8')

/** Parse all variable declarations from a CSS block string */
function parseVarsFromBlock(block: string): Map<string, string> {
  const vars = new Map<string, string>()
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g
  let m: RegExpExecArray | null
  while ((m = re.exec(block)) !== null) {
    vars.set(m[1].trim(), m[2].trim())
  }
  return vars
}

/** Parse hex to [r,g,b] 0-255 */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/** WCAG relative luminance */
function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  )
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/** WCAG contrast ratio */
function contrastRatio(hex1: string, hex2: string): number {
  const [r1, g1, b1] = hexToRgb(hex1)
  const [r2, g2, b2] = hexToRgb(hex2)
  const l1 = relativeLuminance(r1, g1, b1)
  const l2 = relativeLuminance(r2, g2, b2)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

/**
 * Task 9.1: 验证暗色主题不变性
 * Validates: Requirements 10.1, 10.2, 10.3
 */
describe('Dark theme invariance', () => {
  // Extract the last [data-theme="dark"] block (the manual override one after @media)
  const darkBlocks: string[] = []
  const darkRe = /\[data-theme=.dark.\]\s*\{([^}]+)\}/g
  let m: RegExpExecArray | null
  while ((m = darkRe.exec(css)) !== null) {
    darkBlocks.push(m[1])
  }
  // Use the last dark block (the manual override)
  const darkVars =
    darkBlocks.length > 0 ? parseVarsFromBlock(darkBlocks[darkBlocks.length - 1]) : new Map()

  /** Expected dark theme values (snapshot of key variables — Agentic palette) */
  const DARK_THEME_SNAPSHOT: Record<string, string> = {
    '--bg': '#0f0f0f',
    '--titlebar-bg': '#161616',
    '--divider': '#1f2937',
    '--item-text': '#e8e8e8',
    '--item-meta': '#a2a6ae',
    '--duration-text': '#6b7280',
    '--record-btn': '#ff7a33',
    '--record-btn-hover': '#ff9355',
    '--record-btn-icon': '#0f0f0f',
    '--item-selected-bg': 'rgba(255, 122, 51, 0.14)',
    '--item-selected-text': '#ff9355',
    '--sidebar-bg': '#141414',
    '--dock-bg': '#141414',
    '--dock-border': '#2c2c2e',
    '--md-h1': 'var(--journal-title-color)',
    '--md-h2': 'var(--journal-title-color)',
    '--md-text': '#d1d5db',
    '--md-strong': '#ff9355',
    '--md-code-bg': 'rgba(255, 255, 255, 0.08)',
    '--md-pre-bg': '#141414',
    '--queue-bg': '#1c1c1e',
    '--ai-pill-bg': 'rgba(255, 122, 51, 0.12)',
    '--ai-pill-text': '#ff9355',
  }

  it('should have all expected dark theme variables unchanged', () => {
    for (const [varName, expectedValue] of Object.entries(DARK_THEME_SNAPSHOT)) {
      const actual = darkVars.get(varName)
      expect(actual, `${varName} should exist in [data-theme="dark"]`).toBeDefined()
      expect(actual, `${varName}: expected "${expectedValue}" but got "${actual}"`).toBe(
        expectedValue,
      )
    }
  })

  it('should preserve dark theme tag CSS tokens', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../styles/globals.css'), 'utf-8')
    // Dark theme tag tokens (Agentic — neutral white-alpha)
    expect(css).toContain('--tag-text: rgba(255, 255, 255, 0.6)')
    expect(css).toContain('--tag-bg: rgba(255, 255, 255, 0.08)')
  })
})

/**
 * Task 9.2: 验证关键对比度
 * Validates: Requirements 1.5, 4.4, 5.3, 8.4, 11.2
 */
describe('Key contrast ratios', () => {
  // Parse :root variables (light theme defaults)
  const rootMatch = css.match(/:root\s*\{([^}]+)\}/)
  const rootVars = rootMatch ? parseVarsFromBlock(rootMatch[1]) : new Map()

  it('--item-text / --bg contrast ≥ 7:1 (AAA)', () => {
    const ratio = contrastRatio(rootVars.get('--item-text')!, rootVars.get('--bg')!)
    expect(ratio, `item-text/bg ratio=${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(7)
  })

  it('--item-meta / --bg contrast ≥ 4.5:1 (AA)', () => {
    const ratio = contrastRatio(rootVars.get('--item-meta')!, rootVars.get('--bg')!)
    expect(ratio, `item-meta/bg ratio=${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
  })

  it('--duration-text / --bg contrast ≥ 2:1', () => {
    const ratio = contrastRatio(rootVars.get('--duration-text')!, rootVars.get('--bg')!)
    expect(ratio, `duration-text/bg ratio=${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(2)
  })

  it('--item-selected-text / --item-selected-bg contrast ≥ 4.5:1 (AA)', () => {
    const ratio = contrastRatio(
      rootVars.get('--item-selected-text')!,
      rootVars.get('--item-selected-bg')!,
    )
    expect(ratio, `selected-text/selected-bg ratio=${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
  })

  it('--ai-pill-text / --ai-pill-bg contrast ≥ 4.5:1 (AA)', () => {
    const ratio = contrastRatio(rootVars.get('--ai-pill-text')!, rootVars.get('--ai-pill-bg')!)
    expect(ratio, `ai-pill-text/ai-pill-bg ratio=${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
  })

  it('--divider / --bg contrast ≥ 1.2:1', () => {
    const ratio = contrastRatio(rootVars.get('--divider')!, rootVars.get('--bg')!)
    expect(ratio, `divider/bg ratio=${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(1.2)
  })
})

/**
 * Task 9.3: 验证强调色不变
 * Validates: Requirements 9.4~9.7
 */
describe('Accent colors unchanged', () => {
  const rootMatch = css.match(/:root\s*\{([^}]+)\}/)
  const rootVars = rootMatch ? parseVarsFromBlock(rootMatch[1]) : new Map()

  const ACCENT_SNAPSHOT: Record<string, string> = {
    '--record-btn': '#ff5701',
    '--record-btn-hover': '#e64a00',
    '--item-selected-text': '#9a3412',
    '--md-h1': 'var(--journal-title-color)',
    '--md-h2': 'var(--journal-title-color)',
    '--md-strong': '#111827',
    '--ai-pill-text': '#c2410c',
    '--ai-pill-active-text': '#9a3412',
    '--ai-pill-active-border': '#f97316',
    '--dock-paste-border': '#ff5701',
    '--dock-paste-label': '#c2410c',
    '--dock-kbd-text': '#9a3412',
    '--dock-dropzone-hover-border': '#ff5701',
    '--date-today-number': '#c2410c',
    '--date-today-weekday': '#9a3412',
    '--item-selected-meta': '#c2410c',
    '--md-link': '#c2410c',
    '--md-link-hover': '#9a3412',
    '--md-code-text': '#c2410c',
  }

  for (const [varName, expectedValue] of Object.entries(ACCENT_SNAPSHOT)) {
    it(`${varName} should be ${expectedValue}`, () => {
      expect(rootVars.get(varName)).toBe(expectedValue)
    })
  }
})

describe('Dark theme surface contract', () => {
  it('global app shell inherits readable foreground text', () => {
    const shellRule = css.match(/html,\s*body,\s*#root\s*\{([^}]+)\}/)
    expect(shellRule?.[1]).toContain('color: var(--item-text)')
  })

  it('automation workbench defines semantic surface tokens instead of ad-hoc inline colors', () => {
    expect(css).toContain('.automation-workbench')
    expect(css).toContain('--automation-surface:')
    expect(css).toContain('--automation-text-muted:')
    expect(css).toContain('--automation-text-faint:')
  })

  it('automation workbench does not use duration text for readable labels or supporting copy', () => {
    const start = css.indexOf('/* ── Automation workbench')
    const end = css.indexOf('/* ── Markdown body', start)
    const automationCss = css.slice(start, end)
    expect(automationCss).not.toContain('var(--duration-text)')
  })
})

describe('Chat panel highlight contract', () => {
  it('keeps rounded composer and warning highlights continuous', () => {
    expect(chatPanelSource).toContain('CHAT_PANEL_HIGHLIGHT_RING')
    expect(chatPanelSource).toContain('CHAT_PANEL_WARNING_RING')
    expect(chatPanelSource).toContain("backgroundClip: 'padding-box'")
    expect(chatPanelSource).toMatch(/focused\s*\?\s*'1px solid var\(--record-btn\)'/)
    expect(chatPanelSource).not.toMatch(/focused\s*\?\s*'0\.5px solid var\(--record-btn\)'/)
    expect(chatPanelSource).toContain('border: `1px solid ${borderColor}`')
  })
})

describe('Journal content frame contract', () => {
  const rootMatch = css.match(/:root\s*\{([^}]+)\}/)
  const rootVars = rootMatch ? parseVarsFromBlock(rootMatch[1]) : new Map()

  it('defines shared readable, workbench, and title tokens', () => {
    expect(rootVars.get('--journal-prose-max')).toBe('100%')
    expect(rootVars.get('--journal-readable-max')).toBe('100%')
    expect(rootVars.get('--journal-content-max')).toBe('var(--journal-readable-max)')
    expect(rootVars.get('--journal-workbench-max')).toBe('1640px')
    expect(rootVars.get('--journal-page-gutter')).toBe('min(56px, 5vw)')
    expect(rootVars.get('--journal-title-size')).toBe('48px')
    expect(rootVars.get('--journal-title-color')).toBe('var(--record-btn)')
    expect(rootVars.get('--journal-summary-color')).toBe('var(--item-meta)')
    expect(rootVars.get('--detail-content-max')).toBe('var(--journal-readable-max)')
  })

  it('aligns markdown, mdx, and detail read mode to the readable frame', () => {
    const mdContentRule = markdownCss.match(/\.md-content\s*\{[^}]*\}/)?.[0] ?? ''
    const mdProseRule = markdownCss.match(/\.md-content > :where\([^)]*\)\s*\{[^}]*\}/)?.[0] ?? ''
    const mdxContentRule = mdxCss.match(/\.mdx-content\s*\{[^}]*\}/)?.[0] ?? ''
    const mdxWideRule =
      mdxCss.match(/\.mdx-content\s+:where\(\s*\.mdx-chart[\s\S]*?\)\s*\{[^}]*\}/)?.[0] ?? ''
    const mdBodyRule = css.match(/\.md-body\s*\{[^}]*\}/)?.[0] ?? ''

    expect(mdContentRule).toContain('width: 100%')
    expect(mdContentRule).toContain('max-width: var(--journal-readable-max)')
    expect(mdProseRule).toContain('max-width: var(--journal-prose-max)')
    expect(mdxContentRule).toContain('max-width: var(--journal-readable-max)')
    expect(mdxWideRule).toContain('max-width: 100%')
    expect(mdBodyRule).toContain('max-width: var(--journal-readable-max)')
    expect(detailViewSource).toContain(
      "isHtmlContent || isStandardDetailSourceMode ? 0 : 'var(--journal-detail-padding)'",
    )
    expect(detailViewSource).not.toContain('journal-readable-shell-max')
    expect(detailViewSource).toContain(
      "isHtmlContent || isStandardDetailSourceMode ? undefined : 'border-box'",
    )
  })

  it('aligns ideas and automation workbenches to the shared workbench frame', () => {
    const ideasFrameRule =
      css.match(
        /\.ideas-workbench-header,\s*\.ideas-workbench-tabs,\s*\.ideas-workbench-main\s*\{[^}]*\}/,
      )?.[0] ?? ''
    const automationHeaderRule = css.match(/\.automation-header\s*\{[^}]*\}/)?.[0] ?? ''
    const automationStackRule = css.match(/\.automation-stack\s*\{[^}]*\}/)?.[0] ?? ''

    expect(ideasFrameRule).toContain('width: min(100%, var(--journal-workbench-max))')
    expect(automationHeaderRule).toContain('var(--journal-workbench-max)')
    expect(automationHeaderRule).toContain('var(--journal-page-gutter)')
    expect(automationStackRule).toContain('width: min(100%, var(--journal-workbench-max))')
    expect(automationStackRule).toContain('margin-left: auto')
    expect(automationStackRule).toContain('margin-right: auto')
  })

  it('aligns workbench title and summary typography through shared tokens', () => {
    const titleRule =
      css.match(/\.automation-title,\s*\.ideas-workbench-title\s*\{[^}]*\}/)?.[0] ?? ''
    const summaryRule =
      css.match(/\.automation-summary,\s*\.ideas-workbench-summary\s*\{[^}]*\}/)?.[0] ?? ''
    const mdHeadingRule =
      markdownCss.match(/\.md-content h1,\s*\.md-content h2\s*\{[^}]*\}/)?.[0] ?? ''

    expect(titleRule).toContain('color: var(--journal-title-color)')
    expect(titleRule).toContain('font-size: var(--journal-title-size)')
    expect(titleRule).toContain('font-weight: var(--journal-title-weight)')
    expect(summaryRule).toContain('color: var(--journal-summary-color)')
    expect(summaryRule).toContain('font-size: var(--journal-summary-size)')
    expect(mdHeadingRule).toContain('color: var(--journal-title-color)')
  })

  it('uses one shared status bar contract for ideas and automation headers', () => {
    const statsRule =
      css.match(/\.automation-stats,\s*\.ideas-workbench-stats\s*\{[^}]*\}/)?.[0] ?? ''
    const statItemRule =
      css.match(/\.automation-stats span,\s*\.ideas-workbench-stats span\s*\{[^}]*\}/)?.[0] ?? ''
    const statValueRule =
      css.match(/\.automation-stats strong,\s*\.ideas-workbench-stats strong\s*\{[^}]*\}/)?.[0] ??
      ''

    expect(statsRule).toContain('width: min(100%, 676px)')
    expect(statsRule).toContain('min-height: 50px')
    expect(statsRule).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))')
    expect(statItemRule).toContain('justify-content: center')
    expect(statItemRule).toContain('padding: 0 20px')
    expect(statValueRule).toContain('font-size: var(--text-md)')
  })
})

describe('MDX table rendering contract', () => {
  it('keeps the header as the first visible table band', () => {
    const tableWrapRule = mdxCss.match(/\.mdx-table-wrap\s*\{[^}]*\}/)?.[0] ?? ''
    const tableRule = mdxCss.match(/\.mdx-table\s*\{[^}]*\}/)?.[0] ?? ''

    expect(tableWrapRule).not.toContain('border:')
    expect(mdxCss).not.toContain('.mdx-table-wrap::after')
    expect(tableRule).toContain('border-spacing: 0')
    expect(mdxCss).toContain('.mdx-table thead th')
    expect(mdxCss).toContain('border-top: 1px solid var(--mdx-border)')
    expect(mdxCss).toContain('.mdx-table--plain tbody tr:first-child td')
    expect(mdxCss).toContain('.mdx-table th + th')
    expect(mdxCss).not.toContain('.mdx-table tbody tr:hover td')
  })
})

describe('Ideas workbench surface contract', () => {
  it('defines ideas workbench classes and semantic tokens', () => {
    expect(css).toContain('.ideas-workbench')
    expect(css).toContain('--ideas-surface:')
    expect(css).toContain('--ideas-text-muted:')
    expect(css).toContain('.ideas-workbench-row')
    expect(css).toContain('.ideas-workbench-stats')
  })

  it('keeps ideas workbench aligned with automation tokens instead of one-off palette colors', () => {
    const start = css.indexOf('/* ── Ideas workbench')
    const end = css.indexOf('/* ── Markdown body', start)
    const ideasCss = css.slice(start, end)
    expect(start).toBeGreaterThanOrEqual(0)
    expect(ideasCss).toContain('var(--record-btn)')
    expect(ideasCss).toContain('var(--detail-case-bg)')
    expect(ideasCss).not.toContain('linear-gradient')
    expect(ideasCss).not.toContain('box-shadow')
  })

  it('does not strike through completed idea rows', () => {
    const selector = '.ideas-workbench-row.is-done .ideas-workbench-row-title'
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const titleRule = css.match(new RegExp(`${escapedSelector}\\s*\\{[^}]*\\}`))?.[0] ?? ''

    expect(titleRule).not.toMatch(/text-decoration\s*:\s*line-through/)
  })

  it('uses a check-square icon style for idea rows', () => {
    const rule = css.match(/\.ideas-workbench-complete\s*\{[^}]*\}/)?.[0] ?? ''
    const iconRule = css.match(/\.ideas-workbench-complete-icon\s*\{[^}]*\}/)?.[0] ?? ''

    expect(rule).toContain('display: inline-flex')
    expect(rule).toContain('width: 28px')
    expect(rule).toContain('height: 28px')
    expect(rule).toContain('border: 0')
    expect(rule).toContain('background: transparent')
    expect(rule).toContain('border-radius: 6px')
    expect(rule).not.toContain('border-radius: 999px')
    expect(iconRule).toContain('width: 17px')
    expect(iconRule).toContain('height: 17px')
    expect(css).not.toMatch(/\.ideas-workbench-complete::after/)
    expect(css).toMatch(
      /\.ideas-workbench-complete:hover \.ideas-workbench-complete-check,\s*\.ideas-workbench-complete:focus-visible \.ideas-workbench-complete-check\s*\{[^}]*opacity: 0\.42/,
    )
  })

  it('keeps idea rows compact without changing the control columns', () => {
    const rowRule = css.match(/\.ideas-workbench-row\s*\{[^}]*\}/)?.[0] ?? ''
    const listRule = css.match(/\.ideas-workbench-list\s*\{[^}]*\}/)?.[0] ?? ''
    const surfaceRule =
      css.match(
        /\.ideas-workbench-row,\s*\.ideas-workbench-draft,\s*\.ideas-workbench-empty\s*\{[^}]*\}/,
      )?.[0] ?? ''

    expect(rowRule).toContain('grid-template-columns: 26px minmax(180px, 1fr) 28px 28px 32px')
    expect(rowRule).toContain('gap: 8px')
    expect(rowRule).toContain('padding: 8px 12px')
    expect(listRule).toContain('gap: 8px')
    expect(surfaceRule).toContain('min-height: 60px')
  })

  it('aligns read and edit text boxes to avoid multiline height jumps', () => {
    const sharedRule =
      css.match(/\.ideas-workbench-text-button,\s*\.ideas-workbench-edit-input\s*\{[^}]*\}/)?.[0] ??
      ''

    expect(sharedRule).toContain('box-sizing: border-box')
    expect(sharedRule).toContain('min-height: 36px')
    expect(sharedRule).toContain('padding: 6px 10px')
    expect(sharedRule).toContain('border: 1px solid transparent')
    expect(sharedRule).toContain('line-height: 1.42')
    expect(sharedRule).toContain('margin: 0')
    expect(sharedRule).toContain('appearance: none')
  })
})
