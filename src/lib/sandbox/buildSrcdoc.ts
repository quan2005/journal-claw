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

  // Design tokens adapted from Open Design's DESIGN.md + meeting-notes template.
  // Naming follows Open Design conventions: paper / ink / muted / line / accent-soft.
  const tokens = `
    :root {
      color-scheme: ${isDark ? 'dark' : 'light'};

      /* — surface hierarchy — */
      --bg: ${isDark ? '#0f0f0f' : '#f5f5f7'};
      --paper: ${isDark ? '#1a1a1c' : '#ffffff'};
      --raised: ${isDark ? '#1e1e21' : '#fafaf8'};

      /* — text — */
      --ink: ${isDark ? '#e8e8e8' : '#1c1c1e'};
      --muted: ${isDark ? '#8e8e93' : '#6a6a70'};
      --faint: ${isDark ? '#5a5a60' : '#a8a8b0'};

      /* — borders & dividers — */
      --line: ${isDark ? '#2a2a2e' : '#e5e5ea'};
      --line-soft: ${isDark ? '#1e1e22' : '#f0f0f2'};

      /* — accent (journal amber) — */
      --accent: ${isDark ? '#c8933b' : '#b8782a'};
      --accent-soft: ${isDark ? 'rgba(200,147,59,0.10)' : 'rgba(184,120,42,0.08)'};

      /* — semantic — */
      --positive: ${isDark ? '#30b158' : '#2c8a4f'};
      --positive-soft: ${isDark ? 'rgba(48,177,88,0.12)' : 'rgba(44,138,79,0.10)'};
      --warn: ${isDark ? '#e6a329' : '#b58522'};
      --danger: ${isDark ? '#e34a4a' : '#b13b3b'};
      --danger-soft: ${isDark ? 'rgba(227,74,74,0.12)' : 'rgba(177,59,59,0.10)'};

      /* — typography — */
      --display: ${isDark
        ? "'Charter', 'Georgia', 'Times New Roman', serif"
        : "'Charter', 'Georgia', 'Times New Roman', serif"};
      --body: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, system-ui, sans-serif;
      --mono: 'SF Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

      /* — radii — */
      --radius-sm: 6px;
      --radius-md: 10px;
      --radius-lg: 14px;
    }`

  // Base styles adapted from Open Design meeting-notes template:
  // paper-on-background hierarchy, serif display headings, mono labels.
  const base = `
    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: var(--body);
      font-size: 14.5px;
      line-height: 1.65;
      -webkit-font-smoothing: antialiased;
    }

    /* — page: paper card floating on bg — */
    .page {
      max-width: 760px;
      margin: 20px auto;
      padding: 44px 52px 56px;
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
    }
    @media (max-width: 600px) {
      .page { margin: 0; border-radius: 0; border: none; padding: 28px 20px; }
    }

    /* — typography — */
    h1 { font-family: var(--display); font-size: 28px; font-weight: 700; margin: 0 0 10px; letter-spacing: -0.005em; line-height: 1.25; }
    h2 { font-family: var(--display); font-size: 20px; font-weight: 700; margin: 32px 0 12px; letter-spacing: -0.005em; }
    h3 { font-size: 15px; font-weight: 600; margin: 24px 0 8px; }
    h4 { font-size: 14px; font-weight: 600; margin: 18px 0 6px; color: var(--muted); }

    p { margin: 0 0 10px; }
    p:last-child { margin-bottom: 0; }

    strong { font-weight: 600; }

    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }

    ul, ol { margin: 0 0 10px; padding-left: 1.25rem; }
    li { margin-bottom: 4px; }

    blockquote {
      margin: 12px 0;
      padding: 10px 16px;
      border-left: 3px solid var(--accent);
      background: var(--accent-soft);
      border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
      color: var(--muted);
      font-size: 13.5px;
    }

    code {
      font-family: var(--mono);
      font-size: 0.88em;
      background: var(--line-soft);
      padding: 1px 5px;
      border-radius: 4px;
    }
    pre {
      font-family: var(--mono);
      font-size: 12.5px;
      background: var(--line-soft);
      padding: 12px 16px;
      border-radius: var(--radius-sm);
      overflow-x: auto;
      margin: 12px 0;
      line-height: 1.55;
    }
    pre code { background: none; padding: 0; border-radius: 0; }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 13.5px;
    }
    th, td {
      text-align: left;
      padding: 9px 12px;
      border-bottom: 1px solid var(--line);
    }
    th {
      font-family: var(--mono);
      font-size: 10.5px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
      font-weight: 500;
    }
    tr:last-child td { border-bottom: none; }

    hr {
      border: none;
      border-top: 1px solid var(--line);
      margin: 24px 0;
    }

    img { max-width: 100%; height: auto; border-radius: var(--radius-sm); }
  `

  // Component library: adapted from Open Design templates (meeting-notes, simple-deck, dashboard).
  // Each component is purpose-built with its own semantic class, following Open Design conventions.
  const components = `
    /* — meta / crumb — */
    .crumb {
      font-family: var(--mono);
      font-size: 11px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .meta-row {
      display: flex; gap: 24px; flex-wrap: wrap;
      font-size: 13px; color: var(--muted);
    }
    .meta-row strong {
      color: var(--ink); display: block;
      font-family: var(--mono); font-size: 10.5px;
      text-transform: uppercase; letter-spacing: 0.06em;
      margin-bottom: 4px; font-weight: 500;
    }
    .subtitle {
      color: var(--muted);
      font-size: 14px;
      margin-bottom: 20px;
    }

    /* — status pill — */
    .pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-family: var(--mono);
      font-size: 10.5px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .pill-todo     { background: var(--line-soft); color: var(--muted); border: 1px solid var(--line); }
    .pill-progress { background: var(--accent-soft); color: var(--accent); }
    .pill-blocked  { background: var(--danger-soft); color: var(--danger); }
    .pill-done     { background: var(--positive-soft); color: var(--positive); }

    /* — agenda / check-list — */
    .agenda { display: flex; flex-direction: column; gap: 6px; }
    .agenda-item {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 9px 14px; border-radius: var(--radius-sm);
      background: var(--line-soft);
    }
    .agenda-item .check {
      flex: 0 0 18px; width: 18px; height: 18px;
      border-radius: 4px; border: 1.5px solid var(--ink);
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700;
      color: transparent; margin-top: 2px;
    }
    .agenda-item.done .check { background: var(--positive); border-color: var(--positive); color: white; }
    .agenda-item .body { flex: 1; }
    .agenda-item .body strong { font-weight: 600; }
    .agenda-item .body small { color: var(--muted); display: block; margin-top: 2px; font-size: 12.5px; }
    .agenda-item .time { font-family: var(--mono); font-size: 11px; color: var(--muted); padding-top: 3px; }

    /* — decision callout — */
    .decisions {
      padding: 20px 22px;
      background: var(--accent-soft);
      border-left: 3px solid var(--accent);
      border-radius: var(--radius-sm);
    }
    .decisions h3 { font-family: var(--display); font-size: 15px; margin: 0 0 10px; color: var(--accent); }
    .decisions ul { padding-left: 18px; margin: 0; display: flex; flex-direction: column; gap: 6px; font-size: 14px; }
    .decisions li::marker { color: var(--accent); }

    /* — callout variants — */
    .callout {
      padding: 16px 20px; border-radius: var(--radius-sm);
      border-left: 3px solid var(--line);
      background: var(--line-soft);
      margin: 12px 0;
    }
    .callout-info  { border-left-color: var(--accent); background: var(--accent-soft); }
    .callout-warn  { border-left-color: var(--warn); }
    .callout-danger { border-left-color: var(--danger); background: var(--danger-soft); }

    /* — two-column panel grid — */
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }
    .panel {
      padding: 18px 20px;
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
    }
    .panel h3 { font-family: var(--display); font-size: 15px; margin: 0 0 8px; }
    .panel p { color: var(--muted); font-size: 13.5px; line-height: 1.55; }

    /* — attendees / avatars — */
    .attendees {
      display: flex; align-items: center; gap: 14px;
      margin-top: 18px; padding: 14px 16px;
      background: var(--line-soft); border-radius: var(--radius-sm);
    }
    .attendees-label {
      font-family: var(--mono); font-size: 11px;
      text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted);
    }
    .av-row { display: flex; }
    .av {
      width: 28px; height: 28px; border-radius: 50%;
      border: 2px solid var(--paper); margin-left: -8px;
      font-size: 11px; font-weight: 700; color: white;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .av:first-child { margin-left: 0; }

    /* — footer — */
    footer {
      margin-top: 36px; padding-top: 16px;
      border-top: 1px solid var(--line);
      display: flex; justify-content: space-between;
      font-family: var(--mono); font-size: 11.5px; color: var(--muted);
    }

    /* — label — */
    .label {
      font-family: var(--mono);
      font-size: 10.5px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 6px;
      font-weight: 500;
    }

    /* — mockup (from brainstorming, Open Design-adapted) — */
    .mockup {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      overflow: hidden;
      margin-bottom: 16px;
    }
    .mockup-header {
      background: var(--line-soft);
      padding: 8px 14px;
      font-family: var(--mono);
      font-size: 11px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-bottom: 1px solid var(--line);
      display: flex; align-items: center; gap: 10px;
      user-select: none;
    }
    .mockup-header::before {
      content: '';
      display: block;
      width: 10px; height: 10px;
      border-radius: 50%;
      background: #ff5f57;
      box-shadow: 16px 0 0 #ffbd2e, 32px 0 0 #28ca41;
      flex-shrink: 0;
    }
    .mockup-body { padding: 0; }

    /* — section — */
    .section { margin-top: 32px; }
  `

  return `<!DOCTYPE html>
<html${darkClass}>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    ${tokens}
    ${base}
    ${components}
  </style>
  ${bridges}
</head>
<body>
  ${html}
</body>
</html>`
}
