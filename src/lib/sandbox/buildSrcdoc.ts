import { injectSandboxShim, injectPreviewFocusGuard, injectThemeBridge } from './bridges'
import picoCSS from './pico-amber.css?raw'

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
 * Stylesheet ported directly from brainstorming visual companion frame-template.css.
 *
 * Changes from the original:
 *   - Accent: Apple blue (#0071e3) → journal amber (#b8782a / #c8933b)
 *   - Dark mode: @media (prefers-color-scheme) → [data-theme="dark"] selector
 *   - Removed: chrome (.header, .indicator-bar), body flex layout, global reset (*)
 *   - Removed: interactive states (.selected, cursor:pointer)
 *   - Pico CSS handles: reset, tables, code, forms, details, base typography
 *   - Added: .timeline, .kpi-bar, .flow, .flow-steps, .decisions (not in original)
 */
const frameCSS = (isDark: boolean) => `
/* ===== THEME VARIABLES (from brainstorming frame-template.css) ===== */
:root {
  --bg-primary: ${isDark ? '#1d1d1f' : '#f5f5f7'};
  --bg-secondary: ${isDark ? '#2d2d2f' : '#ffffff'};
  --bg-tertiary: ${isDark ? '#3d3d3f' : '#e5e5e7'};
  --border: ${isDark ? '#424245' : '#d1d1d6'};
  --text-primary: ${isDark ? '#f5f5f7' : '#1d1d1f'};
  --text-secondary: ${isDark ? '#86868b' : '#86868b'};
  --text-tertiary: ${isDark ? '#636366' : '#aeaeb2'};
  --accent: ${isDark ? '#c8933b' : '#b8782a'};
  --accent-hover: ${isDark ? '#d4a24e' : '#9c6622'};
  --success: #34c759;
  --warning: #ff9f0a;
  --error: #ff3b30;
}

/* ===== TYPOGRAPHY (from brainstorming frame-template.css) ===== */
h2 { font-size: 1.5rem; font-weight: 600; }
h3 { font-size: 1.1rem; font-weight: 600; }
.subtitle { color: var(--text-secondary); margin-bottom: 1.5rem; }
.section { margin-bottom: 2rem; }
.label { font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }

/* ===== OPTIONS — choice / comparison cards ===== */
/* Direct port from brainstorming frame-template.css */
.options { display: flex; flex-direction: column; gap: 0.75rem; margin: 1rem 0; }
.option {
  background: var(--bg-secondary);
  border: 2px solid var(--border);
  border-radius: 12px;
  padding: 1rem 1.25rem;
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  transition: border-color 0.15s ease;
}
.option:hover { border-color: var(--accent); }
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

/* ===== CARDS — auto-fit grid (from brainstorming frame-template.css) ===== */
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin: 1rem 0; }
.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}
.card:hover { border-color: var(--accent); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.card-image { background: var(--bg-tertiary); aspect-ratio: 16/10; display: flex; align-items: center; justify-content: center; }
.card-body { padding: 1rem; }
.card-body h3 { margin-bottom: 0.25rem; }
.card-body p { color: var(--text-secondary); font-size: 0.85rem; }

/* ===== MOCKUP — wireframe container (from brainstorming frame-template.css) ===== */
.mockup {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 1.5rem;
}
.mockup-header {
  background: var(--bg-tertiary);
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
}
.mockup-body { padding: 0; }

/* ===== SPLIT — side-by-side (from brainstorming frame-template.css) ===== */
.split { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
@media (max-width: 700px) { .split { grid-template-columns: 1fr; } }

/* ===== PROS/CONS — trade-off analysis (from brainstorming frame-template.css) ===== */
.pros-cons { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0; }
.pros, .cons { background: var(--bg-secondary); border-radius: 8px; padding: 1rem; }
.pros h4 { color: var(--success); font-size: 0.85rem; margin-bottom: 0.5rem; }
.cons h4 { color: var(--error); font-size: 0.85rem; margin-bottom: 0.5rem; }
.pros ul, .cons ul { margin-left: 1.25rem; font-size: 0.85rem; color: var(--text-secondary); }
.pros li, .cons li { margin-bottom: 0.25rem; }

/* ===== PLACEHOLDER (from brainstorming frame-template.css) ===== */
.placeholder {
  background: var(--bg-tertiary);
  border: 2px dashed var(--border);
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  color: var(--text-tertiary);
}

/* ===== MOCKUP ELEMENTS (from brainstorming frame-template.css) ===== */
.mock-nav { background: var(--accent); color: white; padding: 0.75rem 1rem; display: flex; gap: 1.5rem; font-size: 0.9rem; }
.mock-sidebar { background: var(--bg-tertiary); padding: 1rem; min-width: 180px; }
.mock-content { padding: 1.5rem; flex: 1; }
.mock-button { background: var(--accent); color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.85rem; }
.mock-input { background: var(--bg-primary); border: 1px solid var(--border); border-radius: 6px; padding: 0.5rem; width: 100%; }

/* ===== EXTENSIONS (not in frame-template, but follow its conventions) ===== */

/* Timeline */
.timeline { position: relative; padding-left: 1.5rem; margin: 1rem 0; }
.timeline::before {
  content: '';
  position: absolute; left: 0.35rem; top: 0.3rem; bottom: 0.3rem;
  width: 2px; background: var(--border); border-radius: 1px;
}
.timeline-item { position: relative; margin-bottom: 1rem; }
.timeline-item:last-child { margin-bottom: 0; }
.timeline-item::before {
  content: '';
  position: absolute; left: -1.15rem; top: 0.3rem;
  width: 0.5rem; height: 0.5rem;
  background: var(--accent); border-radius: 50%;
}
.timeline-date { font-size: 0.7rem; color: var(--text-secondary); font-family: monospace; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 0.15rem; }
.timeline-body { font-size: 0.9rem; }
.timeline-body p { margin: 0; }

/* KPI Bar */
.kpi-bar { display: flex; gap: 1.5rem; flex-wrap: wrap; margin: 1rem 0; padding: 1rem 1.25rem; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 10px; }
.kpi-item { display: flex; flex-direction: column; min-width: 80px; }
.kpi-value { font-size: 1.4rem; font-weight: 600; color: var(--text-primary); line-height: 1.2; font-family: monospace; }
.kpi-label { font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; margin-top: 0.15rem; }
.kpi-up { color: var(--success); font-size: 0.8rem; font-weight: 600; }
.kpi-down { color: var(--error); font-size: 0.8rem; font-weight: 600; }

/* Flow */
.flow { display: flex; flex-wrap: wrap; align-items: center; margin: 1rem 0; }
.flow-node { padding: 0.5rem 1rem; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px; font-size: 0.875rem; font-weight: 500; white-space: nowrap; }
.flow-arrow { padding: 0 0.5rem; color: var(--text-tertiary); font-size: 1rem; user-select: none; }

/* Flow Steps (vertical) */
.flow-steps { display: flex; flex-direction: column; gap: 0.75rem; padding-left: 1.5rem; border-left: 2px solid var(--accent); margin: 1rem 0; }
.flow-step { position: relative; font-size: 0.9rem; }
.flow-step::before { content: ''; position: absolute; left: -1.85rem; top: 0.35rem; width: 0.625rem; height: 0.625rem; background: var(--accent); border-radius: 50%; }
.flow-step p { color: var(--text-secondary); font-size: 0.85rem; margin: 0.15rem 0 0; }

/* Decisions */
.decisions { padding: 1rem 1.25rem; border-left: 3px solid var(--accent); background: var(--bg-secondary); border-radius: 0 8px 8px 0; margin: 1rem 0; }
.decisions h2, .decisions h3 { margin-top: 0; }
.decisions ul { margin-bottom: 0; }
`

function wrapFragment(html: string, theme: 'light' | 'dark', bridges: string): string {
  const isDark = theme === 'dark'
  const themeAttr = isDark ? ' data-theme="dark"' : ''

  return `<!DOCTYPE html>
<html${themeAttr}>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>${picoCSS}</style>
  <style>${frameCSS(isDark)}</style>
  ${bridges}
</head>
<body class="pico">
  ${html}
</body>
</html>`
}
