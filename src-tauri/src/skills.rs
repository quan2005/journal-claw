use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// One trigger entry for a skill. `kind` is a short semantic tag
/// (`slash` / `auto` / `drop` / `nl` / `menu` / …) controlling chip rendering;
/// `label` is the human-readable trigger text (e.g. `"/lint"`, `"自然语言"`).
#[derive(Debug, Clone, Serialize)]
pub struct TriggerInfo {
    pub kind: String,
    pub label: String,
}

/// One rule/resource a skill loads. `kind` ∈ `md` / `json` / `dir`.
#[derive(Debug, Clone, Serialize)]
pub struct LoadInfo {
    pub name: String,
    #[serde(rename = "type")]
    pub kind: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SkillInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub scope: String,
    pub dir_name: String,
    /// Triggers parsed from frontmatter `triggers:` (YAML list). Empty when absent.
    #[serde(default)]
    pub triggers: Vec<TriggerInfo>,
    /// Output description from frontmatter `output:`. None when absent.
    #[serde(default)]
    pub output: Option<String>,
    /// Resources the skill loads (references/, assets/, SKILL.md). Empty when none found.
    #[serde(default)]
    pub loads: Vec<LoadInfo>,
    /// Whether this skill is currently enabled (project skills default true;
    /// global skills gated by the global toggle + per-skill disabled list).
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    /// If this skill is shadowed by a higher-priority skill (L1 > L2 > L3),
    /// this holds the shadowing skill's id. UI uses this to grey out and explain.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shadowed_by: Option<String>,
}

fn default_enabled() -> bool {
    true
}

/// Typed frontmatter shape for gray_matter deserialization. Only `name` is required;
/// `description` / `output` / `triggers` are optional. `triggers` accepts either a list
/// of strings (`["/lint"]`) or a list of objects (`[{k: slash, t: "/lint"}]`) — both
/// deserialize into `TriggerRaw`, which normalizes to `TriggerInfo`.
#[derive(Debug, Deserialize, Default)]
struct SkillFrontMatter {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    output: Option<String>,
    #[serde(default)]
    triggers: Vec<TriggerRaw>,
}

/// Accept either `"/lint"` (string) or `{k: slash, t: "/lint"}` (object) in the
/// frontmatter `triggers:` list. The custom impl normalizes both forms.
#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum TriggerRaw {
    Object {
        #[serde(default)]
        k: Option<String>,
        #[serde(default)]
        kind: Option<String>,
        #[serde(default)]
        t: Option<String>,
        #[serde(default)]
        label: Option<String>,
        #[serde(default)]
        text: Option<String>,
    },
    String(String),
}

impl TriggerRaw {
    fn into_info(self) -> TriggerInfo {
        match self {
            TriggerRaw::String(s) => trigger_from_string(&s),
            TriggerRaw::Object {
                k,
                kind,
                t,
                label,
                text,
            } => {
                let kind = k.or(kind).unwrap_or_else(|| "nl".to_string());
                let label = t.or(label).or(text).unwrap_or_else(|| kind.clone());
                TriggerInfo { kind, label }
            }
        }
    }
}

/// Parse a skill's SKILL.md frontmatter via gray_matter (a real YAML engine),
/// returning (name, description, triggers, output). `name` missing → None (skip skill).
fn parse_skill_frontmatter(
    content: &str,
) -> Option<(String, String, Vec<TriggerInfo>, Option<String>)> {
    use gray_matter::{engine::YAML, Matter};

    let matter = Matter::<YAML>::new();
    let parsed = matter.parse_with_struct::<SkillFrontMatter>(content);
    let fm = match parsed {
        Some(p) => p.data,
        None => {
            // gray_matter failed (malformed YAML, unclosed frontmatter). Fall back to the
            // line-based parser for name+description; triggers/output are unavailable.
            let name = crate::frontmatter::parse_frontmatter_field(content, "name")?;
            let description =
                crate::frontmatter::parse_frontmatter_field(content, "description")
                    .unwrap_or_default();
            return Some((name, description, vec![], None));
        }
    };

    let name = fm.name.filter(|s| !s.trim().is_empty())?;
    let description = fm.description.unwrap_or_default();
    let output = fm.output.filter(|s| !s.trim().is_empty());
    let triggers = fm.triggers.into_iter().map(|t| t.into_info()).collect();
    Some((name, description, triggers, output))
}

/// Infer a trigger kind from a plain string value: slash commands start with `/`.
fn trigger_from_string(s: &str) -> TriggerInfo {
    let s = s.trim();
    let kind = if s.starts_with('/') {
        "slash".to_string()
    } else {
        "nl".to_string()
    };
    TriggerInfo {
        kind,
        label: s.to_string(),
    }
}

/// Build the `loads` list: SKILL.md itself + entries under references/ and assets/.
fn scan_skill_loads(skill_dir: &PathBuf) -> Vec<LoadInfo> {
    let mut loads = Vec::new();
    let skill_md = skill_dir.join("SKILL.md");
    if skill_md.exists() {
        loads.push(LoadInfo {
            name: "SKILL.md".to_string(),
            kind: "md".to_string(),
        });
    }
    for sub in ["references", "assets"] {
        let sub_dir = skill_dir.join(sub);
        if let Ok(entries) = fs::read_dir(&sub_dir) {
            let mut files: Vec<(String, String)> = entries
                .flatten()
                .filter_map(|e| {
                    let p = e.path();
                    let name = format!("{}/{}", sub, p.file_name()?.to_string_lossy());
                    let kind = if p.is_dir() {
                        "dir".to_string()
                    } else {
                        match p.extension().and_then(|x| x.to_str()) {
                            Some("md") => "md".to_string(),
                            Some("json") => "json".to_string(),
                            _ => "file".to_string(),
                        }
                    };
                    Some((name, kind))
                })
                .collect();
            files.sort_by(|a, b| a.0.cmp(&b.0));
            for (name, kind) in files {
                loads.push(LoadInfo { name, kind });
            }
        }
    }
    loads
}

/// Scan builtin skills bundled inside the app resources directory.
fn scan_builtin_skills(app: &tauri::AppHandle) -> Vec<SkillInfo> {
    use tauri::Manager;
    let resource_dir = app
        .path()
        .resource_dir()
        .unwrap_or_default()
        .join("resources")
        .join("builtin-skills");
    scan_skills_dir(&resource_dir, "builtin")
}

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
                let plugin_name = entry
                    .file_name()
                    .to_string_lossy()
                    .to_string();
                let plugin_skills = scan_skills_dir(&skills_dir, "global");
                for mut skill in plugin_skills {
                    skill.dir_name = format!("{}/{}", plugin_name, skill.dir_name);
                    skill.id = format!("global:{}", skill.dir_name);
                    all.push(skill);
                }
            }
        }
    }

    all
}

/// Merge skills from three layers with strict priority: builtin > project > global.
/// Same-name skills at lower priority get shadowed_by set and enabled = false.
fn merge_skills_with_priority(
    builtin: Vec<SkillInfo>,
    project: Vec<SkillInfo>,
    global: Vec<SkillInfo>,
) -> Vec<SkillInfo> {
    let mut result: Vec<SkillInfo> = Vec::new();
    let mut seen_names: Vec<(String, String)> = Vec::new(); // (name, id)

    for skill in builtin {
        seen_names.push((skill.name.clone(), skill.id.clone()));
        result.push(skill);
    }

    for mut skill in project {
        if let Some((_, shadow_id)) = seen_names.iter().find(|(n, _)| n == &skill.name) {
            skill.shadowed_by = Some(shadow_id.clone());
            skill.enabled = false;
        } else {
            seen_names.push((skill.name.clone(), skill.id.clone()));
        }
        result.push(skill);
    }

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

        let (name, description, triggers, output) = match parse_skill_frontmatter(&content) {
            Some(pair) => pair,
            None => continue,
        };

        let loads = scan_skill_loads(&path);
        let id = format!("{}:{}", scope, dir_name);

        skills.push(SkillInfo {
            id,
            name,
            description,
            scope: scope.to_string(),
            dir_name,
            triggers,
            output,
            loads,
            // enabled is resolved by the caller (list_skills) against the disabled list.
            enabled: true,
            shadowed_by: None,
        });
    }

    skills.sort_by(|a, b| a.name.cmp(&b.name));
    skills
}

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

/// Return the full SKILL.md content for a skill by its id.
/// Used for one-shot `/` invocation in the chat UI.
#[tauri::command]
pub async fn get_skill_content(app: tauri::AppHandle, skill_id: String) -> Result<String, String> {
    use tauri::Manager;
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
            let home = dirs::home_dir().ok_or("cannot resolve home directory")?;
            if dir_name.contains('/') {
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

#[tauri::command]
pub fn open_skills_dir(app: tauri::AppHandle, scope: String) -> Result<(), String> {
    let dir = match scope.as_str() {
        "builtin" => {
            // Builtin skills are in the app bundle — open the source copy in .agents/skills
            let config = crate::config::load_config(&app)?;
            if config.workspace_path.is_empty() {
                return Err("workspace_path not set".to_string());
            }
            PathBuf::from(&config.workspace_path)
                .join(".agents")
                .join("skills")
        }
        "project" => {
            let config = crate::config::load_config(&app)?;
            if config.workspace_path.is_empty() {
                return Err("workspace_path not set".to_string());
            }
            PathBuf::from(&config.workspace_path)
                .join(".agents")
                .join("skills")
        }
        "global" => dirs::home_dir()
            .ok_or("cannot resolve home directory")?
            .join(".claude")
            .join("skills"),
        _ => return Err(format!("invalid scope: {}", scope)),
    };

    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    crate::platform::open_with_system(&dir.to_string_lossy())
}

/// Open the directory containing a specific skill's SKILL.md (used by the drawer's
/// "edit skill" affordance). Falls back to the scope skills directory.
#[tauri::command]
pub fn open_skill_dir(app: tauri::AppHandle, scope: String, dir_name: String) -> Result<(), String> {
    let base = match scope.as_str() {
        "builtin" => {
            // Builtin skills are read-only in the bundle — open the source copy in .agents/skills
            let config = crate::config::load_config(&app)?;
            if config.workspace_path.is_empty() {
                return Err("workspace_path not set".to_string());
            }
            PathBuf::from(&config.workspace_path)
                .join(".agents")
                .join("skills")
        }
        "project" => {
            let config = crate::config::load_config(&app)?;
            if config.workspace_path.is_empty() {
                return Err("workspace_path not set".to_string());
            }
            PathBuf::from(&config.workspace_path)
                .join(".agents")
                .join("skills")
        }
        "global" => dirs::home_dir()
            .ok_or("cannot resolve home directory")?
            .join(".claude")
            .join("skills"),
        _ => return Err(format!("invalid scope: {}", scope)),
    };
    let target = base.join(&dir_name);
    if !target.exists() {
        return Err(format!("skill directory not found: {}", target.display()));
    }
    crate::platform::open_with_system(&target.to_string_lossy())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_valid_frontmatter() {
        let content =
            "---\nname: ideate\ndescription: \"灵感探讨与设计咨询\"\n---\n\n# Content here\n";
        let (name, desc, triggers, output) = parse_skill_frontmatter(content).unwrap();
        assert_eq!(name, "ideate");
        assert_eq!(desc, "灵感探讨与设计咨询");
        assert!(triggers.is_empty());
        assert!(output.is_none());
    }

    #[test]
    fn parse_triggers_as_string_list() {
        let content =
            "---\nname: lint\ndescription: 日志库整理\ntriggers:\n  - \"/lint\"\n  - \"记住这个\"\n---\n";
        let (_, _, triggers, _) = parse_skill_frontmatter(content).unwrap();
        assert_eq!(triggers.len(), 2);
        assert_eq!(triggers[0].kind, "slash");
        assert_eq!(triggers[0].label, "/lint");
        assert_eq!(triggers[1].kind, "nl");
        assert_eq!(triggers[1].label, "记住这个");
    }

    #[test]
    fn parse_triggers_as_object_list() {
        let content =
            "---\nname: journal\ntriggers:\n  - k: slash\n    t: \"/lint\"\n  - k: drop\n    t: \"拖入文件\"\n---\n";
        let (_, _, triggers, _) = parse_skill_frontmatter(content).unwrap();
        assert_eq!(triggers.len(), 2);
        assert_eq!(triggers[0].kind, "slash");
        assert_eq!(triggers[0].label, "/lint");
        assert_eq!(triggers[1].kind, "drop");
        assert_eq!(triggers[1].label, "拖入文件");
    }

    #[test]
    fn parse_output_field() {
        let content = "---\nname: journal\noutput: 结构化 Markdown 知识条目\n---\n";
        let (_, _, _, output) = parse_skill_frontmatter(content).unwrap();
        assert_eq!(output.as_deref(), Some("结构化 Markdown 知识条目"));
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

    #[test]
    fn trigger_from_string_infers_slash() {
        let t = trigger_from_string("/self-improve");
        assert_eq!(t.kind, "slash");
        assert_eq!(t.label, "/self-improve");
    }

    #[test]
    fn trigger_from_string_defaults_nl() {
        let t = trigger_from_string("帮我想想");
        assert_eq!(t.kind, "nl");
    }

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
}

// ── Workspace directory browsing ─────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct WorkspaceDirEntry {
    pub name: String,
    pub is_dir: bool,
    pub path: String,
    pub mtime_secs: u64,
}

#[tauri::command]
pub fn list_workspace_dir(
    app: tauri::AppHandle,
    relative_path: String,
) -> Result<Vec<WorkspaceDirEntry>, String> {
    let config = crate::config::load_config(&app)?;
    if config.workspace_path.is_empty() {
        return Err("workspace_path not set".to_string());
    }

    let workspace = std::path::PathBuf::from(&config.workspace_path);
    let target = if relative_path.is_empty() {
        workspace.clone()
    } else {
        workspace.join(&relative_path)
    };

    // Security: ensure target is within workspace
    let canonical_workspace = workspace.canonicalize().map_err(|e| e.to_string())?;
    let canonical_target = target
        .canonicalize()
        .map_err(|e| format!("路径不存在: {}", e))?;
    if !canonical_target.starts_with(&canonical_workspace) {
        return Err("路径超出 workspace 范围".to_string());
    }

    let mut entries: Vec<WorkspaceDirEntry> = Vec::new();
    let read_dir = fs::read_dir(&canonical_target).map_err(|e| e.to_string())?;

    for entry in read_dir.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files and .claude/ .conversations/ directories
        if name.starts_with('.') {
            continue;
        }

        let is_dir = entry.path().is_dir();
        let rel_path = if relative_path.is_empty() {
            name.clone()
        } else {
            format!("{}/{}", relative_path, name)
        };

        let mtime_secs = entry
            .metadata()
            .and_then(|m| m.modified())
            .map(|t| {
                t.duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs()
            })
            .unwrap_or(0);

        entries.push(WorkspaceDirEntry {
            name,
            is_dir,
            path: rel_path,
            mtime_secs,
        });
    }

    // Sort: directories first, then files; within each group by name descending
    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => b.name.cmp(&a.name),
    });

    Ok(entries)
}

#[tauri::command]
pub fn workspace_duplicate_file(
    app: tauri::AppHandle,
    relative_path: String,
) -> Result<String, String> {
    let config = crate::config::load_config(&app)?;
    let workspace = std::path::PathBuf::from(&config.workspace_path);
    let source = workspace.join(&relative_path);
    if !source.exists() {
        return Err("文件不存在".to_string());
    }
    let stem = source
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let ext = source
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();
    let parent = source.parent().unwrap();
    let mut i = 1;
    let dest = loop {
        let name = format!(
            "{} copy{}{}",
            stem,
            if i > 1 {
                format!(" {}", i)
            } else {
                String::new()
            },
            ext
        );
        let candidate = parent.join(&name);
        if !candidate.exists() {
            break candidate;
        }
        i += 1;
    };
    fs::copy(&source, &dest).map_err(|e| e.to_string())?;
    let dest_rel = dest
        .strip_prefix(&workspace)
        .unwrap_or(&dest)
        .to_string_lossy()
        .to_string();
    Ok(dest_rel)
}

#[tauri::command]
pub fn workspace_rename_file(
    app: tauri::AppHandle,
    relative_path: String,
    new_name: String,
) -> Result<String, String> {
    let config = crate::config::load_config(&app)?;
    let workspace = std::path::PathBuf::from(&config.workspace_path);
    let source = workspace.join(&relative_path);
    if !source.exists() {
        return Err("文件不存在".to_string());
    }
    let parent = source.parent().unwrap();
    let dest = parent.join(&new_name);
    if dest.exists() {
        return Err("目标文件已存在".to_string());
    }
    fs::rename(&source, &dest).map_err(|e| e.to_string())?;
    let dest_rel = dest
        .strip_prefix(&workspace)
        .unwrap_or(&dest)
        .to_string_lossy()
        .to_string();
    Ok(dest_rel)
}

#[tauri::command]
pub fn workspace_move_file(
    app: tauri::AppHandle,
    relative_path: String,
    dest_dir: String,
) -> Result<String, String> {
    let config = crate::config::load_config(&app)?;
    let workspace = std::path::PathBuf::from(&config.workspace_path);
    let source = workspace.join(&relative_path);
    if !source.exists() {
        return Err("文件不存在".to_string());
    }
    let target_dir = workspace.join(&dest_dir);
    if !target_dir.is_dir() {
        return Err("目标目录不存在".to_string());
    }
    let filename = source.file_name().unwrap();
    let dest = target_dir.join(filename);
    if dest.exists() {
        return Err("目标位置已存在同名文件".to_string());
    }
    fs::rename(&source, &dest).map_err(|e| e.to_string())?;
    let dest_rel = dest
        .strip_prefix(&workspace)
        .unwrap_or(&dest)
        .to_string_lossy()
        .to_string();
    Ok(dest_rel)
}

#[tauri::command]
pub fn workspace_delete_file(app: tauri::AppHandle, relative_path: String) -> Result<(), String> {
    let config = crate::config::load_config(&app)?;
    let workspace = std::path::PathBuf::from(&config.workspace_path);
    let target = workspace.join(&relative_path);
    if !target.exists() {
        return Err("文件不存在".to_string());
    }
    if target.is_dir() {
        fs::remove_dir_all(&target).map_err(|e| e.to_string())?;
    } else {
        fs::remove_file(&target).map_err(|e| e.to_string())?;
    }
    Ok(())
}
