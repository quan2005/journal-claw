use serde::Serialize;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize)]
pub struct SkillInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub scope: String,
    pub dir_name: String,
}

fn parse_skill_frontmatter(content: &str) -> Option<(String, String)> {
    let mut name = String::new();
    let mut description = String::new();

    // Try standard YAML frontmatter first: ---\n...\n---
    let trimmed = content.trim();
    if let Some(rest) = trimmed.strip_prefix("---") {
        if let Some(end) = rest.find("---") {
            let yaml_block = &rest[..end];
            for line in yaml_block.lines() {
                let line = line.trim().trim_start_matches('#').trim();
                if let Some(val) = line.strip_prefix("name:") {
                    name = val.trim().trim_matches('"').trim_matches('\'').to_string();
                } else if let Some(val) = line.strip_prefix("description:") {
                    description = val.trim().trim_matches('"').trim_matches('\'').to_string();
                }
            }
        }
    }

    // Fallback: scan first 30 lines for name:/description: (handles unclosed frontmatter)
    if name.is_empty() {
        for line in content.lines().take(30) {
            let line = line.trim().trim_start_matches('#').trim();
            if name.is_empty() {
                if let Some(val) = line.strip_prefix("name:") {
                    name = val.trim().trim_matches('"').trim_matches('\'').to_string();
                }
            }
            if description.is_empty() {
                if let Some(val) = line.strip_prefix("description:") {
                    description = val.trim().trim_matches('"').trim_matches('\'').to_string();
                }
            }
            if !name.is_empty() && !description.is_empty() {
                break;
            }
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
    std::process::Command::new("open")
        .arg(&dir)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_valid_frontmatter() {
        let content =
            "---\nname: ideate\ndescription: \"灵感探讨与设计咨询\"\n---\n\n# Content here\n";
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

// ── Workspace directory browsing ─────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct WorkspaceDirEntry {
    pub name: String,
    pub is_dir: bool,
    pub path: String,
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

        entries.push(WorkspaceDirEntry {
            name,
            is_dir,
            path: rel_path,
        });
    }

    // Sort: directories first, then files, alphabetically within each group
    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.cmp(&b.name),
    });

    Ok(entries)
}
