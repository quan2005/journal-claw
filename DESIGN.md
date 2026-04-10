# Design System — 谨迹 (JournalClaw)

## 1. Visual Theme & Atmosphere

谨迹 is a macOS journal app for knowledge workers who attend meetings all day and need to review, not create. The entire experience is built on a principle of **deliberate restraint** — every pixel earns its place or gets removed. Where most productivity apps compete for attention with color, animation, and chrome, 谨迹 recedes into the background so the content can breathe.

The signature move is the **ink-cyan neutral system** — all grays carry a subtle cold-cyan tint, neither warm nor cold, sitting in a precise middle register that feels like high-quality paper under cool studio lighting. The light theme (`#f5f6f7`) is barely off-white, almost imperceptible as a color choice, which is exactly the point. The dark theme (`#0f0f0f`) is a near-black with the same ink tint — warmer than pure black, cooler than charcoal.

The single chromatic accent is **amber-gold** (`#B8782A` light / `#C8933B` dark) — the color of aged brass, archival ink, and quality leather. It appears only where it must: the recording button, selected states, active UI elements. A second accent, **recording red** (`#ff3b30` / `#ff375f`), is reserved exclusively for the live recording state — the one moment in the app that demands urgency. Everything else is neutral.

Typography is SF Pro (via `system-ui`) — the system font that disappears into the OS. No custom typefaces, no web fonts, no loading. IBM Plex Mono handles code blocks with semantic precision. The type scale is compact and information-dense, calibrated for a sidebar-plus-detail layout where every pixel of vertical space matters.

**Key Characteristics:**
- Ink-cyan neutral surfaces — every gray has a subtle cold-cyan tint, never dead gray
- Single amber-gold accent (`#B8782A` / `#C8933B`) for all interactive states
- Recording red (`#ff3b30` / `#ff375f`) reserved exclusively for live recording
- System font stack — SF Pro on macOS, zero loading cost, perfect OS integration
- Dark mode as the primary quality benchmark; light mode equally polished
- 4px spacing base unit with tight-loose rhythm (8–12px intra-group, 32–48px inter-section)
- Animation discipline: transform + opacity only, ≤300ms, ease-out-quart, prefers-reduced-motion respected

---

## 2. Color Palette & Roles

### Accent

| Token | Light | Dark | Role |
|---|---|---|---|
| `--accent` | `#ff3b30` | `#ff375f` | Recording state only — live mic indicator |
| `--record-btn` | `#B8782A` | `#C8933B` | Primary interactive accent — buttons, selected states, active UI |
| `--record-btn-hover` | `#A06820` | `#d9a44b` | Hover variant of primary accent |
| `--record-btn-icon` | `#f5f6f7` | `#0f0f0f` | Icon color on filled accent button |

The amber-gold (`--record-btn`) is the true brand color of 谨迹. It appears on: the recording button, selected list items, active segment controls, AI status pills, dock paste states, keyboard shortcut badges, markdown headings (dark mode), checkboxes, and links. The recording red (`--accent`) appears only when the microphone is actively capturing — a semantic distinction that gives the red its urgency.

### Surfaces & Backgrounds

| Token | Light | Dark | Role |
|---|---|---|---|
| `--bg` | `#f5f6f7` | `#0f0f0f` | Primary app background |
| `--titlebar-bg` | `#edf0f1` | `#161616` | Titlebar / drag region |
| `--sidebar-bg` | `#f0f2f3` | `#141414` | Left sidebar background |
| `--dock-bg` | `#f0f2f3` | `#141414` | Bottom command dock |
| `--detail-bg` | `= --bg` | `= --bg` | Right detail panel |
| `--md-pre-bg` | `#f7f8f9` | `#141414` | Code block background |
| `--queue-bg` | `#f7f8f9` | `#1c1c1e` | Processing queue container |
| `--context-menu-bg` | `#f5f6f7` | `#1e1e1e` | Context menu surface |

### Text

| Token | Light | Dark | Role |
|---|---|---|---|
| `--item-text` | `#1c1c1e` | `#e8e8e8` | Primary text — list items, headings |
| `--item-meta` | `#6a7278` | `#a2a6ae` | Secondary text — dates, tags, meta |
| `--duration-text` | `#a0a8ad` | `#48484a` | Tertiary text — durations, de-emphasized |
| `--month-label` | `#6a7278` | `#353840` | Month group labels in sidebar |
| `--muted-text` | `#8A8078` | `#736D65` | Muted / disabled text |

### Borders & Dividers

| Token | Light | Dark | Role |
|---|---|---|---|
| `--divider` | `#d8dce0` | `#1e2228` | Section dividers, panel borders |
| `--dock-border` | `#d8dce0` | `#252525` | Dock top border |
| `--detail-case-border` | `#d8dce0` | `#1e2228` | Detail panel card borders |
| `--context-menu-border` | `#d8dce0` | `#2e3238` | Context menu border |

### Interactive States

| Token | Light | Dark | Role |
|---|---|---|---|
| `--item-hover-bg` | `#F7F0E4` | `rgba(255,255,255,0.03)` | List item hover |
| `--item-selected-bg` | `#F0E4CC` | `#1a1c20` | Selected list item background |
| `--item-selected-text` | `#7A5800` | `#C8933B` | Selected item primary text |
| `--item-selected-meta` | `#A07828` | `#a07830` | Selected item meta text |
| `--record-highlight` | `#FBF3E5` | `rgba(200,147,59,0.06)` | Recording-sourced item highlight |
| `--record-highlight-bar` | `#B8782A` | `#C8933B` | Left bar on recording-sourced items |
| `--item-icon-bg` | `#F5EDD8` | `#2c2c2e` | Icon container background |

### Semantic Colors

| Token | Light | Dark | Role |
|---|---|---|---|
| `--status-danger` | `#B5312A` | `#e06c60` | Error / destructive |
| `--status-danger-bg` | `#FDE8E5` | `rgba(224,108,96,0.12)` | Error background |
| `--status-warning` | `#8A6500` | `#C8933B` | Warning (shares amber accent in dark) |
| `--status-warning-bg` | `#FBF3E5` | `rgba(200,147,59,0.12)` | Warning background |
| `--status-success` | `#266B45` | `#5ba67a` | Success / confirmed |
| `--status-success-bg` | `#E5F2EA` | `rgba(91,166,122,0.12)` | Success background |

### File Type Colors

Used for file type badges and icons only — never for decoration:

| Type | Light | Dark |
|---|---|---|
| PDF | `#B5312A` | `#e06c60` |
| DOCX | `#3A5FA8` | `#5a8ae0` |
| Markdown | `#635850` | `#A89880` |
| Audio | `#5F4290` | `#9a7ec7` |
| Image | `#266B45` | `#5ba67a` |

---

## 3. Typography Rules

### Font Stack

| Role | Stack | Notes |
|---|---|---|
| **Body / UI** | `system-ui, -apple-system, BlinkMacSystemFont, sans-serif` | SF Pro Text on macOS — zero loading cost |
| **Display** | Same stack | SF Pro Display kicks in automatically at large sizes |
| **Mono** | `'IBM Plex Mono', ui-monospace, monospace` | Code blocks and inline code only |
| **Serif** | `'Noto Serif SC', serif` | Available but rarely used — reserved for editorial moments |

### Type Scale

| Token | Size | Weight | Line Height | Use |
|---|---|---|---|---|
| `--text-xs` | 12px | 400–500 | 1.4 | Timestamps, auxiliary info |
| `--text-sm` | 13px | 400–500 | 1.4 | Meta text, secondary labels |
| `--text-base` | 14px | 400–500 | 1.5 | List item body, sidebar text |
| `--text-md` | 16px | 400–500 | 1.75 | Detail panel body, Markdown prose |
| `--text-lg` | 20px | 500–600 | 1.3 | Small headings, section titles |
| `--text-xl` | 24px | 600 | 1.2 | Page-level titles |
| `--text-2xl` | 30px | 600 | 1.1 | Large titles (rare) |

### Weight Roles

- **400** — body text, meta, secondary labels
- **500** — emphasis, active states, interactive labels
- **600** — headings, titles, strong emphasis

Weights 300 and 700+ are intentionally excluded. The design achieves hierarchy through size differences and the 400→500→600 ladder, not through bold extremes.

### Markdown Typography (Detail Panel)

| Element | Light | Dark | Notes |
|---|---|---|---|
| H1 | `#1c1c1e` | `#C8933B` | Dark: amber accent for maximum hierarchy |
| H2 | `#2a3038` | `#C8933B` | Dark: same amber — headings are the accent |
| H3 | `#2a3038` | `#b0b4bc` | Slightly de-emphasized |
| Body | `#2a3038` | `#a8acb4` | Slightly softer than UI text |
| Strong | `#1c1c1e` | `#C8933B` | Matches H1 weight |
| Bullet marker | `#586068` | `#808488` | Recedes behind content |
| Blockquote bar | `#c0c8ce` | `#48484a` | Structural, not decorative |
| Code (inline) | `#8A6500` | `#88b4e0` | Amber light / blue dark — semantic contrast |
| Link | `#8A6500` | `#6cb6ff` | Amber light / blue dark |

---

## 4. Component Stylings

### Recording Button (Primary CTA)

The most important interactive element in the app. Filled amber-gold, circular, centered in the Command Dock.

- Background: `--record-btn` (`#B8782A` / `#C8933B`)
- Icon: `--record-btn-icon` (inverted surface color)
- Hover: `--record-btn-hover`, `transform: scale(1.04)`
- Active recording: pulses with `--accent` red (`#ff3b30` / `#ff375f`)
- Focus: `outline: 2px solid color-mix(in srgb, var(--record-btn) 68%, white)`
- Transition: `background-color 0.18s ease, transform 0.18s ease, opacity 0.18s ease`

### List Items (Journal Entry Cards)

Flat rows, no card chrome. Hierarchy through spacing and text weight, not borders or shadows.

- Default: transparent background
- Hover: `--item-hover-bg` (`#F7F0E4` / `rgba(255,255,255,0.03)`)
- Selected: `--item-selected-bg` with left bar in `--card-selected-bar`
- Recording-sourced: `--record-highlight` background + `--record-highlight-bar` left bar
- Icon container: `--item-icon-bg` with 6px radius

### AI Status Pill

Inline status indicator for AI processing state. Amber-tinted, compact.

- Background: `--ai-pill-bg` (`#FBF3E5` / `#1a1708`)
- Border: `--ai-pill-border` (`#D4A855` / `#3a3018`)
- Text: `--ai-pill-text` (`#8A6500` / `#C8933B`)
- Active state: darker background (`--ai-pill-active-bg`), stronger border

### Command Dock

Bottom bar housing the recording button, drop zone, and paste area.

- Background: `--dock-bg` (matches sidebar, slightly darker than main bg)
- Top border: `1px solid --dock-border`
- Drop zone border: `--dock-dropzone-border`, dashed
- Drop zone hover: `--dock-dropzone-hover-border` (amber), `--dock-dropzone-hover-bg`
- Paste active: `--dock-paste-border` (amber), `--dock-paste-bg`
- Keyboard badge: `--dock-kbd-bg` / `--dock-kbd-text` / `--dock-kbd-border` (amber family)
- Pulsing kbd hint: `kbd-glow-pulse` animation, 2.4s ease-in-out, opacity 0.4→1

### Source Badges

Compact inline badges indicating content origin. Each type has its own semantic color family:

| Type | Light bg / text / border | Dark bg / text / border |
|---|---|---|
| Voice | `#FBF3E5` / `#8A6500` / `#D4B878` | `#2a1f0f` / `#c8933a` / `#4a3010` |
| Document | `#e8f0fa` / `#3a6a9a` / `#c0d4ea` | `#0f1a2a` / `#4a8ac8` / `#1a3050` |
| AI | `#ededfa` / `#5a5a9a` / `#c8c8e8` | `#1a1a2a` / `#7a7ac8` / `#2a2a50` |

### Segment Control

Tab-like switcher for view modes.

- Default: `--segment-bg` (near-transparent), `--segment-text`
- Active: `--segment-active-bg` (amber at 10–12% opacity), `--segment-active-text` (amber)
- No borders, no shadows — purely opacity-based differentiation

### Context Menu

- Background: `--context-menu-bg`
- Border: `1px solid --context-menu-border`
- Shadow: `--context-menu-shadow` (light: `rgba(0,0,0,0.15)`, dark: `rgba(0,0,0,0.5)`)
- Radius: 8px

### Scrollbars

Minimal, 4px wide, always transparent track.

- Thumb: `--scrollbar-thumb` (light: `#d2d5d8`, dark: `rgba(255,255,255,0.10)`)
- Thumb hover: `--scrollbar-thumb-hover`
- Track: transparent

---

## 5. Layout Principles

### Spacing System

4px base unit. Rhythm alternates between tight (intra-group) and loose (inter-section):

| Token | Value | Use |
|---|---|---|
| `--space-1` | 4px | Icon-to-text gap, inline spacing |
| `--space-2` | 8px | Component internal padding |
| `--space-3` | 12px | List item vertical padding |
| `--space-4` | 16px | Section internal padding |
| `--space-6` | 24px | Between related blocks |
| `--space-8` | 32px | Between sections |
| `--space-12` | 48px | Major area separation |

### App Layout

Two-panel split: resizable left list + right detail panel + bottom Command Dock. The divider is draggable. No top navigation bar — the titlebar is a drag region.

- Left panel: journal entry list, grouped by month
- Right panel: selected entry detail with Markdown rendering
- Bottom dock: recording button, file drop zone, paste area
- Titlebar: `--titlebar-bg`, `[data-tauri-drag-region]`

### Information Density

The list panel is deliberately dense — 14px body text, 12–13px meta, tight row padding. The detail panel opens up — 16px body, 1.75 line-height, generous paragraph spacing. The contrast between dense list and spacious detail is intentional: scanning is fast, reading is comfortable.

### Border Radius Scale

| Value | Use |
|---|---|
| 2px | Scrollbar thumb |
| 4px | Inline code, small badges |
| 6px | Small interactive elements |
| 8px | Standard containers, context menus, code blocks |
| 12px | Larger cards, sheet handles |

No large radii (16px+). The app is a tool, not a marketing page — rounded corners are functional, not decorative.

---

## 6. Depth & Elevation

| Level | Treatment | Use |
|---|---|---|
| Flat (0) | No shadow, no border | Main background, list rows |
| Contained (1) | `1px solid --divider` | Panel borders, section separators |
| Raised (2) | `--queue-shadow: rgba(0,0,0,0.06)` | Processing queue, floating elements |
| Overlay (3) | `--context-menu-shadow: rgba(0,0,0,0.15–0.5)` | Context menus, sheets |

**Shadow philosophy**: 谨迹 uses almost no drop shadows. Depth comes from background color steps — `--bg` → `--sidebar-bg` → `--dock-bg` → `--titlebar-bg` — each a subtle step darker/lighter. The eye reads these as elevation without any shadow rendering. When shadows do appear (queue, context menu), they are minimal and functional.

**Left bar accent**: The primary depth signal for selected/highlighted list items is a 2–3px left border in `--card-selected-bar` / `--record-highlight-bar`. This is the app's signature interaction pattern — a vertical amber stroke that says "this is active" without any background drama.

---

## 7. Do's and Don'ts

### Do
- Use `--bg` (`#f5f6f7` / `#0f0f0f`) as the primary surface — the ink-cyan tint IS the 谨迹 personality
- Use amber-gold (`--record-btn`) for all interactive accent moments — buttons, selections, active states
- Reserve recording red (`--accent`) exclusively for the live recording state
- Keep all neutrals ink-cyan tinted — every gray should have a subtle cold-cyan undertone
- Use the left-bar pattern (`--record-highlight-bar`) for selected/highlighted list items
- Maintain tight list density (14px, compact padding) contrasted with spacious detail (16px, 1.75 line-height)
- Animate only `transform` and `opacity` — never `width`, `height`, `padding`, or `margin`
- Use `cubic-bezier(0.16, 1, 0.3, 1)` for all transitions
- Always implement `prefers-reduced-motion` fallbacks
- Use semantic file-type colors (PDF red, DOCX blue, audio purple) only for file badges

### Don't
- Don't introduce a second chromatic accent — amber and recording-red are the complete palette
- Don't use pure `#000000` or `#ffffff` — use `#0f0f0f` / `#e8e8e8` (ink-tinted near-black/white)
- Don't use warm-toned grays — the neutral system is ink-cyan, not warm beige
- Don't add card shadows or card-in-card nesting — depth comes from background steps and left bars
- Don't use bounce or elastic easing — ease-out-quart only
- Don't animate layout properties (width, height, margin) — transform + opacity only
- Don't use decorative blur, gradients, or glow effects
- Don't use font weights below 400 or above 600
- Don't use IBM Plex Mono outside of code blocks — it's semantic, not stylistic
- Don't add color to markdown headings in light mode — amber headings are a dark-mode-only pattern

---

## 8. Agent Prompt Guide

### Quick Token Reference

```
Primary bg (light):      #f5f6f7   --bg
Primary bg (dark):       #0f0f0f   --bg
Sidebar bg (light):      #f0f2f3   --sidebar-bg
Sidebar bg (dark):       #141414   --sidebar-bg
Amber accent (light):    #B8782A   --record-btn
Amber accent (dark):     #C8933B   --record-btn
Recording red (light):   #ff3b30   --accent
Recording red (dark):    #ff375f   --accent
Primary text (light):    #1c1c1e   --item-text
Primary text (dark):     #e8e8e8   --item-text
Secondary text (light):  #6a7278   --item-meta
Secondary text (dark):   #a2a6ae   --item-meta
Divider (light):         #d8dce0   --divider
Divider (dark):          #1e2228   --divider
Selected bg (light):     #F0E4CC   --item-selected-bg
Selected bg (dark):      #1a1c20   --item-selected-bg
```

### Example Component Prompts

- "Create a journal list item on `#f5f6f7` background. Primary text `#1c1c1e` at 14px system-ui weight 400. Meta text `#6a7278` at 13px. On hover, background shifts to `#F7F0E4`. On selection, background `#F0E4CC` with a 2px left border in `#B8782A`. No shadows, no card chrome."

- "Design an AI status pill with background `#FBF3E5`, border `1px solid #D4A855`, text `#8A6500` at 12px system-ui weight 500. Compact padding 2px 8px, radius 4px. Active state: background `#F0E4CC`, border `#B8782A`."

- "Build a dark-mode detail panel on `#0f0f0f`. Markdown H1 and H2 in `#C8933B` (amber). Body text `#a8acb4` at 16px, line-height 1.75. Code blocks on `#141414` background with IBM Plex Mono. Blockquote left bar `#48484a`."

- "Create a recording button: circular, background `#B8782A`, icon color `#f5f6f7`. Hover: background `#A06820`, scale 1.04. Active recording: background `#ff3b30`. Transition: 180ms ease."

- "Design a source badge for voice content: background `#FBF3E5`, text `#8A6500`, border `1px solid #D4B878`, radius 4px, 12px system-ui weight 500. Dark mode: background `#2a1f0f`, text `#c8933a`, border `#4a3010`."

### Iteration Guide

1. Always specify both light and dark values — the app ships both
2. Reference token names alongside hex values — `--record-btn (#B8782A)` not just "amber"
3. Distinguish amber accent from recording red — they are semantically different
4. For neutrals, say "ink-cyan tinted gray" — never "warm gray" or "cool gray"
5. For depth, use "left bar accent" or "background step" — never "drop shadow" or "card elevation"
6. For animation, specify "transform + opacity only, ease-out-quart, Xms"
7. Keep list density tight (14px, compact) and detail panel spacious (16px, 1.75lh) — the contrast is intentional
