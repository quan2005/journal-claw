# UX Window & Interaction Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix five interaction defects in the IM-style master-detail layout: window over-resize, broken flex animation, panel content flash on close, minWidth too small, and missing Escape key support.

**Architecture:** All changes are in `src/App.tsx` and `src-tauri/tauri.conf.json`. The window resize effect is replaced with a "once on first open" strategy using refs. The right panel's CSS transition is changed from `flex` to `max-width` (WebKit-compatible). A `displayedItem` state is added to keep `DetailPanel` mounted during the closing animation. A `setTimeout` with a cancellation ref handles delayed unmount safely.

**Tech Stack:** React 18, TypeScript, Tauri v2 `@tauri-apps/api/window` (`getCurrentWindow`, `PhysicalSize`)

---

## File Structure

| File | Change |
|------|--------|
| `src/App.tsx` | Replace resize effect; fix panel CSS; add `displayedItem`; add Escape handler |
| `src-tauri/tauri.conf.json` | `minWidth: 280 → 320` |

---

## Chunk 1: tauri.conf.json + CSS transition fix

### Task 1: Fix minWidth in tauri.conf.json

**Files:**
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: Change minWidth from 280 to 320**

In `src-tauri/tauri.conf.json`, find the `windows` array entry and change:
```json
"minWidth": 280,
```
to:
```json
"minWidth": 320,
```

- [ ] **Step 2: Verify TypeScript still compiles**

```bash
npx tsc --noEmit
```
Expected: no output (clean).

---

### Task 2: Fix panel CSS transition (flex → max-width)

**Files:**
- Modify: `src/App.tsx` (lines ~133–175, the JSX return)

**Context:** The current right panel uses `transition: 'flex'` which does not work in WebKit (Tauri's renderer). Replace both panels' flex strategy and use `max-width` animation on the right panel.

- [ ] **Step 1: Replace the left panel `<div>` style**

Find this block in `src/App.tsx`:
```tsx
      {/* Left sidebar — min 320px, grows to fill space when panel is closed */}
      <div style={{
        flex: panelOpen ? `0 0 ${LEFT_WIDTH}px` : 1,
        minWidth: LEFT_WIDTH,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}>
```

Replace with:
```tsx
      {/* Left sidebar — fixed LEFT_WIDTH, never grows/shrinks */}
      <div style={{
        flex: '0 0 auto',
        width: LEFT_WIDTH,
        minWidth: LEFT_WIDTH,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}>
```

- [ ] **Step 2: Replace the right panel `<div>` style**

Find this block:
```tsx
      {/* Right panel — slides in */}
      <div style={{
        flex: panelOpen ? 1 : '0 0 0px',
        overflow: 'hidden',
        transition: 'flex 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        height: '100%',
        borderLeft: panelOpen ? '1px solid var(--divider)' : 'none',
        minWidth: 0,
      }}>
```

Replace with:
```tsx
      {/* Right panel — slides in via max-width transition (WebKit-compatible) */}
      <div style={{
        flex: 1,
        minWidth: 0,
        maxWidth: panelOpen ? 2000 : 0,
        overflow: 'hidden',
        transition: 'max-width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        height: '100%',
        borderLeft: panelOpen ? '1px solid var(--divider)' : 'none',
      }}>
```

Note: `borderLeft` is conditional on `panelOpen`. CSS `overflow: hidden` does not clip borders (borders are outside the content/padding box), so always-on border would show a 1px line even when the panel is closed. Keeping it conditional avoids this artifact.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no output (clean).

- [ ] **Step 4: Visual smoke test**

Run the app (`npm run tauri dev`), click a recording — the right panel should slide in smoothly. Click the X or the same item again — it should slide out. Confirm no border flicker on open/close.

---

## Chunk 2: Window resize + displayedItem + Escape key

### Task 3: Replace window resize effect

**Files:**
- Modify: `src/App.tsx`

**Context:** The existing `useEffect` on `panelOpen` calls `setSize` every time `panelOpen` changes — including every click while the panel is already open. Replace it with a "once on first open" strategy using two refs.

- [ ] **Step 1: Add `useRef` to the React import**

Find line 1 of `src/App.tsx`:
```tsx
import { useState, useEffect, useCallback } from 'react'
```

Replace with:
```tsx
import { useState, useEffect, useCallback, useRef } from 'react'
```

- [ ] **Step 2: Add two refs near the top of the `App` component**

After the existing state declarations (around line 23), add:
```tsx
  const panelHasResized = useRef(false)
  const prevPanelOpen = useRef(false)
```

- [ ] **Step 2: Replace the resize useEffect**

Find and remove this entire effect:
```tsx
  // Resize window when panel opens/closes
  useEffect(() => {
    const win = getCurrentWindow()
    if (panelOpen) {
      win.setSize(new PhysicalSize(Math.round((LEFT_WIDTH + RIGHT_WIDTH) * window.devicePixelRatio), Math.round(WINDOW_HEIGHT_DEFAULT * window.devicePixelRatio)))
        .catch(() => {})
    } else {
      win.setSize(new PhysicalSize(Math.round(LEFT_WIDTH * window.devicePixelRatio), Math.round(WINDOW_HEIGHT_DEFAULT * window.devicePixelRatio)))
        .catch(() => {})
    }
  }, [panelOpen])
```

Replace with:
```tsx
  // Auto-expand window once on first panel open; never shrink automatically
  useEffect(() => {
    const justOpened = panelOpen && !prevPanelOpen.current
    const justClosed = !panelOpen && prevPanelOpen.current
    prevPanelOpen.current = panelOpen

    if (justOpened && !panelHasResized.current) {
      if (window.innerWidth < LEFT_WIDTH + 280) {
        getCurrentWindow()
          .setSize(new PhysicalSize(
            Math.round((LEFT_WIDTH + RIGHT_WIDTH) * window.devicePixelRatio),
            Math.round(window.innerHeight * window.devicePixelRatio),
          ))
          .catch(() => {})
      }
      panelHasResized.current = true
    }

    if (justClosed) {
      panelHasResized.current = false
    }
  }, [panelOpen])
```

- [ ] **Step 3: Remove unused constant**

`WINDOW_HEIGHT_DEFAULT` is no longer used. Remove this line near the top of the file:
```tsx
const WINDOW_HEIGHT_DEFAULT = 480
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no output (clean).

---

### Task 4: Add displayedItem to prevent panel flash on close

**Files:**
- Modify: `src/App.tsx`

**Context:** When the panel closes, `selectedItem` is set to null immediately, which unmounts `DetailPanel` before the CSS transition finishes. We add a `displayedItem` state that lags behind `selectedItem` by 250ms on close (slightly longer than the 220ms CSS transition).

- [ ] **Step 1: Add displayedItem state and closeTimeout ref**

After the existing state declarations, add:
```tsx
  const [displayedItem, setDisplayedItem] = useState<RecordingItem | null>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
```

- [ ] **Step 2: Replace handleClosePanel**

Find:
```tsx
  const handleClosePanel = useCallback(() => {
    setSelectedItem(null)
    setPanelOpen(false)
  }, [])
```

Replace with:
```tsx
  const TRANSITION_MS = 250

  const handleClosePanel = useCallback(() => {
    setSelectedItem(null)
    setPanelOpen(false)
    // Cancel any pending close timeout (handles rapid open/close)
    if (closeTimeoutRef.current !== null) {
      clearTimeout(closeTimeoutRef.current)
    }
    closeTimeoutRef.current = setTimeout(() => {
      setDisplayedItem(null)
      closeTimeoutRef.current = null
    }, TRANSITION_MS)
  }, [])
```

- [ ] **Step 3: Reorder and update handleItemClick**

**Important:** `handleItemClick` now calls `handleClosePanel` directly. In the current file, `handleItemClick` is defined BEFORE `handleClosePanel`. You must ensure `handleClosePanel` is declared first. After Task 4 Step 2, the file will have `handleClosePanel` near the bottom (line ~128). Move `handleItemClick` to after `handleClosePanel` by placing the following replacement code after the `handleClosePanel` block.

Find:
```tsx
  const handleItemClick = useCallback((item: RecordingItem) => {
    if (item.path === '__active__') return
    if (selectedItem?.path === item.path) {
      setSelectedItem(null)
      setPanelOpen(false)
    } else {
      setSelectedItem(item)
      setPanelOpen(true)
    }
  }, [selectedItem])
```

Replace with:
```tsx
  const handleItemClick = useCallback((item: RecordingItem) => {
    if (item.path === '__active__') return
    if (selectedItem?.path === item.path) {
      handleClosePanel()
    } else {
      // Cancel any pending delayed unmount
      if (closeTimeoutRef.current !== null) {
        clearTimeout(closeTimeoutRef.current)
        closeTimeoutRef.current = null
      }
      setSelectedItem(item)
      setDisplayedItem(item)
      setPanelOpen(true)
    }
  }, [selectedItem, handleClosePanel])
```

- [ ] **Step 4: Update DetailPanel render to use displayedItem**

Find:
```tsx
        {selectedItem && (
          <DetailPanel
            item={selectedItem}
            transcriptionState={transcriptionStates[selectedItem.filename]}
            onClose={handleClosePanel}
          />
        )}
```

Replace with:
```tsx
        {displayedItem && (
          <DetailPanel
            item={displayedItem}
            transcriptionState={transcriptionStates[displayedItem.filename]}
            onClose={handleClosePanel}
          />
        )}
```

`selectedItem` still drives the `isSelected` highlight in the list (via `selectedPath={selectedItem?.path ?? null}`). `displayedItem` drives what's rendered in the panel. These are intentionally separate.

- [ ] **Step 5: Update handleContextMenu delete action to use handleClosePanel**

The delete action in `handleContextMenu` currently calls `setSelectedItem(null)` and `setPanelOpen(false)` directly, which bypasses the `displayedItem` cleanup. Find inside the delete `MenuItem.new` action:
```tsx
        if (selectedItem?.path === item.path) {
          setSelectedItem(null)
          setPanelOpen(false)
        }
```

Replace with:
```tsx
        if (selectedItem?.path === item.path) {
          handleClosePanel()
        }
```

Also update `handleContextMenu`'s `useCallback` dependency array to include `handleClosePanel`:
```tsx
  }, [selectedItem, handleClosePanel])

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no output (clean).

---

### Task 5: Add Escape key handler

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add keydown effect after the other useEffects**

Add this effect after the transcription-progress listener effect:
```tsx
  // Close panel on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && panelOpen) handleClosePanel()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [panelOpen, handleClosePanel])
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no output (clean).

---

### Task 6: Final integration test + commit

- [ ] **Step 1: Run full TypeScript check**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 2: Manual integration test**

Launch the app:
```bash
npm run tauri dev
```

Test the following scenarios:

| Scenario | Expected |
|----------|----------|
| Click a recording (panel closed) | Panel slides in smoothly; window expands to ~640px |
| Click a different recording (panel open) | Content switches; window does NOT resize |
| Manually drag window wider, then click another recording | Window stays at user's width |
| Close panel via X button | Panel slides out smoothly; content visible until animation ends |
| Close panel via clicking same item | Same as above |
| Press Escape while panel open | Panel closes smoothly |
| Press Escape while panel closed | Nothing happens |
| Drag window narrower than 320px | OS prevents it (minWidth constraint) |
| Close app and reopen | Window starts at 320px (initial config) |

- [ ] **Step 3: Commit all changes**

```bash
git add src/App.tsx src-tauri/tauri.conf.json docs/
git commit -m "fix: improve window resize and panel interaction UX

- Auto-expand window only once on first panel open, never on subsequent item clicks
- Fix panel slide animation (flex transition → max-width, WebKit-compatible)
- Prevent panel content flash on close via displayedItem state
- Fix borderLeft flicker by keeping it conditional (overflow:hidden doesn't clip borders)
- Set minWidth to 320 to match left sidebar width
- Add Escape key to close panel"
```
