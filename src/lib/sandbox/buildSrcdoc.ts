import { injectSandboxShim, injectPreviewFocusGuard, injectThemeBridge } from './bridges'
// Pico CSS v2 classless · amber accent · MIT licensed
// https://picocss.com — zero-class semantic HTML, auto dark mode
import picoCSS from './pico-amber.css?raw'

/**
 * Build a srcdoc string for a sandboxed iframe.
 *
 * Fragment HTML (the default for AI-generated journal entries) is wrapped
 * in a minimal doctype shell with Pico CSS classless stylesheet, security
 * bridges, and journal theme wiring via data-theme attribute.
 *
 * Full documents pass through unchanged (bridges injected only).
 */
export function buildSrcdoc(html: string, theme: 'light' | 'dark'): string {
  const head = html.trimStart().slice(0, 64).toLowerCase()
  const isFullDoc = head.startsWith('<!doctype') || head.startsWith('<html')

  const bridges = [
    injectSandboxShim(),
    injectPreviewFocusGuard(),
    injectThemeBridge(theme),
  ].join('\n')

  if (isFullDoc) {
    return injectBridges(html, bridges)
  }

  return wrapFragment(html, theme, bridges)
}

function injectBridges(doc: string, bridges: string): string {
  if (/<\/head>/i.test(doc)) {
    return doc.replace(/<\/head>/i, `${bridges}\n</head>`)
  }
  if (/<body[^>]*>/i.test(doc)) {
    return doc.replace(/<body([^>]*)>/i, `<body$1>${bridges}`)
  }
  return bridges + doc
}

/**
 * Wrap a fragment in a minimal shell with Pico CSS classless.
 *
 * Pico CSS provides beautiful, semantic HTML styling out of the box:
 * - Responsive typography (h1–h6, tables, blockquotes, code, etc.)
 * - Auto dark/light mode via `data-theme` attribute
 * - Zero classes needed — just write semantic HTML
 * - Amber accent variant matches journal's brand color
 */
function wrapFragment(html: string, theme: 'light' | 'dark', bridges: string): string {
  const themeAttr = theme === 'dark' ? ' data-theme="dark"' : ''

  return `<!DOCTYPE html>
<html${themeAttr}>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>${picoCSS}</style>
  ${bridges}
</head>
<body class="pico">
  ${html}
</body>
</html>`
}
