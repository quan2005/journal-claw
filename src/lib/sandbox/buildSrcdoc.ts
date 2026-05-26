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

const componentCSS = `
/* ===== Compare — A/B/C option cards ===== */
.compare {
  display: flex; flex-direction: column; gap: 0.75rem;
  margin: var(--pico-typography-spacing-vertical) 0;
}
.compare-item {
  display: flex; align-items: flex-start; gap: 0.75rem;
  padding: 1rem 1.125rem;
  background: var(--pico-card-background-color);
  border: 1px solid var(--pico-muted-border-color);
  border-radius: var(--pico-border-radius);
}
.compare-item .compare-letter {
  display: flex; align-items: center; justify-content: center;
  width: 1.625rem; height: 1.625rem;
  background: var(--pico-primary-background);
  color: var(--pico-primary-inverse);
  border-radius: var(--pico-border-radius);
  font-weight: 700; font-size: 0.85rem;
  flex-shrink: 0; font-family: monospace;
}
.compare-item .compare-body { flex: 1; }
.compare-item .compare-body strong { display: block; margin-bottom: 0.15rem; }
.compare-item .compare-body p {
  color: var(--pico-muted-color); font-size: 0.875rem; margin: 0;
}

/* ===== Flow — process / flowchart nodes ===== */
.flow {
  display: flex; flex-wrap: wrap; align-items: flex-start;
  gap: 0; margin: var(--pico-typography-spacing-vertical) 0;
}
.flow-node {
  display: flex; align-items: center;
  padding: 0.6rem 1rem;
  background: var(--pico-card-background-color);
  border: 1px solid var(--pico-muted-border-color);
  border-radius: var(--pico-border-radius);
  font-size: 0.875rem; font-weight: 500;
  white-space: nowrap;
}
.flow-arrow {
  display: flex; align-items: center;
  padding: 0 0.5rem;
  color: var(--pico-muted-color);
  font-size: 1.125rem; user-select: none;
}

/* Wrap your .flow nodes in article cards for vertical step flows */
.flow-steps {
  display: flex; flex-direction: column; gap: 0.5rem;
  padding-left: 1.5rem; border-left: 2px solid var(--pico-primary-background);
  margin: var(--pico-typography-spacing-vertical) 0;
}
.flow-step {
  position: relative;
}
.flow-step::before {
  content: '';
  position: absolute; left: -1.85rem; top: 0.45rem;
  width: 0.625rem; height: 0.625rem;
  background: var(--pico-primary-background);
  border-radius: 50%;
}

/* ===== Mockup — wireframe / design preview container ===== */
.mockup {
  background: var(--pico-card-background-color);
  border: 1px solid var(--pico-muted-border-color);
  border-radius: var(--pico-border-radius);
  overflow: hidden;
  margin: var(--pico-typography-spacing-vertical) 0;
  box-shadow: var(--pico-card-box-shadow);
}
.mockup-header {
  background: var(--pico-code-background-color);
  padding: 0.5rem 0.75rem;
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
.mockup-body { padding: 1rem; }

/* ===== Timeline ===== */
.timeline {
  position: relative; padding-left: 1.5rem;
  margin: var(--pico-typography-spacing-vertical) 0;
}
.timeline::before {
  content: '';
  position: absolute; left: 0.35rem; top: 0.25rem; bottom: 0.25rem;
  width: 2px; background: var(--pico-muted-border-color);
}
.timeline-item { position: relative; margin-bottom: 1rem; }
.timeline-item:last-child { margin-bottom: 0; }
.timeline-item::before {
  content: '';
  position: absolute; left: -1.15rem; top: 0.3rem;
  width: 0.5rem; height: 0.5rem;
  background: var(--pico-primary-background);
  border-radius: 50%;
}
.timeline-date {
  font-size: 0.75rem; color: var(--pico-muted-color);
  font-family: monospace; margin-bottom: 0.1rem;
}
.timeline-body { font-size: 0.9rem; }
.timeline-body p { margin: 0; }

/* ===== KPI Bar — key metric summary ===== */
.kpi-bar {
  display: flex; gap: 1.5rem; flex-wrap: wrap;
  margin: var(--pico-typography-spacing-vertical) 0;
  padding: 1rem 1.125rem;
  background: var(--pico-card-background-color);
  border: 1px solid var(--pico-muted-border-color);
  border-radius: var(--pico-border-radius);
}
.kpi-item { display: flex; flex-direction: column; min-width: 80px; }
.kpi-value {
  font-size: 1.25rem; font-weight: 700;
  color: var(--pico-color); line-height: 1.2;
  font-family: monospace;
}
.kpi-label {
  font-size: 0.6875rem; color: var(--pico-muted-color);
  text-transform: uppercase; letter-spacing: 0.04em;
  margin-top: 0.1rem;
}
.kpi-up   { color: #2c8a4f; font-size: 0.8rem; font-weight: 600; }
.kpi-down { color: #b13b3b; font-size: 0.8rem; font-weight: 600; }

/* ===== Decisions — callout with left accent bar ===== */
.decisions {
  padding: 1rem 1.125rem;
  border-left: 3px solid var(--pico-primary-background);
  background: var(--pico-card-background-color);
  border-radius: 0 var(--pico-border-radius) var(--pico-border-radius) 0;
  margin: var(--pico-typography-spacing-vertical) 0;
}
.decisions h2, .decisions h3 { margin-top: 0; }
.decisions ul { margin-bottom: 0; }

/* ===== Pros/Cons — side-by-side comparison ===== */
.pros-cons {
  display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;
  margin: var(--pico-typography-spacing-vertical) 0;
}
@media (max-width: 600px) { .pros-cons { grid-template-columns: 1fr; } }
.pros, .cons {
  padding: 1rem; border-radius: var(--pico-border-radius);
  background: var(--pico-card-background-color);
}
.pros h3, .pros h4 { color: #2c8a4f; }
.cons h3, .cons h4 { color: #b13b3b; }
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
