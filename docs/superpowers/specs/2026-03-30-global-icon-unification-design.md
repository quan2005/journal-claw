# Global Icon Unification — Spec

**Date:** 2026-03-30

## Problem

Unicode geometric symbols and emoji are used inconsistently across the app as visual icons. They render differently across fonts and OS versions, and emoji introduce color/weight that conflicts with the brand's "克制·沉静·专业" aesthetic. The settings nav was already migrated to Lucide React in a prior task; this spec covers the remaining locations.

## Solution

Replace all remaining Unicode symbol and emoji icons with Lucide React icons (already installed: `lucide-react@1.7.0`). Icon style: `size` and `strokeWidth` matched to context. Keep `⌘V` and `↗` as-is — these are keyboard/direction labels, not icons.

## Icon Mapping

### TitleBar.tsx

| Element | Current | New Lucide | Size | StrokeWidth |
|---------|---------|------------|------|-------------|
| Settings toggle button | `⚙` (fontSize 15) | `Settings2` | 15 | 1.5 |

### ThemeToggle.tsx

| Element | Current | New Lucide | Size | StrokeWidth |
|---------|---------|------------|------|-------------|
| Light theme button | `☀️` | `Sun` | 12 | 1.5 |
| Dark theme button | `🌙` | `Moon` | 12 | 1.5 |
| System theme button | `🖥️` | `Monitor` | 12 | 1.5 |

`SEGMENTS` array changes `icon` field from `string` to `LucideIcon`. Render updates from `{seg.icon}` to `<seg.icon size={12} strokeWidth={1.5} />`.

### FileCard.tsx

| Element | Current | New Lucide | Size | StrokeWidth |
|---------|---------|------------|------|-------------|
| PDF icon | `📕` | `FileText` | 20 | 1.5 |
| DOCX icon | `📘` | `FileText` | 20 | 1.5 |
| text icon | `📄` | `FileText` | 20 | 1.5 |
| markdown icon | `📝` | `FileText` | 20 | 1.5 |
| audio icon | `🎵` | `Music` | 20 | 1.5 |
| image icon | `🖼` | `Image` | 20 | 1.5 |
| default icon | `📄` | `FileText` | 20 | 1.5 |
| Remove button | `×` (fontSize 9) | `X` | 8 | 2 |

`iconEmoji()` function replaced with `iconLucide()` returning `LucideIcon`. The colored gradient background card remains unchanged — only the emoji inside is replaced with an SVG icon rendered in white (`color="#fff"`).

### DetailPanel.tsx

| Element | Current | New Lucide | Size | StrokeWidth |
|---------|---------|------------|------|-------------|
| Code block "Copied" state | `✓` | `Check` | 12 | 2 |

### SectionAiEngine.tsx

| Element | Current | New Lucide | Size | StrokeWidth |
|---------|---------|------------|------|-------------|
| Claude Code engine icon | `◈` (fontSize 22) | `Terminal` | 22 | 1.5 |
| Qwen Code engine icon | `◇` (fontSize 22) | `Sparkles` | 22 | 1.5 |
| Install complete check | `✓` (fontSize 9) | `Check` | 9 | 2.5 |

`ENGINES` array: `icon` field changes from `string` to `LucideIcon`.

## Not Changed

- `⌘V` in CommandDock — keyboard shortcut label, not an icon
- `↗` in CommandDock submit button — directional text character, not an icon
- `+` in SectionPlugins — plain text character used intentionally

## Files Changed

- `src/components/TitleBar.tsx`
- `src/components/ThemeToggle.tsx`
- `src/components/FileCard.tsx`
- `src/components/DetailPanel.tsx`
- `src/settings/components/SectionAiEngine.tsx`
