# Right Panel Refactor — Design Spec

**Date**: 2026-05-05
**Status**: Approved
**Approach**: B — Extract & Unify

## Overview

Merge the TodoSidebar, ConversationDialog (modal), and SessionList into a single right panel with tab switching. The panel is conditionally visible (toggle via todo button / Cmd+T). Remove the CommandDock bottom bar entirely. Move the settings button to the left sidebar.

## Goals

1. **Unified right panel** — Ideas (todos) / Chat / History tabs, conditionally visible in a resizable right panel
2. **Remove CommandDock** — relocate upload, input, mic/send, and processing queue to the Chat tab
3. **Settings button** — fixed at bottom of left sidebar, separated by 0.5px divider, non-scrolling

## Non-Goals

- No changes to todo CRUD logic or conversation streaming
- No changes to journal entry / identity detail behavior
- No new AI features or input capabilities

---

## Component Architecture

### Files Changed

| File | Action | Notes |
|---|---|---|
| `App.tsx` | Modify | Three-column flex layout; remove CommandDock and ConversationDialog rendering; new state variables |
| `RightPanel.tsx` | **New** | Container: tab bar + processing queue banner + tab content + chat input bar |
| `ChatPanel.tsx` | **New** | Chat tab content — extracted from ConversationDialog: message list + streaming + input area |
| `useRightPanelInput.ts` | **New** | Shared hook: file drop, text input, slash commands, attachment management |
| `useMicSendToggle.ts` | **New** | Shared hook: mic/send button state + opacity/scale animation |
| `ConversationDialog.tsx` | **Remove** | Modal wrapper removed. Core logic extracted to ChatPanel + shared hooks |
| `CommandDock.tsx` | **Remove** | Bottom bar removed. Input logic extracted; settings button relocated |
| `TodoSidebar.tsx` | Modify | Remove outer draggable divider wrapper; render inline as tab content (no show/hide toggle) |
| `SessionList.tsx` | No change | Reused as-is for the History tab content |
| `ProcessingQueue.tsx` | No change | Reused as-is — rendered inline as a banner, not a floating overlay |
| `TitleBar.tsx` | Modify | Remove todo toggle logic; keep AI status pill + theme toggle + todo button (switches to ideas tab) |

### Component Tree (After)

```
App
├── TitleBar (AI status, todo button+badge, theme toggle)
├── Content Row (flex: 1)
│   ├── Left Sidebar (JournalList... + ⚙️ Settings at bottom)
│   ├── DetailPanel / IdentityDetail / FilePreviewPanel (flex: 1)
│   └── RightPanel (resizable, conditionally visible)
│       ├── Tab Bar (Ideas | Chat | History)
│       ├── ProcessingQueue Banner (Chat tab only)
│       ├── Tab Content
│       │   ├── TodoSidebar (inline, Ideas tab)
│       │   ├── ChatPanel (inline, Chat tab)
│       │   └── SessionList (inline, History tab)
│       └── Chat Input Area (Chat tab only)
│           ├── Drop Zone
│           └── Input Bar (📎 + text input + 🎤/➤ toggle)
```

---

## Key State Variables (App.tsx)

| State | Type | Default | Replaces |
|---|---|---|---|
| `rightPanelOpen` | `boolean` | `true` | `todoOpen` |
| `rightPanelTab` | `'ideas' \| 'chat' \| 'history'` | `'ideas'` | `conversationState.visible` (for chat) |
| `rightPanelWidth` | `number` | `320` | `todoWidth` |
| `view` | `'journal' \| 'settings'` | `'journal'` | Unchanged — still used for settings overlay |

## Tab Behavior

### Visibility Rules

- **Ideas tab**: no input bar. Add todos via inline "+ New Todo".
- **Chat tab**: full input bar (attachments + text + mic/send toggle + drop zone above input). Processing queue banner below tab bar.
- **History tab**: no input bar. Read-only session list. Clicking a session switches to Chat tab and loads that session.

### Trigger Behavior

| Trigger | Behavior |
|---|---|
| Todo button / Cmd+T | If panel hidden → show panel + switch to Ideas. If panel visible & Ideas active → hide panel. If panel visible & not Ideas → switch to Ideas. |
| Cmd+K / AI status pill | If panel hidden → show panel + switch to Chat. If panel visible → switch to Chat. |
| Todo "discuss" / context menu / processing queue item | If panel hidden → show panel + switch to Chat + attach context. If panel visible → switch to Chat + attach context. |
| Click session in History tab | Switch to Chat tab + load selected session. |

All six entry points call a single function:

```ts
function openChatPanel(sessionId?: string, context?: ChatContext) {
  setRightPanelOpen(true);
  setRightPanelTab('chat');
  if (sessionId) loadSession(sessionId);
  if (context) setPendingContext(context);
}
```

No more `conversationState.visible`, no more modal overlay.

---

## Shared Hooks

### `useRightPanelInput`

Extracted from CommandDock input logic. Used by ChatPanel input bar.

| Return | Type | Description |
|---|---|---|
| `inputValue` | `string` | Current text input |
| `setInputValue` | `(val: string) => void` | Update input |
| `attachments` | `Attachment[]` | File attachments list |
| `handleFileDrop` | `(files: File[]) => void` | Handle dropped/pasted files |
| `handleSubmit` | `() => void` | Submit message (text + attachments) |
| `isDropping` | `boolean` | Active drag-over state for drop zone highlight |
| `slashCommands` | `SlashCommand[]` | Available slash commands triggered by `/` |

### `useMicSendToggle`

Manages mic/send button mode and animation. Used by ChatPanel input bar.

| Return | Type | Description |
|---|---|---|
| `buttonMode` | `'mic' \| 'send' \| 'recording'` | Current button mode |
| `micStyle` | `CSSProperties` | Dynamic opacity + scale for mic icon |
| `sendStyle` | `CSSProperties` | Dynamic opacity + scale for send icon |
| `onButtonClick` | `() => void` | Start recording / submit / stop recording |

**Animation spec**: Both icons stacked in the same circular button. Transition: `opacity 200ms ease-out, transform 200ms ease-out`. Inactive: `opacity: 0, transform: scale(0.5)`. Active: `opacity: 1, transform: scale(1)`. No bounce easing, no translate offsets.

**Recording state**: Button background changes to recording red `#ff3b30` (only for recording — per design principle #3: single accent, recording red only for recording state).

---

## Layout Changes

### App.tsx Vertical Structure

```
TitleBar (38px)
Settings overlay (absolute, view === 'settings')
Content row (flex: 1, overflow: hidden)
  ├── Left Sidebar (resizable, baseWidth)
  ├── Divider (5px, draggable)
  ├── Content Area (flex: 1)
  ├── Right Panel Edge Divider (5px, draggable)  — only when rightPanelOpen
  └── Right Panel (rightPanelWidth)              — only when rightPanelOpen
```

No CommandDock wrapper. No ConversationDialog overlay.

### Left Sidebar Bottom

```
SidebarTabs (fixed top)
Scrollable list area (flex: 1, overflow-y: auto)
0.5px divider (border-top, ink-cyan neutral)
Settings button (flex-shrink: 0, non-scrolling)
```

Settings button shows gear icon + "Settings" label + `⌘,` shortcut hint. Opens settings overlay via Cmd+, or click.

### Right Panel (Chat tab) Vertical Zones

```
Tab Bar (flex-shrink: 0)
Processing Queue Banner (flex-shrink: 0)
Message List (flex: 1, overflow-y: auto)
Drop Zone (flex-shrink: 0, dashed border)
Input Bar (flex-shrink: 0)
  📎 | text input | 🎤/➤
```

### CommandDock Feature Relocation

| Feature | New Location |
|---|---|
| Settings button | Left sidebar bottom |
| File upload + drop zone | Chat tab input bar (📎 button + drop zone above input) |
| Text input | Chat tab input bar |
| Microphone button | Chat tab input bar — shared position with send button |
| Processing queue | Chat tab — banner below tab bar |

---

## Design Constraints

- **Animations**: Transform + opacity only, ≤300ms, ease-out, respect `prefers-reduced-motion`
- **Colors**: Amber gold `#B8782A` (light) / `#C8933B` (dark) for accent. Recording red `#ff3b30` / `#ff375f` only for recording state.
- **Spacing**: Tight 8–12px within groups, loose 32–48px between sections
- **Right panel width**: Resizable 200–480px, persisted to localStorage (default 320px)
- **Settings divider**: `border-top: 0.5px solid` with ink-cyan neutral gray

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| ConversationDialog removal breaks existing session streaming | Extract streaming logic into ChatPanel preserving the same hook usage |
| CommandDock keyboard shortcuts (Cmd+V, Escape, Enter) break | Re-bind shortcuts in RightPanel/ChatPanel scope |
| TodoSidebar resize behavior changes | Reuse same drag-resize pattern from current todo sidebar divider |
| Right panel feels cramped at narrow widths | Enforce 200px minimum; tabs remain usable at that width |
