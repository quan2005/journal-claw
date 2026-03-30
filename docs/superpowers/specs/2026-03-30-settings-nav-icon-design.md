# Settings Nav Icon Redesign — Spec

**Date:** 2026-03-30

## Problem

Current nav icons are Unicode geometric symbols (⚙ ◈ ◎ ✦ ⬡ ◌). These render inconsistently across fonts/OS versions and carry weak semantic meaning.

## Solution

Replace with Lucide React icons — SF Symbols-style thin-stroke icons that match the Bear/Things 3 aesthetic.

## Icon Mapping

| Nav item | id      | New icon     |
|----------|---------|--------------|
| 通用      | general | `Settings2`  |
| AI 引擎   | ai      | `Cpu`        |
| 语音转写   | voice   | `Mic`        |
| 工作引导   | guide   | `BookOpen`   |
| 技能插件   | plugins | `Puzzle`     |
| 关于      | about   | `Info`       |

## Implementation

- Install: `npm install lucide-react`
- `NAV_ITEMS` in `SettingsPanel.tsx` stores Lucide component references instead of strings
- Icon size: 14, strokeWidth: 1.5
- Active color: `var(--record-btn)`, inactive: `var(--item-meta)`

## Files Changed

- `package.json` — add lucide-react dependency
- `src/settings/SettingsPanel.tsx` — update NAV_ITEMS and icon rendering
