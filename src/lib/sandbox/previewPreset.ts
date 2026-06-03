export const previewPresetCSS = `
@layer journal.preview {
  :root {
    color-scheme: light;
    --j-bg: var(--bg, #f5f6f7);
    --j-surface: var(--color-background-primary, #ffffff);
    --j-surface-muted: #f7f8f9;
    --j-surface-raised: #ffffff;
    --j-text: var(--color-text-primary, var(--text, #1c1c1e));
    --j-muted: var(--color-text-secondary, var(--text-secondary, #6a7278));
    --j-faint: var(--color-text-tertiary, var(--text-tertiary, #a0a8ad));
    --j-accent: var(--accent, #b8782a);
    --j-accent-soft: #fbf3e5;
    --j-border: var(--color-border-tertiary, var(--border, #d8dce0));
    --j-border-strong: color-mix(in srgb, var(--j-border) 70%, var(--j-text) 20%);
    --j-success: var(--color-text-success, #24734e);
    --j-success-bg: var(--color-background-success, #edf7f0);
    --j-success-border: var(--color-border-success, #b7dbc4);
    --j-warning: #9a650b;
    --j-warning-bg: #fff7e6;
    --j-danger: #b5312a;
    --j-danger-bg: #fde8e5;
    --j-radius: var(--border-radius-lg, 8px);
    --j-radius-sm: var(--border-radius-md, 6px);
    --j-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 12px 30px rgba(0, 0, 0, 0.06);
    --j-font-body: var(--font-body, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
    --j-font-mono: var(--font-mono, "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace);
    --j-measure: 72ch;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      color-scheme: dark;
      --j-bg: var(--bg, #0f0f0f);
      --j-surface: var(--color-background-primary, #1c1c1e);
      --j-surface-muted: #24262b;
      --j-surface-raised: #202226;
      --j-text: var(--color-text-primary, var(--text, #e8e8e8));
      --j-muted: var(--color-text-secondary, var(--text-secondary, #a2a6ae));
      --j-faint: var(--color-text-tertiary, var(--text-tertiary, #727780));
      --j-accent: var(--accent, #c8933b);
      --j-accent-soft: rgba(200, 147, 59, 0.14);
      --j-border: var(--color-border-tertiary, var(--border, #2a2a2e));
      --j-success: var(--color-text-success, #95d5b2);
      --j-success-bg: var(--color-background-success, #123326);
      --j-success-border: var(--color-border-success, #2f7d5c);
      --j-warning: #e2b45f;
      --j-warning-bg: rgba(226, 180, 95, 0.12);
      --j-danger: #ff8a80;
      --j-danger-bg: rgba(255, 138, 128, 0.12);
      --j-shadow: 0 1px 2px rgba(0, 0, 0, 0.26), 0 14px 36px rgba(0, 0, 0, 0.34);
    }
  }

  :where(*),
  :where(*::before),
  :where(*::after) {
    box-sizing: border-box;
  }

  :where(html) {
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
    scroll-behavior: smooth;
  }

  :where(body) {
    margin: 0;
    min-height: 100vh;
    background: var(--j-bg);
    color: var(--j-text);
    font-family: var(--j-font-body);
    font-size: 16px;
    line-height: 1.65;
    overflow-wrap: break-word;
  }

  :where(body[data-journal-preview='fragment']) {
    padding: clamp(18px, 3vw, 32px);
  }

  :where(body[data-journal-preview='fragment'] > *) {
    max-width: min(100%, 960px);
    margin-inline: auto;
  }

  :where(main, article, section) {
    min-width: 0;
  }

  :where(article, main.readable, .readable, .j-readable) {
    max-width: var(--j-measure);
  }

  :where(h1, h2, h3, h4, h5, h6) {
    color: var(--j-text);
    line-height: 1.22;
    text-wrap: balance;
    margin: 1.8em 0 0.55em;
  }

  :where(h1) {
    margin-top: 0;
    font-size: clamp(1.8rem, 4vw, 2.5rem);
    letter-spacing: -0.02em;
  }

  :where(h2) {
    font-size: clamp(1.35rem, 2.6vw, 1.75rem);
    letter-spacing: -0.01em;
  }

  :where(h3) {
    font-size: 1.18rem;
  }

  :where(h4, h5, h6) {
    font-size: 1rem;
  }

  :where(p, ul, ol, dl, table, figure, blockquote, pre) {
    margin-block: 0 1.1em;
  }

  :where(p, li) {
    text-wrap: pretty;
  }

  :where(ul, ol) {
    padding-inline-start: 1.5em;
  }

  :where(li + li) {
    margin-top: 0.25em;
  }

  :where(a) {
    color: var(--j-accent);
    text-decoration-thickness: 1px;
    text-underline-offset: 0.18em;
  }

  :where(strong, b) {
    font-weight: 650;
  }

  :where(small, figcaption, .muted, .j-muted) {
    color: var(--j-muted);
    font-size: 0.9em;
  }

  :where(code, kbd, samp) {
    font-family: var(--j-font-mono);
    font-size: 0.92em;
  }

  :where(code) {
    padding: 0.12em 0.32em;
    border-radius: 4px;
    background: var(--j-surface-muted);
  }

  :where(pre) {
    overflow: auto;
    padding: 1rem;
    border: 1px solid var(--j-border);
    border-radius: var(--j-radius);
    background: var(--j-surface);
    line-height: 1.5;
  }

  :where(pre code) {
    padding: 0;
    background: transparent;
  }

  :where(blockquote) {
    margin-inline: 0;
    padding: 0.75rem 1rem;
    border-left: 3px solid var(--j-accent);
    border-radius: 0 var(--j-radius-sm) var(--j-radius-sm) 0;
    background: var(--j-surface-muted);
    color: var(--j-muted);
  }

  :where(hr) {
    border: 0;
    border-top: 1px solid var(--j-border);
    margin: 2rem 0;
  }

  :where(img, picture, video, canvas, svg) {
    display: block;
    max-width: 100%;
    height: auto;
  }

  :where(table) {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 0.94rem;
    overflow: hidden;
  }

  :where(th, td) {
    padding: 0.62rem 0.75rem;
    border-bottom: 1px solid var(--j-border);
    text-align: left;
    vertical-align: top;
  }

  :where(th) {
    color: var(--j-muted);
    font-weight: 650;
    background: var(--j-surface-muted);
  }

  :where(label) {
    display: block;
    margin-bottom: 0.35rem;
    color: var(--j-muted);
    font-size: 0.9rem;
    font-weight: 600;
  }

  :where(input, textarea, select) {
    width: 100%;
    border: 1px solid var(--j-border);
    border-radius: var(--j-radius-sm);
    background: var(--j-surface);
    color: var(--j-text);
    font: inherit;
  }

  :where(input:not([type='checkbox']):not([type='radio']):not([type='range']):not([type='color']),
  textarea, select) {
    padding: 0.55rem 0.7rem;
  }

  :where(button, .button, .j-button, input[type='submit'], input[type='button']) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 34px;
    gap: 0.4rem;
    border: 1px solid transparent;
    border-radius: var(--j-radius-sm);
    padding: 0.45rem 0.85rem;
    background: var(--j-accent);
    color: #fff;
    font: inherit;
    font-size: 0.93rem;
    font-weight: 600;
    line-height: 1.2;
    cursor: pointer;
  }

  :where(button.secondary, .button.secondary, .j-button.secondary) {
    border-color: var(--j-border);
    background: var(--j-surface);
    color: var(--j-text);
  }

  :where(button:disabled, .button:disabled, .j-button:disabled) {
    cursor: not-allowed;
    opacity: 0.55;
  }

  :where(:focus-visible) {
    outline: 2px solid color-mix(in srgb, var(--j-accent) 70%, transparent);
    outline-offset: 2px;
  }

  :where(.stack, .j-stack, .section, .j-section) {
    display: flex;
    flex-direction: column;
    gap: var(--j-stack-gap, 0.85rem);
  }

  :where(.section, .j-section) {
    margin-block: 0 2rem;
  }

  :where(.compact, .j-compact) {
    --j-stack-gap: 0.45rem;
  }

  :where(.cluster, .j-cluster, .toolbar, .j-toolbar) {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.65rem;
  }

  :where(.toolbar, .j-toolbar) {
    justify-content: space-between;
    padding: 0.65rem;
    border: 1px solid var(--j-border);
    border-radius: var(--j-radius);
    background: var(--j-surface);
  }

  :where(.grid, .j-grid, .cards, .j-cards) {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
    gap: var(--j-grid-gap, 0.85rem);
  }

  :where(.two-col, .j-two-col, .split, .j-split) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }

  @media (max-width: 720px) {
    :where(.two-col, .j-two-col, .split, .j-split) {
      grid-template-columns: 1fr;
    }
  }

  :where(.surface, .j-surface, .card, .j-card, .option, .j-option) {
    border: 1px solid var(--j-border);
    border-radius: var(--j-radius);
    background: var(--j-surface);
  }

  :where(.card, .j-card, .option, .j-option) {
    padding: 1rem;
  }

  :where(.card.raised, .j-card.raised) {
    box-shadow: var(--j-shadow);
  }

  :where(.card > :first-child, .j-card > :first-child, .option > :first-child, .j-option > :first-child) {
    margin-top: 0;
  }

  :where(.card > :last-child, .j-card > :last-child, .option > :last-child, .j-option > :last-child) {
    margin-bottom: 0;
  }

  :where(.badge, .j-badge, .tag, .j-tag) {
    display: inline-flex;
    align-items: center;
    gap: 0.35em;
    border: 1px solid var(--j-border);
    border-radius: 999px;
    padding: 0.12rem 0.55rem;
    background: var(--j-surface);
    color: var(--j-muted);
    font-size: 0.78rem;
    font-weight: 600;
    line-height: 1.6;
    white-space: nowrap;
  }

  :where(.badge.success, .j-badge.success, .tag.success, .j-tag.success) {
    border-color: var(--j-success-border);
    background: var(--j-success-bg);
    color: var(--j-success);
  }

  :where(.badge.warning, .j-badge.warning) {
    background: var(--j-warning-bg);
    color: var(--j-warning);
  }

  :where(.badge.danger, .j-badge.danger) {
    background: var(--j-danger-bg);
    color: var(--j-danger);
  }

  :where(.callout, .j-callout, .decisions, .j-decisions) {
    margin-block: 1rem;
    padding: 0.9rem 1rem;
    border: 1px solid var(--j-border);
    border-left: 3px solid var(--j-accent);
    border-radius: var(--j-radius);
    background: var(--j-surface);
  }

  :where(.callout.info, .j-callout.info) {
    border-left-color: var(--j-accent);
    background: color-mix(in srgb, var(--j-accent-soft) 45%, var(--j-surface));
  }

  :where(.callout.success, .j-callout.success) {
    border-left-color: var(--j-success);
    background: var(--j-success-bg);
  }

  :where(.kpi, .j-kpi, .kpi-bar, .j-kpi-bar) {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: stretch;
    padding: 0.9rem 1rem;
    border: 1px solid var(--j-border);
    border-radius: var(--j-radius);
    background: var(--j-surface);
  }

  :where(.kpi-item, .j-kpi-item) {
    min-width: 96px;
  }

  :where(.kpi-value, .j-kpi-value) {
    color: var(--j-text);
    font-family: var(--j-font-mono);
    font-size: 1.45rem;
    font-weight: 700;
    line-height: 1.15;
  }

  :where(.kpi-label, .j-kpi-label) {
    margin-top: 0.15rem;
    color: var(--j-muted);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  :where(.timeline, .j-timeline) {
    position: relative;
    padding-left: 1.35rem;
  }

  :where(.timeline, .j-timeline)::before {
    content: '';
    position: absolute;
    left: 0.35rem;
    top: 0.2rem;
    bottom: 0.2rem;
    width: 1px;
    background: var(--j-border);
  }

  :where(.timeline-item, .j-timeline-item) {
    position: relative;
    margin-bottom: 1rem;
  }

  :where(.timeline-item, .j-timeline-item)::before {
    content: '';
    position: absolute;
    left: -1.08rem;
    top: 0.45rem;
    width: 0.48rem;
    height: 0.48rem;
    border-radius: 999px;
    background: var(--j-accent);
  }

  :where(.flow, .j-flow) {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.45rem;
  }

  :where(.flow-node, .j-flow-node) {
    border: 1px solid var(--j-border);
    border-radius: var(--j-radius-sm);
    padding: 0.42rem 0.7rem;
    background: var(--j-surface);
    font-weight: 600;
  }

  :where(.flow-arrow, .j-flow-arrow) {
    color: var(--j-faint);
  }

  :where(.center, .j-center) {
    text-align: center;
  }

  :where(.full-bleed, .j-full-bleed) {
    max-width: none;
    width: 100%;
  }

  :where(.sr-only) {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
}
`
