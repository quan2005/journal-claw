import { injectSandboxShim, injectPreviewFocusGuard, injectThemeBridge } from './bridges'
// neat.style — "One line to make raw HTML beautiful" • MIT • 3KB
// https://neat.style — modern blue accent, zero classes, auto dark mode
import neatCSS from './neat.css?raw'

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
 * Component CSS — ported from brainstorming visual companion frame-template.css.
 * Uses neat.style variables for core colors, extends with surface hierarchy for components.
 */
const componentCSS = (isDark: boolean) => `
/* ===== Surface hierarchy (extends neat.style) ===== */
:root {
  --bg-primary: ${isDark ? '#181a20' : '#ffffff'};
  --bg-secondary: ${isDark ? '#22252d' : '#f4f5f7'};
  --bg-tertiary: ${isDark ? '#2a2d36' : '#eaedf0'};
}

/* ===== TYPOGRAPHY (brainstorming frame-template.css) ===== */
.subtitle { color: var(--text-light); margin-bottom: 1.5rem; }
.section { margin-bottom: 2rem; }
.label { font-size: 0.7rem; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }

/* ===== OPTIONS — choice cards (brainstorming frame-template.css) ===== */
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
  color: var(--text-light);
  width: 1.75rem; height: 1.75rem;
  border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  font-weight: 600; font-size: 0.85rem; flex-shrink: 0;
}
.option .content { flex: 1; }
.option .content h3 { font-size: 0.95rem; margin-bottom: 0.15rem; }
.option .content p { color: var(--text-light); font-size: 0.85rem; margin: 0; }

/* ===== CARDS — grid (brainstorming frame-template.css) ===== */
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
.card-body p { color: var(--text-light); font-size: 0.85rem; }

/* ===== MOCKUP — wireframe (brainstorming frame-template.css) ===== */
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
  color: var(--text-light);
  border-bottom: 1px solid var(--border);
}
.mockup-body { padding: 0; }

/* ===== SPLIT — side-by-side (brainstorming frame-template.css) ===== */
.split { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
.split > * {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1rem 1.125rem;
}
.split h4 { font-size: 0.875rem; font-weight: 600; margin: 0 0 0.5rem; }
.split p { font-size: 0.875rem; color: var(--text-light); margin: 0; }
@media (max-width: 700px) { .split { grid-template-columns: 1fr; } }

/* ===== PROS/CONS (brainstorming frame-template.css) ===== */
.pros-cons { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0; }
.pros, .cons { background: var(--bg-secondary); border-radius: 8px; padding: 1rem; }
.pros h4 { color: #16a34a; font-size: 0.85rem; margin-bottom: 0.5rem; }
.cons h4 { color: #dc2626; font-size: 0.85rem; margin-bottom: 0.5rem; }
.pros ul, .cons ul { margin-left: 1.25rem; font-size: 0.85rem; color: var(--text-light); }
.pros li, .cons li { margin-bottom: 0.25rem; }

/* ===== PLACEHOLDER (brainstorming frame-template.css) ===== */
.placeholder {
  background: var(--bg-tertiary);
  border: 2px dashed var(--border);
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  color: var(--text-light);
}

/* ===== MOCKUP ELEMENTS (brainstorming frame-template.css) ===== */
.mock-nav { background: var(--accent); color: var(--accent-text); padding: 0.75rem 1rem; display: flex; gap: 1.5rem; font-size: 0.9rem; }
.mock-sidebar { background: var(--bg-tertiary); padding: 1rem; min-width: 180px; }
.mock-content { padding: 1.5rem; flex: 1; }
.mock-button { background: var(--accent); color: var(--accent-text); border: none; padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.85rem; }
.mock-input { background: var(--bg-primary); border: 1px solid var(--border); border-radius: 6px; padding: 0.5rem; width: 100%; }

/* ===== EXTENSIONS (timeline, kpi, flow, decisions) ===== */
.timeline { position: relative; padding-left: 1.5rem; margin: 1rem 0; }
.timeline::before { content: ''; position: absolute; left: 0.35rem; top: 0.3rem; bottom: 0.3rem; width: 2px; background: var(--border); border-radius: 1px; }
.timeline-item { position: relative; margin-bottom: 1rem; }
.timeline-item:last-child { margin-bottom: 0; }
.timeline-item::before { content: ''; position: absolute; left: -1.15rem; top: 0.3rem; width: 0.5rem; height: 0.5rem; background: var(--accent); border-radius: 50%; }
.timeline-date { font-size: 0.7rem; color: var(--text-light); font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 0.15rem; }
.timeline-body { font-size: 0.9rem; }
.timeline-body p { margin: 0; }

.kpi-bar { display: flex; gap: 1.5rem; flex-wrap: wrap; margin: 1rem 0; padding: 1rem 1.25rem; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 10px; }
.kpi-item { display: flex; flex-direction: column; min-width: 80px; }
.kpi-value { font-size: 1.4rem; font-weight: 700; color: var(--text); line-height: 1.2; font-family: var(--font-mono); }
.kpi-label { font-size: 0.65rem; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.04em; margin-top: 0.15rem; }
.kpi-up { color: #16a34a; font-size: 0.8rem; font-weight: 600; }
.kpi-down { color: #dc2626; font-size: 0.8rem; font-weight: 600; }

.flow { display: flex; flex-wrap: wrap; align-items: center; margin: 1rem 0; }
.flow-node { padding: 0.5rem 1rem; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px; font-size: 0.875rem; font-weight: 500; white-space: nowrap; }
.flow-arrow { padding: 0 0.5rem; color: var(--text-light); font-size: 1rem; user-select: none; }

.flow-steps { display: flex; flex-direction: column; gap: 0.75rem; padding-left: 1.5rem; border-left: 2px solid var(--accent); margin: 1rem 0; }
.flow-step { position: relative; font-size: 0.9rem; }
.flow-step::before { content: ''; position: absolute; left: -1.85rem; top: 0.35rem; width: 0.625rem; height: 0.625rem; background: var(--accent); border-radius: 50%; }
.flow-step p { color: var(--text-light); font-size: 0.85rem; margin: 0.15rem 0 0; }

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
  <style>${neatCSS}</style>
  <style>${componentCSS(isDark)}</style>
  ${bridges}
</head>
<body>
  ${html}
</body>
</html>`
}
