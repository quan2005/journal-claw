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
        .map(|t| format!("\"{}\"", t))
        .collect::<Vec<_>>()
        .join(", ");
    let content = format!(
        "---\nsummary: \"{}\"\ntags: [{}]\nspeaker_id: \"{}\"\n---\n\n# {}\n",
        summary, tags_yaml, speaker_id, name
    );
    std::fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

pub fn list_identity_entries(workspace: &str) -> Result<Vec<IdentityEntry>, String> {
    use gray_matter::{engine::YAML, Matter};

    let dir = identity_dir(workspace);
    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut entries: Vec<IdentityEntry> = vec![];
    let read_dir = std::fs::read_dir(&dir).map_err(|e| format!("读取 identity 目录失败: {}", e))?;

    for entry in read_dir.flatten() {
        let path = entry.path();
        let filename = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let (region, name) = match parse_identity_filename(&filename) {
            Some(v) => v,
            None => continue,
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
}
