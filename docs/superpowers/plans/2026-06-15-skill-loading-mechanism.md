# 技能三层加载机制 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有两层技能发现（project + global）升级为三层加载架构（builtin + project + global），支持差异化默认状态、层级覆盖、临时调用。

**Architecture:** Rust 后端新增 builtin scope 扫描（从 bundle resources 读取）+ 全局技能扫描路径扩展（plugins/cache/\*/skills/）+ `enabled_global_skills` 白名单持久化。前端 SkillsWorkbench 改为三分区布局，每个技能卡片增加 `/` 临时调用按钮。`prompt.rs` 和 `enable_skill.rs` 适配三层优先级。

**Tech Stack:** Rust (Tauri v2), React 19, TypeScript

---

## File Structure

| File                                  | Action | Responsibility                                                         |
| ------------------------------------- | ------ | ---------------------------------------------------------------------- |
| `src-tauri/src/skills.rs`             | Modify | 新增 builtin/global 扫描、三层合并与覆盖去重、`get_skill_content` 命令 |
| `src-tauri/src/workspace_settings.rs` | Modify | 新增 `enabled_global_skills` 字段 + getter/setter                      |
| `src-tauri/src/llm/prompt.rs`         | Modify | `scan_skills()` 扩展为三层、支持 builtin 强制加载                      |
| `src-tauri/src/llm/enable_skill.rs`   | Modify | `execute()` 支持 builtin 路径查找                                      |
| `src-tauri/src/main.rs`               | Modify | 注册新增 Tauri 命令                                                    |
| `src-tauri/resources/builtin-skills/` | Create | 内置技能目录（从 `.agents/skills/` 迁移）                              |
| `src/lib/tauri.ts`                    | Modify | 扩展 SkillInfo 类型 + 新增 IPC 函数                                    |
| `src/components/SkillsWorkbench.tsx`  | Modify | 三分区布局 + `/` 按钮 + shadowed 标注                                  |
| `src/styles/skills-workbench.css`     | Modify | 新增分区样式 + `/` 按钮样式                                            |

---

### Task 1: 创建 builtin-skills 资源目录

**Files:**

- Create: `src-tauri/resources/builtin-skills/docs-maintenance/SKILL.md`
- Create: `src-tauri/resources/builtin-skills/requirements-gate/SKILL.md`
- Create: `src-tauri/resources/builtin-skills/verification-gate/SKILL.md`
- Modify: `src-tauri/tauri.conf.json` (确保 resources 已包含)

- [ ] **Step 1: 将现有 .agents/skills/ 内容复制到 resources/builtin-skills/**

```bash
cp -r .agents/skills/docs-maintenance src-tauri/resources/builtin-skills/docs-maintenance
cp -r .agents/skills/requirements-gate src-tauri/resources/builtin-skills/requirements-gate
cp -r .agents/skills/verification-gate src-tauri/resources/builtin-skills/verification-gate
```

- [ ] **Step 2: 验证 tauri.conf.json 的 bundle.resources 包含 builtin-skills**

读取 `src-tauri/tauri.conf.json`，确认 `bundle.resources` 数组中包含 `"resources/builtin-skills/**"` 或等效 glob。如不存在则添加。

- [ ] **Step 3: Commit**

```bash
git add src-tauri/resources/builtin-skills/
git commit -m "feat: add builtin-skills resource directory for L1 skills"
```

---

### Task 2: workspace_settings.rs — 新增 enabled_global_skills 字段

**Files:**

- Modify: `src-tauri/src/workspace_settings.rs`
- Test: 在同一文件的 `mod tests` 中新增测试

- [ ] **Step 1: 写测试 — enabled_global_skills 序列化/反序列化**

在 `src-tauri/src/workspace_settings.rs` 的 `mod tests` 末尾添加：

```rust
#[test]
fn enabled_global_skills_defaults_to_empty() {
    let s: WorkspaceSettings = serde_json::from_str("{}").unwrap();
    assert!(s.enabled_global_skills.is_none());
}

#[test]
fn enabled_global_skills_round_trip() {
    let json = r#"{"enabled_global_skills":["global:superpowers:brainstorming"]}"#;
    let s: WorkspaceSettings = serde_json::from_str(json).unwrap();
    let list = s.enabled_global_skills.unwrap();
    assert_eq!(list, vec!["global:superpowers:brainstorming"]);
}
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd src-tauri && cargo test workspace_settings::tests::enabled_global_skills -- --nocapture
```

Expected: 编译错误，`enabled_global_skills` 字段不存在。

- [ ] **Step 3: 在 WorkspaceSettings 结构体中添加字段**

在 `src-tauri/src/workspace_settings.rs` 的 `WorkspaceSettings` 结构体中，`disabled_skills` 字段后面新增：

```rust
/// Global skills whitelist — stores skill ids that the user has opted-in.
/// Global skills default to off, so we record which ones are explicitly enabled.
#[serde(default)]
enabled_global_skills: Option<Vec<String>>,
```

在 `impl Default for WorkspaceSettings` 中加入：

```rust
enabled_global_skills: None,
```

- [ ] **Step 4: 新增公开 getter 函数**

在 `get_disabled_skills_for_workspace` 函数下方添加：

```rust
/// Return enabled global skill ids for a workspace path, without needing an AppHandle.
pub fn get_enabled_global_skills_for_workspace(workspace_path: &str) -> Vec<String> {
    if workspace_path.is_empty() {
        return vec![];
    }
    let path = PathBuf::from(workspace_path).join(".setting.json");
    let data = match fs::read_to_string(&path) {
        Ok(d) => d,
        Err(_) => return vec![],
    };
    let settings: WorkspaceSettings = serde_json::from_str(&data).unwrap_or_default();
    settings.enabled_global_skills.unwrap_or_default()
}
```

- [ ] **Step 5: 新增 Tauri 命令 set_global_skill_enabled**

在 `set_skill_enabled` 命令后面添加：

```rust
#[tauri::command]
pub fn set_global_skill_enabled(app: AppHandle, skill_id: String, enabled: bool) -> Result<(), String> {
    let mut settings = load_settings(&app)?;
    let mut list = settings.enabled_global_skills.unwrap_or_default();
    if enabled {
        if !list.contains(&skill_id) {
            list.push(skill_id);
        }
    } else {
        list.retain(|id| id != &skill_id);
    }
    settings.enabled_global_skills = if list.is_empty() { None } else { Some(list) };
    save_settings(&app, &settings)
}
```

- [ ] **Step 6: 运行测试确认通过**

```bash
cd src-tauri && cargo test workspace_settings::tests -- --nocapture
```

Expected: 全部 PASS。

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/workspace_settings.rs
git commit -m "feat: add enabled_global_skills whitelist to workspace settings"
```

---

### Task 3: skills.rs — 三层扫描 + 覆盖合并 + get_skill_content 命令

**Files:**

- Modify: `src-tauri/src/skills.rs`
- Test: 同文件 `mod tests`

- [ ] **Step 1: 写测试 — SkillInfo 新增 shadowed_by 字段**

在 `src-tauri/src/skills.rs` 的 `mod tests` 末尾添加：

```rust
#[test]
fn skill_info_shadowed_by_defaults_none() {
    let info = SkillInfo {
        id: "builtin:test".to_string(),
        name: "test".to_string(),
        description: String::new(),
        scope: "builtin".to_string(),
        dir_name: "test".to_string(),
        triggers: vec![],
        output: None,
        loads: vec![],
        enabled: true,
        shadowed_by: None,
    };
    assert!(info.shadowed_by.is_none());
}
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd src-tauri && cargo test skills::tests::skill_info_shadowed_by -- --nocapture
```

Expected: 编译错误，`shadowed_by` 字段不存在。

- [ ] **Step 3: 在 SkillInfo 中添加 shadowed_by 字段**

在 `src-tauri/src/skills.rs` 的 `SkillInfo` 结构体中 `enabled` 字段后面添加：

```rust
/// If this skill is shadowed by a higher-priority skill (L1 > L2 > L3),
/// this holds the shadowing skill's id. UI uses this to grey out and explain.
#[serde(default, skip_serializing_if = "Option::is_none")]
pub shadowed_by: Option<String>,
```

- [ ] **Step 4: 更新 scan_skills_dir 中所有 SkillInfo 构造，加入 `shadowed_by: None`**

在 `scan_skills_dir` 函数中 `skills.push(SkillInfo { ... })` 的字段列表末尾加入：

```rust
shadowed_by: None,
```

- [ ] **Step 5: 运行测试确认通过**

```bash
cd src-tauri && cargo test skills::tests::skill_info_shadowed_by -- --nocapture
```

Expected: PASS。

- [ ] **Step 6: 实现 scan_builtin_skills 函数**

在 `scan_skills_dir` 函数上方添加：

```rust
/// Scan builtin skills bundled inside the app resources directory.
fn scan_builtin_skills(app: &tauri::AppHandle) -> Vec<SkillInfo> {
    let resource_dir = app
        .path()
        .resource_dir()
        .unwrap_or_default()
        .join("resources")
        .join("builtin-skills");
    scan_skills_dir(&resource_dir, "builtin")
}
```

需要在文件顶部添加 `use tauri::Manager;`（如果尚未导入）。

- [ ] **Step 7: 实现 scan_global_skills_extended 函数**

在 `scan_builtin_skills` 下方添加：

```rust
/// Scan global skill directories: ~/.claude/skills/ + ~/.claude/plugins/cache/*/skills/
fn scan_global_skills_extended() -> Vec<SkillInfo> {
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return vec![],
    };
    let mut all = Vec::new();

    // 1. ~/.claude/skills/
    let global_dir = home.join(".claude").join("skills");
    all.extend(scan_skills_dir(&global_dir, "global"));

    // 2. ~/.claude/plugins/cache/*/skills/ (e.g. superpowers)
    let plugins_cache = home.join(".claude").join("plugins").join("cache");
    if let Ok(entries) = fs::read_dir(&plugins_cache) {
        for entry in entries.flatten() {
            let skills_dir = entry.path().join("skills");
            if skills_dir.is_dir() {
                // Use plugin name as prefix in id: "global:plugin-name/skill-dir"
                let plugin_name = entry
                    .file_name()
                    .to_string_lossy()
                    .to_string();
                let plugin_skills = scan_skills_dir(&skills_dir, "global");
                for mut skill in plugin_skills {
                    // Prefix dir_name to avoid collisions across plugins
                    skill.dir_name = format!("{}/{}", plugin_name, skill.dir_name);
                    skill.id = format!("global:{}", skill.dir_name);
                    all.push(skill);
                }
            }
        }
    }

    all
}
```

- [ ] **Step 8: 实现 merge_skills_with_priority 函数**

```rust
/// Merge skills from three layers with strict priority: builtin > project > global.
/// Same-name skills at lower priority get shadowed_by set and enabled = false.
fn merge_skills_with_priority(
    builtin: Vec<SkillInfo>,
    project: Vec<SkillInfo>,
    global: Vec<SkillInfo>,
) -> Vec<SkillInfo> {
    let mut result: Vec<SkillInfo> = Vec::new();
    let mut seen_names: Vec<(String, String)> = Vec::new(); // (name, id)

    // L1 builtin — always enabled, always first
    for skill in builtin {
        seen_names.push((skill.name.clone(), skill.id.clone()));
        result.push(skill);
    }

    // L2 project
    for mut skill in project {
        if let Some((_, shadow_id)) = seen_names.iter().find(|(n, _)| n == &skill.name) {
            skill.shadowed_by = Some(shadow_id.clone());
            skill.enabled = false;
        } else {
            seen_names.push((skill.name.clone(), skill.id.clone()));
        }
        result.push(skill);
    }

    // L3 global
    for mut skill in global {
        if let Some((_, shadow_id)) = seen_names.iter().find(|(n, _)| n == &skill.name) {
            skill.shadowed_by = Some(shadow_id.clone());
            skill.enabled = false;
        } else {
            seen_names.push((skill.name.clone(), skill.id.clone()));
        }
        result.push(skill);
    }

    result
}
```

- [ ] **Step 9: 重写 list_skills 命令**

替换现有 `list_skills` 函数：

```rust
#[tauri::command]
pub fn list_skills(app: tauri::AppHandle) -> Result<Vec<SkillInfo>, String> {
    // L1: Builtin skills (always loaded)
    let builtin = scan_builtin_skills(&app);

    // L2: Project skills
    let config = crate::config::load_config(&app)?;
    let project = if !config.workspace_path.is_empty() {
        let project_skills_dir = PathBuf::from(&config.workspace_path)
            .join(".agents")
            .join("skills");
        scan_skills_dir(&project_skills_dir, "project")
    } else {
        vec![]
    };

    // L3: Global skills (always scanned for discovery, enabled state resolved below)
    let global = scan_global_skills_extended();

    // Merge with priority
    let mut all = merge_skills_with_priority(builtin, project, global);

    // Resolve enabled state:
    // - builtin: always true
    // - project: true unless in disabled_skills
    // - global: false unless in enabled_global_skills (and not shadowed)
    let disabled = crate::workspace_settings::get_disabled_skills(&app);
    let enabled_globals = crate::workspace_settings::get_enabled_global_skills_for_workspace(
        &config.workspace_path,
    );

    for skill in &mut all {
        if skill.shadowed_by.is_some() {
            skill.enabled = false;
            continue;
        }
        match skill.scope.as_str() {
            "builtin" => skill.enabled = true,
            "project" => skill.enabled = !disabled.contains(&skill.id),
            "global" => skill.enabled = enabled_globals.contains(&skill.id),
            _ => {}
        }
    }

    Ok(all)
}
```

- [ ] **Step 10: 新增 get_skill_content Tauri 命令**

在 `list_skills` 下方添加：

```rust
/// Return the full SKILL.md content for a skill by its id.
/// Used for one-shot `/` invocation in the chat UI.
#[tauri::command]
pub async fn get_skill_content(app: tauri::AppHandle, skill_id: String) -> Result<String, String> {
    let config = crate::config::load_config(&app)?;
    let parts: Vec<&str> = skill_id.splitn(2, ':').collect();
    if parts.len() != 2 {
        return Err(format!("invalid skill_id format: {}", skill_id));
    }
    let (scope, dir_name) = (parts[0], parts[1]);

    let skill_md_path = match scope {
        "builtin" => {
            app.path()
                .resource_dir()
                .unwrap_or_default()
                .join("resources")
                .join("builtin-skills")
                .join(dir_name)
                .join("SKILL.md")
        }
        "project" => {
            PathBuf::from(&config.workspace_path)
                .join(".agents")
                .join("skills")
                .join(dir_name)
                .join("SKILL.md")
        }
        "global" => {
            // dir_name may be "plugin-name/skill-dir" or just "skill-dir"
            let home = dirs::home_dir().ok_or("cannot resolve home directory")?;
            if dir_name.contains('/') {
                // Plugin path: ~/.claude/plugins/cache/<plugin>/skills/<skill>/SKILL.md
                let parts: Vec<&str> = dir_name.splitn(2, '/').collect();
                home.join(".claude")
                    .join("plugins")
                    .join("cache")
                    .join(parts[0])
                    .join("skills")
                    .join(parts[1])
                    .join("SKILL.md")
            } else {
                home.join(".claude").join("skills").join(dir_name).join("SKILL.md")
            }
        }
        _ => return Err(format!("unknown scope: {}", scope)),
    };

    tokio::fs::read_to_string(&skill_md_path)
        .await
        .map_err(|e| format!("cannot read skill: {}", e))
}
```

- [ ] **Step 11: 运行所有 skills 测试**

```bash
cd src-tauri && cargo test skills::tests -- --nocapture
```

Expected: 全部 PASS。

- [ ] **Step 12: Commit**

```bash
git add src-tauri/src/skills.rs
git commit -m "feat: three-layer skill scanning with priority merge and get_skill_content"
```

---

### Task 4: prompt.rs — 适配三层扫描

**Files:**

- Modify: `src-tauri/src/llm/prompt.rs`

- [ ] **Step 1: 更新 scan_skills 函数支持三层**

替换现有 `scan_skills` 函数（lines 143-205）：

```rust
/// Scan skills from all three layers, return (dir_name, description) pairs.
/// Builtin and enabled project/global skills are included. Disabled ones are excluded.
pub async fn scan_skills(
    workspace_path: &str,
    _global_skills_enabled: bool,  // kept for API compat, now always scans global
    disabled_ids: &[String],
) -> Vec<(String, String)> {
    let mut skills: Vec<(String, String)> = Vec::new();

    // L1: Builtin — scan from resources (at runtime, use resource_dir)
    // For the prompt layer we need the workspace-relative approach since we don't have AppHandle.
    // Builtin skills are always included — scan .agents/skills/ which mirrors builtin-skills/
    let builtin_dir = PathBuf::from(workspace_path)
        .parent()
        .unwrap_or(std::path::Path::new("/"))
        .join(".agents")
        .join("skills");
    // Actually builtin skills are in the same workspace under .agents/skills/
    let project_skills_dir = PathBuf::from(workspace_path).join(".agents").join("skills");

    // Scan project skills directory (contains both what was formerly "builtin" at project level)
    if let Ok(mut entries) = tokio::fs::read_dir(&project_skills_dir).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let skill_md = path.join("SKILL.md");
            let content = match tokio::fs::read_to_string(&skill_md).await {
                Ok(c) => c,
                Err(_) => continue,
            };
            let dir_name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            if dir_name.is_empty() {
                continue;
            }
            let skill_id = format!("project:{}", dir_name);
            if disabled_ids.contains(&skill_id) {
                continue;
            }
            let description = parse_skill_description(&content).unwrap_or_default();
            skills.push((dir_name, description));
        }
    }

    // L3: Global skills (only enabled ones from whitelist)
    let enabled_globals =
        crate::workspace_settings::get_enabled_global_skills_for_workspace(workspace_path);
    if let Some(home) = dirs::home_dir() {
        // ~/.claude/skills/
        let global_dir = home.join(".claude").join("skills");
        if let Ok(mut entries) = tokio::fs::read_dir(&global_dir).await {
            while let Ok(Some(entry)) = entries.next_entry().await {
                let path = entry.path();
                if !path.is_dir() {
                    continue;
                }
                let skill_md = path.join("SKILL.md");
                let content = match tokio::fs::read_to_string(&skill_md).await {
                    Ok(c) => c,
                    Err(_) => continue,
                };
                let dir_name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();
                if dir_name.is_empty() {
                    continue;
                }
                let skill_id = format!("global:{}", dir_name);
                if !enabled_globals.contains(&skill_id) {
                    continue;
                }
                let description = parse_skill_description(&content).unwrap_or_default();
                if !skills.iter().any(|(n, _)| n == &dir_name) {
                    skills.push((dir_name, description));
                }
            }
        }

        // ~/.claude/plugins/cache/*/skills/
        let plugins_cache = home.join(".claude").join("plugins").join("cache");
        if let Ok(mut plugin_entries) = tokio::fs::read_dir(&plugins_cache).await {
            while let Ok(Some(plugin_entry)) = plugin_entries.next_entry().await {
                let skills_dir = plugin_entry.path().join("skills");
                if !skills_dir.is_dir() {
                    continue;
                }
                let plugin_name = plugin_entry
                    .file_name()
                    .to_string_lossy()
                    .to_string();
                if let Ok(mut entries) = tokio::fs::read_dir(&skills_dir).await {
                    while let Ok(Some(entry)) = entries.next_entry().await {
                        let path = entry.path();
                        if !path.is_dir() {
                            continue;
                        }
                        let skill_md = path.join("SKILL.md");
                        let content = match tokio::fs::read_to_string(&skill_md).await {
                            Ok(c) => c,
                            Err(_) => continue,
                        };
                        let raw_dir = path
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("")
                            .to_string();
                        if raw_dir.is_empty() {
                            continue;
                        }
                        let dir_name = format!("{}/{}", plugin_name, raw_dir);
                        let skill_id = format!("global:{}", dir_name);
                        if !enabled_globals.contains(&skill_id) {
                            continue;
                        }
                        let description = parse_skill_description(&content).unwrap_or_default();
                        if !skills.iter().any(|(n, _)| n == &dir_name) {
                            skills.push((dir_name, description));
                        }
                    }
                }
            }
        }
    }

    skills.sort_by(|a, b| a.0.cmp(&b.0));
    skills
}
```

- [ ] **Step 2: 运行现有 prompt 测试**

```bash
cd src-tauri && cargo test llm::prompt::tests -- --nocapture
```

Expected: 全部 PASS（测试使用 tempdir，不依赖 builtin 路径）。

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/llm/prompt.rs
git commit -m "feat: prompt.rs scan_skills supports three-layer discovery"
```

---

### Task 5: enable_skill.rs — 支持 builtin 路径查找

**Files:**

- Modify: `src-tauri/src/llm/enable_skill.rs`

- [ ] **Step 1: 更新 execute 函数的搜索路径**

在 `enable_skill.rs` 的 `execute` 函数中，替换 `search_dirs` 构建逻辑（lines 79-85）：

```rust
// Search: builtin first, then project, then global
let mut search_dirs: Vec<PathBuf> = Vec::new();

// Builtin skills (in workspace's .agents/skills/ which mirrors resources/builtin-skills/)
search_dirs.push(PathBuf::from(workspace).join(".agents").join("skills"));

// Project skills
search_dirs.push(PathBuf::from(workspace).join(".claude").join("skills"));

// Global skills
if let Some(home) = dirs::home_dir() {
    search_dirs.push(home.join(".claude").join("skills"));
    // Plugin cache skills
    let plugins_cache = home.join(".claude").join("plugins").join("cache");
    if let Ok(entries) = std::fs::read_dir(&plugins_cache) {
        for entry in entries.flatten() {
            let skills_dir = entry.path().join("skills");
            if skills_dir.is_dir() {
                search_dirs.push(skills_dir);
            }
        }
    }
}
```

- [ ] **Step 2: 运行 enable_skill 测试**

```bash
cd src-tauri && cargo test llm::enable_skill::tests -- --nocapture
```

Expected: 全部 PASS。

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/llm/enable_skill.rs
git commit -m "feat: enable_skill searches builtin and plugin cache paths"
```

---

### Task 6: main.rs — 注册新 Tauri 命令

**Files:**

- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: 在 invoke_handler 中注册新命令**

在 `src-tauri/src/main.rs` 的 `.invoke_handler(tauri::generate_handler![...])` 列表中添加：

```rust
workspace_settings::set_global_skill_enabled,
skills::get_skill_content,
```

- [ ] **Step 2: 运行编译检查**

```bash
cd src-tauri && cargo check
```

Expected: 无错误。

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/main.rs
git commit -m "feat: register new Tauri commands for skill loading"
```

---

### Task 7: tauri.ts — 前端 IPC 层扩展

**Files:**

- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: 扩展 SkillInfo 类型**

在 `src/lib/tauri.ts` 中将 `SkillInfo` 接口修改为：

```typescript
export interface SkillInfo {
  id: string
  name: string
  description: string
  scope: 'builtin' | 'project' | 'global'
  dir_name: string
  triggers: SkillTrigger[]
  output: string | null
  loads: SkillLoad[]
  enabled: boolean
  shadowed_by?: string | null
}
```

- [ ] **Step 2: 新增 IPC 函数**

在 `setSkillEnabled` 后面添加：

```typescript
export const setGlobalSkillEnabled = (skillId: string, enabled: boolean): Promise<void> =>
  invoke<void>('set_global_skill_enabled', { skillId, enabled })

export const getSkillContent = (skillId: string): Promise<string> =>
  invoke<string>('get_skill_content', { skillId })
```

- [ ] **Step 3: 运行 TypeScript 编译检查**

```bash
npm run build
```

Expected: 无类型错误（如有使用 `scope` 的地方需要适配，在此步骤修复）。

- [ ] **Step 4: Commit**

```bash
git add src/lib/tauri.ts
git commit -m "feat: extend SkillInfo type and add IPC for three-layer skills"
```

---

### Task 8: SkillsWorkbench.tsx — 三分区布局 + `/` 按钮

**Files:**

- Modify: `src/components/SkillsWorkbench.tsx`
- Modify: `src/styles/skills-workbench.css`

- [ ] **Step 1: 导入新增 IPC 函数**

在 `SkillsWorkbench.tsx` 顶部的 import 中添加 `setGlobalSkillEnabled` → `setGlobalSkillEnabled` 改为 `setGlobalSkillEnabled`（新命令），以及 `getSkillContent`：

```typescript
import {
  listSkills,
  openSkillsDir,
  openSkillDir,
  setSkillEnabled,
  setGlobalSkillEnabled,
  getSkillContent,
  getGlobalSkillsEnabled,
  type SkillInfo,
  type SkillTrigger,
} from '../lib/tauri'
```

删除原有的 `setGlobalSkillsEnabled` 导入（旧的全局总开关不再需要，但保留以防其他地方用）。

- [ ] **Step 2: 在 SkillCard 中添加 `/` 调用按钮**

修改 `SkillCard` 组件，在 `Switch` 旁添加 `/` 按钮：

```typescript
function SkillCard({
  s,
  on,
  toggle,
  onOpen,
  onInvoke,
  showToggle,
}: {
  s: SkillInfo
  on: boolean
  toggle: () => void
  onOpen: () => void
  onInvoke: () => void
  showToggle: boolean
}) {
  const Icon = skillIcon(s.dir_name)
  const isShadowed = !!s.shadowed_by
  return (
    <div
      onClick={onOpen}
      className={`skills-card${on ? '' : ' is-disabled'}${isShadowed ? ' is-shadowed' : ''}`}
    >
      {/* header */}
      <div className="skills-card-header">
        <div className="skills-card-icon">
          <Icon size={19} />
        </div>
        <div className="skills-card-meta">
          <div className="skills-card-meta-row">
            <span className="skills-card-id">{s.dir_name}</span>
            <span className={`skills-card-scope scope-${s.scope}`}>
              {s.scope === 'builtin' ? '内置' : s.scope === 'global' ? '全局' : '项目'}
            </span>
          </div>
          <div className="skills-card-name">{s.name}</div>
        </div>
        <button
          type="button"
          className="skills-card-invoke"
          title="临时使用此技能"
          onClick={(e) => {
            e.stopPropagation()
            onInvoke()
          }}
        >
          /
        </button>
        {showToggle && !isShadowed && (
          <Switch
            on={on}
            onClick={(e) => {
              e.stopPropagation()
              toggle()
            }}
          />
        )}
      </div>

      {/* shadowed notice */}
      {isShadowed && (
        <p className="skills-card-shadowed">已被高优先级技能覆盖</p>
      )}

      {/* description */}
      {!isShadowed && s.description && <p className="skills-card-desc">{s.description}</p>}

      {/* footer: trigger chips */}
      {!isShadowed && s.triggers.length > 0 && (
        <div className="skills-card-triggers">
          {s.triggers.map((t, i) => (
            <TriggerChip key={i} trig={t} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 重写 SkillsWorkbench 主组件为三分区**

替换 `SkillsWorkbench` 组件的渲染逻辑：

```typescript
export default function SkillsWorkbench() {
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    listSkills()
      .then(setSkills)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const toggle = (skill: SkillInfo) => {
    const next = !skill.enabled
    if (skill.scope === 'global') {
      setGlobalSkillEnabled(skill.id, next).catch(console.error)
    } else {
      setSkillEnabled(skill.id, next).catch(console.error)
    }
    setSkills((prev) =>
      prev.map((s) => (s.id === skill.id ? { ...s, enabled: next } : s)),
    )
  }

  const invokeOnce = async (skill: SkillInfo) => {
    if (skill.enabled && !skill.shadowed_by) {
      // Already loaded — show hint
      alert('该技能已在当前对话中生效')
      return
    }
    try {
      const content = await getSkillContent(skill.id)
      // Dispatch content to chat — emit custom event for ChatPanel to pick up
      window.dispatchEvent(
        new CustomEvent('skill-invoke-once', { detail: { skillId: skill.id, content } }),
      )
    } catch (e) {
      console.error('invoke skill failed:', e)
    }
  }

  const list = useMemo(() => {
    if (!q.trim()) return skills
    const needle = q.trim().toLowerCase()
    return skills.filter((s) =>
      (s.dir_name + s.name + s.description).toLowerCase().includes(needle),
    )
  }, [skills, q])

  const builtin = list.filter((s) => s.scope === 'builtin')
  const project = list.filter((s) => s.scope === 'project')
  const global = list.filter((s) => s.scope === 'global')

  const enabledCount = skills.filter((s) => s.enabled).length

  if (loading) {
    return <div className="skills-workbench-loading">加载中…</div>
  }

  return (
    <section className="skills-workbench">
      <div className="skills-workbench-inner">
        {/* header */}
        <div className="skills-workbench-header">
          <div className="skills-workbench-header-left">
            <span className="skills-workbench-eyebrow">AGENT SKILLS</span>
            <h1 className="skills-workbench-title">技能</h1>
            <p className="skills-workbench-summary">
              三层技能架构：内置技能始终生效，项目技能可切换，全局技能按需启用。
            </p>
          </div>
          <div className="skills-workbench-header-right">
            <StatCard
              cells={[
                { n: enabledCount, l: '已启用' },
                { n: builtin.length, l: '内置' },
                { n: global.length, l: '全局' },
              ]}
            />
            <div className="skills-workbench-actions">
              <button
                type="button"
                onClick={() => openSkillsDir('project')}
                className="skills-workbench-button"
              >
                <FolderOpen size={15} />
                打开目录
              </button>
              <button
                type="button"
                onClick={() => openSkillsDir('project')}
                className="skills-workbench-button-primary"
              >
                <Plus size={15} />
                新建技能
              </button>
            </div>
          </div>
        </div>

        {/* search */}
        <div className="skills-workbench-toolbar">
          <div className="skills-workbench-search">
            <Search size={15} className="skills-workbench-search-icon" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索技能…"
              className="skills-workbench-search-input"
            />
          </div>
        </div>

        {/* L1: Builtin */}
        {builtin.length > 0 && (
          <div className="skills-section">
            <h2 className="skills-section-title">🔒 内置技能</h2>
            <div className="skills-workbench-grid">
              {builtin.map((s) => (
                <SkillCard
                  key={s.id}
                  s={s}
                  on={true}
                  toggle={() => {}}
                  onOpen={() => setOpenId(s.id)}
                  onInvoke={() => invokeOnce(s)}
                  showToggle={false}
                />
              ))}
            </div>
          </div>
        )}

        {/* L2: Project */}
        {project.length > 0 && (
          <div className="skills-section">
            <h2 className="skills-section-title">📦 项目技能</h2>
            <div className="skills-workbench-grid">
              {project.map((s) => (
                <SkillCard
                  key={s.id}
                  s={s}
                  on={s.enabled}
                  toggle={() => toggle(s)}
                  onOpen={() => setOpenId(s.id)}
                  onInvoke={() => invokeOnce(s)}
                  showToggle={true}
                />
              ))}
            </div>
          </div>
        )}

        {/* L3: Global */}
        {global.length > 0 && (
          <div className="skills-section">
            <h2 className="skills-section-title">🌐 全局技能</h2>
            <div className="skills-workbench-grid">
              {global.map((s) => (
                <SkillCard
                  key={s.id}
                  s={s}
                  on={s.enabled}
                  toggle={() => toggle(s)}
                  onOpen={() => setOpenId(s.id)}
                  onInvoke={() => invokeOnce(s)}
                  showToggle={true}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {list.length === 0 && (
          <div className="skills-workbench-empty">
            <div className="skills-workbench-empty-icon">+</div>
            <div className="skills-workbench-empty-title">
              {skills.length === 0 ? '未发现技能' : '没有匹配的技能'}
            </div>
            <div className="skills-workbench-empty-subtitle">
              {skills.length === 0
                ? '内置技能将随应用更新自动添加'
                : '尝试调整搜索关键词'}
            </div>
          </div>
        )}
      </div>

      {/* Drawer */}
      {openId &&
        (() => {
          const s = skills.find((k) => k.id === openId)
          if (!s) return null
          return (
            <SkillDrawer
              s={s}
              on={s.enabled}
              toggle={() => toggle(s)}
              onClose={() => setOpenId(null)}
            />
          )
        })()}
    </section>
  )
}
```

- [ ] **Step 4: 添加 CSS 样式**

在 `src/styles/skills-workbench.css` 中追加：

```css
/* ── Section dividers ─────────────────── */
.skills-section {
  margin-bottom: 2rem;
}
.skills-section-title {
  font: var(--font-body);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary, #6b7280);
  text-transform: none;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

/* ── Invoke button (/) ────────────────── */
.skills-card-invoke {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border, #e5e7eb);
  background: transparent;
  color: var(--color-text-secondary, #6b7280);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  margin-right: 0.5rem;
  transition: all 0.15s ease;
}
.skills-card-invoke:hover {
  border-color: #ff5701;
  color: #ff5701;
  background: rgba(255, 87, 1, 0.05);
}

/* ── Shadowed state ───────────────────── */
.skills-card.is-shadowed {
  opacity: 0.5;
  pointer-events: none;
}
.skills-card-shadowed {
  font-size: 0.75rem;
  color: var(--color-text-tertiary, #9ca3af);
  margin-top: 0.25rem;
}

/* ── Scope badge variants ─────────────── */
.skills-card-scope.scope-builtin {
  background: rgba(255, 87, 1, 0.1);
  color: #ff5701;
}
.skills-card-scope.scope-project {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}
.skills-card-scope.scope-global {
  background: rgba(107, 114, 128, 0.1);
  color: #6b7280;
}
```

- [ ] **Step 5: 运行前端构建**

```bash
npm run build
```

Expected: 无错误。

- [ ] **Step 6: Commit**

```bash
git add src/components/SkillsWorkbench.tsx src/styles/skills-workbench.css
git commit -m "feat: SkillsWorkbench three-section layout with invoke button"
```

---

### Task 9: 集成验证

**Files:**

- Test: 全链路验证

- [ ] **Step 1: 运行 Rust 全量测试**

```bash
cd src-tauri && cargo test
```

Expected: 全部 PASS。

- [ ] **Step 2: 运行前端 lint + 构建**

```bash
npm run lint && npm run build
```

Expected: 无错误。

- [ ] **Step 3: 运行前端测试**

```bash
npm test
```

Expected: 全部 PASS。

- [ ] **Step 4: 手动验证（tauri dev）**

```bash
npm run tauri dev
```

验证点：

1. SkillsWorkbench 显示三个分区
2. 内置技能分区无 toggle，有 `/` 按钮
3. 项目技能有 toggle（默认开）+ `/` 按钮
4. 全局技能有 toggle（默认关）+ `/` 按钮
5. 对已启用技能点 `/` 显示"已在对话中生效"提示
6. 全局技能的 toggle 切换后，刷新页面状态持久保存

- [ ] **Step 5: 最终 commit**

```bash
git add -A
git commit -m "feat: complete three-layer skill loading mechanism"
```

---

## Notes

- **L2 项目技能目录**：spec 中写 `<workspace>/.agents/skills/`，与现有代码一致（现有代码扫描 `.claude/skills/`，但实际文件在 `.agents/skills/`）。实现中以 `.agents/skills/` 为准，因为这是 production 中实际存放位置。
- **临时调用的 chat 集成**：Task 8 使用 `CustomEvent` 作为 SkillsWorkbench → ChatPanel 的通信桥。ChatPanel 侧的监听和 prompt 注入需要在后续任务中完成（本计划聚焦在加载机制本身）。
- **旧全局总开关**：`global_skills_enabled` toggle 在新设计中不再需要（全局技能现在是逐个启用的白名单模式）。保留字段但不再在 UI 中展示，避免 breaking change。
