---
id: STORY-20260625-agent-run-panel-integration
title: "AgentRunPanel integration into right panel (G13)"
status: verified
source: orchestrator
level: L2
hypothesis_basis: reference
created: 2026-06-25
parent: ../20260625-ts-daemon-agent-runtime-migration/story.md
related:
  - docs/final-state.md
  - docs/verification-standard.md
---

# AgentRunPanel integration into right panel (G13)

> Goal: surface the AgentRunPanel (built in G12) in the actual app right panel, behind a chat/run mode toggle. The user's explicit ask: "the right side should be an Agent Run panel, not a chat." Default stays chat (no production regression); a toggle switches the right panel content to the structured Run surface.

## 服务对象 / Object served

**Runs** (UI integration). G12 built the panel component; G13 wires it into the live app layout so the user can actually open it.

## 范围

### 实现
1. UIContext/LayoutContext: add `rightPanelMode: 'chat' | 'run'` + setter (default 'chat')
2. App.tsx: render AgentRunPanel instead of ChatPanel when mode === 'run', inside the existing RightPanel wrapper
3. A small mode toggle control (segmented chat/run) shown in the right panel header area
4. AgentRunPanel is lazy-loaded (matches existing RightPanel/ChatPanel lazy pattern)

### 独占文件
- apps/web/src/contexts/UIContext.tsx (add rightPanelMode state)
- apps/web/src/App.tsx (render branch + lazy import + toggle)
- apps/web/src/components/AgentRunPanel.tsx (optional: accept no-op props if needed)

## 验收标准 (AC)

AC-1 rightPanelMode exists in LayoutContext, defaults to 'chat'
AC-2 mode === 'run' renders AgentRunPanel in the right panel slot; mode === 'chat' renders ChatPanel (no regression)
AC-3 a toggle control switches modes and persists for the session
AC-4 AgentRunPanel lazy-loaded (no bundle regression)
AC-5 web typecheck exit 0; existing web tests no new regression (pre-existing unrelated failures acceptable); App-level render covered

## 不做项

- no persistence of the mode across app restarts (session-only; can add workspace_settings later)
- no removing ChatPanel (it stays the default)
- no real daemon wiring in App (the panel uses its own daemon client; App just renders it)

## 验收方式

docs/verification-standard.md: typecheck + component/render tests + Playwright visual check.
