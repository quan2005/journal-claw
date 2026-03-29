# Theme Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a three-segment light/dark/system theme toggle to the TitleBar, persisted in workspace `.setting.json`.

**Architecture:** Rust backend reads/writes `{workspace_path}/.setting.json`; a new `useTheme` hook loads the saved value on mount, applies it to `<html data-theme="...">`, and handles system-preference changes when theme is `"system"`; a pure `ThemeToggle` component renders the segmented control.

**Tech Stack:** Rust + serde_json (backend), React + TypeScript (frontend), Tauri invoke (IPC), CSS attribute selectors (theming).

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src-tauri/src/workspace_settings.rs` | Create | Read/write `.setting.json` in workspace root |
| `src-tauri/src/main.rs` | Modify | Register `mod workspace_settings` + 2 new commands |
| `src/components/ThemeToggle.tsx` | Create | Pure three-segment control UI |
| `src/hooks/useTheme.ts` | Create | Theme state, Tauri IPC, `<html>` attribute, matchMedia |
| `src/styles/globals.css` | Modify | Add `[data-theme="dark"]` and `[data-theme="light"]` selectors |
| `src/components/TitleBar.tsx` | Modify | Accept `theme`/`onChange` props, render `ThemeToggle` |
| `src/App.tsx` | Modify | Call `useTheme()`, pass props to `TitleBar` |

---

### Task 1: Rust — workspace_settings.rs

**Files:**
- Create: `src-tauri/src/workspace_settings.rs`

- [ ] **Step 1: Create the file**

```rust
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

use crate::config::load_config;

#[derive(Debug, Serialize, Deserialize, Default)]
struct WorkspaceSettings {
    #[serde(default = "default_theme")]
    theme: String,
}

fn default_theme() -> String {
    "system".to_string()
}

fn valid_theme(s: &str) -> bool {
    matches!(s, "light" | "dark" | "system")
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let config = load_config(app)?;
    if config.workspace_path.is_empty() {
        return Err("workspace_path not set".to_string());
    }
    Ok(PathBuf::from(&config.workspace_path).join(".setting.json"))
}

fn load_settings(app: &AppHandle) -> Result<WorkspaceSettings, String> {
    let path = settings_path(app)?;
    if !path.exists() {
        return Ok(WorkspaceSettings::default());
    }
    let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut s: WorkspaceSettings = serde_json::from_str(&data).unwrap_or_default();
    if !valid_theme(&s.theme) {
        s.theme = "system".to_string();
    }
    Ok(s)
}

fn save_settings(app: &AppHandle, settings: &WorkspaceSettings) -> Result<(), String> {
    let path = settings_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let data = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_workspace_theme(app: AppHandle) -> Result<String, String> {
    Ok(load_settings(&app)?.theme)
}

#[tauri::command]
pub fn set_workspace_theme(app: AppHandle, theme: String) -> Result<(), String> {
    if !valid_theme(&theme) {
        return Err(format!("invalid theme: {}", theme));
    }
    let mut settings = load_settings(&app)?;
    settings.theme = theme;
    save_settings(&app, &settings)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_theme_is_system() {
        let s = WorkspaceSettings::default();
        assert_eq!(s.theme, "system");
    }

    #[test]
    fn valid_theme_accepts_known_values() {
        assert!(valid_theme("light"));
        assert!(valid_theme("dark"));
        assert!(valid_theme("system"));
        assert!(!valid_theme("auto"));
        assert!(!valid_theme(""));
    }

    #[test]
    fn deserialize_missing_theme_defaults_to_system() {
        let s: WorkspaceSettings = serde_json::from_str("{}").unwrap();
        assert_eq!(s.theme, "system");
    }

    #[test]
    fn deserialize_valid_theme() {
        let s: WorkspaceSettings = serde_json::from_str(r#"{"theme":"dark"}"#).unwrap();
        assert_eq!(s.theme, "dark");
    }
}
```

- [ ] **Step 2: Run unit tests**

```bash
cd src-tauri && cargo test workspace_settings
```

Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/workspace_settings.rs
git commit -m "feat(rust): add workspace_settings — read/write .setting.json"
```

---

### Task 2: Rust — register module and commands in main.rs

**Files:**
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: Add `mod workspace_settings;` after the existing mod declarations**

In `main.rs`, the mod list currently ends with `mod ai_processor;` (line 10). Add after it:

```rust
mod workspace_settings;
```

- [ ] **Step 2: Add the two new commands to the invoke_handler**

In `main.rs`, inside `tauri::generate_handler![...]`, add after `open_with_system,`:

```rust
            workspace_settings::get_workspace_theme,
            workspace_settings::set_workspace_theme,
```

- [ ] **Step 3: Build to confirm no compile errors**

```bash
cd src-tauri && cargo build 2>&1 | tail -5
```

Expected: `Finished` line, no errors.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/main.rs
git commit -m "feat(rust): register get/set_workspace_theme commands"
```

---

### Task 3: CSS — add explicit theme selectors

**Files:**
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Append the two selectors at the end of the file**

Add after the last line of `globals.css` (currently ends after the `@media (prefers-color-scheme: light)` hljs block at line 199):

```css

/* ── Manual theme overrides ─────────────────────────────────── */
/* Must appear AFTER the @media block — same specificity, last wins */

[data-theme="dark"] {
  --bg: #1c1c1e;
  --titlebar-bg: var(--bg);
  --divider: #3a3a3c;
  --month-label: #636366;
  --item-text: #e8e8e8;
  --item-meta: #636366;
  --duration-text: #48484a;
  --record-btn: #ff375f;
  --record-highlight: rgba(255, 55, 95, 0.06);
  --record-highlight-bar: rgba(255, 55, 95, 1);
  --item-icon-bg: #2c2c2e;
  --item-hover-bg: rgba(255, 255, 255, 0.05);
  --item-selected-bg: rgba(255, 255, 255, 0.08);
  --item-selected-text: #e8e8e8;
  --item-selected-meta: #636366;
  --sheet-bg: var(--bg);
  --sheet-handle: #48484a;
  --md-h1: #e8e8e8;
  --md-h2: #e0e0e0;
  --md-h3: #636366;
  --md-text: #c8c8c8;
  --md-strong: #e8e8e8;
  --md-em: #b0b0b0;
  --md-bullet: #636366;
  --md-code-bg: rgba(255,255,255,0.08);
  --md-code-text: #88b4e0;
  --md-pre-bg: #2c2c2e;
  --md-pre-text: #d4d4d4;
  --md-quote-bar: #48484a;
  --md-quote-text: #636366;
  --md-checkbox-border: #48484a;
  --md-checkbox-checked: #0a84ff;
  --md-checkbox-done-text: #48484a;
}

[data-theme="light"] {
  --bg: #ffffff;
  --titlebar-bg: var(--bg);
  --divider: #e5e5ea;
  --month-label: #8e8e93;
  --item-text: #1c1c1e;
  --item-meta: #aeaeb2;
  --duration-text: #c7c7cc;
  --record-btn: #ff3b30;
  --record-highlight: rgba(255, 59, 48, 0.06);
  --record-highlight-bar: rgba(255, 59, 48, 1);
  --item-icon-bg: #f2f2f7;
  --item-hover-bg: rgba(0, 0, 0, 0.04);
  --item-selected-bg: rgba(0, 0, 0, 0.06);
  --item-selected-text: #1c1c1e;
  --item-selected-meta: #aeaeb2;
  --sheet-bg: var(--bg);
  --sheet-handle: #d1d1d6;
  --md-h1: #1c1c1e;
  --md-h2: #1c1c1e;
  --md-h3: #636366;
  --md-text: #3a3a3c;
  --md-strong: #1c1c1e;
  --md-em: #3a3a3c;
  --md-bullet: #8e8e93;
  --md-code-bg: rgba(0,0,0,0.055);
  --md-code-text: #2d6a9f;
  --md-pre-bg: #f5f5f7;
  --md-pre-text: #2d2d2d;
  --md-quote-bar: #d1d1d6;
  --md-quote-text: #8e8e93;
  --md-checkbox-border: #c7c7cc;
  --md-checkbox-checked: #007aff;
  --md-checkbox-done-text: #aeaeb2;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles/globals.css
git commit -m "feat(css): add [data-theme] selectors for manual light/dark override"
```

---

### Task 4: ThemeToggle component

**Files:**
- Create: `src/components/ThemeToggle.tsx`

- [ ] **Step 1: Create the component**

```tsx
type Theme = 'light' | 'dark' | 'system'

interface ThemeToggleProps {
  theme: Theme
  onChange: (theme: Theme) => void
}

const SEGMENTS: { value: Theme; icon: string }[] = [
  { value: 'light', icon: '☀️' },
  { value: 'dark',  icon: '🌙' },
  { value: 'system', icon: '🖥️' },
]

export function ThemeToggle({ theme, onChange }: ThemeToggleProps) {
  return (
    <div
      style={{
        display: 'flex',
        border: '1px solid var(--divider)',
        borderRadius: 6,
        overflow: 'hidden',
        height: 22,
      }}
    >
      {SEGMENTS.map((seg, i) => (
        <button
          key={seg.value}
          onClick={() => onChange(seg.value)}
          style={{
            width: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            cursor: 'pointer',
            border: 'none',
            borderRight: i < SEGMENTS.length - 1 ? '1px solid var(--divider)' : 'none',
            background: theme === seg.value ? 'var(--item-selected-bg)' : 'transparent',
            opacity: theme === seg.value ? 1 : 0.45,
            padding: 0,
          }}
          title={seg.value}
        >
          {seg.icon}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ThemeToggle.tsx
git commit -m "feat(ui): add ThemeToggle three-segment component"
```

---

### Task 5: useTheme hook

**Files:**
- Create: `src/hooks/useTheme.ts`

- [ ] **Step 1: Create the hook**

```ts
import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

type Theme = 'light' | 'dark' | 'system'

function applyTheme(theme: Theme) {
  if (theme === 'system') {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  } else {
    document.documentElement.setAttribute('data-theme', theme)
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('system')

  useEffect(() => {
    invoke<string>('get_workspace_theme')
      .then(saved => {
        const t = (saved as Theme) ?? 'system'
        setThemeState(t)
        applyTheme(t)
      })
      .catch(() => applyTheme('system'))
  }, [])

  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  function setTheme(t: Theme) {
    setThemeState(t)
    applyTheme(t)
    invoke('set_workspace_theme', { theme: t }).catch(console.error)
  }

  return { theme, setTheme }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useTheme.ts
git commit -m "feat(hook): add useTheme — load/save/apply theme with system-follow"
```

---

### Task 6: Wire TitleBar

**Files:**
- Modify: `src/components/TitleBar.tsx`

- [ ] **Step 1: Replace TitleBar.tsx entirely**

```tsx
import { ThemeToggle } from './ThemeToggle'

type Theme = 'light' | 'dark' | 'system'

interface TitleBarProps {
  theme: Theme
  onThemeChange: (theme: Theme) => void
}

export function TitleBar({ theme, onThemeChange }: TitleBarProps) {
  return (
    <div
      data-tauri-drag-region
      style={{
        height: 36,
        background: 'var(--bg)',
        flexShrink: 0,
        paddingLeft: 70,
        paddingRight: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
      }}
    >
      <ThemeToggle theme={theme} onChange={onThemeChange} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TitleBar.tsx
git commit -m "feat(ui): wire ThemeToggle into TitleBar"
```

---

### Task 7: Wire App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add useTheme import**

At the top of `src/App.tsx`, after the existing imports, add:

```ts
import { useTheme } from './hooks/useTheme'
```

- [ ] **Step 2: Call useTheme inside App()**

Inside the `App` function body, after the existing hook calls (`useRecorder`, `useJournal`), add:

```ts
const { theme, setTheme } = useTheme()
```

- [ ] **Step 3: Update TitleBar usage**

Change the `<TitleBar />` call (currently line 97) to:

```tsx
<TitleBar theme={theme} onThemeChange={setTheme} />
```

- [ ] **Step 4: Build the app to confirm no TypeScript errors**

```bash
npm run build 2>&1 | tail -10
```

Expected: Build succeeds, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: integrate useTheme into App — theme toggle fully wired"
```

---

### Task 8: Manual smoke test

- [ ] **Step 1: Run the app**

```bash
npm run tauri dev
```

- [ ] **Step 2: Verify default state**

On first launch (no `.setting.json` yet): the 🖥️ segment should be highlighted. The app should follow the system appearance.

- [ ] **Step 3: Switch to dark**

Click 🌙. The app should immediately switch to dark mode. Check that `{workspace_path}/.setting.json` was created:

```bash
cat ~/Documents/journal/.setting.json
```

Expected output:
```json
{
  "theme": "dark"
}
```

- [ ] **Step 4: Switch to light**

Click ☀️. App switches to light even if system is in dark mode. `.setting.json` should now read `"light"`.

- [ ] **Step 5: Switch to system**

Click 🖥️. App follows system again. `.setting.json` should read `"system"`.

- [ ] **Step 6: Restart app**

Quit and relaunch. The last chosen theme should be restored on startup.

- [ ] **Step 7: Final commit if everything passes**

```bash
git log --oneline -8
```

All 7 feature commits should be visible.
