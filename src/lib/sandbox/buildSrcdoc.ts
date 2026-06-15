import { injectSandboxShim, injectPreviewFocusGuard, injectThemeBridge } from './bridges'
import { previewPresetCSS } from './previewPreset'
// AC-21: Only ship woff2 (drop ttf+woff ~4MB). Build a trimmed @font-face from the
// full icon-class CSS so we keep all .ti-* classes but reference woff2 only.
import tablerIconsRawCSS from '@tabler/icons-webfont/dist/tabler-icons.min.css?inline'
import tablerIconsWoff2Url from '@tabler/icons-webfont/dist/fonts/tabler-icons.woff2?url'

// Strip the multi-format src(...) down to woff2 only, keeping every icon class.
const tablerIconsCSS = tablerIconsRawCSS.replace(
  /src:url\([^)]*\)\s*format\("woff2"\)[^}]*\}/,
  `src:url("${tablerIconsWoff2Url}") format("woff2")}`,
)
// Magic UI — React + Tailwind + Motion components for rich journal entries
import magicUICSS from './magicui/dist/magicui.bundle.css?inline'
import magicUIJS from './magicui/dist/magicui.bundle.js?raw'

export function buildSrcdoc(html: string, theme: 'light' | 'dark'): string {
  const head = html.trimStart().slice(0, 64).toLowerCase()
  const isFullDoc = head.startsWith('<!doctype') || head.startsWith('<html')

  const bridges = [injectSandboxShim(), injectPreviewFocusGuard(), injectThemeBridge(theme)].join(
    '\n',
  )

  if (isFullDoc) {
    return injectBridges(html, bridges)
  }

  return wrapFragment(html, theme, bridges)
}

function injectBridges(doc: string, bridges: string): string {
  const resources = buildPreviewResources()
  const combined = `${resources}\n${bridges}`

  if (/<\/head>/i.test(doc)) {
    return doc.replace(/<\/head>/i, `${combined}\n</head>`)
  }
  if (/<body[^>]*>/i.test(doc)) {
    return doc.replace(/<body([^>]*)>/i, `<body$1>${combined}`)
  }
  return combined + doc
}

function buildPreviewResources(): string {
  return [
    `<style id="journal-preview-preset">${previewPresetCSS}</style>`,
    `<style id="journal-preview-tabler-icons">${tablerIconsCSS}</style>`,
    `<style>${magicUICSS}</style>`,
    `<script>${magicUIJS}</script>`,
  ].join('\n')
}

function wrapFragment(html: string, theme: 'light' | 'dark', bridges: string): string {
  const isDark = theme === 'dark'
  const themeAttr = isDark ? ' data-theme="dark"' : ''
  const resources = buildPreviewResources()

  return `<!DOCTYPE html>
<html${themeAttr}>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${resources}
  ${bridges}
</head>
<body data-journal-preview="fragment">
  ${html}
</body>
</html>`
}
