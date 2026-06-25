use crate::config;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdentityEntry {
    pub filename: String,
    pub path: String,
    pub name: String,
    pub region: String,
    pub summary: String,
    pub tags: Vec<String>,
    pub aliases: Vec<String>,
    pub expert_skill: String,
    pub is_expert: bool,
    pub speaker_id: String,
    pub mtime_secs: i64,
    pub archived: bool,
}

#[derive(Debug, Deserialize, Default)]
struct IdentityFrontMatter {
    #[serde(default)]
    summary: String,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    aliases: Vec<String>,
    #[serde(default)]
    expert_skill: String,
    #[serde(default)]
    speaker_id: String,
    #[serde(default)]
    archived: bool,
}

/// Escape a string for use inside YAML double quotes: `"` → `\"`, `\` → `\\`.
fn yaml_escape(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

/// Reassemble an identity file from its frontmatter fields and body.
/// Every frontmatter-mutating path (archive, merge) goes through this so the
/// serialized shape stays consistent and a new field can't be silently dropped
/// by one writer but not the others.
fn format_identity_content(
    summary: &str,
    tags: &[String],
    aliases: &[String],
    expert_skill: &str,
    speaker_id: &str,
    archived: bool,
    body: &str,
) -> String {
    let tags_yaml = tags
        .iter()
        .map(|t| format!("\"{}\"", yaml_escape(t)))
        .collect::<Vec<_>>()
        .join(", ");
    let aliases_line = if aliases.is_empty() {
        String::new()
    } else {
        let aliases_yaml = aliases
            .iter()
            .map(|t| format!("\"{}\"", yaml_escape(t)))
            .collect::<Vec<_>>()
            .join(", ");
        format!("aliases: [{}]\n", aliases_yaml)
    };
    let expert_skill_line = if expert_skill.trim().is_empty() {
        String::new()
    } else {
        format!("expert_skill: \"{}\"\n", yaml_escape(expert_skill))
    };
    let archived_line = if archived { "archived: true\n" } else { "" };
    format!(
        "---\nsummary: \"{}\"\ntags: [{}]\n{}{}speaker_id: \"{}\"\n{}---\n\n{}",
        yaml_escape(summary),
        tags_yaml,
        aliases_line,
        expert_skill_line,
        yaml_escape(speaker_id),
        archived_line,
        body.trim_start(),
    )
}

pub fn identity_dir(workspace: &str) -> PathBuf {
    PathBuf::from(workspace).join("identity")
}

pub fn ensure_identity_dir(workspace: &str) -> Result<(), String> {
    let dir = identity_dir(workspace);
    std::fs::create_dir_all(&dir).map_err(|e| format!("创建 identity 目录失败: {}", e))
}

/// Build the canonical filename for an identity: `{region}-{name}.md`
pub fn identity_filename(region: &str, name: &str) -> String {
    format!("{}-{}.md", region, name)
}

pub fn is_expert_identity(tags: &[String], expert_skill: &str) -> bool {
    !expert_skill.trim().is_empty()
        || tags
            .iter()
            .any(|tag| tag.trim() == "专家" || tag.trim().eq_ignore_ascii_case("expert"))
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
        "---\nsummary: {}\ntags: [{}]\nspeaker_id: \"{}\"\n---\n\n# {}\n",
        summary,
        tags_yaml,
        yaml_escape(speaker_id),
        name
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
            summary: crate::journal::strip_surrounding_quotes(&fm.summary),
            is_expert: is_expert_identity(&fm.tags, &fm.expert_skill),
            tags: fm.tags,
            aliases: fm.aliases,
            expert_skill: fm.expert_skill,
            speaker_id: fm.speaker_id,
            archived: fm.archived,
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
pub fn save_identity_content(app: AppHandle, path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, &content).map_err(|e| e.to_string())?;
    let _ = app.emit("identity-updated", ());
    Ok(())
}

#[tauri::command]
pub fn delete_identity(app: AppHandle, path: String) -> Result<(), String> {
    let fname = std::path::Path::new(&path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy();
    if fname == "README.md" {
        return Err("不可删除「关于我」".to_string());
    }
    std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    let _ = app.emit("identity-updated", ());
    Ok(())
}

#[tauri::command]
pub fn archive_identity(app: AppHandle, path: String) -> Result<(), String> {
    set_archived_flag(&path, true)?;
    let _ = app.emit("identity-updated", ());
    Ok(())
}

#[tauri::command]
pub fn unarchive_identity(app: AppHandle, path: String) -> Result<(), String> {
    set_archived_flag(&path, false)?;
    let _ = app.emit("identity-updated", ());
    Ok(())
}

/// Set or remove the `archived` flag in an identity file's frontmatter.
/// Parses via gray_matter (a real YAML engine) so a `---` inside a field value
/// cannot corrupt the file the way a naive substring search would. No-op when
/// the file is already in the desired state.
fn set_archived_flag(path: &str, archived: bool) -> Result<(), String> {
    use gray_matter::{engine::YAML, Matter};

    let content = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    let matter = Matter::<YAML>::new();

    let (mut fm, body) = match matter.parse_with_struct::<IdentityFrontMatter>(&content) {
        Some(parsed) => (parsed.data, parsed.content),
        None => {
            // No parseable frontmatter — only prepend one when archiving.
            if !archived {
                return Ok(());
            }
            let with_fm = format!("---\narchived: true\n---\n\n{}", content);
            std::fs::write(path, with_fm).map_err(|e| e.to_string())?;
            return Ok(());
        }
    };

    if fm.archived == archived {
        return Ok(()); // already in the desired state — don't rewrite
    }
    fm.archived = archived;

    let new_content = format_identity_content(
        &fm.summary,
        &fm.tags,
        &fm.aliases,
        &fm.expert_skill,
        &fm.speaker_id,
        archived,
        &body,
    );
    std::fs::write(path, new_content).map_err(|e| e.to_string())?;
    Ok(())
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
    let path = create_identity_file(
        &cfg.workspace_path,
        &region,
        &name,
        &summary,
        &tags,
        &speaker_id,
    )?;
    let _ = app.emit("identity-updated", ());
    Ok(path)
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

    // Update target's speaker_id in frontmatter (both modes need this).
    // Preserve the target's `archived` flag — merging must not silently un-archive it.
    let tgt_body = extract_body(&target_content);
    let new_target = format_identity_content(
        &tgt_fm.summary,
        &tgt_fm.tags,
        &tgt_fm.aliases,
        &tgt_fm.expert_skill,
        &merged_speaker_id,
        tgt_fm.archived,
        tgt_body,
    );
    std::fs::write(&target_path, new_target).map_err(|e| e.to_string())?;

    // Reassign speaker profiles
    if !src_fm.speaker_id.is_empty() && src_fm.speaker_id != merged_speaker_id {
        let _ = crate::speaker_profiles::reassign_speaker_id(
            &app,
            &src_fm.speaker_id,
            &merged_speaker_id,
        );
    }

    if mode == "voice_only" {
        // voice_only: just delete source, we're done
        std::fs::remove_file(&source_path).map_err(|e| e.to_string())?;
    }
    // full: source file is kept — AI will merge content and delete it

    let _ = app.emit("identity-updated", ());
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

    #[test]
    fn set_archived_flag_preserves_summary_containing_dashes() {
        // Regression: a summary containing "---" must survive an archive toggle.
        // The old string-surgery impl used content.find("---"), which matched
        // the "---" inside the summary value and corrupted the whole file.
        let file = tempfile::NamedTempFile::new().unwrap();
        let path = file.path().to_string_lossy().to_string();
        let original =
            "---\nsummary: 会议---复盘\ntags: [\"x\"]\nspeaker_id: \"spk-1\"\n---\n\n# 张三\n";
        std::fs::write(&path, original).unwrap();

        set_archived_flag(&path, true).unwrap();

        let rewritten = std::fs::read_to_string(&path).unwrap();
        let matter = gray_matter::Matter::<gray_matter::engine::YAML>::new();
        let parsed = matter
            .parse_with_struct::<IdentityFrontMatter>(&rewritten)
            .map(|p| p.data)
            .unwrap_or_default();
        assert_eq!(parsed.summary, "会议---复盘");
        assert!(parsed.archived);
    }

    #[test]
    fn format_identity_content_includes_archived_only_when_set() {
        let tags = vec!["a".to_string()];
        let archived = format_identity_content("s", &tags, &[], "", "spk", true, "正文");
        assert!(archived.contains("archived: true"));
        assert!(archived.contains("summary: \"s\""));

        let active = format_identity_content("s", &[], &[], "", "spk", false, "正文");
        assert!(!active.contains("archived"));
    }

    #[test]
    fn set_archived_flag_roundtrips_archive_then_unarchive() {
        let file = tempfile::NamedTempFile::new().unwrap();
        let path = file.path().to_string_lossy().to_string();
        let original =
            "---\nsummary: 简介含\"引号\"\ntags: [\"x\", \"y\"]\nspeaker_id: \"spk-1\"\n---\n\n# 张三\n";
        std::fs::write(&path, original).unwrap();

        set_archived_flag(&path, true).unwrap();
        set_archived_flag(&path, false).unwrap();

        let rewritten = std::fs::read_to_string(&path).unwrap();
        let matter = gray_matter::Matter::<gray_matter::engine::YAML>::new();
        let parsed = matter
            .parse_with_struct::<IdentityFrontMatter>(&rewritten)
            .map(|p| p.data)
            .unwrap_or_default();
        assert_eq!(parsed.summary, "简介含\"引号\"");
        assert_eq!(parsed.tags, vec!["x".to_string(), "y".to_string()]);
        assert_eq!(parsed.speaker_id, "spk-1");
        assert!(!parsed.archived);
    }

    #[test]
    fn expert_identity_detects_tag_or_skill() {
        assert!(is_expert_identity(&["专家".to_string()], ""));
        assert!(is_expert_identity(&["expert".to_string()], ""));
        assert!(is_expert_identity(&[], "technical-architect-perspective"));
        assert!(!is_expert_identity(&["人物".to_string()], ""));
    }

    #[test]
    fn format_identity_content_preserves_expert_fields() {
        let content = format_identity_content(
            "s",
            &["专家".to_string()],
            &["架构师".to_string()],
            "technical-architect-perspective",
            "spk",
            false,
            "正文",
        );

        assert!(content.contains("tags: [\"专家\"]"));
        assert!(content.contains("aliases: [\"架构师\"]"));
        assert!(content.contains("expert_skill: \"technical-architect-perspective\""));
    }
}
