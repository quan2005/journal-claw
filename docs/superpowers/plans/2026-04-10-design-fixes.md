# Design Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 9 design/code issues: failing property test, dark-mode color bugs, icon inconsistencies, font misuse, tab order, and fake-bold hack.

**Architecture:** Pure CSS token edits + React component edits. No new files. All changes are isolated and independently testable.

**Tech Stack:** React + TypeScript (Tauri v2), CSS custom properties, Vitest + fast-check property tests.

---

## File Map

| File | Changes |
|---|---|
| `src/__tests__/light-theme-properties.test.ts` | Remove amber-tinted vars from `TINTED_NEUTRAL_VARIABLES` |
| `src/styles/globals.css` | Fix `--md-checkbox-checked` (dark), `--sidebar-month`/`--month-label` (dark) |
| `src/components/CommandDock.tsx` | Sliders icon, fix hardcoded rgba bg |
| `src/components/TodoSidebar.tsx` | Replace `--font-mono` with `--font-body` on 4 lines |
| `src/components/SidebarTabs.tsx` | Swap Journal/Identity button order |
| `src/components/JournalItem.tsx` | Remove `textShadow` fake-bold |
| `src/components/ProcessingQueue.tsx` | Replace `kindEmoji` dict + render with SVG icons |

---

## Task 1: Fix failing property test — remove amber vars from TINTED_NEUTRAL_VARIABLES

The test `light-theme-properties.test.ts` checks that all "tinted neutral" CSS vars have OKLCH hue 195°–250°. But `--item-icon-bg`, `--item-hover-bg`, `--item-selected-bg`, `--record-highlight`, and `--dock-dropzone-hover-bg` are intentionally amber-tinted (part of the amber accent family). They must be removed from the neutral hue check.

**Files:**
- Modify: `src/__tests__/light-theme-properties.test.ts:273-287`

- [ ] **Step 1: Run the failing test to confirm the error**

```bash
npx vitest run src/__tests__/light-theme-properties.test.ts 2>&1 | tail -30
```
Expected: FAIL — `--item-icon-bg (#F5EDD8): hue=89.60° should be in 195°~250°`

- [ ] **Step 2: Edit TINTED_NEUTRAL_VARIABLES to remove amber-tinted interactive vars**

In `src/__tests__/light-theme-properties.test.ts`, replace lines 273–287:

```typescript
/** Tinted neutral variables — from design doc categories
 *
 * NOTE: Amber-tinted interactive states (--item-icon-bg, --item-hover-bg,
 * --item-selected-bg, --record-highlight, --dock-dropzone-hover-bg) are
 * intentionally warm amber in light mode (accent family). They are excluded
 * from this neutral hue check.
 */
const TINTED_NEUTRAL_VARIABLES = [
  // Background / Surface
  '--bg', '--sidebar-bg', '--dock-bg', '--titlebar-bg',
  '--detail-case-bg', '--md-pre-bg', '--queue-bg', '--context-menu-bg',
  // Borders
  '--divider', '--dock-border', '--detail-case-border', '--dock-kbd-border',
  '--sheet-handle', '--queue-border', '--context-menu-border',
  // Auxiliary text
  '--item-meta', '--month-label', '--sidebar-month', '--duration-text',
  '--detail-section-label', '--dock-dropzone-text', '--dock-dropzone-hint',
  '--detail-summary', '--detail-case-key', '--md-quote-text', '--md-bullet',
  // Interactive states (ink-cyan only — amber states excluded)
  '--md-code-bg', '--scrollbar-thumb', '--scrollbar-thumb-hover',
] as const
```

- [ ] **Step 3: Run the test to verify it passes**

```bash
cd /Users/yanwu/Projects/github/journal && npx vitest run src/__tests__/light-theme-properties.test.ts 2>&1 | tail -10
```
Expected: all tests PASS

- [ ] **Step 4: Run full test suite to confirm no regressions**

```bash
cd /Users/yanwu/Projects/github/journal && npx vitest run 2>&1 | tail -15
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/yanwu/Projects/github/journal && git add src/__tests__/light-theme-properties.test.ts && git commit -m "$(cat <<'EOF'
test: exclude amber-tinted interactive vars from neutral hue property test

Amber interactive states (item-icon-bg, item-hover-bg, item-selected-bg,
record-highlight, dock-dropzone-hover-bg) are intentionally warm in light
mode — part of the amber accent family, not ink-cyan neutrals.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Fix dark mode `--md-checkbox-checked` color

Currently `#0a84ff` (iOS blue) in dark mode. Should be `#C8933B` (amber) to match the single-accent system.

**Files:**
- Modify: `src/styles/globals.css:265` (media query dark block)
- Modify: `src/styles/globals.css:396` (`[data-theme="dark"]` block)

- [ ] **Step 1: Verify current values**

```bash
grep -n "md-checkbox-checked" /Users/yanwu/Projects/github/journal/src/styles/globals.css
```
Expected: lines 119 (`#B8782A` light ✓), 265 (`#0a84ff` dark ✗), 396 (`#0a84ff` dark ✗), 700 (`#B8782A` light ✓)

- [ ] **Step 2: Fix both dark occurrences**

In `src/styles/globals.css`, change line 265:
```css
    --md-checkbox-checked: #C8933B;
```

Change line 396:
```css
    --md-checkbox-checked: #C8933B;
```

- [ ] **Step 3: Verify**

```bash
grep -n "md-checkbox-checked" /Users/yanwu/Projects/github/journal/src/styles/globals.css
```
Expected: all 4 occurrences now use amber (`#B8782A` light, `#C8933B` dark)

- [ ] **Step 4: Run tests**

```bash
cd /Users/yanwu/Projects/github/journal && npx vitest run 2>&1 | tail -10
```
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/yanwu/Projects/github/journal && git add src/styles/globals.css && git commit -m "$(cat <<'EOF'
fix(theme): replace iOS blue checkbox with amber in dark mode

--md-checkbox-checked was #0a84ff (iOS system blue), breaking the
single-accent rule. Now #C8933B to match the amber accent family.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Fix dark mode `--sidebar-month` / `--month-label` contrast

`#353840` on `#141414` background is ~1.8:1 contrast — nearly invisible. Fix to `#5a5e68` (~4.5:1).

**Files:**
- Modify: `src/styles/globals.css:192` (media query dark — `--month-label`)
- Modify: `src/styles/globals.css:224` (media query dark — `--sidebar-month`)
- Modify: `src/styles/globals.css:335` (`[data-theme="dark"]` — `--month-label`)
- Modify: `src/styles/globals.css:361` (`[data-theme="dark"]` — `--sidebar-month`)

- [ ] **Step 1: Verify current values**

```bash
grep -n "sidebar-month\|month-label" /Users/yanwu/Projects/github/journal/src/styles/globals.css
```
Expected: dark occurrences show `#353840`

- [ ] **Step 2: Fix all 4 dark occurrences**

In `src/styles/globals.css`, change all 4 dark-mode instances:
- Line 192: `--month-label: #5a5e68;`
- Line 224: `--sidebar-month: #5a5e68;`
- Line 335: `--month-label: #5a5e68;`
- Line 361: `--sidebar-month: #5a5e68;`

- [ ] **Step 3: Verify**

```bash
grep -n "sidebar-month\|month-label" /Users/yanwu/Projects/github/journal/src/styles/globals.css
```
Expected: dark occurrences now `#5a5e68`, light occurrences still `#6a7278`

- [ ] **Step 4: Run tests**

```bash
cd /Users/yanwu/Projects/github/journal && npx vitest run 2>&1 | tail -10
```
Expected: all PASS (the snapshot test in `light-theme-unit.test.ts` tracks dark vars — update snapshot if needed with `npx vitest run --update`)

- [ ] **Step 5: Commit**

```bash
cd /Users/yanwu/Projects/github/journal && git add src/styles/globals.css && git commit -m "$(cat <<'EOF'
fix(theme): raise sidebar month label contrast in dark mode

#353840 on #141414 was ~1.8:1 contrast (nearly invisible).
Changed to #5a5e68 (~4.5:1) for both --sidebar-month and --month-label.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Fix CommandDock settings icon — hamburger → sliders

The settings button shows three horizontal lines (hamburger/menu icon). It should show a sliders/gear icon to indicate settings.

**Files:**
- Modify: `src/components/CommandDock.tsx:238-242`

- [ ] **Step 1: Locate the current icon**

```bash
grep -n "x1=\"3\" y1=\"6\"\|x1=\"3\" y1=\"12\"\|x1=\"3\" y1=\"18\"" /Users/yanwu/Projects/github/journal/src/components/CommandDock.tsx
```
Expected: 3 lines around 239–241

- [ ] **Step 2: Replace hamburger SVG with sliders SVG**

In `src/components/CommandDock.tsx`, replace the `<svg>` block at lines 238–242:

```tsx
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="6" x2="20" y2="6"/>
          <line x1="4" y1="12" x2="20" y2="12"/>
          <line x1="4" y1="18" x2="20" y2="18"/>
          <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none"/>
          <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none"/>
          <circle cx="9" cy="18" r="2" fill="currentColor" stroke="none"/>
        </svg>
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/yanwu/Projects/github/journal && npx vitest run 2>&1 | tail -10
```
Expected: all PASS

- [ ] **Step 4: Commit**

```bash
cd /Users/yanwu/Projects/github/journal && git add src/components/CommandDock.tsx && git commit -m "$(cat <<'EOF'
fix(ui): replace hamburger icon with sliders icon on settings button

Hamburger (≡) implies a menu. Sliders (⊟ with dots) correctly signals
settings/preferences.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Fix CommandDock hardcoded rgba background

`rgba(255,255,255,0.06)` is invisible in light mode. Replace with `var(--item-icon-bg)` which is theme-aware.

**Files:**
- Modify: `src/components/CommandDock.tsx:276`

- [ ] **Step 1: Locate the hardcoded value**

```bash
grep -n "rgba(255,255,255,0.06)" /Users/yanwu/Projects/github/journal/src/components/CommandDock.tsx
```
Expected: line 276

- [ ] **Step 2: Replace with CSS variable**

In `src/components/CommandDock.tsx` line 276, change:
```tsx
              background: 'rgba(255,255,255,0.06)',
```
to:
```tsx
              background: 'var(--item-icon-bg)',
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/yanwu/Projects/github/journal && npx vitest run 2>&1 | tail -10
```
Expected: all PASS

- [ ] **Step 4: Commit**

```bash
cd /Users/yanwu/Projects/github/journal && git add src/components/CommandDock.tsx && git commit -m "$(cat <<'EOF'
fix(ui): replace hardcoded rgba with --item-icon-bg in dock drop zone

rgba(255,255,255,0.06) was invisible in light mode. --item-icon-bg is
theme-aware (amber tint in light, dark surface in dark).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Fix TodoSidebar — replace `--font-mono` with `--font-body` on todo text

Todo item text is natural language, not code. IBM Plex Mono is wrong here. Fix 4 occurrences.

**Files:**
- Modify: `src/components/TodoSidebar.tsx:228,234,499,527`

- [ ] **Step 1: Verify all 4 occurrences**

```bash
grep -n "font-mono" /Users/yanwu/Projects/github/journal/src/components/TodoSidebar.tsx
```
Expected: lines 228, 234, 499, 527

- [ ] **Step 2: Replace all 4 occurrences**

```bash
cd /Users/yanwu/Projects/github/journal && sed -i '' "s/fontFamily: 'var(--font-mono)'/fontFamily: 'var(--font-body)'/g" src/components/TodoSidebar.tsx
```

- [ ] **Step 3: Verify**

```bash
grep -n "font-mono\|font-body" /Users/yanwu/Projects/github/journal/src/components/TodoSidebar.tsx
```
Expected: no `font-mono` occurrences remain in todo text lines; `font-body` appears 4 times

- [ ] **Step 4: Run tests**

```bash
cd /Users/yanwu/Projects/github/journal && npx vitest run 2>&1 | tail -10
```
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/yanwu/Projects/github/journal && git add src/components/TodoSidebar.tsx && git commit -m "$(cat <<'EOF'
fix(ui): use body font for todo item text instead of monospace

Todo text is natural language, not code. IBM Plex Mono was wrong here.
Replaced all 4 occurrences with --font-body.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Swap SidebarTabs order — Journal first, Identity second

Journal is the primary tab and should appear on the left. Currently Identity is first.

**Files:**
- Modify: `src/components/SidebarTabs.tsx:43-57`

- [ ] **Step 1: Read current order**

```bash
grep -n "btnStyle\|identity\|journal" /Users/yanwu/Projects/github/journal/src/components/SidebarTabs.tsx | head -15
```
Expected: identity button at line 43, journal button at line 50

- [ ] **Step 2: Swap the two buttons**

In `src/components/SidebarTabs.tsx`, replace lines 43–57 (the two buttons and divider):

```tsx
      <button style={btnStyle('journal')} onClick={() => onChange('journal')}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        {t('journal')}
      </button>
      <div style={{ width: 1, alignSelf: 'stretch', margin: '10px 0', background: 'var(--divider)' }} />
      <button style={btnStyle('identity')} onClick={() => onChange('identity')}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
        {t('profiles')}
      </button>
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/yanwu/Projects/github/journal && npx vitest run 2>&1 | tail -10
```
Expected: all PASS

- [ ] **Step 4: Commit**

```bash
cd /Users/yanwu/Projects/github/journal && git add src/components/SidebarTabs.tsx && git commit -m "$(cat <<'EOF'
fix(ui): put Journal tab first, Identity tab second in sidebar

Journal is the primary view and should be on the left per standard
left-to-right reading priority.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Remove JournalItem textShadow fake-bold hack

`textShadow: '0 0 0.4px currentColor, 0 0 0.4px currentColor'` is a CSS trick to fake font-weight increase. It causes blurry text on retina displays. The selected state already uses `var(--item-selected-text)` color for visual distinction — the shadow is redundant.

**Files:**
- Modify: `src/components/JournalItem.tsx:49`

- [ ] **Step 1: Locate the hack**

```bash
grep -n "textShadow" /Users/yanwu/Projects/github/journal/src/components/JournalItem.tsx
```
Expected: line 49

- [ ] **Step 2: Remove the textShadow line**

In `src/components/JournalItem.tsx`, remove line 49:
```tsx
        ...(isSelected ? { textShadow: '0 0 0.4px currentColor, 0 0 0.4px currentColor' } : {}),
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/yanwu/Projects/github/journal && npx vitest run 2>&1 | tail -10
```
Expected: all PASS

- [ ] **Step 4: Commit**

```bash
cd /Users/yanwu/Projects/github/journal && git add src/components/JournalItem.tsx && git commit -m "$(cat <<'EOF'
fix(ui): remove textShadow fake-bold hack from selected journal item title

The shadow caused blurry text on retina. Selected state is already
visually distinct via --item-selected-text color.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Replace ProcessingQueue emoji with SVG icons

`kindEmoji` dict uses Unicode emoji for file type indicators. Emoji render inconsistently across macOS versions and break the app's visual language. Replace with inline SVG icons matching the rest of the app.

**Files:**
- Modify: `src/components/ProcessingQueue.tsx:17-25,209,233`

- [ ] **Step 1: Verify current emoji usage**

```bash
grep -n "kindEmoji\|emoji" /Users/yanwu/Projects/github/journal/src/components/ProcessingQueue.tsx
```
Expected: lines 17–25 (dict), 209 (lookup), 233 (render)

- [ ] **Step 2: Replace kindEmoji dict with SVG icon map**

In `src/components/ProcessingQueue.tsx`, replace lines 17–25:

```tsx
function KindIcon({ kind }: { kind: string }) {
  const s = { width: 13, height: 13, flexShrink: 0 as const, opacity: 0.55 }
  const stroke = 'var(--item-meta)'
  if (kind === 'audio') return (
    <svg {...s} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
    </svg>
  )
  if (kind === 'image') return (
    <svg {...s} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  )
  // text / markdown / pdf / docx / other — generic document icon
  return (
    <svg {...s} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  )
}
```

- [ ] **Step 3: Replace emoji lookup and render**

Find line 209 (emoji lookup):
```tsx
          const emoji = kindEmoji[fileKindFromName(item.filename)] ?? '\uD83D\uDCC1'
```
Replace with:
```tsx
          const kind = fileKindFromName(item.filename)
```

Find line 233 (emoji render):
```tsx
              <span style={{ fontSize: 'var(--text-sm)', flexShrink: 0, opacity: 0.7 }}>{emoji}</span>
```
Replace with:
```tsx
              <KindIcon kind={kind} />
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/yanwu/Projects/github/journal && npx vitest run 2>&1 | tail -10
```
Expected: all PASS

- [ ] **Step 5: Build check**

```bash
cd /Users/yanwu/Projects/github/journal && npm run build 2>&1 | tail -20
```
Expected: no TypeScript errors

- [ ] **Step 6: Commit**

```bash
cd /Users/yanwu/Projects/github/journal && git add src/components/ProcessingQueue.tsx && git commit -m "$(cat <<'EOF'
fix(ui): replace emoji file-type indicators with SVG icons in processing queue

Emoji render inconsistently across macOS versions and break the app's
visual language. SVG icons use --item-meta color and match the rest of
the icon system.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Final Verification

- [ ] **Run full test suite**

```bash
cd /Users/yanwu/Projects/github/journal && npx vitest run 2>&1 | tail -15
```
Expected: all tests PASS, 0 failures

- [ ] **TypeScript build check**

```bash
cd /Users/yanwu/Projects/github/journal && npm run build 2>&1 | tail -10
```
Expected: no errors
