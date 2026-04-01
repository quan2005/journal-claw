import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

const GLOBALS_CSS_PATH = path.resolve(__dirname, '../styles/globals.css')
const css = fs.readFileSync(GLOBALS_CSS_PATH, 'utf-8')

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

/** Extract the content of a specific CSS selector block */
function extractBlock(css: string, selector: string): string | null {
  // Escape brackets for regex
  const escaped = selector.replace(/[[\]()]/g, '\\$&')
  const re = new RegExp(escaped + '\\s*\\{([^}]+)\\}')
  const m = css.match(re)
  return m ? m[1] : null
}

/** Parse hex to [r,g,b] 0-255 */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/** WCAG relative luminance */
function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map(c =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
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
  const darkRe = /\[data-theme="dark"\]\s*\{([^}]+)\}/g
  let m: RegExpExecArray | null
  while ((m = darkRe.exec(css)) !== null) {
    darkBlocks.push(m[1])
  }
  // Use the last dark block (the manual override)
  const darkVars = darkBlocks.length > 0 ? parseVarsFromBlock(darkBlocks[darkBlocks.length - 1]) : new Map()

  /** Expected dark theme values (snapshot of key variables) */
  const DARK_THEME_SNAPSHOT: Record<string, string> = {
    '--bg': '#0f0f0f',
    '--titlebar-bg': '#161616',
    '--divider': '#222',
    '--item-text': '#e8e8e8',
    '--item-meta': '#aaaaaa',
    '--duration-text': '#48484a',
    '--record-btn': '#C8933B',
    '--record-btn-hover': '#d9a44b',
    '--record-btn-icon': '#0f0f0f',
    '--item-selected-bg': '#1c1c1c',
    '--item-selected-text': '#C8933B',
    '--sidebar-bg': '#141414',
    '--dock-bg': '#141414',
    '--dock-border': '#252525',
    '--md-h1': '#C8933B',
    '--md-h2': '#C8933B',
    '--md-text': '#b0b0b0',
    '--md-strong': '#C8933B',
    '--md-code-bg': 'rgba(255,255,255,0.08)',
    '--md-pre-bg': '#141414',
    '--queue-bg': '#1c1c1e',
    '--ai-pill-bg': '#1a1708',
    '--ai-pill-text': '#C8933B',
  }

  it('should have all expected dark theme variables unchanged', () => {
    for (const [varName, expectedValue] of Object.entries(DARK_THEME_SNAPSHOT)) {
      const actual = darkVars.get(varName)
      expect(actual, `${varName} should exist in [data-theme="dark"]`).toBeDefined()
      expect(actual, `${varName}: expected "${expectedValue}" but got "${actual}"`).toBe(expectedValue)
    }
  })

  it('should preserve dark theme tags.ts alpha values', () => {
    const tagsSource = fs.readFileSync(
      path.resolve(__dirname, '../lib/tags.ts'),
      'utf-8',
    )
    // Dark theme textAlpha = 0.72
    expect(tagsSource).toMatch(/dark\s*\?\s*0\.72/)
    // Dark theme bgAlpha = 0.12
    expect(tagsSource).toMatch(/dark\s*\?\s*0\.12/)
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
    const ratio = contrastRatio(rootVars.get('--item-selected-text')!, rootVars.get('--item-selected-bg')!)
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
    '--record-btn': '#4a6a7a',
    '--record-btn-hover': '#3a5a6a',
    '--item-selected-text': '#3a5a6a',
    '--md-h1': '#3a5a6a',
    '--md-h2': '#3a5a6a',
    '--md-strong': '#3a5a6a',
    '--ai-pill-text': '#3a5a6a',
    '--ai-pill-active-text': '#2a4a5a',
    '--ai-pill-active-border': '#4a6a7a',
    '--dock-paste-border': '#4a6a7a',
    '--dock-paste-label': '#3a5a6a',
    '--dock-kbd-text': '#3a5a6a',
    '--dock-dropzone-hover-border': '#4a6a7a',
    '--date-today-number': '#3a5a6a',
    '--date-today-weekday': '#5a7a8a',
    '--item-selected-meta': '#5a7a8a',
    '--md-link': '#2d6a9f',
    '--md-link-hover': '#1a5080',
    '--md-code-text': '#2d6a9f',
  }

  for (const [varName, expectedValue] of Object.entries(ACCENT_SNAPSHOT)) {
    it(`${varName} should be ${expectedValue}`, () => {
      expect(rootVars.get(varName)).toBe(expectedValue)
    })
  }
})
