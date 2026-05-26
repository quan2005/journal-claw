import { injectSandboxShim, injectPreviewFocusGuard, injectThemeBridge } from './bridges'

/**
 * Build a srcdoc string for a sandboxed iframe.
 *
 * Detects whether the input is a full HTML document or a content fragment,
 * wraps fragments in a minimal journal-themed shell, and injects security
 * bridges (storage shim, focus guard, theme sync).
 *
 * Fragment detection follows the same pattern as Open Design's buildSrcdoc
 * and the brainstorming visual companion: check for <!doctype or <html prefix.
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

function wrapFragment(html: string, theme: 'light' | 'dark', bridges: string): string {
  const darkClass = theme === 'dark' ? ' class="dark"' : ''
  return `<!DOCTYPE html>
<html${darkClass}>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    :root {
      color-scheme: ${theme === 'dark' ? 'dark' : 'light'};
      --bg: ${theme === 'dark' ? '#0f0f0f' : '#f5f6f7'};
      --text: ${theme === 'dark' ? '#e8e8e8' : '#1c1c1e'};
      --text-secondary: ${theme === 'dark' ? '#a2a6ae' : '#6a7278'};
      --accent: ${theme === 'dark' ? '#c8933b' : '#b8782a'};
      --border: ${theme === 'dark' ? '#2a2a2e' : '#d8dce0'};
      --font-body: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      --font-mono: "IBM Plex Mono", ui-monospace, monospace;
    }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-body);
      line-height: 1.6;
      margin: 0;
      padding: 0;
    }
    a { color: var(--accent); }
  </style>
  ${bridges}
</head>
<body>
  ${html}
</body>
</html>`
}
