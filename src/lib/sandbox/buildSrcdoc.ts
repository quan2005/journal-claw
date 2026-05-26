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
  const isDark = theme === 'dark'
  const darkClass = isDark ? ' class="dark"' : ''
  return `<!DOCTYPE html>
<html${darkClass}>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    :root {
      color-scheme: ${isDark ? 'dark' : 'light'};
      --bg: ${isDark ? '#0f0f0f' : '#f5f6f7'};
      --text: ${isDark ? '#e8e8e8' : '#1c1c1e'};
      --text-secondary: ${isDark ? '#a2a6ae' : '#6a7278'};
      --text-muted: ${isDark ? '#5a5e68' : '#a0a8ad'};
      --accent: ${isDark ? '#c8933b' : '#b8782a'};
      --accent-dim: ${isDark ? 'rgba(200,147,59,0.12)' : 'rgba(184,120,42,0.08)'};
      --border: ${isDark ? '#2a2a2e' : '#d8dce0'};
      --divider: ${isDark ? '#222' : '#e8eaed'};
      --code-bg: ${isDark ? '#1a1a1c' : '#eeeff0'};
      --font-body: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      --font-mono: "IBM Plex Mono", ui-monospace, "SF Mono", monospace;
      --bg-primary: var(--bg);
      --bg-secondary: ${isDark ? '#1a1a1c' : '#ffffff'};
      --bg-tertiary: ${isDark ? '#2a2a2e' : '#e5e5e7'};
      --text-primary: var(--text);
      --text-tertiary: var(--text-muted);
      --success: #34c759;
      --error: #ff3b30;
    }
    *, *::before, *::after { box-sizing: border-box; }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-body);
      font-size: 0.9375rem;
      line-height: 1.75;
      margin: 0;
      padding: 1.5rem 1.75rem;
      max-width: 48rem;
    }

    h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 0.75rem; line-height: 1.35; color: var(--text); }
    h2 { font-size: 1.15rem; font-weight: 600; margin: 2rem 0 0.5rem; line-height: 1.4; color: var(--text); }
    h3 { font-size: 1rem; font-weight: 600; margin: 1.5rem 0 0.4rem; line-height: 1.45; color: var(--text-secondary); }
    h4 { font-size: 0.9375rem; font-weight: 600; margin: 1.25rem 0 0.35rem; line-height: 1.45; color: var(--text-secondary); }

    p { margin: 0 0 0.75rem; }

    ul, ol { margin: 0 0 0.75rem; padding-left: 1.25rem; }
    li { margin-bottom: 0.2rem; }
    li > ul, li > ol { margin-top: 0.25rem; margin-bottom: 0; }

    strong { font-weight: 600; color: var(--text); }

    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }

    blockquote {
      margin: 0.75rem 0;
      padding: 0.5rem 1rem;
      border-left: 2px solid var(--accent);
      background: var(--accent-dim);
      border-radius: 0 4px 4px 0;
    }
    blockquote p { margin: 0.25rem 0; color: var(--text-secondary); }

    code {
      font-family: var(--font-mono);
      font-size: 0.8125rem;
      background: var(--code-bg);
      padding: 0.1em 0.35em;
      border-radius: 3px;
      color: var(--text);
    }
    pre {
      font-family: var(--font-mono);
      font-size: 0.8125rem;
      background: var(--code-bg);
      padding: 0.75rem 1rem;
      border-radius: 6px;
      overflow-x: auto;
      margin: 0.75rem 0;
      line-height: 1.55;
    }
    pre code {
      background: none;
      padding: 0;
      border-radius: 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 0.75rem 0;
      font-size: 0.875rem;
    }
    th, td {
      text-align: left;
      padding: 0.4rem 0.75rem;
      border-bottom: 0.5px solid var(--divider);
    }
    th {
      font-weight: 600;
      color: var(--text-secondary);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    td { color: var(--text); }

    hr {
      border: none;
      border-top: 0.5px solid var(--divider);
      margin: 1.5rem 0;
    }

    img { max-width: 100%; height: auto; border-radius: 6px; }

    /* ===== VISUAL PATTERNS (from brainstorming frame-template) ===== */

    .subtitle { color: var(--text-secondary); margin-bottom: 1.5rem; font-size: 0.9rem; }
    .section { margin-bottom: 2rem; }
    .label { font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }

    /* Options (choice cards) */
    .options { display: flex; flex-direction: column; gap: 0.75rem; margin: 1rem 0; }
    .option {
      background: var(--bg-secondary);
      border: 2px solid var(--border);
      border-radius: 12px;
      padding: 1rem 1.25rem;
      display: flex;
      align-items: flex-start;
      gap: 1rem;
    }
    .option .letter {
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      width: 1.75rem; height: 1.75rem;
      border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      font-weight: 600; font-size: 0.85rem; flex-shrink: 0;
    }
    .option .content { flex: 1; }
    .option .content h3 { font-size: 0.95rem; margin-bottom: 0.15rem; }
    .option .content p { color: var(--text-secondary); font-size: 0.85rem; margin: 0; }

    /* Cards (visual grid) */
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.75rem; margin: 1rem 0; }
    .card {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .card-image { background: var(--bg-tertiary); aspect-ratio: 16/10; display: flex; align-items: center; justify-content: center; }
    .card-body { padding: 1rem 1.125rem; font-size: 0.9rem; line-height: 1.6; color: var(--text); }
    .card-body h3 { margin: 0 0 0.35rem; font-size: 0.95rem; font-weight: 600; }
    .card-body h4 { margin: 0 0 0.25rem; font-size: 0.875rem; font-weight: 600; }
    .card-body p { color: var(--text-secondary); font-size: 0.875rem; margin: 0 0 0.5rem; }
    .card-body p:last-child { margin-bottom: 0; }
    .card-body strong { color: var(--text); }

    /* Mockup container */
    .mockup {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 1.5rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }
    .mockup-header {
      background: var(--bg-tertiary);
      padding: 0.6rem 1rem;
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--text-secondary);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 0.5rem;
      user-select: none;
    }
    .mockup-header::before {
      content: '';
      display: flex;
      gap: 6px;
      width: 12px; height: 12px;
      border-radius: 50%;
      background: #ff5f57;
      box-shadow:
        16px 0 0 #ffbd2e,
        32px 0 0 #28ca41;
      flex-shrink: 0;
      margin-right: 0.25rem;
    }
    .mockup-body { padding: 0; }

    /* Split view (side-by-side) */
    .split { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin: 1rem 0; }
    .split > * {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1rem 1.125rem;
    }
    .split h4 { font-size: 0.875rem; font-weight: 600; margin: 0 0 0.5rem; color: var(--text); }
    .split p { font-size: 0.875rem; color: var(--text-secondary); margin: 0; }
    @media (max-width: 700px) { .split { grid-template-columns: 1fr; } }

    /* Pros/Cons */
    .pros-cons { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0; }
    .pros, .cons { background: var(--bg-secondary); border-radius: 8px; padding: 1rem; }
    .pros h4 { color: var(--success); font-size: 0.85rem; margin-bottom: 0.5rem; }
    .cons h4 { color: var(--error); font-size: 0.85rem; margin-bottom: 0.5rem; }
    .pros ul, .cons ul { margin-left: 1.25rem; font-size: 0.85rem; color: var(--text-secondary); }
    .pros li, .cons li { margin-bottom: 0.25rem; }

    /* Placeholder */
    .placeholder {
      background: var(--bg-tertiary);
      border: 2px dashed var(--border);
      border-radius: 8px;
      padding: 2rem;
      text-align: center;
      color: var(--text-tertiary);
    }

    /* Timeline */
    .timeline { position: relative; padding-left: 1.75rem; margin: 1rem 0; }
    .timeline::before {
      content: '';
      position: absolute;
      left: 0.35rem;
      top: 0.35rem;
      bottom: 0.35rem;
      width: 2px;
      background: var(--border);
      border-radius: 1px;
    }
    .timeline-item { position: relative; margin-bottom: 1.25rem; }
    .timeline-item:last-child { margin-bottom: 0; }
    .timeline-item::before {
      content: '';
      position: absolute;
      left: -1.4rem;
      top: 0.35rem;
      width: 0.5rem; height: 0.5rem;
      border-radius: 50%;
      background: var(--accent);
    }
    .timeline-item .timeline-date {
      font-size: 0.7rem;
      color: var(--text-muted);
      font-family: var(--font-mono);
      margin-bottom: 0.15rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .timeline-item .timeline-body { font-size: 0.9rem; line-height: 1.6; color: var(--text); }
    .timeline-item .timeline-body p { margin: 0; color: var(--text); }

    /* KPI Bar (key metrics) */
    .kpi-bar {
      display: flex; gap: 1.5rem; flex-wrap: wrap;
      margin: 1rem 0;
      padding: 1rem 1.25rem;
      background: var(--bg-secondary);
      border-radius: 10px;
      border: 1px solid var(--border);
    }
    .kpi-item { display: flex; flex-direction: column; min-width: 80px; }
    .kpi-value {
      font-size: 1.4rem; font-weight: 600;
      color: var(--text);
      line-height: 1.2;
      font-family: var(--font-mono);
    }
    .kpi-label {
      font-size: 0.65rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-top: 0.15rem;
    }
    .kpi-trend-up { color: var(--success); font-size: 0.8rem; font-weight: 600; }
    .kpi-trend-down { color: var(--error); font-size: 0.8rem; font-weight: 600; }

    /* Inline mockup elements */
    .mock-nav {
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      padding: 0.6rem 1rem;
      display: flex; gap: 1.5rem;
      font-size: 0.8rem;
      font-weight: 500;
      border-bottom: 1px solid var(--border);
      letter-spacing: 0.02em;
    }
    .mock-sidebar { background: var(--bg-tertiary); padding: 1rem; min-width: 160px; font-size: 0.85rem; color: var(--text-secondary); }
    .mock-content { padding: 1.25rem; flex: 1; font-size: 0.9rem; }
    .mock-button {
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      border: 1px solid var(--border);
      padding: 0.4rem 0.9rem;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 500;
      display: inline-block;
      letter-spacing: 0.02em;
    }
    .mock-input { background: var(--bg-primary); border: 1px solid var(--border); border-radius: 6px; padding: 0.4rem 0.6rem; width: 100%; font-size: 0.85rem; color: var(--text-muted); }
  </style>
  ${bridges}
</head>
<body>
  ${html}
</body>
</html>`
}
