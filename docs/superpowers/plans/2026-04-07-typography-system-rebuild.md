# Typography System Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace IBM Plex Mono global font with system sans-serif, introduce 7-level font-size token scale, add font-weight tokens, and clean up dead CSS.

**Architecture:** CSS custom properties for all typography tokens in `globals.css :root`. Components migrate from hardcoded inline values to `var(--text-*)` / `var(--font-*)` references. Dead scaffold CSS in `App.css` removed.

**Tech Stack:** CSS custom properties, React inline styles with `var()` references.

**Spec:** `docs/superpowers/specs/2026-04-07-typography-system-rebuild.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/styles/globals.css` | Modify | Add typography tokens, change global font-family |
| `src/App.css` | Modify | Remove dead Tauri scaffold code, keep `.file-card-*` styles |
| `src/components/ProcessingQueue.tsx` | Modify | Replace hardcoded fontSize/fontFamily |
| `src/components/JournalList.tsx` | Modify | Replace hardcoded fontSize/fontWeight |
| `src/components/JournalItem.tsx` | Modify | Replace hardcoded fontSize/fontWeight |
| `src/components/DetailPanel.tsx` | Modify | Replace hardcoded fontSize/fontFamily/fontWeight |
| `src/components/IdentityDetail.tsx` | Modify | Replace hardcoded fontSize/fontFamily/fontWeight |
| `src/components/IdentityList.tsx` | Modify | Replace hardcoded fontSize/fontFamily/fontWeight |
| `src/components/CommandDock.tsx` | Modify | Replace hardcoded fontSize/fontFamily |
| `src/components/SidebarTabs.tsx` | Modify | Replace hardcoded fontSize/fontFamily/fontWeight |
| `src/components/TodoSidebar.tsx` | Modify | Replace hardcoded fontSize/fontFamily |
| `src/components/TitleBar.tsx` | Modify | Replace hardcoded fontSize/fontWeight |
| `src/components/AiStatusPill.tsx` | Modify | Replace hardcoded fontSize |
| `src/components/AiLogModal.tsx` | Modify | Replace hardcoded fontSize/fontFamily |
| `src/components/DetailSheet.tsx` | Modify | Replace hardcoded fontSize/fontWeight |
| `src/components/RecordingItem.tsx` | Modify | Replace hardcoded fontSize/fontWeight |
| `src/components/RecordingList.tsx` | Modify | Replace hardcoded fontSize/fontWeight |
| `src/components/MonthDivider.tsx` | Modify | Replace hardcoded fontSize/fontWeight |
| `src/components/FileCard.tsx` | Modify | Replace hardcoded fontSize/fontFamily/fontWeight |
| `src/components/FileChip.tsx` | Modify | Replace hardcoded fontSize/fontFamily |
| `src/components/ErrorBoundary.tsx` | Modify | Replace hardcoded fontSize |
| `src/components/MergeIdentityDialog.tsx` | Modify | Replace hardcoded fontSize/fontWeight |
| `src/components/SoulView.tsx` | Modify | Replace hardcoded fontSize/fontWeight |
| `src/components/JournalContextMenu.tsx` | Modify | Replace hardcoded fontSize |

---

### Task 1: Add Typography Tokens to globals.css

**Files:**
- Modify: `src/styles/globals.css:7` (inside `:root` block, top)

- [ ] **Step 1: Add font-size and font-weight tokens**

Add these lines right after the opening `:root {` on line 7 of `globals.css`:

```css
  /* ── Typography tokens ─────────────────────────── */
  --text-xs:   0.75rem;    /* 12px */
  --text-sm:   0.8125rem;  /* 13px */
  --text-base: 0.875rem;   /* 14px */
  --text-md:   1rem;       /* 16px */
  --text-lg:   1.25rem;    /* 20px */
  --text-xl:   1.5rem;     /* 24px */
  --text-2xl:  1.875rem;   /* 30px */

  --font-normal:   400;
  --font-medium:   500;
  --font-semibold: 600;

  --font-body: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
  --font-serif: 'Noto Serif SC', serif;
```

- [ ] **Step 2: Change global font-family**

Change line 345:
```css
/* Before */
font-family: 'IBM Plex Mono', ui-monospace, -apple-system, BlinkMacSystemFont, sans-serif;

/* After */
font-family: var(--font-body);
```

- [ ] **Step 3: Update .md-body inline code font-family**

Change line 381:
```css
/* Before */
font-family: 'IBM Plex Mono', ui-monospace, "SF Mono", Menlo, monospace;

/* After */
font-family: var(--font-mono);
```

- [ ] **Step 4: Update .dock-textarea font-family**

Change line 478:
```css
/* Before */
font-family: 'IBM Plex Mono', ui-monospace, "SF Mono", Menlo, monospace;

/* After */
font-family: var(--font-mono);
```

- [ ] **Step 5: Verify build**

Run: `cd /Users/yanwu/Projects/github/journal && npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/styles/globals.css
git commit -m "feat: add typography tokens and switch global font to system sans-serif"
```

---

### Task 2: Clean Up App.css Dead Code

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: Replace entire file with only the live styles**

Replace the full contents of `src/App.css` with:

```css
/* FileCard hover styles */
.file-card-remove {
  opacity: 0;
  transition: opacity 0.15s;
}
.file-card-wrap:hover .file-card-remove {
  opacity: 1;
}
.file-card-wrap:hover {
  background: rgba(255, 255, 255, 0.06);
}
```

This removes: the `:root` block (conflicting Inter/Avenir font-family), `.logo`, `.container`, `.row`, `a`, `h1`, `input`, `button`, `#greet-input`, and the dark-mode media query — all Tauri scaffold leftovers.

- [ ] **Step 2: Verify build**

Run: `cd /Users/yanwu/Projects/github/journal && npm run build`
Expected: Build succeeds. No visual change (these styles were unused).

- [ ] **Step 3: Commit**

```bash
git add src/App.css
git commit -m "chore: remove dead Tauri scaffold CSS from App.css"
```

---

### Task 3: Migrate Sidebar Components

**Files:**
- Modify: `src/components/SidebarTabs.tsx`
- Modify: `src/components/JournalList.tsx`
- Modify: `src/components/JournalItem.tsx`
- Modify: `src/components/MonthDivider.tsx`

- [ ] **Step 1: SidebarTabs.tsx — replace font values**

Line 20: `fontSize: 12.5` → `fontSize: 'var(--text-sm)'`
Line 21: `fontWeight: isActive(tab) ? 600 : 400` → `fontWeight: isActive(tab) ? 'var(--font-semibold)' : 'var(--font-normal)'`
Line 27: `fontFamily: "'IBM Plex Mono', ui-monospace, monospace"` → remove this line (inherits system sans-serif from body)

- [ ] **Step 2: JournalList.tsx — replace font values**

Line 99: `fontSize: 12` → `fontSize: 'var(--text-sm)'`
Line 122: `fontSize: 24` → `fontSize: 'var(--text-xl)'`
Line 123: `fontWeight: 500` → `fontWeight: 'var(--font-medium)'`
Line 130: `fontSize: 12` → `fontSize: 'var(--text-sm)'`
Line 156: `fontSize: 13` → `fontSize: 'var(--text-sm)'`

- [ ] **Step 3: JournalItem.tsx — replace font values**

Line 45: `fontSize: 14` → `fontSize: 'var(--text-base)'`
Line 46: `fontWeight: 700` → `fontWeight: 'var(--font-semibold)'`
Line 48: keep `fontFamily: "'Noto Serif SC', serif"` (spec: Noto Serif SC stays for journal titles)
Line 62: `fontSize: 12` → `fontSize: 'var(--text-xs)'`
Line 92: `fontSize: 11` → `fontSize: 'var(--text-xs)'`
Line 107: `fontSize: 11` → `fontSize: 'var(--text-xs)'`

- [ ] **Step 4: MonthDivider.tsx — replace font values**

Line 20: `fontSize: 16` → `fontSize: 'var(--text-md)'`
Line 21: `fontWeight: 600` → `fontWeight: 'var(--font-semibold)'`

- [ ] **Step 5: Verify build**

Run: `cd /Users/yanwu/Projects/github/journal && npm run build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/SidebarTabs.tsx src/components/JournalList.tsx src/components/JournalItem.tsx src/components/MonthDivider.tsx
git commit -m "feat: migrate sidebar components to typography tokens"
```

---

### Task 4: Migrate Detail Panel Components

**Files:**
- Modify: `src/components/DetailPanel.tsx`
- Modify: `src/components/DetailSheet.tsx`

- [ ] **Step 1: DetailPanel.tsx — replace fontFamily references**

All `fontFamily: "'IBM Plex Mono', monospace"` → `fontFamily: 'var(--font-mono)'`
(Lines 126, 143, 398)

All `fontFamily: "'Noto Serif SC', serif"` → `fontFamily: 'var(--font-serif)'`
(Lines 403, 422, 428, 434)

Keep the watermark fontFamily on line 257 as-is (extended serif fallback chain for CJK coverage).

- [ ] **Step 2: DetailPanel.tsx — replace fontSize values**

Line 122: `fontSize: 11` → `fontSize: 'var(--text-xs)'`
Line 140: `fontSize: 14` → `fontSize: 'var(--text-base)'`
Line 251: `fontSize: '84vh'` → keep (watermark)
Line 276: `fontSize: 14` → `fontSize: 'var(--text-base)'`
Line 299: `fontSize: 13` → `fontSize: 'var(--text-sm)'`
Line 300: `fontSize: 12` → `fontSize: 'var(--text-xs)'`
Line 321: `fontSize: 13` → `fontSize: 'var(--text-sm)'`
Line 322: `fontSize: 12` → `fontSize: 'var(--text-xs)'`
Line 345: `fontSize: 13` → `fontSize: 'var(--text-sm)'`
Line 346: `fontSize: 12` → `fontSize: 'var(--text-xs)'`
Line 375: `fontSize: 14` → `fontSize: 'var(--text-base)'`
Line 392: `fontSize: 12` → `fontSize: 'var(--text-xs)'`

Markdown renderer:
Line 423: `fontSize: 24` → `fontSize: 'var(--text-xl)'`
Line 429: `fontSize: 18` → `fontSize: 'var(--text-lg)'`
Line 435: `fontSize: 16` → `fontSize: 'var(--text-md)'`
Line 439: `fontSize: 13` → `fontSize: 'var(--text-sm)'`
Line 442: `fontSize: 14` → `fontSize: 'var(--text-base)'`
Line 445: `fontSize: 13` → `fontSize: 'var(--text-sm)'`
Line 449: `fontSize: 16` → `fontSize: 'var(--text-md)'`
Line 461: `fontSize: 16` → `fontSize: 'var(--text-md)'`
Line 469: `fontSize: 16` → `fontSize: 'var(--text-md)'`
Line 476: `fontSize: 16` → `fontSize: 'var(--text-md)'`
Line 546: `fontSize: 14` → `fontSize: 'var(--text-base)'`
Line 552: `fontSize: 13` → `fontSize: 'var(--text-sm)'`

- [ ] **Step 3: DetailPanel.tsx — replace fontWeight values**

Line 252: `fontWeight: 900` → keep (watermark)
Line 395: `fontWeight: 500` → `fontWeight: 'var(--font-medium)'`
Line 423: `fontWeight: 600` → `fontWeight: 'var(--font-semibold)'`
Line 429: `fontWeight: 600` → `fontWeight: 'var(--font-semibold)'`
Line 435: `fontWeight: 600` → `fontWeight: 'var(--font-semibold)'`
Line 486: `fontWeight: 600` → `fontWeight: 'var(--font-semibold)'`
Line 551: `fontWeight: 600` → `fontWeight: 'var(--font-semibold)'`

- [ ] **Step 4: DetailSheet.tsx — replace font values**

Line 114: `fontSize: 18` → `fontSize: 'var(--text-lg)'`, `fontWeight: 600` → `fontWeight: 'var(--font-semibold)'`
Line 117: `fontSize: 14` → `fontSize: 'var(--text-base)'`
Line 149: `fontSize: 16` → `fontSize: 'var(--text-md)'`
Line 157: `fontSize: 16` → `fontSize: 'var(--text-md)'`
Line 161: `fontSize: 14` → `fontSize: 'var(--text-base)'`
Line 177: `fontSize: 17` → `fontSize: 'var(--text-md)'`
Line 189: `fontSize: 13` → `fontSize: 'var(--text-sm)'`
Line 193: `fontSize: 13` → `fontSize: 'var(--text-sm)'`

- [ ] **Step 5: Verify build**

Run: `cd /Users/yanwu/Projects/github/journal && npm run build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/DetailPanel.tsx src/components/DetailSheet.tsx
git commit -m "feat: migrate detail panel components to typography tokens"
```

---

### Task 5: Migrate Command Dock & Processing Queue

**Files:**
- Modify: `src/components/CommandDock.tsx`
- Modify: `src/components/ProcessingQueue.tsx`

- [ ] **Step 1: CommandDock.tsx — replace font values**

Line 180: `fontFamily: "'IBM Plex Mono', monospace"` → `fontFamily: 'var(--font-mono)'`
Line 181: `fontSize: 12` → `fontSize: 'var(--text-xs)'`
Line 191: `fontFamily: "'IBM Plex Mono', monospace"` → `fontFamily: 'var(--font-mono)'`
Line 192: `fontSize: 12` → `fontSize: 'var(--text-xs)'`
Line 276: `fontSize: 14` → `fontSize: 'var(--text-base)'`
Line 277: `fontSize: 12` → `fontSize: 'var(--text-xs)'`
Line 283: `fontSize: 11` → `fontSize: 'var(--text-xs)'`
Line 347: `fontSize: 12` → `fontSize: 'var(--text-xs)'`
Line 421: `fontFamily: "'IBM Plex Mono', monospace"` → `fontFamily: 'var(--font-mono)'`
Line 422: `fontSize: 13` → `fontSize: 'var(--text-sm)'`
Line 520: `fontSize: 13` → `fontSize: 'var(--text-sm)'`

- [ ] **Step 2: ProcessingQueue.tsx — replace font values**

All `fontSize: 11` → `fontSize: 'var(--text-xs)'`
(Lines 77, 85, 93, 102, 107, 127, 198, 248, 251, 257)

All `fontSize: 12` → `fontSize: 'var(--text-xs)'`
(Lines 117, 177, 236, 270)

All `fontSize: 13` → `fontSize: 'var(--text-sm)'`
(Lines 128, 233)

Line 197: `fontFamily: "'IBM Plex Mono', monospace"` → `fontFamily: 'var(--font-mono)'`

- [ ] **Step 3: Verify build**

Run: `cd /Users/yanwu/Projects/github/journal && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/CommandDock.tsx src/components/ProcessingQueue.tsx
git commit -m "feat: migrate dock and queue components to typography tokens"
```

---

### Task 6: Migrate Identity Components

**Files:**
- Modify: `src/components/IdentityList.tsx`
- Modify: `src/components/IdentityDetail.tsx`

- [ ] **Step 1: IdentityList.tsx — replace font values**

Line 47: `fontSize: char === 'AI' ? 10 : 13` → `fontSize: char === 'AI' ? 'var(--text-xs)' : 'var(--text-sm)'`
Line 48: `fontFamily: char === 'AI' ? "'IBM Plex Mono', monospace" : undefined` → `fontFamily: char === 'AI' ? 'var(--font-mono)' : undefined`
Line 91: `fontSize: 14, fontWeight: 600` → `fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)'`
Line 100: `fontSize: 11` → `fontSize: 'var(--text-xs)'`
Line 101: `fontWeight: 500` → `fontWeight: 'var(--font-medium)'`
Line 102: `fontFamily: "'IBM Plex Mono', monospace"` → `fontFamily: 'var(--font-mono)'`
Line 111: `fontSize: 13` → `fontSize: 'var(--text-sm)'`
Line 152: `fontSize: 13` → `fontSize: 'var(--text-sm)'`
Line 339: `fontSize: 12` → `fontSize: 'var(--text-xs)'`
Line 364: `fontSize: 12` → `fontSize: 'var(--text-xs)'`
Line 384: `fontSize: 14` → `fontSize: 'var(--text-base)'`
Line 387: `fontSize: 13` → `fontSize: 'var(--text-sm)'`

- [ ] **Step 2: IdentityDetail.tsx — replace fontFamily references**

All `fontFamily: "'IBM Plex Mono', monospace"` → `fontFamily: 'var(--font-mono)'`
(Lines 105, 219, 821, 834)

Line 115: `fontFamily: "'IBM Plex Mono', ui-monospace, Menlo, monospace"` → `fontFamily: 'var(--font-mono)'`

All `fontFamily: "'Noto Serif SC', serif"` → `fontFamily: 'var(--font-serif)'`
(Lines 288, 291, 294)

Keep watermark fontFamily on line 561 as-is.

- [ ] **Step 3: IdentityDetail.tsx — replace fontSize values**

Line 43: `fontSize: 13` → `fontSize: 'var(--text-sm)'`
Line 104: `fontSize: 11` → `fontSize: 'var(--text-xs)'`
Line 114: `fontSize: 14` → `fontSize: 'var(--text-base)'`
Line 218: `fontSize: 12` → `fontSize: 'var(--text-xs)'`
Line 223: `fontSize: 11` → `fontSize: 'var(--text-xs)'`
Line 247: `fontSize: 10` → `fontSize: 'var(--text-xs)'`
Line 257: `fontSize: 11` → `fontSize: 'var(--text-xs)'`
Line 288: `fontSize: 24` → `fontSize: 'var(--text-xl)'`
Line 291: `fontSize: 18` → `fontSize: 'var(--text-lg)'`
Line 294: `fontSize: 16` → `fontSize: 'var(--text-md)'`
Line 297: `fontSize: 13` → `fontSize: 'var(--text-sm)'`
Line 300: `fontSize: 14` → `fontSize: 'var(--text-base)'`
Line 303: `fontSize: 13` → `fontSize: 'var(--text-sm)'`
Line 306: `fontSize: 16` → `fontSize: 'var(--text-md)'`
Line 316: `fontSize: 16` → `fontSize: 'var(--text-md)'`
Line 321: `fontSize: 16` → `fontSize: 'var(--text-md)'`
Line 328: `fontSize: 16` → `fontSize: 'var(--text-md)'`
Line 353: `fontSize: 14` → `fontSize: 'var(--text-base)'`
Line 357: `fontSize: 13` → `fontSize: 'var(--text-sm)'`
Line 555: `fontSize: '84vh'` → keep (watermark)
Line 580: `fontSize: 14` → `fontSize: 'var(--text-base)'`
Line 604: `fontSize: 13` → `fontSize: 'var(--text-sm)'`
Line 605: `fontSize: 12` → `fontSize: 'var(--text-xs)'`
Line 626: `fontSize: 13` → `fontSize: 'var(--text-sm)'`
Line 627: `fontSize: 12` → `fontSize: 'var(--text-xs)'`
Line 648: `fontSize: 11` → `fontSize: 'var(--text-xs)'`
Line 670: `fontSize: 14, fontWeight: 600` → `fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)'`
Line 691: `fontSize: 9` → `fontSize: 'var(--text-xs)'`
Line 709: `fontSize: 9` → `fontSize: 'var(--text-xs)'`
Line 749: `fontSize: 9` → `fontSize: 'var(--text-xs)'`
Line 809: `fontSize: 14` → `fontSize: 'var(--text-base)'`
Line 819: `fontSize: 12` → `fontSize: 'var(--text-xs)'`
Line 832: `fontSize: 12` → `fontSize: 'var(--text-xs)'`
Line 859: `fontSize: 14` → `fontSize: 'var(--text-base)'`

- [ ] **Step 4: Verify build**

Run: `cd /Users/yanwu/Projects/github/journal && npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/IdentityList.tsx src/components/IdentityDetail.tsx
git commit -m "feat: migrate identity components to typography tokens"
```

---

### Task 7: Migrate Remaining Components

**Files:**
- Modify: `src/components/TitleBar.tsx`
- Modify: `src/components/AiStatusPill.tsx`
- Modify: `src/components/AiLogModal.tsx`
- Modify: `src/components/RecordingItem.tsx`
- Modify: `src/components/RecordingList.tsx`
- Modify: `src/components/TodoSidebar.tsx`
- Modify: `src/components/FileCard.tsx`
- Modify: `src/components/FileChip.tsx`
- Modify: `src/components/ErrorBoundary.tsx`
- Modify: `src/components/MergeIdentityDialog.tsx`
- Modify: `src/components/SoulView.tsx`
- Modify: `src/components/JournalContextMenu.tsx`

- [ ] **Step 1: TitleBar.tsx**

Line 40: `fontSize: 16, fontWeight: 500` → `fontSize: 'var(--text-md)', fontWeight: 'var(--font-medium)'`
Line 70: `fontSize: 8, fontWeight: 700` → `fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)'`

- [ ] **Step 2: AiStatusPill.tsx**

Line 48: `fontSize: 13` → `fontSize: 'var(--text-sm)'`

- [ ] **Step 3: AiLogModal.tsx**

Line 73: `fontSize: 13` → `fontSize: 'var(--text-sm)'`
Line 77: `fontSize: 11` → `fontSize: 'var(--text-xs)'`
Line 89: `fontSize: 16` → `fontSize: 'var(--text-md)'`
Line 102: `fontFamily: 'ui-monospace, "SF Mono", monospace'` → `fontFamily: 'var(--font-mono)'`
Line 103: `fontSize: 12` → `fontSize: 'var(--text-xs)'`
Line 147: `fontSize: 12` → `fontSize: 'var(--text-xs)'`

- [ ] **Step 4: RecordingItem.tsx**

Line 118: `fontSize: 26` → `fontSize: 'var(--text-xl)'`
Line 119: `fontWeight: 300` → `fontWeight: 'var(--font-normal)'`
Line 126: `fontSize: 10` → `fontSize: 'var(--text-xs)'`
Line 143: `fontSize: 13, fontWeight: 500` → `fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)'`
Line 157: `fontSize: 12` → `fontSize: 'var(--text-xs)'`

- [ ] **Step 5: RecordingList.tsx**

Line 97: `fontSize: 13, fontWeight: 500` → `fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)'`
Line 100: `fontSize: 12` → `fontSize: 'var(--text-xs)'`
Line 105: `fontSize: 13` → `fontSize: 'var(--text-sm)'`
Line 133: `fontSize: 13` → `fontSize: 'var(--text-sm)'`

- [ ] **Step 6: TodoSidebar.tsx**

Line 60: `fontSize: 11` → `fontSize: 'var(--text-xs)'`
Line 69: `fontSize: 11, fontWeight: 500` → `fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)'`
Line 76: `fontSize: 9` → `fontSize: 'var(--text-xs)'`
Line 90: `fontSize: 11` → `fontSize: 'var(--text-xs)'`
Line 93: `fontWeight: isToday || isSelected ? 600 : 400` → `fontWeight: isToday || isSelected ? 'var(--font-semibold)' : 'var(--font-normal)'`
Line 103: `fontSize: 10` → `fontSize: 'var(--text-xs)'`
Line 230: `fontSize: 12, fontFamily: "'IBM Plex Mono', ui-monospace, monospace"` → `fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)'`
Line 235-236: same replacement
Line 248: `fontSize: 8` → `fontSize: 'var(--text-xs)'`
Line 379: `fontSize: 10, fontWeight: 500` → `fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)'`
Line 380: `fontSize: 10` → `fontSize: 'var(--text-xs)'`
Line 395: `fontSize: 11, fontFamily: "'IBM Plex Mono', monospace"` → `fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)'`
Line 407: `fontSize: 11` → `fontSize: 'var(--text-xs)'`
Line 415: `fontSize: 9` → `fontSize: 'var(--text-xs)'`
Line 430: `fontSize: 13` → `fontSize: 'var(--text-sm)'`

- [ ] **Step 7: FileCard.tsx**

Line 74: `fontSize: 7, fontWeight: 700` → `fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)'`
Line 78: `fontFamily: "'IBM Plex Mono', monospace"` → `fontFamily: 'var(--font-mono)'`
Line 89: `fontSize: 11` → `fontSize: 'var(--text-xs)'`

- [ ] **Step 8: FileChip.tsx**

Line 101: `fontFamily: "'IBM Plex Mono', monospace"` → `fontFamily: 'var(--font-mono)'`
Line 102: `fontSize: 13` → `fontSize: 'var(--text-sm)'`

- [ ] **Step 9: ErrorBoundary.tsx**

Line 30: `fontSize: 14` → `fontSize: 'var(--text-base)'`
Line 31: `fontSize: 12` → `fontSize: 'var(--text-xs)'`
Line 37: `fontSize: 12` → `fontSize: 'var(--text-xs)'`

- [ ] **Step 10: MergeIdentityDialog.tsx**

Line 72: `fontSize: 13` → `fontSize: 'var(--text-sm)'`
Line 80: `fontSize: 16` → `fontSize: 'var(--text-md)'`
Line 93: `fontSize: 14, fontWeight: 600` → `fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)'`
Line 94: `fontSize: 13` → `fontSize: 'var(--text-sm)'`
Line 101: `fontSize: 16, fontWeight: 700` → `fontSize: 'var(--text-md)', fontWeight: 'var(--font-semibold)'`
Line 131: `fontSize: 13` → `fontSize: 'var(--text-sm)'`
Line 139: `fontSize: 14` → `fontSize: 'var(--text-base)'`
Line 151: `fontSize: 14, fontWeight: 600` → `fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)'`

- [ ] **Step 11: SoulView.tsx**

Line 93: `fontSize: 16, fontWeight: 600` → `fontSize: 'var(--text-md)', fontWeight: 'var(--font-semibold)'`
Line 94: `fontSize: 13` → `fontSize: 'var(--text-sm)'`
Line 129: `fontSize: 12` → `fontSize: 'var(--text-xs)'`
Line 144: `fontSize: 14, fontWeight: 600` → `fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)'`

- [ ] **Step 12: JournalContextMenu.tsx**

Line 148: `fontSize: 13` → `fontSize: 'var(--text-sm)'`

- [ ] **Step 13: Verify build**

Run: `cd /Users/yanwu/Projects/github/journal && npm run build`
Expected: Build succeeds.

- [ ] **Step 14: Run tests**

Run: `cd /Users/yanwu/Projects/github/journal && npm test`
Expected: All tests pass.

- [ ] **Step 15: Commit**

```bash
git add src/components/TitleBar.tsx src/components/AiStatusPill.tsx src/components/AiLogModal.tsx src/components/RecordingItem.tsx src/components/RecordingList.tsx src/components/TodoSidebar.tsx src/components/FileCard.tsx src/components/FileChip.tsx src/components/ErrorBoundary.tsx src/components/MergeIdentityDialog.tsx src/components/SoulView.tsx src/components/JournalContextMenu.tsx
git commit -m "feat: migrate remaining components to typography tokens"
```
