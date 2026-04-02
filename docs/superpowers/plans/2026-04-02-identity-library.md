# Identity Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a unified identity library that merges people profiles with speaker voiceprints, stored as markdown files in `workspace/identity/`.

**Architecture:** New `identity.rs` Rust module owns identity CRUD and wraps `speaker_profiles.rs` (which moves its JSON storage to `workspace/identity/raw/`). Frontend replaces `SoulView` with `IdentityView` — a left-list + right-detail layout showing Soul (pinned), user self (pinned), and regular identities. Workspace scripts (`identity-create`, `recent-summaries`) enable AI to create and discover identities.

**Tech Stack:** Rust (Tauri v2), React + TypeScript, bash scripts

---

## File Map

### Create
- `src-tauri/src/identity.rs` — IdentityEntry struct, CRUD, filename parsing, list/create/delete/merge commands
- `src/components/IdentityView.tsx` — main identity library view (list + detail)
- `src/components/IdentityList.tsx` — left sidebar list of identities with pinned section
- `src/components/IdentityDetail.tsx` — right detail panel for identity markdown + merge UI
- `src/components/MergeIdentityDialog.tsx` — merge target picker + mode selector dialog
- `src/hooks/useIdentity.ts` — hook to load identities, listen for updates
- `src-tauri/resources/workspace-template/.claude/scripts/identity-create` — bash script for AI to create identity files

### Modify
- `src-tauri/src/main.rs` — add `mod identity`, register new Tauri commands
- `src-tauri/src/speaker_profiles.rs` — change `profiles_path()` to use workspace, add `create_identity` call on new speaker registration
- `src-tauri/src/ai_processor.rs` — add `SCRIPT_IDENTITY_CREATE` const, write script in `ensure_workspace_dot_claude()`
- `src-tauri/resources/workspace-template/.claude/scripts/recent-summaries` — append identity summaries section
- `src-tauri/resources/workspace-template/.claude/CLAUDE.md` — add identity directory docs
- `src/types.ts` — add `IdentityEntry`, `MergeMode` types
- `src/lib/tauri.ts` — add identity IPC wrappers
- `src/App.tsx` — replace `'soul'` view with `'identity'`, swap `SoulView` for `IdentityView`
- `src/settings/SettingsLayout.tsx` — remove `SectionSpeakers` import and section
- `src/settings/navigation.ts` — remove `'speakers'` from NavId and ALL_NAV_IDS

### Delete
- `src/settings/components/SectionSpeakers.tsx` — functionality moves to IdentityView

---

### Task 1: Rust identity.rs — data types and filename parsing

**Files:**
- Create: `src-tauri/src/identity.rs`

- [ ] **Step 1: Write unit tests for filename parsing**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_identity_filename_standard() {
        let r = parse_identity_filename("广州-张三.md");
        assert_eq!(r, Some(("广州".to_string(), "张三".to_string())));
    }

    #[test]
    fn parse_identity_filename_company() {
        let r = parse_identity_filename("趣丸-王五.md");
        assert_eq!(r, Some(("趣丸".to_string(), "王五".to_string())));
    }

    #[test]
    fn parse_identity_filename_unknown() {
        let r = parse_identity_filename("未知-说话人1.md");
        assert_eq!(r, Some(("未知".to_string(), "说话人1".to_string())));
    }

    #[test]
    fn parse_identity_filename_no_dash() {
        assert_eq!(parse_identity_filename("README.md"), None);
    }

    #[test]
    fn parse_identity_filename_not_md() {
        assert_eq!(parse_identity_filename("广州-张三.txt"), None);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd src-tauri && cargo test identity::tests --no-run 2>&1 | head -20`
Expected: compilation error — `identity` module doesn't exist yet

- [ ] **Step 3: Implement identity.rs with types and parsing**

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdentityEntry {
    pub filename: String,
    pub path: String,
    pub name: String,
    pub region: String,
    pub summary: String,
    pub tags: Vec<String>,
    pub speaker_id: String,
    pub mtime_secs: i64,
}

#[derive(Debug, Deserialize, Default)]
struct IdentityFrontMatter {
    #[serde(default)]
    summary: String,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    speaker_id: String,
}

pub fn parse_identity_filename(filename: &str) -> Option<(String, String)> {
    let stem = filename.strip_suffix(".md")?;
    let dash_pos = stem.find('-')?;
    let region = &stem[..dash_pos];
    let name = &stem[dash_pos + 1..];
    if region.is_empty() || name.is_empty() {
        return None;
    }
    Some((region.to_string(), name.to_string()))
}
```

- [ ] **Step 4: Add `mod identity;` to main.rs**

In `src-tauri/src/main.rs`, add after `mod journal;`:
```rust
mod identity;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd src-tauri && cargo test identity::tests -- --nocapture`
Expected: all 5 tests pass

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/identity.rs src-tauri/src/main.rs
git commit -m "$(cat <<'EOF'
feat: add identity.rs with IdentityEntry type and filename parser

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Rust identity.rs — list, create, CRUD commands

**Files:**
- Modify: `src-tauri/src/identity.rs`
- Modify: `src-tauri/src/main.rs:212-268` (invoke_handler)

- [ ] **Step 1: Write test for create_identity and list**

Add to `identity::tests`:

```rust
#[test]
fn create_and_list_identity() {
    let tmp = std::env::temp_dir().join(format!(
        "identity_test_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let ws = tmp.to_str().unwrap();
    let path = create_identity_file(ws, "广州", "张三", "speaker-uuid-1").unwrap();
    assert!(std::path::Path::new(&path).exists());
    let content = std::fs::read_to_string(&path).unwrap();
    assert!(content.contains("speaker_id: speaker-uuid-1"));
    let entries = list_identity_entries(ws).unwrap();
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].name, "张三");
    assert_eq!(entries[0].region, "广州");
    assert_eq!(entries[0].speaker_id, "speaker-uuid-1");
    std::fs::remove_dir_all(&tmp).ok();
}

#[test]
fn create_identity_no_overwrite() {
    let tmp = std::env::temp_dir().join(format!(
        "identity_nooverwrite_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let ws = tmp.to_str().unwrap();
    let path1 = create_identity_file(ws, "广州", "张三", "id1").unwrap();
    std::fs::write(&path1, "custom").unwrap();
    let path2 = create_identity_file(ws, "广州", "张三", "id1").unwrap();
    assert_eq!(path1, path2);
    assert_eq!(std::fs::read_to_string(&path1).unwrap(), "custom");
    std::fs::remove_dir_all(&tmp).ok();
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd src-tauri && cargo test identity::tests -- --nocapture 2>&1 | tail -5`
Expected: FAIL — `create_identity_file` and `list_identity_entries` not found

- [ ] **Step 3: Implement identity directory helpers**

Add to `identity.rs`:

```rust
use gray_matter::{engine::YAML, Matter};

fn identity_dir(workspace: &str) -> std::path::PathBuf {
    std::path::PathBuf::from(workspace).join("identity")
}

fn identity_raw_dir(workspace: &str) -> std::path::PathBuf {
    identity_dir(workspace).join("raw")
}

fn ensure_identity_dirs(workspace: &str) -> Result<(), String> {
    let raw = identity_raw_dir(workspace);
    std::fs::create_dir_all(&raw)
        .map_err(|e| format!("创建 identity 目录失败: {}", e))
}
```

- [ ] **Step 4: Implement create_identity_file**

```rust
pub fn create_identity_file(
    workspace: &str,
    region: &str,
    name: &str,
    speaker_id: &str,
) -> Result<String, String> {
    ensure_identity_dirs(workspace)?;
    let filename = format!("{}-{}.md", region, name);
    let path = identity_dir(workspace).join(&filename);
    if path.exists() {
        return Ok(path.to_string_lossy().to_string());
    }
    let content = format!(
        "---\nsummary: \"\"\ntags: []\nspeaker_id: {}\n---\n\n# {}\n",
        speaker_id, name
    );
    std::fs::write(&path, content)
        .map_err(|e| format!("写入身份文件失败: {}", e))?;
    Ok(path.to_string_lossy().to_string())
}
```

- [ ] **Step 5: Implement list_identity_entries**

```rust
pub fn list_identity_entries(workspace: &str) -> Result<Vec<IdentityEntry>, String> {
    let dir = identity_dir(workspace);
    if !dir.exists() {
        return Ok(vec![]);
    }
    let read_dir = std::fs::read_dir(&dir)
        .map_err(|e| format!("读取 identity 目录失败: {}", e))?;
    let matter = Matter::<YAML>::new();
    let mut entries: Vec<IdentityEntry> = vec![];

    for entry in read_dir.flatten() {
        let path = entry.path();
        if path.is_dir() { continue; }
        let fname = path.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let (region, name) = match parse_identity_filename(&fname) {
            Some(v) => v,
            None => continue,
        };
        let content = std::fs::read_to_string(&path).unwrap_or_default();
        let fm: IdentityFrontMatter = matter
            .parse_with_struct::<IdentityFrontMatter>(&content)
            .map(|p| p.data)
            .unwrap_or_default();
        let mtime = entry.metadata().ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);

        entries.push(IdentityEntry {
            filename: fname,
            path: path.to_string_lossy().to_string(),
            name,
            region,
            summary: fm.summary,
            tags: fm.tags,
            speaker_id: fm.speaker_id,
            mtime_secs: mtime,
        });
    }
    entries.sort_by(|a, b| b.mtime_secs.cmp(&a.mtime_secs));
    Ok(entries)
}
```

- [ ] **Step 6: Add Tauri commands**

```rust
#[tauri::command]
pub fn list_identities(app: tauri::AppHandle) -> Result<Vec<IdentityEntry>, String> {
    let cfg = crate::config::load_config(&app)?;
    if cfg.workspace_path.is_empty() { return Ok(vec![]); }
    list_identity_entries(&cfg.workspace_path)
}

#[tauri::command]
pub fn get_identity_content(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_identity_content(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_identity(path: String) -> Result<(), String> {
    // Refuse to delete pinned identities (filename starts with "我-")
    let fname = std::path::Path::new(&path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy();
    if fname.starts_with("我-") {
        return Err("不可删除用户自身身份".to_string());
    }
    std::fs::remove_file(&path).map_err(|e| e.to_string())
}
```

- [ ] **Step 7: Register commands in main.rs invoke_handler**

Add these lines inside `invoke_handler![]` in `main.rs`, after the `speaker_profiles::` block:

```rust
identity::list_identities,
identity::get_identity_content,
identity::save_identity_content,
identity::delete_identity,
```

- [ ] **Step 8: Run tests**

Run: `cd src-tauri && cargo test identity::tests -- --nocapture`
Expected: all tests pass

- [ ] **Step 9: Commit**

```bash
git add src-tauri/src/identity.rs src-tauri/src/main.rs
git commit -m "$(cat <<'EOF'
feat: identity CRUD — list, create, read, save, delete commands

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Move speaker_profiles.json to workspace/identity/raw/

**Files:**
- Modify: `src-tauri/src/speaker_profiles.rs:58-63` (profiles_path)
- Modify: `src-tauri/src/identity.rs` (add ensure_identity_dirs export)

- [ ] **Step 1: Write test for new profiles path**

Add to `speaker_profiles::tests`:

```rust
#[test]
fn profiles_path_uses_workspace_identity_raw() {
    let path = workspace_profiles_path("/tmp/test-ws");
    assert_eq!(
        path,
        std::path::PathBuf::from("/tmp/test-ws/identity/raw/speaker_profiles.json")
    );
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src-tauri && cargo test speaker_profiles::tests::profiles_path_uses_workspace -- --nocapture 2>&1 | tail -5`
Expected: FAIL — `workspace_profiles_path` not found

- [ ] **Step 3: Add workspace_profiles_path function**

In `speaker_profiles.rs`, add a new function that takes workspace path instead of AppHandle:

```rust
pub fn workspace_profiles_path(workspace: &str) -> std::path::PathBuf {
    std::path::PathBuf::from(workspace)
        .join("identity")
        .join("raw")
        .join(PROFILES_FILE)
}
```

- [ ] **Step 4: Update load_profiles and save_profiles to accept workspace path**

Change `load_profiles` signature to take `workspace: &str` instead of `app: &AppHandle`. Update `save_profiles` similarly. Update all callers (`identify_or_register_all`, Tauri commands) to pass workspace path from config.

The Tauri commands (`get_speaker_profiles`, `update_speaker_name`, `delete_speaker_profile`, `merge_speaker_profiles`) now need to load config first to get workspace_path, then pass it to load/save.

- [ ] **Step 5: Run all speaker_profiles tests**

Run: `cd src-tauri && cargo test speaker_profiles::tests -- --nocapture`
Expected: all tests pass

- [ ] **Step 6: Run full cargo test**

Run: `cd src-tauri && cargo test 2>&1 | tail -10`
Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/speaker_profiles.rs src-tauri/src/identity.rs
git commit -m "$(cat <<'EOF'
refactor: move speaker_profiles.json storage to workspace/identity/raw/

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Auto-create identity on new speaker registration

**Files:**
- Modify: `src-tauri/src/speaker_profiles.rs` (identify_or_register_all)

- [ ] **Step 1: Update identify_or_register_all signature**

Add `workspace: &str` parameter to `identify_or_register_all()`. When a new speaker profile is created (the "No match" branch), call `crate::identity::create_identity_file(workspace, "未知", &auto_name, &new_profile.id)`.

```rust
pub fn identify_or_register_all(
    workspace: &str,
    speaker_embeddings: &HashMap<String, Vec<f32>>,
) -> HashMap<String, String> {
    // ... existing matching logic ...

    // In the "No match — register new profile" branch, after creating new_profile:
    if let Err(e) = crate::identity::create_identity_file(
        workspace, "未知", &new_profile.auto_name, &new_profile.id
    ) {
        eprintln!("[speaker_profiles] Failed to create identity file: {}", e);
    }

    // ... rest unchanged ...
}
```

- [ ] **Step 2: Update all callers of identify_or_register_all**

Search for callers (likely in `transcription.rs` or `audio_pipeline.rs`) and pass workspace path.

- [ ] **Step 3: Run cargo test**

Run: `cd src-tauri && cargo test 2>&1 | tail -10`
Expected: all tests pass (compilation + existing tests)

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/speaker_profiles.rs
git commit -m "$(cat <<'EOF'
feat: auto-create identity markdown when new speaker is registered

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Merge identity command

**Files:**
- Modify: `src-tauri/src/identity.rs`
- Modify: `src-tauri/src/main.rs` (register command)

- [ ] **Step 1: Write test for voice_only merge**

Add to `identity::tests`:

```rust
#[test]
fn merge_identity_voice_only_deletes_source() {
    let tmp = std::env::temp_dir().join(format!(
        "identity_merge_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let ws = tmp.to_str().unwrap();
    let src = create_identity_file(ws, "未知", "说话人1", "spk-1").unwrap();
    let tgt = create_identity_file(ws, "广州", "张三", "spk-2").unwrap();
    merge_identity_files(ws, &src, &tgt, "voice_only").unwrap();
    assert!(!std::path::Path::new(&src).exists());
    assert!(std::path::Path::new(&tgt).exists());
    std::fs::remove_dir_all(&tmp).ok();
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src-tauri && cargo test identity::tests::merge_identity -- --nocapture 2>&1 | tail -5`
Expected: FAIL — `merge_identity_files` not found

- [ ] **Step 3: Implement merge_identity_files**

```rust
pub fn merge_identity_files(
    workspace: &str,
    source_path: &str,
    target_path: &str,
    mode: &str,
) -> Result<(), String> {
    // Read source frontmatter to get speaker_id
    let source_content = std::fs::read_to_string(source_path)
        .map_err(|e| format!("读取源文件失败: {}", e))?;
    let matter = Matter::<YAML>::new();
    let source_fm: IdentityFrontMatter = matter
        .parse_with_struct::<IdentityFrontMatter>(&source_content)
        .map(|p| p.data)
        .unwrap_or_default();
    let target_content = std::fs::read_to_string(target_path)
        .map_err(|e| format!("读取目标文件失败: {}", e))?;
    let target_fm: IdentityFrontMatter = matter
        .parse_with_struct::<IdentityFrontMatter>(&target_content)
        .map(|p| p.data)
        .unwrap_or_default();

    // Merge speaker profiles if both have speaker_ids
    if !source_fm.speaker_id.is_empty() && !target_fm.speaker_id.is_empty() {
        let mut profiles = crate::speaker_profiles::load_profiles_from_workspace(workspace);
        crate::speaker_profiles::merge_profiles_by_id(
            &mut profiles, &source_fm.speaker_id, &target_fm.speaker_id
        );
        crate::speaker_profiles::save_profiles_to_workspace(workspace, &profiles)?;

        // Rename audio clips from source speaker_id to target speaker_id
        rename_audio_clips(workspace, &source_fm.speaker_id, &target_fm.speaker_id)?;
    }

    if mode == "full" {
        // For "full" merge, content merging is handled by AI engine on the frontend side.
        // The Rust command just returns the source content for the frontend to pass to AI.
        // After AI processes, frontend calls save_identity_content on target, then delete source.
        return Ok(());
    }

    // voice_only: delete source file
    std::fs::remove_file(source_path)
        .map_err(|e| format!("删除源文件失败: {}", e))?;
    Ok(())
}

fn rename_audio_clips(
    workspace: &str,
    source_speaker_id: &str,
    target_speaker_id: &str,
) -> Result<(), String> {
    let raw = identity_raw_dir(workspace);
    if !raw.exists() { return Ok(()); }
    let prefix = format!("{}_", source_speaker_id);
    let entries = std::fs::read_dir(&raw).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let fname = entry.file_name().to_string_lossy().to_string();
        if fname.starts_with(&prefix) {
            let new_name = fname.replacen(source_speaker_id, target_speaker_id, 1);
            let new_path = raw.join(&new_name);
            std::fs::rename(entry.path(), new_path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
```

- [ ] **Step 4: Add Tauri command**

```rust
#[tauri::command]
pub fn merge_identity(
    app: tauri::AppHandle,
    source_path: String,
    target_path: String,
    mode: String,
) -> Result<(), String> {
    let cfg = crate::config::load_config(&app)?;
    merge_identity_files(&cfg.workspace_path, &source_path, &target_path, &mode)
}
```

- [ ] **Step 5: Register in main.rs**

Add to `invoke_handler![]`:
```rust
identity::merge_identity,
```

- [ ] **Step 6: Run tests**

Run: `cd src-tauri && cargo test identity::tests -- --nocapture`
Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/identity.rs src-tauri/src/speaker_profiles.rs src-tauri/src/main.rs
git commit -m "$(cat <<'EOF'
feat: add merge_identity command with voice_only and full modes

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Frontend types and IPC wrappers

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: Add IdentityEntry and MergeMode types**

In `src/types.ts`, add at the end:

```typescript
// ── 身份库 ───────────────────────────────────────────────
export interface IdentityEntry {
  filename: string
  path: string
  name: string
  region: string
  summary: string
  tags: string[]
  speaker_id: string
  mtime_secs: number
}

export type MergeMode = 'voice_only' | 'full'
```

- [ ] **Step 2: Add IPC wrappers in tauri.ts**

In `src/lib/tauri.ts`, add the import for `IdentityEntry` and `MergeMode`, then add:

```typescript
// Identity (身份库)
export const listIdentities = (): Promise<IdentityEntry[]> =>
  invoke<IdentityEntry[]>('list_identities')

export const getIdentityContent = (path: string): Promise<string> =>
  invoke<string>('get_identity_content', { path })

export const saveIdentityContent = (path: string, content: string): Promise<void> =>
  invoke<void>('save_identity_content', { path, content })

export const deleteIdentity = (path: string): Promise<void> =>
  invoke<void>('delete_identity', { path })

export const mergeIdentity = (sourcePath: string, targetPath: string, mode: MergeMode): Promise<void> =>
  invoke<void>('merge_identity', { sourcePath, targetPath, mode })
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | tail -10`
Expected: build succeeds (types are defined but not yet used)

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/lib/tauri.ts
git commit -m "$(cat <<'EOF'
feat: add IdentityEntry types and Tauri IPC wrappers

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: useIdentity hook

**Files:**
- Create: `src/hooks/useIdentity.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useState, useEffect, useCallback, useRef } from 'react'
import { listIdentities } from '../lib/tauri'
import type { IdentityEntry } from '../types'

export function useIdentity() {
  const [identities, setIdentities] = useState<IdentityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const refreshing = useRef(false)

  const refresh = useCallback(async () => {
    if (refreshing.current) return
    refreshing.current = true
    try {
      const result = await listIdentities()
      setIdentities(prev => {
        if (prev.length !== result.length) return result
        for (let i = 0; i < prev.length; i++) {
          if (prev[i].path !== result[i].path || prev[i].mtime_secs !== result[i].mtime_secs) return result
        }
        return prev
      })
    } catch (e) {
      console.error('Failed to load identities:', e)
    } finally {
      setLoading(false)
      refreshing.current = false
    }
  }, [])

  useEffect(() => {
    refresh()
    const poll = setInterval(refresh, 3000)
    return () => clearInterval(poll)
  }, [refresh])

  return { identities, loading, refresh }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useIdentity.ts
git commit -m "$(cat <<'EOF'
feat: add useIdentity hook for loading identity entries

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: IdentityList component

**Files:**
- Create: `src/components/IdentityList.tsx`

- [ ] **Step 1: Create IdentityList**

This component renders the left sidebar: pinned Soul card at top, pinned user-self card, then regular identities sorted by mtime. Follow the same visual patterns as `JournalList` — item hover, selected state, summary text.

```typescript
import { memo } from 'react'
import type { IdentityEntry } from '../types'

interface IdentityListProps {
  identities: IdentityEntry[]
  loading: boolean
  selectedPath: string | null
  onSelect: (entry: IdentityEntry) => void
  onSelectSoul: () => void
  soulSelected: boolean
}

export const IdentityList = memo(function IdentityList({
  identities, loading, selectedPath, onSelect, onSelectSoul, soulSelected,
}: IdentityListProps) {
  // Separate pinned (我-*) from regular
  const selfEntry = identities.find(e => e.filename.startsWith('我-'))
  const regular = identities.filter(e => !e.filename.startsWith('我-'))

  const itemStyle = (selected: boolean): React.CSSProperties => ({
    padding: '10px 16px',
    cursor: 'pointer',
    background: selected ? 'var(--item-selected-bg)' : 'transparent',
    borderBottom: '0.5px solid var(--divider)',
  })

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {/* Soul card — pinned */}
      <div onClick={onSelectSoul} style={itemStyle(soulSelected)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6,
            background: 'rgba(90,154,106,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--soul-color, #5a9a6a)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4"/>
              <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 12 0"/>
              <path d="M12 12a2 2 0 0 0-2 2c0 2 1 4 1 6"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--item-text)' }}>AI 人格</div>
            <div style={{ fontSize: 10, color: 'var(--item-meta)', marginTop: 1 }}>谨迹的角色与工作偏好</div>
          </div>
        </div>
      </div>

      {/* Self card — pinned */}
      {selfEntry && (
        <div onClick={() => onSelect(selfEntry)} style={itemStyle(selectedPath === selfEntry.path)}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--item-text)' }}>
            {selfEntry.region}-{selfEntry.name}
          </div>
          {selfEntry.summary && (
            <div style={{ fontSize: 11, color: 'var(--item-meta)', marginTop: 2, lineHeight: 1.5 }}>
              {selfEntry.summary}
            </div>
          )}
        </div>
      )}

      {/* Divider */}
      {(selfEntry || true) && (
        <div style={{ height: 6, background: 'var(--bg)' }} />
      )}

      {/* Regular identities */}
      {loading && regular.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', fontSize: 11, color: 'var(--item-meta)' }}>
          加载中…
        </div>
      ) : regular.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', fontSize: 11, color: 'var(--item-meta)' }}>
          暂无身份档案
        </div>
      ) : (
        regular.map(entry => (
          <div
            key={entry.path}
            onClick={() => onSelect(entry)}
            style={itemStyle(selectedPath === entry.path)}
            onMouseEnter={e => {
              if (selectedPath !== entry.path)
                (e.currentTarget as HTMLDivElement).style.background = 'var(--item-hover-bg)'
            }}
            onMouseLeave={e => {
              if (selectedPath !== entry.path)
                (e.currentTarget as HTMLDivElement).style.background = 'transparent'
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--item-text)' }}>
              {entry.region}-{entry.name}
            </div>
            {entry.summary && (
              <div style={{
                fontSize: 11, color: 'var(--item-meta)', marginTop: 2,
                lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              }}>
                {entry.summary}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
})
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/IdentityList.tsx
git commit -m "$(cat <<'EOF'
feat: add IdentityList component with pinned Soul and self cards

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: IdentityDetail component

**Files:**
- Create: `src/components/IdentityDetail.tsx`

- [ ] **Step 1: Create IdentityDetail**

Renders the right panel when an identity is selected. Reuses markdown rendering patterns from `DetailPanel.tsx`. Shows summary, tags, speaker info, and a "合并到..." button.

```typescript
import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getIdentityContent, saveIdentityContent } from '../lib/tauri'
import { pickDisplayTags } from '../lib/tags'
import { Spinner } from './Spinner'
import type { IdentityEntry } from '../types'

interface IdentityDetailProps {
  entry: IdentityEntry | null
  onMerge: (entry: IdentityEntry) => void
  onDelete: (entry: IdentityEntry) => void
}

export function IdentityDetail({ entry, onMerge, onDelete }: IdentityDetailProps) {
  const [content, setContent] = useState<string | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!entry) { setContent(null); return }
    setContent(null)
    getIdentityContent(entry.path).then(setContent)
  }, [entry?.path, entry?.mtime_secs])

  if (!entry) {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--detail-bg)', color: 'var(--item-meta)', fontSize: 12,
      }}>
        选择一个身份查看详情
      </div>
    )
  }

  const displayTags = pickDisplayTags(entry.tags, Infinity)
  const isPinned = entry.filename.startsWith('我-')

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: 'var(--detail-bg)',
    }}>
      <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        {/* Header */}
        <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '0.5px solid var(--divider)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--item-text)' }}>
              {entry.region}-{entry.name}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {entry.speaker_id && !isPinned && (
                <button
                  onClick={() => onMerge(entry)}
                  style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 5,
                    border: '0.5px solid var(--divider)', background: 'transparent',
                    color: 'var(--item-meta)', cursor: 'pointer',
                  }}
                >
                  合并到…
                </button>
              )}
              {!isPinned && (
                <button
                  onClick={() => onDelete(entry)}
                  style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 5,
                    border: '0.5px solid var(--divider)', background: 'transparent',
                    color: 'var(--record-btn)', cursor: 'pointer',
                  }}
                >
                  删除
                </button>
              )}
            </div>
          </div>
          {entry.summary && (
            <div style={{ fontSize: 12, color: 'var(--detail-summary)', lineHeight: 1.8, marginTop: 8 }}>
              {entry.summary}
            </div>
          )}
          {displayTags.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {displayTags.map((cfg, i) => (
                <span key={i} style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 500,
                  color: cfg.color, background: cfg.bg,
                  fontFamily: "'IBM Plex Mono', monospace",
                }}>
                  {cfg.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Markdown body */}
        {content === null ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 24 }}>
            <Spinner size={20} />
          </div>
        ) : (
          <div className="md-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content.replace(/^---[\s\S]*?---\n?/, '').trim()}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/IdentityDetail.tsx
git commit -m "$(cat <<'EOF'
feat: add IdentityDetail component with markdown rendering

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: MergeIdentityDialog component

**Files:**
- Create: `src/components/MergeIdentityDialog.tsx`

- [ ] **Step 1: Create the dialog**

A modal overlay that shows a list of target identities to merge into, then a mode selector (voice_only / full).

```typescript
import { useState } from 'react'
import type { IdentityEntry, MergeMode } from '../types'

interface MergeIdentityDialogProps {
  source: IdentityEntry
  identities: IdentityEntry[]
  onConfirm: (targetPath: string, mode: MergeMode) => void
  onCancel: () => void
}

export function MergeIdentityDialog({ source, identities, onConfirm, onCancel }: MergeIdentityDialogProps) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null)
  const [step, setStep] = useState<'pick' | 'mode'>('pick')

  // Exclude source and AI soul from targets; keep pinned self as valid target
  const targets = identities.filter(e =>
    e.path !== source.path && !e.filename.startsWith('AI-')
  )

  const handlePickTarget = (path: string) => {
    setSelectedTarget(path)
    setStep('mode')
  }

  const handleSelectMode = (mode: MergeMode) => {
    if (selectedTarget) onConfirm(selectedTarget, mode)
  }

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg)', borderRadius: 12,
          border: '1px solid var(--divider)',
          width: 360, maxHeight: '60vh', display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--divider)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--item-text)' }}>
            {step === 'pick' ? `将「${source.region}-${source.name}」合并到…` : '选择合并方式'}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {step === 'pick' ? (
            targets.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--item-meta)' }}>
                没有可合并的目标
              </div>
            ) : (
              targets.map(t => (
                <div
                  key={t.path}
                  onClick={() => handlePickTarget(t.path)}
                  style={{
                    padding: '10px 20px', cursor: 'pointer',
                    borderBottom: '0.5px solid var(--divider)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--item-hover-bg)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--item-text)' }}>
                    {t.region}-{t.name}
                  </div>
                  {t.summary && (
                    <div style={{ fontSize: 11, color: 'var(--item-meta)', marginTop: 2 }}>
                      {t.summary}
                    </div>
                  )}
                </div>
              ))
            )
          ) : (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => handleSelectMode('voice_only')}
                style={{
                  padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
                  border: '1px solid var(--divider)', background: 'var(--detail-bg)',
                  textAlign: 'left',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--item-meta)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--divider)')}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--item-text)' }}>仅声纹合并</div>
                <div style={{ fontSize: 11, color: 'var(--item-meta)', marginTop: 4 }}>
                  声纹和声音切片归入目标，源文档删除
                </div>
              </button>
              <button
                onClick={() => handleSelectMode('full')}
                style={{
                  padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
                  border: '1px solid var(--divider)', background: 'var(--detail-bg)',
                  textAlign: 'left',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--item-meta)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--divider)')}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--item-text)' }}>整合合并</div>
                <div style={{ fontSize: 11, color: 'var(--item-meta)', marginTop: 4 }}>
                  声纹归入目标，AI 整合两份文档内容后删除源文档
                </div>
              </button>
            </div>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '0.5px solid var(--divider)', textAlign: 'right' }}>
          <button
            onClick={step === 'mode' ? () => setStep('pick') : onCancel}
            style={{
              fontSize: 12, padding: '6px 14px', borderRadius: 5,
              border: '0.5px solid var(--divider)', background: 'transparent',
              color: 'var(--item-meta)', cursor: 'pointer',
            }}
          >
            {step === 'mode' ? '返回' : '取消'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/MergeIdentityDialog.tsx
git commit -m "$(cat <<'EOF'
feat: add MergeIdentityDialog with target picker and mode selector

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: IdentityView — main view assembling list + detail + Soul

**Files:**
- Create: `src/components/IdentityView.tsx`

- [ ] **Step 1: Create IdentityView**

This is the top-level view that replaces `SoulView`. It manages state for selected identity, merge dialog, and switches between Soul editing and identity detail.

```typescript
import { useState, useCallback } from 'react'
import SoulView from './SoulView'
import { IdentityList } from './IdentityList'
import { IdentityDetail } from './IdentityDetail'
import { MergeIdentityDialog } from './MergeIdentityDialog'
import { useIdentity } from '../hooks/useIdentity'
import { mergeIdentity, deleteIdentity } from '../lib/tauri'
import type { IdentityEntry, MergeMode } from '../types'

export default function IdentityView() {
  const { identities, loading, refresh } = useIdentity()
  const [selected, setSelected] = useState<IdentityEntry | null>(null)
  const [soulSelected, setSoulSelected] = useState(false)
  const [mergeSource, setMergeSource] = useState<IdentityEntry | null>(null)

  const handleSelectIdentity = useCallback((entry: IdentityEntry) => {
    setSelected(entry)
    setSoulSelected(false)
  }, [])

  const handleSelectSoul = useCallback(() => {
    setSelected(null)
    setSoulSelected(true)
  }, [])

  const handleMerge = useCallback((entry: IdentityEntry) => {
    setMergeSource(entry)
  }, [])

  const handleMergeConfirm = useCallback(async (targetPath: string, mode: MergeMode) => {
    if (!mergeSource) return
    try {
      await mergeIdentity(mergeSource.path, targetPath, mode)
      setMergeSource(null)
      setSelected(null)
      await refresh()
    } catch (e) {
      console.error('[identity] merge failed:', e)
    }
  }, [mergeSource, refresh])

  const handleDelete = useCallback(async (entry: IdentityEntry) => {
    try {
      await deleteIdentity(entry.path)
      if (selected?.path === entry.path) setSelected(null)
      await refresh()
    } catch (e) {
      console.error('[identity] delete failed:', e)
    }
  }, [selected, refresh])

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left: identity list */}
      <div style={{
        width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column',
        overflow: 'hidden', borderRight: '0.5px solid var(--divider)',
      }}>
        <IdentityList
          identities={identities}
          loading={loading}
          selectedPath={selected?.path ?? null}
          onSelect={handleSelectIdentity}
          onSelectSoul={handleSelectSoul}
          soulSelected={soulSelected}
        />
      </div>

      {/* Right: detail or Soul editor */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {soulSelected ? (
          <SoulView />
        ) : (
          <IdentityDetail
            entry={selected}
            onMerge={handleMerge}
            onDelete={handleDelete}
          />
        )}
      </div>

      {/* Merge dialog */}
      {mergeSource && (
        <MergeIdentityDialog
          source={mergeSource}
          identities={identities}
          onConfirm={handleMergeConfirm}
          onCancel={() => setMergeSource(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/IdentityView.tsx
git commit -m "$(cat <<'EOF'
feat: add IdentityView combining identity list, detail, and Soul editor

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: App.tsx — replace 'soul' view with 'identity'

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update imports**

Replace:
```typescript
import SoulView from './components/SoulView'
```
With:
```typescript
import IdentityView from './components/IdentityView'
```

- [ ] **Step 2: Update view state type**

Change the `view` state from:
```typescript
const [view, setView] = useState<'journal' | 'settings' | 'soul'>('journal')
```
To:
```typescript
const [view, setView] = useState<'journal' | 'settings' | 'identity'>('journal')
```

- [ ] **Step 3: Update all 'soul' references**

Replace all occurrences of `'soul'` with `'identity'` in App.tsx:
- `setView(v => v === 'soul' ? 'journal' : 'soul')` → `setView(v => v === 'identity' ? 'journal' : 'identity')`
- `view === 'soul'` → `view === 'identity'`
- The `onToggleSoul` prop in TitleBar stays as-is (it's a callback name, TitleBar doesn't need to know the view name)

- [ ] **Step 4: Replace SoulView render with IdentityView**

Change:
```tsx
) : view === 'soul' ? (
  <div key="soul" style={{ flex: 1, overflow: 'hidden', animation: 'view-enter 0.2s ease-out' }}>
    <SoulView />
  </div>
```
To:
```tsx
) : view === 'identity' ? (
  <div key="identity" style={{ flex: 1, overflow: 'hidden', animation: 'view-enter 0.2s ease-out' }}>
    <IdentityView />
  </div>
```

- [ ] **Step 5: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "$(cat <<'EOF'
feat: replace SoulView with IdentityView in App.tsx

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Remove SectionSpeakers from settings

**Files:**
- Modify: `src/settings/SettingsLayout.tsx`
- Modify: `src/settings/navigation.ts`
- Delete: `src/settings/components/SectionSpeakers.tsx`

- [ ] **Step 1: Remove 'speakers' from navigation.ts**

In `src/settings/navigation.ts`, change:
```typescript
export type NavId = 'general' | 'ai' | 'voice' | 'speakers' | 'permissions' | 'plugins' | 'about'

export const ALL_NAV_IDS: NavId[] = [
  'general',
  'ai',
  'voice',
  'speakers',
  'permissions',
  'plugins',
  'about',
]
```
To:
```typescript
export type NavId = 'general' | 'ai' | 'voice' | 'permissions' | 'plugins' | 'about'

export const ALL_NAV_IDS: NavId[] = [
  'general',
  'ai',
  'voice',
  'permissions',
  'plugins',
  'about',
]
```

- [ ] **Step 2: Remove SectionSpeakers from SettingsLayout.tsx**

Remove the import:
```typescript
import SectionSpeakers from './components/SectionSpeakers'
```

Remove from `NAV_ITEMS`:
```typescript
{ id: 'speakers', label: '声纹', icon: Users },
```

Remove the `Users` import from lucide-react.

Remove from `SettingsContent`:
```tsx
<section id="speakers" ref={(el) => registerSectionRef('speakers', el)}><SectionSpeakers /></section>
```

- [ ] **Step 3: Delete SectionSpeakers.tsx**

```bash
rm src/settings/components/SectionSpeakers.tsx
```

- [ ] **Step 4: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: build succeeds

- [ ] **Step 5: Commit**

```bash
git add -A src/settings/
git commit -m "$(cat <<'EOF'
refactor: remove SectionSpeakers from settings, functionality moved to IdentityView

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Workspace scripts — identity-create, recent-summaries, CLAUDE.md

**Files:**
- Create: `src-tauri/resources/workspace-template/.claude/scripts/identity-create`
- Modify: `src-tauri/resources/workspace-template/.claude/scripts/recent-summaries`
- Modify: `src-tauri/resources/workspace-template/.claude/CLAUDE.md`
- Modify: `src-tauri/src/ai_processor.rs:77-126`

- [ ] **Step 1: Create identity-create script**

Create `src-tauri/resources/workspace-template/.claude/scripts/identity-create`:

```bash
#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: .claude/scripts/identity-create \"地域\" \"姓名\" [--speaker-id UUID]" >&2
  exit 1
}

if [[ $# -lt 2 ]]; then
  usage
fi

region=""
name=""
speaker_id=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --speaker-id)
      shift
      [[ $# -gt 0 ]] || usage
      speaker_id="$1"
      ;;
    *)
      if [[ -z "$region" ]]; then
        region="$1"
      elif [[ -z "$name" ]]; then
        name="$1"
      else
        usage
      fi
      ;;
  esac
  shift
done

[[ -n "$region" && -n "$name" ]] || usage

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
IDENTITY_DIR="${REPO_ROOT}/identity"
mkdir -p "${IDENTITY_DIR}/raw"

filename="${region}-${name}.md"
target_path="${IDENTITY_DIR}/${filename}"

if [[ -e "${target_path}" ]]; then
  echo "${target_path}"
  exit 0
fi

cat > "${target_path}" <<EOF
---
summary: ""
tags: []
speaker_id: ${speaker_id}
---

# ${name}

EOF

echo "${target_path}"
```

- [ ] **Step 2: Update recent-summaries script**

In `src-tauri/resources/workspace-template/.claude/scripts/recent-summaries`, after the existing journal output loop, append identity summary collection:

Add after the existing `done` (line ~49), before the script ends:

```bash
# ── Identity summaries ──────────────────────────────────
IDENTITY_DIR="${REPO_ROOT}/identity"
if [[ -d "$IDENTITY_DIR" ]]; then
  declare -a id_entries=()
  while IFS= read -r -d '' file; do
    summary=$(awk '
      /^---$/ { count++; next }
      count == 1 && /^summary:/ {
        sub(/^summary:[[:space:]]*/, "")
        gsub(/^["'"'"']|["'"'"']$/, "")
        print
        exit
      }
    ' "$file")
    # Skip entries without summary
    [[ -z "$summary" || "$summary" == '""' ]] && continue
    id_entries+=("${file}	${summary}")
  done < <(find "$IDENTITY_DIR" -maxdepth 1 -name "*.md" -print0)

  if [[ ${#id_entries[@]} -gt 0 ]]; then
    printf "\n=== 身份档案 ===\n"
    id_count=0
    for entry in "${id_entries[@]}"; do
      file="${entry%%	*}"
      summary="${entry#*	}"
      rel="${file#$REPO_ROOT/}"
      id_count=$((id_count+1))
      printf "%d. %s\n   > %s\n" "$id_count" "$rel" "$summary"
    done
  fi
fi
```

- [ ] **Step 3: Update CLAUDE.md template**

In `src-tauri/resources/workspace-template/.claude/CLAUDE.md`, add after the workspace directory structure section:

```markdown
## 身份库

工作区包含一个 `identity/` 目录，用于管理人物身份信息：

```
{workspace}/
  identity/          ← 身份档案
    地域-姓名.md     ← 如 广州-张三.md、华工-李四.md
    raw/             ← 声纹数据和声音切片
```

### 身份文件格式

```yaml
---
summary: 一句话描述
tags: [标签]
speaker_id: uuid
---

# 姓名

自由记录区域
```

### 处理未知说话人

当素材中出现未知说话人（如"未知-说话人1"），你应该：
1. 从素材内容中提取该人物的信息（姓名、地域、角色等）
2. 使用 `.claude/scripts/identity-create "地域" "姓名"` 创建身份文档
3. 编辑创建的文件，填写 summary 和正文信息
4. 如果无法确定地域，使用"未知"作为地域前缀
```

- [ ] **Step 4: Register identity-create in ai_processor.rs**

In `src-tauri/src/ai_processor.rs`, add the const and update `ensure_workspace_dot_claude`:

Add after `SCRIPT_RECENT_SUMMARIES`:
```rust
const SCRIPT_IDENTITY_CREATE: &str =
    include_str!("../resources/workspace-template/.claude/scripts/identity-create");
```

Add to the `scripts` array in `ensure_workspace_dot_claude`:
```rust
let scripts: &[(&str, &str)] = &[
    ("journal-create", SCRIPT_JOURNAL_CREATE),
    ("recent-summaries", SCRIPT_RECENT_SUMMARIES),
    ("identity-create", SCRIPT_IDENTITY_CREATE),
];
```

- [ ] **Step 5: Verify Rust build**

Run: `cd src-tauri && cargo build 2>&1 | tail -5`
Expected: build succeeds

- [ ] **Step 6: Commit**

```bash
git add src-tauri/resources/workspace-template/.claude/ src-tauri/src/ai_processor.rs
git commit -m "$(cat <<'EOF'
feat: add identity-create script, update recent-summaries and CLAUDE.md

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Integration test — full build and manual verification

**Files:** (none — verification only)

- [ ] **Step 1: Run full Rust test suite**

Run: `cd src-tauri && cargo test 2>&1 | tail -20`
Expected: all tests pass

- [ ] **Step 2: Run frontend build**

Run: `npm run build 2>&1 | tail -10`
Expected: build succeeds with no errors

- [ ] **Step 3: Run frontend tests**

Run: `npm test -- --run 2>&1 | tail -20`
Expected: all tests pass

- [ ] **Step 4: Manual smoke test checklist**

Run `npm run tauri dev` manually and verify:
- [ ] Cmd+P opens IdentityView (not old SoulView)
- [ ] Soul card is pinned at top of identity list, clicking it shows Soul editor
- [ ] Settings no longer has "声纹" section
- [ ] Identity list shows empty state when no identities exist
- [ ] `workspace/identity/` directory is created on first use

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix: integration fixes for identity library

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Known Gaps & Notes

### Audio clip saving (Spec 1.5)
The audio pipeline (`audio_pipeline.rs` / `transcription.rs`) needs to be updated to save per-speaker audio segments to `workspace/identity/raw/<speaker_id>_NNN.m4a` after transcription with speaker diarization. This is tightly coupled to the voice recognition feature being developed in parallel on this branch. The identity library tasks above do NOT include this audio slicing logic — it should be handled as part of the voice recognition pipeline work, using `identity_raw_dir()` from `identity.rs` for the output path.

### User self identity creation
The `我-XXX.md` file needs to be created on first use. Add a step in `identity.rs` — `ensure_self_identity(workspace)` — called from `list_identities` or during workspace init. If no `我-*.md` file exists, create `我-用户.md` with empty frontmatter. The user renames it themselves.

### "Full" merge AI integration
For `mode = "full"`, the Rust `merge_identity` command handles voice merging and returns. The frontend then:
1. Reads both source and target content
2. Sends both to AI engine via `triggerAiPrompt()` with a merge instruction
3. On AI completion, saves the merged content to target via `saveIdentityContent()`
4. Deletes the source file via `deleteIdentity()`
This multi-step flow lives in `IdentityView.tsx`'s `handleMergeConfirm` callback. The current Task 11 implementation shows a simplified version — the full AI integration should be added once the AI prompt format is finalized.
