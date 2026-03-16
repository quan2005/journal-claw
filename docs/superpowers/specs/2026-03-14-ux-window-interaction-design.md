# UX Window & Interaction Design Spec

**Goal:** Fix all interaction defects in the IM-style master-detail layout so window resizing, panel open/close, and list interaction all feel native and polished.

**Architecture:** Pure frontend changes — App.tsx, a new `useDelayedUnmount` hook, and tauri.conf.json. No Rust changes required.

**Tech Stack:** React, TypeScript, Tauri v2 `@tauri-apps/api/window`

---

## Problem Statement

Five interaction defects exist in the current implementation:

1. **Window over-resizes**: Every `panelOpen` state change triggers `setSize`, including when switching between records while panel is already open. User-adjusted window size is destroyed on every click.
2. **Flex transition broken**: `transition: 'flex'` is not supported in WebKit/Safari. Panel slide animation does not play.
3. **Panel content disappears before animation ends**: `handleClosePanel` sets both `selectedItem = null` and `panelOpen = false` simultaneously. `DetailPanel` unmounts immediately (its render guard is `{selectedItem && ...}`), so content vanishes before the closing CSS transition completes.
4. **minWidth too small**: `tauri.conf.json` sets `minWidth: 280`, which is less than `LEFT_WIDTH: 320`, allowing the user to resize the window to a broken state.
5. **No Escape key support**: Panel can only be closed by clicking the X button or re-clicking the selected item.

---

## Design Decisions

### 1. Window Resize — "Once on first open" strategy

**State:**
- `panelHasResized` ref (`useRef<boolean>(false)`) — tracks whether we've already auto-resized for this open session.

**Logic (replaces the existing `useEffect([panelOpen])`):**

```tsx
const prevPanelOpen = useRef(false)

useEffect(() => {
  const justOpened = panelOpen && !prevPanelOpen.current
  const justClosed = !panelOpen && prevPanelOpen.current
  prevPanelOpen.current = panelOpen

  if (justOpened && !panelHasResized.current) {
    if (window.innerWidth < LEFT_WIDTH + 280) {
      getCurrentWindow()
        .setSize(new PhysicalSize(
          Math.round((LEFT_WIDTH + RIGHT_WIDTH) * window.devicePixelRatio),
          Math.round(window.innerHeight * window.devicePixelRatio)
        ))
        .catch(() => {})
    }
    panelHasResized.current = true
  }

  if (justClosed) {
    panelHasResized.current = false
    // No setSize — window stays at whatever size the user chose
  }
}, [panelOpen])
```

Height uses `window.innerHeight` (live value) rather than the `WINDOW_HEIGHT_DEFAULT` constant, so auto-resize preserves the user's current window height.

**Rationale:** First open gives the user the correct initial experience (640px wide). After that, the window is theirs. Resetting the flag on close means the auto-expand happens again if the user shrinks the window back to narrow before reopening.

### 2. Panel Transition — max-width strategy

Replace `transition: 'flex'` (not supported in WebKit) with `max-width` transition.

**Right panel container:**
```tsx
style={{
  flex: 1,
  minWidth: 0,
  maxWidth: panelOpen ? 2000 : 0,
  overflow: 'hidden',
  transition: 'max-width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
  borderLeft: '1px solid var(--divider)',  // always present; clipped by overflow when maxWidth=0
}}
```

**Left panel container:**
```tsx
style={{
  flex: '0 0 auto',
  width: LEFT_WIDTH,
  minWidth: LEFT_WIDTH,
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
}}
```

Left panel is fixed at `LEFT_WIDTH`. Right panel takes all remaining space, animated with `max-width`. The `border-left` is always declared — when `max-width: 0` it is clipped by `overflow: hidden`, eliminating the flicker.

**Known gap:** When the right panel is open and the user manually drags the window narrower than `LEFT_WIDTH + 1px`, the right panel will compress toward zero. With `minWidth: 320` in tauri.conf.json, the OS prevents the window from going below 320px, so the right panel may reach 0 but the left panel is never truncated. This is acceptable behavior.

### 3. Delayed Unmount — keep `displayedItem` separate from `selectedItem`

**The root cause:** `handleClosePanel` calls `setSelectedItem(null)` and `setPanelOpen(false)` together. Since `DetailPanel` renders only when `selectedItem` is non-null, it unmounts immediately.

**Fix:** Introduce a separate `displayedItem` state that lags behind `selectedItem` during close:

```tsx
const [displayedItem, setDisplayedItem] = useState<RecordingItem | null>(null)

// When opening: update displayedItem immediately
// When closing: update displayedItem after transition completes
const TRANSITION_MS = 250 // slightly longer than CSS 220ms

const handleClosePanel = useCallback(() => {
  setSelectedItem(null)
  setPanelOpen(false)
  setTimeout(() => setDisplayedItem(null), TRANSITION_MS)
}, [])

const handleItemClick = useCallback((item: RecordingItem) => {
  if (item.path === '__active__') return
  if (selectedItem?.path === item.path) {
    handleClosePanel()
  } else {
    setSelectedItem(item)
    setDisplayedItem(item)  // update immediately on open
    setPanelOpen(true)
  }
}, [selectedItem, handleClosePanel])
```

`DetailPanel` uses `displayedItem`:
```tsx
{displayedItem && (
  <DetailPanel
    item={displayedItem}
    transcriptionState={transcriptionStates[displayedItem.filename]}
    onClose={handleClosePanel}
  />
)}
```

`selectedItem` continues to drive `isSelected` in the list (highlight clears immediately on click, correct behavior). `displayedItem` drives what's rendered in the panel (stays mounted until transition finishes).

No new hook needed — this approach is simpler and more explicit.

### 4. minWidth Fix

`tauri.conf.json`: change `minWidth` from `280` to `320`.

This prevents the window from being resized smaller than the left sidebar at the OS level.

### 5. Escape Key

In `App.tsx`, add a `useEffect` that listens for `keydown`:

```tsx
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && panelOpen) handleClosePanel()
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [panelOpen, handleClosePanel])
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/App.tsx` | Replace resize effect; replace `flex` transition with `max-width`; add `displayedItem` state; add Escape key handler |
| `src-tauri/tauri.conf.json` | `minWidth: 280 → 320` |

No new files needed (`useDelayedUnmount` hook dropped in favor of the simpler `displayedItem` approach).

---

## Out of Scope

- Persisting window size/position across app restarts
- Right panel enforced minimum width while resizing
