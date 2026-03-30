# Settings Nav Active Highlight Fix — Design Spec

**Date:** 2026-03-30
**Status:** Approved

## Problem

Settings panel navigation highlight drifts during scroll and after click-to-jump. Root causes:

1. `IntersectionObserver` with `threshold: 0.4` — short sections never reach 40% visibility, so they never activate
2. Multiple entries firing simultaneously — the `for` loop picks the last winner arbitrarily, not the topmost visible section
3. Click → smooth scroll triggers observer mid-animation, which may settle on a neighboring section

## Goal

The highlighted nav item always reflects the topmost visible section in the scroll area.

## Solution

Replace `IntersectionObserver` with a `scroll` event listener.

**Active section logic:**

```
activeNav = the last section where section.offsetTop <= scrollTop + OFFSET
```

`OFFSET = 8` (px) — small top margin to avoid off-by-one pixel flipping.

## Changes

File: `src/settings/SettingsPanel.tsx`

- Remove `IntersectionObserver` setup in `useEffect`
- Add `scroll` event listener on `scrollRef.current` in `useEffect`
- On each scroll event, iterate `NAV_ITEMS` (plus `about`) in order, find the last one whose `offsetTop <= scrollTop + OFFSET`, set as `activeNav`
- `jumpTo` unchanged (`scrollIntoView({ behavior: 'smooth' })`)
- `sectionRefs` unchanged (still needed for `jumpTo`)

## Edge Cases

| Scenario | Behavior |
|---|---|
| Initial render (`scrollTop = 0`) | `general` active — correct |
| Scrolled to bottom | Last section active because it remains the last satisfying entry |
| Click jump (smooth scroll) | `scroll` events fire continuously during animation; final resting position is accurate |
| Very short last section | Always activates correctly because condition is `<=` not intersection |

## Out of Scope

- No debounce needed (6 sections, trivial DOM reads)
- No click lock needed (scroll event handles it naturally)
