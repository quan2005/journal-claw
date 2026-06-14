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

    // 2. Global skills: ~/.claude/skills/ (only when enabled)
    if crate::workspace_settings::is_global_skills_enabled(&app) {
        if let Some(home) = dirs::home_dir() {
            let global_skills_dir = home.join(".claude").join("skills");
            all_skills.extend(scan_skills_dir(&global_skills_dir, "global"));
        }
    }

    // Resolve per-skill enabled state against the disabled list.
    let disabled = crate::workspace_settings::get_disabled_skills(&app);
    for skill in &mut all_skills {
        skill.enabled = !disabled.contains(&skill.id);
    }

    Ok(all_skills)
}

#[tauri::command]
pub fn open_skills_dir(app: tauri::AppHandle, scope: String) -> Result<(), String> {
    let dir = match scope.as_str() {
        "project" => {
            let config = crate::config::load_config(&app)?;
            if config.workspace_path.is_empty() {
                return Err("workspace_path not set".to_string());
            }
            PathBuf::from(&config.workspace_path)
                .join(".claude")
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
        "project" => {
            let config = crate::config::load_config(&app)?;
            if config.workspace_path.is_empty() {
                return Err("workspace_path not set".to_string());
            }
            PathBuf::from(&config.workspace_path)
                .join(".claude")
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
