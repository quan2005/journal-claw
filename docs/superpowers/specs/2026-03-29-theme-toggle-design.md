# Theme Toggle Design

**Date:** 2026-03-29

## Overview

Add a light/dark/system theme toggle button to the DayNote TitleBar. Theme preference is persisted per-workspace in `.setting.json` at the workspace root.

## UI

### Placement

TitleBar right corner. The TitleBar (`src/components/TitleBar.tsx`) is currently an empty 36px drag region with 70px left padding for macOS traffic lights. The right side is completely empty — natural home for toolbar controls.

### Control

Three-segment control:

```
[ ☀️ | 🌙 | 🖥️ ]
```

- ☀️ — force light
- 🌙 — force dark
- 🖥️ — follow system (default)

Active segment: white background (light mode) / `#48484a` background (dark mode), full-opacity icon.
Inactive segments: muted color (`#8e8e93` light / `#636366` dark), no background.

Border: `1px solid #d1d1d6` (light) / `#48484a` (dark). Border-radius: 6px. Height: 22px. Each segment: 28px wide.

### New component

`src/components/ThemeToggle.tsx` — pure presentational, props:
```ts
interface ThemeToggleProps {
  theme: 'light' | 'dark' | 'system'
  onChange: (theme: 'light' | 'dark' | 'system') => void
}
```

## Theme State Management

New hook: `src/hooks/useTheme.ts`

Responsibilities:
1. On mount: `invoke('get_workspace_theme')` → get saved value or `"system"` default
2. Apply theme to `<html data-theme="light|dark|system">`
3. When theme is `"system"`: listen to `window.matchMedia('(prefers-color-scheme: dark)')` and update `data-theme` accordingly (but keep the stored value as `"system"`)
4. `setTheme(t)`: update `data-theme`, invoke `set_workspace_theme(t)`, update state

Return value: `{ theme, setTheme }`

Used in `App.tsx`: call `useTheme()` at top level, pass `theme` and `setTheme` down to `TitleBar` → `ThemeToggle`.

## CSS

`src/styles/globals.css` currently uses `@media (prefers-color-scheme: dark)` exclusively. Add explicit selectors so manual overrides work:

```css
/* Force dark — overrides system preference */
[data-theme="dark"] {
  /* same variables as existing @media dark block */
}

/* Force light — overrides system dark preference */
[data-theme="light"] {
  /* same variables as existing :root light block */
}

/* data-theme="system": rely on existing @media query, no new selector needed */
```

The `@media` block remains for the `"system"` case. The explicit attribute selectors take precedence over the media query due to specificity.

## Rust Backend

New file: `src-tauri/src/workspace_settings.rs`

### Data structure

```json
{ "theme": "system" }
```

File location: `{workspace_path}/.setting.json`

### Reading

1. Load `workspace_path` from `config.rs`
2. Read `{workspace_path}/.setting.json`
3. If file missing or `theme` field absent: return `"system"`
4. Validate value is one of `"light"`, `"dark"`, `"system"`; default to `"system"` if invalid

### Commands

```rust
#[tauri::command]
pub fn get_workspace_theme(app: AppHandle) -> Result<String, String>

#[tauri::command]
pub fn set_workspace_theme(app: AppHandle, theme: String) -> Result<(), String>
```

`set_workspace_theme` reads the existing `.setting.json` (to preserve other future fields), updates the `theme` key, writes back. Creates the file if it doesn't exist.

Register both commands in `main.rs` alongside existing commands.

## Data Flow

```
App starts
  └─ useTheme (mount)
       └─ invoke get_workspace_theme → "system" | "light" | "dark"
       └─ set <html data-theme="...">
       └─ if "system": attach matchMedia listener

TitleBar renders ThemeToggle with current theme

User clicks segment
  └─ ThemeToggle.onChange("dark")
  └─ useTheme.setTheme("dark")
       └─ invoke set_workspace_theme("dark")
       └─ set <html data-theme="dark">
       └─ update state → ThemeToggle re-renders

System appearance changes (when theme="system")
  └─ matchMedia listener fires
  └─ update <html data-theme="light|dark"> to reflect actual system value
     (stored value remains "system")
```

## Files Changed

| File | Change |
|------|--------|
| `src/components/TitleBar.tsx` | Accept `theme`/`onChange` props, render `ThemeToggle` |
| `src/components/ThemeToggle.tsx` | New — three-segment control |
| `src/hooks/useTheme.ts` | New — theme state + persistence |
| `src/styles/globals.css` | Add `[data-theme="dark"]` and `[data-theme="light"]` selectors |
| `src/App.tsx` | Call `useTheme()`, pass props to `TitleBar` |
| `src-tauri/src/workspace_settings.rs` | New — read/write `.setting.json` |
| `src-tauri/src/main.rs` | Register new commands |
