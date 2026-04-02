use crate::config;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::AppHandle;

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

/// Escape a string for use inside YAML double quotes: `"` → `\"`, `\` → `\\`.
fn yaml_escape(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

pub fn identity_dir(workspace: &str) -> PathBuf {
    PathBuf::from(workspace).join("identity")
}

pub fn ensure_identity_dir(workspace: &str) -> Result<(), String> {
    let dir = identity_dir(workspace);
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("创建 identity 目录失败: {}", e))
}

/// Build the canonical filename for an identity: `{region}-{name}.md`
pub fn identity_filename(region: &str, name: &str) -> String {
    format!("{}-{}.md", region, name)
}

/// Create a new identity file with minimal frontmatter. Returns the absolute path.
/// Returns an error if the file already exists.
pub fn create_identity_file(
    workspace: &str,
    region: &str,
    name: &str,
    summary: &str,
    tags: &[String],
    speaker_id: &str,
) -> Result<String, String> {
    ensure_identity_dir(workspace)?;
    let filename = identity_filename(region, name);
    let path = identity_dir(workspace).join(&filename);
    if path.exists() {
        return Err(format!("身份文件已存在: {}", filename));
    }
    let tags_yaml = tags
        .iter()
        .map(|t| format!("\"{}\"", yaml_escape(t)))
        .collect::<Vec<_>>()
        .join(", ");
    let content = format!(
        "---\nsummary: \"{}\"\ntags: [{}]\nspeaker_id: \"{}\"\n---\n\n# {}\n",
        yaml_escape(summary), tags_yaml, yaml_escape(speaker_id), name
    );
    std::fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// Ensure a user-self identity file (about-me.md) exists. If not found, create it.
fn ensure_self_identity(workspace: &str) -> Result<(), String> {
    let dir = identity_dir(workspace);
    if !dir.exists() {
        return Ok(());
    }
    let path = dir.join("README.md");
    if path.exists() {
        return Ok(());
    }
    let content = r#"---
summary: "你的个人档案，谨迹会参考这里的信息来更好地整理你的日志"
tags: []
speaker_id: ""
---

# 关于我

## 基本信息

- 姓名：
- 角色：
- 所在地：

## 工作偏好

- 沟通风格：
- 关注领域：
"#;
    std::fs::write(&path, content).map_err(|e| format!("创建用户身份失败: {}", e))?;
    Ok(())
}

pub fn list_identity_entries(workspace: &str) -> Result<Vec<IdentityEntry>, String> {
    use gray_matter::{engine::YAML, Matter};

    let dir = identity_dir(workspace);
    if !dir.exists() {
        ensure_identity_dir(workspace)?;
    }

    // Ensure user-self identity exists (我-*.md)
    ensure_self_identity(workspace)?;

    let mut entries: Vec<IdentityEntry> = vec![];
    let read_dir = std::fs::read_dir(&dir).map_err(|e| format!("读取 identity 目录失败: {}", e))?;

    for entry in read_dir.flatten() {
        let path = entry.path();
        let filename = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        // Special case: README.md is the user-self identity
        let (region, name) = if filename == "README.md" {
            (String::new(), "关于我".to_string())
        } else {
            match parse_identity_filename(&filename) {
                Some(v) => v,
                None => continue,
            }
        };

        let content = std::fs::read_to_string(&path).unwrap_or_default();
        let matter = Matter::<YAML>::new();
        let fm: IdentityFrontMatter = matter
            .parse_with_struct::<IdentityFrontMatter>(&content)
            .map(|p| p.data)
            .unwrap_or_default();

        let mtime = entry.metadata().ok().and_then(|m| m.modified().ok());
        let mtime_secs = mtime
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);

        entries.push(IdentityEntry {
            filename,
            path: path.to_string_lossy().to_string(),
            name,
            region,
            summary: fm.summary,
            tags: fm.tags,
            speaker_id: fm.speaker_id,
            mtime_secs,
        });
    }

    entries.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(entries)
}

#[tauri::command]
pub fn list_identities(app: AppHandle) -> Result<Vec<IdentityEntry>, String> {
    let cfg = config::load_config(&app)?;
    if cfg.workspace_path.is_empty() {
        return Ok(vec![]);
    }
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
    let fname = std::path::Path::new(&path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy();
    if fname == "README.md" {
        return Err("不可删除「关于我」".to_string());
    }
    std::fs::remove_file(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_identity(
    app: AppHandle,
    region: String,
    name: String,
    summary: String,
    tags: Vec<String>,
    speaker_id: String,
) -> Result<String, String> {
    let cfg = config::load_config(&app)?;
    if cfg.workspace_path.is_empty() {
        return Err("workspace not configured".to_string());
    }
    create_identity_file(&cfg.workspace_path, &region, &name, &summary, &tags, &speaker_id)
}

/// Merge source identity into target.
/// - voice_only: update target's speaker_id to source's speaker_id (if target has none), delete source file.
/// - full: merge speaker_id, then delegate content merging to AI engine. Source file is NOT deleted
///   here — the AI prompt instructs it to delete source after intelligent content merge.
#[tauri::command]
pub fn merge_identity(
    app: AppHandle,
    source_path: String,
    target_path: String,
    mode: String, // "voice_only" | "full"
) -> Result<(), String> {
    use gray_matter::{engine::YAML, Matter};

    if source_path == target_path {
        return Err("Cannot merge an identity into itself".to_string());
    }

    let source_content = std::fs::read_to_string(&source_path).map_err(|e| e.to_string())?;
    let target_content = std::fs::read_to_string(&target_path).map_err(|e| e.to_string())?;

    let matter = Matter::<YAML>::new();
    let src_fm: IdentityFrontMatter = matter
        .parse_with_struct::<IdentityFrontMatter>(&source_content)
        .map(|p| p.data)
        .unwrap_or_default();
    let tgt_fm: IdentityFrontMatter = matter
        .parse_with_struct::<IdentityFrontMatter>(&target_content)
        .map(|p| p.data)
        .unwrap_or_default();

    // Determine merged speaker_id: prefer target's if set, else source's
    let merged_speaker_id = if !tgt_fm.speaker_id.is_empty() {
        tgt_fm.speaker_id.clone()
    } else {
        src_fm.speaker_id.clone()
    };

    // Update target's speaker_id in frontmatter (both modes need this)
    let tags_yaml = tgt_fm.tags
        .iter()
        .map(|t| format!("\"{}\"", yaml_escape(t)))
        .collect::<Vec<_>>()
        .join(", ");
    let tgt_body = extract_body(&target_content);
    let new_target = format!(
        "---\nsummary: \"{}\"\ntags: [{}]\nspeaker_id: \"{}\"\n---\n\n{}",
        yaml_escape(&tgt_fm.summary), tags_yaml, yaml_escape(&merged_speaker_id), tgt_body.trim_start()
    );
    std::fs::write(&target_path, new_target).map_err(|e| e.to_string())?;

    // Reassign speaker profiles
    if !src_fm.speaker_id.is_empty() && src_fm.speaker_id != merged_speaker_id {
        let _ = crate::speaker_profiles::reassign_speaker_id(&app, &src_fm.speaker_id, &merged_speaker_id);
    }

    if mode == "voice_only" {
        // voice_only: just delete source, we're done
        std::fs::remove_file(&source_path).map_err(|e| e.to_string())?;
    }
    // full: source file is kept — AI will merge content and delete it

    Ok(())
}

fn extract_body(content: &str) -> &str {
    if let Some(rest) = content.strip_prefix("---") {
        if let Some(end) = rest.find("\n---") {
            let after = &rest[end + 4..]; // skip "\n---"
            return after.trim_start_matches('\n');
        }
    }
    content
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

    #[test]
    fn yaml_escape_quotes_and_backslashes() {
        assert_eq!(yaml_escape(r#"hello "world""#), r#"hello \"world\""#);
        assert_eq!(yaml_escape(r#"back\slash"#), r#"back\\slash"#);
        assert_eq!(yaml_escape("plain"), "plain");
    }
}
