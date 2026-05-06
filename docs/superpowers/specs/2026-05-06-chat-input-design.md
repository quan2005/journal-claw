# ChatPanel Input Bar — Design Spec

**Date**: 2026-05-06
**Status**: Approved
**Based on**: [Right Panel Refactor](./2026-05-05-right-panel-refactor-design.md)

## Overview

Refine the ChatPanel input bar design with OpenAI/ChatGPT-style layout, then implement the Right Panel Refactor (removing CommandDock and ConversationDialog).

## Input Bar Design

### Layout (OpenAI style)

```
┌─ 融合容器 (padding: 8px 12px 4px, border-radius: 12px) ────┐
│                                                               │
│  [附件标签] [图片缩略图]          ← 有则显示                  │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐    │
│  │ textarea 全宽 · 自适应高度 · max-height: 160px          │    │
│  └───────────────────────────────────────────────────────┘    │
│                                                               │
│  📎                                    🎤  ➤                  │
└───────────────────────────────────────────────────────────────┘
```

Key difference from Right Panel Refactor spec: **textarea full-width above, toolbar row below** (not side-by-side `📎 | text | 🎤/➤`). This gives text more room on multi-line and matches ChatGPT.

### Button States

| State | 🎤 Mic | ➤ Send |
|-------|--------|---------|
| Empty input | Amber translucent bg + subtle glow shadow | Disabled (gray `opacity: 0.3`) |
| Has text | `opacity: 0` (hidden, retains space) | Solid amber bg + white arrow |
| Recording | Red bg `#ff3b30` + red glow shadow | Disabled |

- Mic and Send are **separate buttons** side by side (not a toggle). No animation needed.
- 📎 attachment button always visible, bottom-left.

### States

1. **Default** (empty) — placeholder text, 🎤 active, ➤ disabled
2. **Has text** — 🎤 hidden (opacity:0), ➤ solid accent
3. **Multi-line** — textarea expands up to max-height 160px, then internal scroll
4. **Has attachments** — chips above textarea (files + images with × remove)
5. **Recording** — 🎤 turns red with stop icon, ➤ disabled
6. **Drag-over** — container border becomes dashed accent, "释放以添加文件" hint at top

### Fused Container

Drop zone and input bar share the same container. No separate drop zone box. During drag:
- Border: `1.5px dashed var(--accent)`
- Hint text appears at top of container
- Normal state: no visible drop zone

### Keyboard

| Key | Action |
|-----|--------|
| `Enter` | Send (when has text) |
| `Shift+Enter` | Newline |
| `Escape` | Clear input / cancel recording / cancel drag |
| `/` | Slash command menu |
| `@` | File mention menu |

## Removal Scope

### Remove
- `src/components/CommandDock.tsx` — bottom bar, input logic extracted to ChatPanel
- `src/components/ConversationDialog.tsx` — modal wrapper, core logic extracted to ChatPanel

### Relocate

| From | Feature | To |
|------|---------|----|
| CommandDock | Settings button | Left sidebar bottom |
| CommandDock | File upload + drop zone | ChatPanel input |
| CommandDock | Text input | ChatPanel input |
| CommandDock | Mic button | ChatPanel input (right side of toolbar) |
| CommandDock | Processing queue | ChatPanel banner (below tab bar) |
| ConversationDialog | Message list + streaming | ChatPanel |
| ConversationDialog | Session management | ChatPanel + useConversation hook |

### Keep (no change)
- `useConversation.ts` — hook logic unchanged
- `SessionList.tsx` — reused in History tab
- `TodoSidebar.tsx` — rendered inline in Ideas tab
- `ProcessingQueue.tsx` — rendered inline as banner

## Design Constraints

- **Animations**: Transform + opacity only, ≤300ms, ease-out, respect `prefers-reduced-motion`
- **Colors**: Amber gold `#C8933B` (dark) for accent. Recording red `#ff3b30` only for recording.
- **Spacing**: Tight 8–12px within groups
- **Right panel width**: Resizable 200–480px, localStorage (default 320px)
- **Textarea**: `rows=1`, auto-resize via JS, max-height 160px, overflow-y auto

## Risks

| Risk | Mitigation |
|------|------------|
| ConversationDialog removal breaks streaming | Extract streaming logic into ChatPanel preserving same hook usage |
| CommandDock keyboard shortcuts (Cmd+V, Escape, Enter) break | Re-bind in ChatPanel scope |
| Mic button relocation changes recorder flow | Same `useRecorder` hook, just different button placement |
