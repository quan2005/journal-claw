# Skill Plugins Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a skill plugin management section to the settings panel that scans project-level and global Claude Code skills, lists them with metadata, and provides enable/disable toggles (default: enabled).

**Architecture:** Rust backend scans `<project>/.claude/skills/` and `~/.claude/skills/` directories, parses YAML frontmatter from `SKILL.md` files, returns skill metadata. Disabled skills are stored as a `disabled_skills: Vec<String>` in the workspace `.setting.json`. Frontend replaces the placeholder `SectionPlugins` with a real skill list using toggle switches.

**Tech Stack:** Rust (serde, serde_yaml frontmatter parsing), React + TypeScript, Tauri IPC

---

### Task 1: Add Rust skill scanning and persistence

**Files:**
- Create: `src-tauri/src/skills.rs`
- Modify: `src-tauri/src/main.rs:1-2` (add `mod skills;`)
- Modify: `src-tauri/src/workspace_settings.rs` (add `disabled_skills` field)

- [ ] **Step 1: Add `disabled_skills` to WorkspaceSettings**

In `src-tauri/src/workspace_settings.rs`, add the field to the struct and expose get/set commands:

```rust
// In WorkspaceSettings struct, add:
#[serde(default)]
disabled_skills: Vec<String>,
```

Add two new Tauri commands at the bottom of the file:

```rust
#[tauri::command]
pub fn get_disabled_skills(app: AppHandle) -> Result<Vec<String>, String> {
    Ok(load_settings(&app)?.disabled_skills)
}

#[tauri::command]
pub fn set_disabled_skills(app: AppHandle, skills: Vec<String>) -> Result<(), String> {
    let mut settings = load_settings(&app)?;
    settings.disabled_skills = skills;
    save_settings(&app, &settings)
}
```

- [ ] **Step 2: Create `skills.rs` with skill scanning logic**

Create `src-tauri/src/skills.rs`:

```rust
use serde::Serialize;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize)]
pub struct SkillInfo {
    /// Unique ID: "project:<name>" or "global:<name>"
    pub id: String,
    /// Display name from frontmatter
    pub name: String,
    /// Description from frontmatter
    pub description: String,
    /// "project" or "global"
    pub scope: String,
    /// Directory name
    pub dir_name: String,
}

fn parse_skill_frontmatter(content: &str) -> Option<(String, String)> {
    let content = content.trim();
    if !content.starts_with("---") {
        return None;
    }
    let rest = &content[3..];
    let end = rest.find("---")?;
    let yaml_block = &rest[..end];

    let mut name = String::new();
    let mut description = String::new();

    for line in yaml_block.lines() {
        let line = line.trim();
        if let Some(val) = line.strip_prefix("name:") {
            name = val.trim().trim_matches('"').trim_matches('\'').to_string();
        } else if let Some(val) = line.strip_prefix("description:") {
            description = val.trim().trim_matches('"').trim_matches('\'').to_string();
        }
    }

    if name.is_empty() {
        return None;
    }

    Some((name, description))
}

fn scan_skills_dir(dir: &PathBuf, scope: &str) -> Vec<SkillInfo> {
    let mut skills = Vec::new();

    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return skills,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let skill_md = path.join("SKILL.md");
        if !skill_md.exists() {
            continue;
        }

        let dir_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        if dir_name.is_empty() {
            continue;
        }

        let content = match fs::read_to_string(&skill_md) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let (name, description) = match parse_skill_frontmatter(&content) {
            Some(pair) => pair,
            None => continue,
        };

        let id = format!("{}:{}", scope, dir_name);

        skills.push(SkillInfo {
            id,
            name,
            description,
            scope: scope.to_string(),
            dir_name,
        });
    }

    skills.sort_by(|a, b| a.name.cmp(&b.name));
    skills
}

#[tauri::command]
pub fn list_skills(app: tauri::AppHandle) -> Result<Vec<SkillInfo>, String> {
    let mut all_skills = Vec::new();

    // 1. Project skills: <workspace>/.claude/skills/
    let config = crate::config::load_config(&app)?;
    if !config.workspace_path.is_empty() {
        let project_skills_dir = PathBuf::from(&config.workspace_path)
            .join(".claude")
            .join("skills");
        all_skills.extend(scan_skills_dir(&project_skills_dir, "project"));
    }

    // 2. Global skills: ~/.claude/skills/
    if let Some(home) = dirs::home_dir() {
        let global_skills_dir = home.join(".claude").join("skills");
        all_skills.extend(scan_skills_dir(&global_skills_dir, "global"));
    }

    Ok(all_skills)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_valid_frontmatter() {
        let content = r#"---
name: ideate
description: "灵感探讨与设计咨询"
---

# Content here
"#;
        let (name, desc) = parse_skill_frontmatter(content).unwrap();
        assert_eq!(name, "ideate");
        assert_eq!(desc, "灵感探讨与设计咨询");
    }

    #[test]
    fn parse_no_frontmatter_returns_none() {
        assert!(parse_skill_frontmatter("# Just a heading").is_none());
    }

    #[test]
    fn parse_missing_name_returns_none() {
        let content = "---\ndescription: test\n---\n";
        assert!(parse_skill_frontmatter(content).is_none());
    }
}
```

- [ ] **Step 3: Register new commands in `main.rs`**

Add `mod skills;` to the module declarations at the top of `main.rs`.

Add these three commands to the `invoke_handler![]` block:

```rust
skills::list_skills,
workspace_settings::get_disabled_skills,
workspace_settings::set_disabled_skills,
```

- [ ] **Step 4: Check `dirs` crate is available in Cargo.toml**

Run: `grep 'dirs' src-tauri/Cargo.toml`

If not present, add `dirs = "5"` to `[dependencies]`. (The `dirs` crate provides `home_dir()`.)

- [ ] **Step 5: Run Rust tests**

Run: `cd src-tauri && cargo test`
Expected: All tests pass, including the new `skills::tests` and existing `workspace_settings::tests`.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/skills.rs src-tauri/src/main.rs src-tauri/src/workspace_settings.rs src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "feat: add skill scanning and disabled_skills persistence"
```

---

### Task 2: Add frontend IPC wrappers and types

**Files:**
- Modify: `src/lib/tauri.ts` (add skill types + invoke wrappers)

- [ ] **Step 1: Add SkillInfo type and IPC wrappers**

Append to `src/lib/tauri.ts`:

```typescript
// Skills (技能插件)
export interface SkillInfo {
  id: string
  name: string
  description: string
  scope: 'project' | 'global'
  dir_name: string
}

export const listSkills = (): Promise<SkillInfo[]> =>
  invoke<SkillInfo[]>('list_skills')

export const getDisabledSkills = (): Promise<string[]> =>
  invoke<string[]>('get_disabled_skills')

export const setDisabledSkills = (skills: string[]): Promise<void> =>
  invoke<void>('set_disabled_skills', { skills })
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/tauri.ts
git commit -m "feat: add skill IPC wrappers and SkillInfo type"
```

---

### Task 3: Add i18n keys for skill plugin section

**Files:**
- Modify: `src/locales/en.ts`
- Modify: `src/locales/zh.ts`

- [ ] **Step 1: Add English locale keys**

Replace the existing `// Settings: Plugins` block in `src/locales/en.ts`:

```typescript
// Settings: Plugins (skills)
pluginsSection: 'Skill Plugins',
pluginScopeProject: 'Project',
pluginScopeGlobal: 'Global',
pluginEnabled: 'Enabled',
pluginDisabled: 'Disabled',
noSkillsFound: 'No skills found',
noSkillsHint: 'Add skills to .claude/skills/ in your project or ~/.claude/skills/ globally',
enableAll: 'Enable all',
disableAll: 'Disable all',
```

Remove the now-unused keys: `pluginScheduledSort`, `pluginScheduledSortDesc`, `pluginVisualizer`, `pluginVisualizerDesc`, `pluginMarketSoon`, `morePlugins`.

- [ ] **Step 2: Add Chinese locale keys**

Replace the existing `// Settings: Plugins` block in `src/locales/zh.ts`:

```typescript
// Settings: Plugins (skills)
pluginsSection: '技能插件',
pluginScopeProject: '项目',
pluginScopeGlobal: '全局',
pluginEnabled: '已启用',
pluginDisabled: '已禁用',
noSkillsFound: '未发现技能插件',
noSkillsHint: '在项目 .claude/skills/ 或全局 ~/.claude/skills/ 目录中添加技能',
enableAll: '全部启用',
disableAll: '全部禁用',
```

Remove the same unused keys as in en.ts.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No type errors (Strings type auto-inferred from en.ts, zh.ts must match).

- [ ] **Step 4: Commit**

```bash
git add src/locales/en.ts src/locales/zh.ts
git commit -m "feat: add i18n keys for skill plugin settings"
```

---

### Task 4: Rewrite SectionPlugins component

**Files:**
- Modify: `src/settings/components/SectionPlugins.tsx`

- [ ] **Step 1: Rewrite SectionPlugins with real skill list and toggles**

Replace the entire content of `SectionPlugins.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react'
import { listSkills, getDisabledSkills, setDisabledSkills } from '../../lib/tauri'
import type { SkillInfo } from '../../lib/tauri'
import { useTranslation } from '../../contexts/I18nContext'

const sectionStyle: React.CSSProperties = { padding: '28px 28px 180px', borderBottom: '1px solid var(--divider)' }

export default function SectionPlugins() {
  const { t } = useTranslation()
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [disabledSet, setDisabledSet] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([listSkills(), getDisabledSkills()])
      .then(([skillList, disabled]) => {
        setSkills(skillList)
        setDisabledSet(new Set(disabled))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const toggleSkill = useCallback(async (id: string) => {
    const next = new Set(disabledSet)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setDisabledSet(next)
    try {
      await setDisabledSkills([...next])
    } catch (e) {
      console.error('[SectionPlugins] save failed', e)
    }
  }, [disabledSet])

  const handleBatchToggle = useCallback(async (disable: boolean) => {
    const next = disable ? new Set(skills.map(s => s.id)) : new Set<string>()
    setDisabledSet(next)
    try {
      await setDisabledSkills([...next])
    } catch (e) {
      console.error('[SectionPlugins] batch save failed', e)
    }
  }, [skills])

  if (loading) {
    return (
      <div style={sectionStyle}>
        <div style={{ fontSize: 13, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, fontWeight: 500 }}>{t('pluginsSection')}</div>
      </div>
    )
  }

  const projectSkills = skills.filter(s => s.scope === 'project')
  const globalSkills = skills.filter(s => s.scope === 'global')
  const allEnabled = skills.length > 0 && disabledSet.size === 0
  const allDisabled = skills.length > 0 && disabledSet.size === skills.length

  return (
    <div style={sectionStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>{t('pluginsSection')}</div>
        {skills.length > 0 && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => handleBatchToggle(false)}
              disabled={allEnabled}
              style={{
                padding: '4px 10px', borderRadius: 5, border: 'none', cursor: allEnabled ? 'default' : 'pointer',
                fontSize: 11, fontWeight: 500,
                background: allEnabled ? 'transparent' : 'rgba(200,147,58,0.12)',
                color: allEnabled ? 'var(--duration-text)' : 'var(--record-btn)',
                opacity: allEnabled ? 0.4 : 1,
              }}
            >{t('enableAll')}</button>
            <button
              onClick={() => handleBatchToggle(true)}
              disabled={allDisabled}
              style={{
                padding: '4px 10px', borderRadius: 5, border: 'none', cursor: allDisabled ? 'default' : 'pointer',
                fontSize: 11, fontWeight: 500,
                background: allDisabled ? 'transparent' : 'rgba(200,210,220,0.06)',
                color: 'var(--item-meta)',
                opacity: allDisabled ? 0.4 : 1,
              }}
            >{t('disableAll')}</button>
          </div>
        )}
      </div>

      {skills.length === 0 ? (
        <div style={{
          background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
          borderRadius: 8, padding: '24px 14px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 14, color: 'var(--item-meta)', marginBottom: 4 }}>{t('noSkillsFound')}</div>
          <div style={{ fontSize: 12, color: 'var(--duration-text)' }}>{t('noSkillsHint')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'section-fadein 160ms ease-out both' }}>
          {projectSkills.length > 0 && (
            <SkillGroup label={t('pluginScopeProject')} skills={projectSkills} disabledSet={disabledSet} onToggle={toggleSkill} />
          )}
          {globalSkills.length > 0 && (
            <SkillGroup label={t('pluginScopeGlobal')} skills={globalSkills} disabledSet={disabledSet} onToggle={toggleSkill} />
          )}
        </div>
      )}
    </div>
  )
}

function SkillGroup({ label, skills, disabledSet, onToggle }: {
  label: string
  skills: SkillInfo[]
  disabledSet: Set<string>
  onToggle: (id: string) => void
}) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--duration-text)', marginBottom: 8, fontWeight: 500 }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {skills.map(skill => {
          const enabled = !disabledSet.has(skill.id)
          return (
            <div key={skill.id} style={{
              background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
              borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12,
              opacity: enabled ? 1 : 0.5,
              transition: 'opacity 200ms ease-out',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--item-text)', marginBottom: 2 }}>{skill.name}</div>
                <div style={{
                  fontSize: 11, color: 'var(--duration-text)', lineHeight: 1.4,
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                }}>{skill.description}</div>
              </div>
              {/* Toggle */}
              <button
                onClick={() => onToggle(skill.id)}
                style={{
                  width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: enabled ? 'var(--record-btn)' : 'var(--divider)',
                  position: 'relative', flexShrink: 0, padding: 0,
                  transition: 'background 200ms ease-out',
                }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 2,
                  left: enabled ? 18 : 2,
                  transition: 'left 200ms ease-out',
                }} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/yanwu/Projects/github/journal && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/settings/components/SectionPlugins.tsx
git commit -m "feat: rewrite SectionPlugins with real skill list and toggles"
```

---

### Task 5: Build verification and manual test

- [ ] **Step 1: Run Rust build**

Run: `cd /Users/yanwu/Projects/github/journal/src-tauri && cargo build`
Expected: Compiles without errors.

- [ ] **Step 2: Run frontend build**

Run: `cd /Users/yanwu/Projects/github/journal && npm run build`
Expected: Builds without errors.

- [ ] **Step 3: Run all tests**

Run: `cd /Users/yanwu/Projects/github/journal/src-tauri && cargo test`
Run: `cd /Users/yanwu/Projects/github/journal && npm test -- --run`
Expected: All tests pass.

- [ ] **Step 4: Manual test**

Start the app with `npm run tauri dev`. Open Settings → 技能插件. Verify:
1. Project skills (ideate, release) appear under "项目" group
2. Global skills (7 items) appear under "全局" group
3. All toggles default to ON (enabled)
4. Toggling a skill OFF dims the row and persists after reopening settings
5. "全部启用" / "全部禁用" buttons work correctly
6. Light and dark themes both render correctly

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: skill plugin settings adjustments"
```
