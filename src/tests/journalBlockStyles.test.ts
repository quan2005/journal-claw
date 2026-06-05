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

  it('keeps section title text on adaptive readable lines', () => {
    expect(rule('.journal-block-part')).toContain('max-inline-size: 100%')
    expect(rule('.journal-block-part h2')).toContain(
      'max-inline-size: 100%',
    )
    expect(rule('.journal-block-part h2')).toContain(
      'font-size: var(--journal-block-part-title-size, var(--text-xl))',
    )
    expect(rule('.journal-block-part h2')).toContain(
      'line-height: var(--journal-block-part-title-line-height, 1.3)',
    )
    expect(rule('.journal-block-part h2')).toContain('text-wrap: wrap')
    expect(rule('.journal-block-part h2')).not.toContain('text-wrap: balance')
    expect(rule('.journal-block-part h2')).toContain('overflow-wrap: anywhere')
    expect(rule('.journal-block-part-title-dense')).toContain(
      '--journal-block-part-title-size: var(--text-lg)',
    )
    expect(rule('.journal-block-part-title-compact')).toContain(
      '--journal-block-part-title-size: var(--text-lg)',
    )
    expect(rule('.journal-block-part-title-compact')).toContain(
      '--journal-block-part-title-line-height: 1.38',
    )
    expect(rule('.journal-block-part-title-dense')).not.toContain(
      '--journal-block-part-title-max',
    )
    expect(rule('.journal-block-part-title-compact')).not.toContain(
      '--journal-block-part-title-max',
    )
    expect(rule('.journal-block-part p')).toContain('max-inline-size: 58ch')
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

  it('styles people as compact name cards distinct from module cards', () => {
    expect(css).not.toContain('.journal-block-person-card p')
    expect(css).not.toContain('.journal-block-person-card h3')
    expect(rule('.journal-block-people')).toContain('padding: var(--space-2) 0')
    expect(rule('.journal-block-people-grid')).toContain('display: grid')
    expect(rule('.journal-block-people-grid')).toContain(
      'grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
    )
    expect(rule('.journal-block-people-grid')).not.toContain('repeat(auto-fill')
    expect(rule('@container (min-width: 1440px)')).toContain(
      'grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
    )
    expect(rule('.journal-block-people-grid')).toContain('justify-content: start')
    expect(rule('.journal-block-people')).toContain('container-type: inline-size')
    expect(rule('.journal-block-person-card')).toContain('grid-template-columns: 28px')
    expect(rule('.journal-block-person-card')).toContain('grid-template-rows: minmax(24px, auto) auto')
    expect(rule('.journal-block-person-card')).toContain('grid-template-areas')
    expect(rule('.journal-block-person-card')).toContain('inline-size: 100%')
    expect(rule('.journal-block-person-card')).not.toContain('max-inline-size')
    expect(rule('.journal-block-person-card')).toContain('background: transparent')
    expect(rule('.journal-block-person-card')).toContain('border-radius: 8px')
    expect(rule('.journal-block-person-card')).toContain('min-block-size: 72px')
    expect(rule('.journal-block-person-card')).toContain('padding: 10px')
    expect(rule('.journal-block-person-card')).toContain('box-shadow: inset 0 1px 0')
    expect(rule('.journal-block-person-card--header-only')).toContain(
      'align-content: center',
    )
    expect(rule('.journal-block-person-card--header-only')).toContain(
      'grid-template-rows: minmax(24px, auto)',
    )
    expect(rule('.journal-block-person-card--header-only')).toContain(
      "'avatar heading'",
    )
    expect(rule('.journal-block .journal-block-person-initial')).toContain('grid-area: avatar')
    expect(rule('.journal-block .journal-block-person-initial')).toContain('align-self: center')
    expect(rule('.journal-block .journal-block-person-initial')).toContain('width: 24px')
    expect(rule('.journal-block .journal-block-person-initial')).toContain('height: 24px')
    expect(rule('.journal-block .journal-block-person-initial')).toContain(
      'font-size: var(--text-xs)',
    )
    expect(rule('.journal-block .journal-block-person-initial')).toContain(
      'background: transparent',
    )
    expect(rule('.journal-block .journal-block-person-heading')).toContain('grid-area: heading')
    expect(rule('.journal-block .journal-block-person-heading')).toContain('align-items: center')
    expect(rule('.journal-block .journal-block-person-heading')).toContain('min-block-size: 24px')
    expect(rule('.journal-block .journal-block-person-heading')).toContain('gap: var(--space-1)')
    expect(rule('.journal-block .journal-block-person-initial')).toContain('border-radius: 50%')
    expect(rule('.journal-block .journal-block-person-name')).toContain('display: inline-flex')
    expect(rule('.journal-block .journal-block-person-name')).toContain('align-items: center')
    expect(rule('.journal-block .journal-block-person-name')).toContain('height: 24px')
    expect(rule('.journal-block .journal-block-person-name')).toContain('line-height: 24px')
    expect(rule('.journal-block .journal-block-person-name')).toContain('margin: 0')
    expect(rule('.journal-block .journal-block-person-name')).toContain('font-size: var(--text-sm)')
    expect(rule('.journal-block .journal-block-person-role')).toContain(
      'font-family: var(--font-mono)',
    )
    expect(rule('.journal-block .journal-block-person-role')).toContain('height: 20px')
    expect(rule('.journal-block .journal-block-person-role')).toContain('line-height: 18px')
    expect(rule('.journal-block .journal-block-person-role')).toContain('align-self: center')
    expect(rule('.journal-block .journal-block-person-role')).toContain('max-inline-size: 100%')
    expect(rule('.journal-block .journal-block-person-role')).toContain('text-overflow: ellipsis')
    expect(rule('.journal-block .journal-block-person-role')).toContain('font-size: 10px')
    expect(rule('.journal-block .journal-block-person-note')).toContain('grid-area: note')
    expect(rule('.journal-block .journal-block-person-note')).toContain('grid-column: 1 / -1')
    expect(rule('.journal-block .journal-block-person-note')).toContain('margin: 0')
    expect(rule('.journal-block .journal-block-person-note')).toContain('overflow-wrap: anywhere')
    expect(rule('.journal-block .journal-block-person-note')).toContain(
      'font-size: var(--text-xs)',
    )
    expect(rule('.journal-block .journal-block-person-note')).toContain('line-height: 1.55')
    expect(rule('@container (max-width: 520px)')).toContain(
      'grid-template-columns: minmax(0, 1fr)',
    )
  })

  it('scopes people text rules above markdown prose defaults', () => {
    expect(rule('.journal-block .journal-block-person-name')).toContain('line-height: 24px')
    expect(rule('.journal-block .journal-block-person-name')).toContain('margin: 0')
    expect(rule('.journal-block .journal-block-person-note')).toContain('margin: 0')
    expect(rule('.journal-block .journal-block-person-note')).toContain('font-size: var(--text-xs)')
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
