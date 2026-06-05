import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'src/styles/journal-blocks.css'), 'utf8')

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{(?<body>[\\s\\S]*?)\\}`))
  return match?.groups?.body ?? ''
}

describe('journal block visual contracts', () => {
  it('keeps list markers vertically centered', () => {
    expect(rule('.journal-block-step')).toContain('align-items: center')
    expect(rule('.journal-block-row')).toContain('align-items: center')
    expect(rule('.journal-block-toc-row')).toContain('grid-template-columns: 48px')
    expect(rule('.journal-block-toc .journal-block-row-marker')).toContain(
      'justify-content: flex-start',
    )
    expect(rule('.journal-block-manifesto-row')).toContain('grid-template-columns: 48px')
    expect(rule('.journal-block-manifesto .journal-block-row-marker')).toContain(
      'justify-content: flex-start',
    )
    expect(rule('.journal-block-marker')).toContain('align-items: center')
    expect(rule('.journal-block-marker')).toContain('justify-content: center')
  })

  it('defines prose, content, and wide width tiers for module families', () => {
    expect(rule('.journal-block-prose')).toContain('max-width: var(--journal-prose-max)')
    expect(rule('.journal-block-content')).toContain('max-width: var(--journal-content-max, 100%)')
    expect(rule('.journal-block-wide')).toContain('max-width: 100%')
  })

  it('centers metric summaries as a dashboard band', () => {
    expect(rule('.journal-block-metric')).toContain('text-align: center')
    expect(rule('.journal-block-metric-grid')).toContain('align-items: stretch')
  })

  it('gives compare and timeline their own visual grammar', () => {
    expect(rule('.journal-block-compare-row')).toContain('grid-template-columns')
    expect(rule('.journal-block-compare-vs')).toContain('border-radius: 999px')
    expect(rule('.journal-block-timeline-nav')).toBe('')
    expect(rule('.journal-block-timeline-track')).toContain('border-left')
    expect(rule('.journal-block-timeline-track')).toContain('margin-top')
  })

  it('styles myth-fact as a high-contrast two-sided comparison', () => {
    expect(rule('.journal-block-myth-fact')).toContain('border-top')
    expect(rule('.journal-block-myth-fact-row')).toContain('grid-template-columns')
    expect(rule('.journal-block-myth-fact-row')).toContain('border-bottom')
    expect(rule('.journal-block-myth-fact-side')).toContain('grid-template-columns: 20px')
    expect(rule('.journal-block-myth-fact-side')).toContain('align-items: start')
    expect(rule('.journal-block-myth-fact-copy')).toContain('min-width: 0')
    expect(rule('.journal-block-myth')).toContain('opacity')
    expect(rule('.journal-block-fact')).toContain('background')
    expect(rule('.journal-block-fact')).toContain('border-left')
    expect(rule('.journal-block-myth-mark')).toContain('color: var(--item-meta)')
    expect(rule('.journal-block-fact-mark')).toContain('color: var(--record-btn)')
  })

  it('styles bridge as a compact transition instead of a heavy card', () => {
    expect(rule('.journal-block-bridge')).toContain(
      'grid-template-columns: minmax(0, 1fr) 32px minmax(0, 1fr)',
    )
    expect(rule('.journal-block-bridge')).toContain('border-top')
    expect(rule('.journal-block-bridge')).toContain('background: transparent')
    expect(rule('.journal-block-bridge-arrow')).toContain('display: inline-flex')
    expect(rule('.journal-block-bridge-arrow')).toContain('border-radius: 999px')
    expect(rule('.journal-block-bridge-why')).toContain('border-top')
  })

  it('styles checklist with the same checkbox grammar as idea rows', () => {
    expect(rule('.journal-block-checklist-list')).toContain('position: relative')
    expect(rule('.journal-block-checklist-list')).toContain('padding: 0')
    expect(rule('.journal-block-checklist .journal-block-checklist-list')).toContain('padding: 0')
    expect(rule('.journal-block-checklist-list::before')).toBe('')
    expect(rule('.journal-block-checklist-item')).toContain('grid-template-columns: 28px')
    expect(rule('.journal-block-check-marker')).toContain('width: 28px')
    expect(rule('.journal-block-check-marker')).toContain('height: 28px')
    expect(rule('.journal-block-check-marker')).toContain('align-items: center')
    expect(rule('.journal-block-check-marker')).toContain('border-radius: 6px')
    expect(rule('.journal-block-check-icon')).toContain('width: 17px')
    expect(rule('.journal-block-check-icon-check')).toContain('opacity: 0')
    expect(
      rule(".journal-block-checklist-item[data-state='done'] .journal-block-check-icon-check"),
    ).toContain('opacity: 1')
  })

  it('styles author and resources as compact references', () => {
    expect(rule('.journal-block-author-card')).toContain('display: grid')
    expect(rule('.journal-block-author-card')).toContain('align-items: center')
    expect(rule('.journal-block-author-card')).toContain('border-top')
    expect(rule('.journal-block-author-mark')).toContain('width: 28px')
    expect(rule('.journal-block-author-name')).toContain('font-size: var(--text-md)')
    expect(rule('.journal-block-series-row')).toContain('grid-template-columns: 48px')
    expect(rule('.journal-block-series .journal-block-row-marker')).toContain(
      'justify-content: flex-start',
    )
    expect(rule('.journal-block-resource-card')).toContain('border-left')
    expect(rule('.journal-block-resource-kind')).toContain('font-size: 11px')
  })

  it('reduces date emphasis in timeline and changelog', () => {
    expect(rule('.journal-block-timeline-date')).toContain('color: var(--item-meta)')
    expect(rule('.journal-block-timeline-item-active .journal-block-timeline-date')).toContain(
      'color: var(--record-btn)',
    )
    expect(rule('.journal-block-changelog-date')).toContain('color: var(--item-meta)')
    expect(rule('.journal-block-changelog-date')).toContain('white-space: nowrap')
    expect(rule('.journal-block-changelog-row')).toContain('grid-template-columns: 132px')
  })

  it('keeps dense tables aligned on a shared dynamic grid', () => {
    expect(rule('.journal-block-table-grid')).toContain('overflow-x: auto')
    expect(rule('.journal-block-table-row')).toContain(
      'min-width: var(--journal-block-table-min-width',
    )
    expect(rule('.journal-block-table-row')).toContain('width: 100%')
    expect(rule('.journal-block-table-cell')).toContain('white-space: normal')
    expect(rule('.journal-block-table-cell')).toContain('word-break: keep-all')
  })
})
