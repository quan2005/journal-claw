import { describe, expect, it } from 'vitest'

import { buildSrcdoc } from '../lib/sandbox/buildSrcdoc'

describe('SandboxPreview srcdoc', () => {
  it('bridges Journal theme tokens for raw HTML previews', () => {
    const srcdoc = buildSrcdoc(
      '<main style="color:var(--color-text-secondary)">Preview</main>',
      'light',
    )

    expect(srcdoc).toContain('--color-background-primary')
    expect(srcdoc).toContain('--color-text-secondary')
    expect(srcdoc).toContain('--color-text-success')
    expect(srcdoc).toContain('--border-radius-lg')
    expect(srcdoc).toContain('Preview')
  })

  it('injects the Journal preview preset into HTML fragments', () => {
    const srcdoc = buildSrcdoc('<main><h1>Preview</h1><p>Readable by default.</p></main>', 'light')

    expect(srcdoc).toContain('id="journal-preview-preset"')
    expect(srcdoc).toContain('@layer journal.preview')
    expect(srcdoc).toContain('--j-bg')
    expect(srcdoc).toContain(':where(.surface, .j-surface, .card, .j-card')
    expect(srcdoc).not.toContain('neat.style')
  })

  it('injects the same low-specificity preset into complete HTML documents', () => {
    const srcdoc = buildSrcdoc(
      `<!doctype html>
<html>
<head><style>.card{border-radius:24px}</style></head>
<body><main class="card">Custom card</main></body>
</html>`,
      'dark',
    )

    expect(srcdoc).toContain('id="journal-preview-preset"')
    expect(srcdoc).toContain('@layer journal.preview')
    expect(srcdoc).toContain(':where(body)')
    expect(srcdoc).toContain('.card{border-radius:24px}')
    expect(srcdoc).toContain('Custom card')
  })

  it('injects inline Tabler Icons webfont support for AI-generated ti classes', () => {
    // AC-21: tabler icon CSS is inlined as a trimmed (woff2-only) <style> block,
    // not referenced as an external stylesheet link.
    const srcdoc = buildSrcdoc(
      '<main><i class="ti ti-clock" aria-hidden="true"></i><span>时间流程</span></main>',
      'light',
    )

    expect(srcdoc).toContain('<style id="journal-preview-tabler-icons">')
    expect(srcdoc).toContain('ti ti-clock')
  })
})
