# Settings Nav Active Highlight Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace IntersectionObserver with a scroll event listener so the nav highlight always tracks the topmost visible section.

**Architecture:** Listen to `scroll` on the right panel container; on each event iterate all section refs in order and pick the last one whose `offsetTop <= scrollTop + 8`. This is deterministic, needs no lock, and handles short sections at the bottom correctly.

**Tech Stack:** React, TypeScript — single file change only.

---

### Task 1: Replace IntersectionObserver with scroll-based active tracking

**Files:**
- Modify: `src/settings/SettingsPanel.tsx`

- [ ] **Step 1: Read the current file**

  Open `src/settings/SettingsPanel.tsx` and confirm the `useEffect` at lines 24–39 contains the `IntersectionObserver` setup.

- [ ] **Step 2: Replace the useEffect**

  Replace the entire `useEffect` block (lines 24–39):

  ```tsx
  // REMOVE this:
  useEffect(() => {
    const scroll = scrollRef.current
    if (!scroll) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveNav(entry.target.id as NavId)
          }
        }
      },
      { root: scroll, threshold: 0.4 }
    )
    Object.values(sectionRefs.current).forEach(el => el && observer.observe(el))
    return () => observer.disconnect()
  }, [])
  ```

  With this:

  ```tsx
  const ALL_NAV_IDS: NavId[] = ['general', 'ai', 'voice', 'guide', 'plugins', 'about']
  const SCROLL_OFFSET = 8

  useEffect(() => {
    const scroll = scrollRef.current
    if (!scroll) return

    const handleScroll = () => {
      const scrollTop = scroll.scrollTop
      let active: NavId = 'general'
      for (const id of ALL_NAV_IDS) {
        const el = sectionRefs.current[id]
        if (el && el.offsetTop <= scrollTop + SCROLL_OFFSET) {
          active = id
        }
      }
      setActiveNav(active)
    }

    scroll.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // set initial active state on mount
    return () => scroll.removeEventListener('scroll', handleScroll)
  }, [])
  ```

  Place `ALL_NAV_IDS` and `SCROLL_OFFSET` as module-level constants above the `SettingsPanel` function, alongside `NAV_ITEMS`.

- [ ] **Step 3: Verify the file compiles**

  ```bash
  cd /Users/yanwu/Projects/github/journal && npm run build 2>&1 | tail -20
  ```

  Expected: no TypeScript errors. Exit code 0 (or only Vite bundle output, no `error TS` lines).

- [ ] **Step 4: Manual smoke test**

  Run `npm run dev` and open the settings window. Verify:
  - On open: "通用" is highlighted
  - Scroll down slowly: highlight advances to AI引擎 → 语音转写 → 工作引导 → 技能插件 → 关于 at the correct moment
  - Click any nav item: scroll jumps and that item immediately highlights without drifting
  - Scroll back to top: "通用" re-activates

- [ ] **Step 5: Commit**

  ```bash
  cd /Users/yanwu/Projects/github/journal
  git add src/settings/SettingsPanel.tsx
  git commit -m "fix: replace IntersectionObserver with scroll-based nav active tracking"
  ```
