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
 * Component CSS layered on top of Pico CSS classless.
 * Uses Pico CSS variables for color consistency.
 */

/**
 * Component CSS — adapted from brainstorming visual companion frame-template.css.
 * Uses Pico CSS variables where available; defines journal-specific surface hierarchy
 * (--cmp-bg / --cmp-surface / --cmp-raised) for component-only use.
 */

const componentCSS = `
/* ===== Component surface tokens (layered on top of Pico) ===== */
:root {
  --cmp-surface: var(--pico-card-background-color);
  --cmp-raised: var(--pico-code-background-color);
}

/* ===== OPTIONS — choice / comparison cards ===== */
/* Adapted from brainstorming: 2px border, 12px radius, bg-secondary, flex + gap */
.options { display: flex; flex-direction: column; gap: 0.75rem; margin: 1rem 0; }
.option {
  display: flex; align-items: flex-start; gap: 1rem;
  padding: 1rem 1.25rem;
  background: var(--cmp-surface);
  border: 2px solid var(--pico-muted-border-color);
  border-radius: 12px;
  transition: border-color 0.15s ease;
}
.option:hover { border-color: var(--pico-primary); }
.option .letter {
  display: flex; align-items: center; justify-content: center;
  width: 1.75rem; height: 1.75rem;
  background: var(--cmp-raised);
  color: var(--pico-muted-color);
  border-radius: 6px;
  font-weight: 600; font-size: 0.85rem;
  flex-shrink: 0;
}
.option .content { flex: 1; }
.option .content h3 { font-size: 0.95rem; margin-bottom: 0.15rem; }
.option .content p { color: var(--pico-muted-color); font-size: 0.85rem; margin: 0; }

/* ===== CARDS — auto-fit grid of cards ===== */
/* Adapted from brainstorming: minmax(280px), 12px radius, hover lift */
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin: 1rem 0; }
.card {
  background: var(--cmp-surface);
  border: 1px solid var(--pico-muted-border-color);
  border-radius: 12px;
  overflow: hidden;
  transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}
.card:hover { border-color: var(--pico-primary); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
.card-image {
  background: var(--cmp-raised);
  aspect-ratio: 16 / 10;
  display: flex; align-items: center; justify-content: center;
}
.card-body { padding: 1rem; }
.card-body h3 { margin-bottom: 0.25rem; }
.card-body p { color: var(--pico-muted-color); font-size: 0.85rem; }
.card-body strong { display: block; margin-bottom: 0.2rem; }

/* ===== MOCKUP — wireframe / design preview ===== */
/* Adapted from brainstorming: bg-secondary, 12px radius, overflow hidden */
.mockup {
  background: var(--cmp-surface);
  border: 1px solid var(--pico-muted-border-color);
  border-radius: 12px;
  overflow: hidden;
  margin: 1rem 0;
}
.mockup-header {
  background: var(--cmp-raised);
  padding: 0.5rem 1rem;
  font-size: 0.75rem; color: var(--pico-muted-color);
  border-bottom: 1px solid var(--pico-muted-border-color);
  display: flex; align-items: center; gap: 0.5rem;
  user-select: none;
}
.mockup-header::before {
  content: '';
  width: 10px; height: 10px; border-radius: 50%;
  background: #ff5f57;
  box-shadow: 16px 0 0 #ffbd2e, 32px 0 0 #28ca41;
  flex-shrink: 0;
}
.mockup-body { padding: 0; }

/* ===== SPLIT — side-by-side comparison ===== */
/* Adapted from brainstorming: 1fr 1fr, collapses at 700px */
.split { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin: 1rem 0; }
.split > * {
  background: var(--cmp-surface);
  border: 1px solid var(--pico-muted-border-color);
  border-radius: 10px;
  padding: 1rem 1.125rem;
}
.split h4 { font-size: 0.875rem; font-weight: 600; margin: 0 0 0.5rem; }
.split p { font-size: 0.875rem; color: var(--pico-muted-color); margin: 0; }
@media (max-width: 700px) { .split { grid-template-columns: 1fr; } }

/* ===== PROS/CONS — trade-off analysis ===== */
/* Adapted from brainstorming: g/r headings, bg-secondary, 8px radius */
.pros-cons { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0; }
@media (max-width: 600px) { .pros-cons { grid-template-columns: 1fr; } }
.pros, .cons {
  background: var(--cmp-surface);
  border-radius: 8px; padding: 1rem;
}
.pros h4 { color: var(--pico-ins-color, #2c8a4f); font-size: 0.85rem; margin-bottom: 0.5rem; }
.cons h4 { color: var(--pico-del-color, #b13b3b); font-size: 0.85rem; margin-bottom: 0.5rem; }
.pros ul, .cons ul { margin-left: 1.25rem; font-size: 0.85rem; color: var(--pico-muted-color); }
.pros li, .cons li { margin-bottom: 0.25rem; }

/* ===== DECISIONS — callout with left accent bar ===== */
.decisions {
  padding: 1rem 1.25rem;
  border-left: 3px solid var(--pico-primary-background);
  background: var(--cmp-surface);
  border-radius: 0 8px 8px 0;
  margin: 1rem 0;
}
.decisions h2, .decisions h3 { margin-top: 0; }
.decisions ul { margin-bottom: 0; }

/* ===== TIMELINE — vertical event chain ===== */
.timeline { position: relative; padding-left: 1.5rem; margin: 1rem 0; }
.timeline::before {
  content: '';
  position: absolute; left: 0.35rem; top: 0.3rem; bottom: 0.3rem;
  width: 2px; background: var(--pico-muted-border-color); border-radius: 1px;
}
.timeline-item { position: relative; margin-bottom: 1rem; }
.timeline-item:last-child { margin-bottom: 0; }
.timeline-item::before {
  content: '';
  position: absolute; left: -1.15rem; top: 0.3rem;
  width: 0.5rem; height: 0.5rem;
  background: var(--pico-primary-background); border-radius: 50%;
}
.timeline-date {
  font-size: 0.7rem; color: var(--pico-muted-color);
  font-family: monospace; margin-bottom: 0.15rem;
  text-transform: uppercase; letter-spacing: 0.03em;
}
.timeline-body { font-size: 0.9rem; }
.timeline-body p { margin: 0; }

/* ===== KPI BAR — metric summary strip ===== */
.kpi-bar {
  display: flex; gap: 1.5rem; flex-wrap: wrap;
  margin: 1rem 0; padding: 1rem 1.25rem;
  background: var(--cmp-surface);
  border: 1px solid var(--pico-muted-border-color);
  border-radius: 10px;
}
.kpi-item { display: flex; flex-direction: column; min-width: 80px; }
.kpi-value {
  font-size: 1.4rem; font-weight: 600; color: var(--pico-color);
  line-height: 1.2; font-family: monospace;
}
.kpi-label {
  font-size: 0.65rem; color: var(--pico-muted-color);
  text-transform: uppercase; letter-spacing: 0.04em;
  margin-top: 0.15rem;
}
.kpi-up   { color: #2c8a4f; font-size: 0.8rem; font-weight: 600; }
.kpi-down { color: #b13b3b; font-size: 0.8rem; font-weight: 600; }

/* ===== FLOW — horizontal process nodes ===== */
.flow { display: flex; flex-wrap: wrap; align-items: center; gap: 0; margin: 1rem 0; }
.flow-node {
  display: flex; align-items: center;
  padding: 0.5rem 1rem;
  background: var(--cmp-surface);
  border: 1px solid var(--pico-muted-border-color);
  border-radius: 8px;
  font-size: 0.875rem; font-weight: 500;
  white-space: nowrap;
}
.flow-arrow {
  display: flex; align-items: center;
  padding: 0 0.5rem;
  color: var(--pico-muted-color);
  font-size: 1rem; user-select: none;
}

/* ===== FLOW-STEPS — vertical step list ===== */
.flow-steps {
  display: flex; flex-direction: column; gap: 0.75rem;
  padding-left: 1.5rem; border-left: 2px solid var(--pico-primary-background);
  margin: 1rem 0;
}
.flow-step { position: relative; font-size: 0.9rem; }
.flow-step::before {
  content: '';
  position: absolute; left: -1.85rem; top: 0.35rem;
  width: 0.625rem; height: 0.625rem;
  background: var(--pico-primary-background); border-radius: 50%;
}
.flow-step p { color: var(--pico-muted-color); font-size: 0.85rem; margin: 0.15rem 0 0; }

/* ===== TYPOGRAPHY HELPERS ===== */
/* Adapted from brainstorming: .subtitle, .section, .label, .placeholder */
.subtitle { color: var(--pico-muted-color); margin-bottom: 1.5rem; }
.section { margin-bottom: 2rem; }
.label {
  font-size: 0.7rem; color: var(--pico-muted-color);
  text-transform: uppercase; letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
}
.placeholder {
  background: var(--cmp-raised);
  border: 2px dashed var(--pico-muted-border-color);
  border-radius: 8px;
  padding: 2rem; text-align: center;
  color: var(--pico-muted-color);
}

/* ===== MOCKUP ELEMENTS (wireframe building blocks) ===== */
/* Adapted from brainstorming: accent-fill nav, tertiary sidebar, accent-fill buttons */
.mock-nav {
  background: var(--pico-primary-background);
  color: var(--pico-primary-inverse);
  padding: 0.75rem 1rem; display: flex; gap: 1.5rem;
  font-size: 0.9rem;
}
.mock-sidebar { background: var(--cmp-raised); padding: 1rem; min-width: 180px; }
.mock-content { padding: 1.5rem; flex: 1; }
.mock-button {
  background: var(--pico-primary-background);
  color: var(--pico-primary-inverse);
  border: none; padding: 0.5rem 1rem; border-radius: 6px;
  font-size: 0.85rem; display: inline-block;
}
.mock-input {
  background: var(--pico-background-color);
  border: 1px solid var(--pico-muted-border-color);
  border-radius: 6px; padding: 0.5rem; width: 100%;
}
`

function wrapFragment(html: string, theme: 'light' | 'dark', bridges: string): string {
  const themeAttr = theme === 'dark' ? ' data-theme="dark"' : ''

  return `<!DOCTYPE html>
<html${themeAttr}>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>${picoCSS}</style>
  <style>${componentCSS}</style>
  ${bridges}
</head>
<body class="pico">
  ${html}
</body>
</html>`
}
