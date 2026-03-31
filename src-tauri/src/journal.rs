use crate::config;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawMaterial {
    pub filename: String,
    pub path: String,
    pub kind: String, // "audio" | "text" | "pdf" | "docx" | "markdown" | "other"
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalEntry {
    pub filename: String,     // "28-AI平台产品会议纪要.md"
    pub path: String,         // absolute path
    pub title: String,        // "AI平台产品会议纪要"
    pub summary: String,      // from frontmatter
    pub tags: Vec<String>,    // from frontmatter
    pub year_month: String,   // "2603"
    pub day: u32,             // 28
    pub created_time: String, // "10:15" (from file mtime)
    pub materials: Vec<RawMaterial>,
}

#[derive(Debug, Deserialize, Default)]
struct FrontMatter {
    #[serde(default)]
    summary: String,
    #[serde(default)]
    tags: Vec<String>,
}

/// Regex-based fallback for when gray_matter fails to parse malformed YAML frontmatter.
/// Handles the common case of unescaped ASCII double-quotes inside a double-quoted
/// YAML scalar (e.g. `summary: "创办"15餐厅"…"`), which is technically invalid YAML
/// but produced by LLMs that don't escape embedded quotes.
fn parse_frontmatter_fallback(content: &str) -> FrontMatter {
    // Extract the raw frontmatter block between the first pair of `---` delimiters.
    let inner = match content.strip_prefix("---") {
        Some(rest) => match rest.find("\n---") {
            Some(end) => &rest[..end],
            None => return FrontMatter::default(),
        },
        None => return FrontMatter::default(),
    };

    let mut summary = String::new();
    let mut tags: Vec<String> = vec![];

    for line in inner.lines() {
        if let Some(val) = line.strip_prefix("summary:") {
            summary = extract_scalar_value(val.trim());
        } else if let Some(val) = line.strip_prefix("tags:") {
            tags = extract_inline_sequence(val.trim());
        }
    }

    FrontMatter { summary, tags }
}

/// Strip outer single or double quotes from a YAML scalar value, returning the raw content.
/// Does not validate or interpret escape sequences — intentionally lenient.
fn extract_scalar_value(s: &str) -> String {
    if (s.starts_with('"') && s.ends_with('"')) || (s.starts_with('\'') && s.ends_with('\'')) {
        s[1..s.len() - 1].to_string()
    } else {
        s.to_string()
    }
}

/// Parse a YAML inline sequence like `[journal, meeting]` into a Vec<String>.
fn extract_inline_sequence(s: &str) -> Vec<String> {
    let inner = s.trim_start_matches('[').trim_end_matches(']');
    inner
        .split(',')
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
        .collect()
}

pub fn parse_entry_filename(filename: &str) -> Option<(u32, String)> {
    // "28-AI平台产品会议纪要.md" → Some((28, "AI平台产品会议纪要"))
    let stem = filename.strip_suffix(".md")?;
    let dash_pos = stem.find('-')?;
    let day_str = &stem[..dash_pos];
    let title = &stem[dash_pos + 1..];
    if title.is_empty() {
        return None;
    }
    let day: u32 = day_str.parse().ok()?;
    Some((day, title.to_string()))
}

pub fn material_kind(filename: &str) -> String {
    let ext = std::path::Path::new(filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    match ext.as_str() {
        "m4a" | "wav" | "mp3" | "aac" | "ogg" | "flac" => "audio",
        "txt" => "text",
        "md" | "markdown" => "markdown",
        "pdf" => "pdf",
        "docx" | "doc" => "docx",
        _ => "other",
    }
    .to_string()
}

fn is_internal_material(filename: &str) -> bool {
    filename.ends_with(".audio-ai.md") || filename.ends_with(".transcript.json")
}

pub fn list_entries(workspace: &str, year_month: &str) -> Result<Vec<JournalEntry>, String> {
    use crate::workspace;
    use gray_matter::{engine::YAML, Matter};

    let ym_dir = workspace::year_month_dir(workspace, year_month);
    if !ym_dir.exists() {
        return Ok(vec![]);
    }

    let raw_dir = workspace::raw_dir(workspace, year_month);
    let mut entries: Vec<JournalEntry> = vec![];

    let read_dir = std::fs::read_dir(&ym_dir).map_err(|e| format!("读取目录失败: {}", e))?;

    for entry in read_dir {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let filename = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let (day, title) = match parse_entry_filename(&filename) {
            Some(v) => v,
            None => continue,
        };

        let content = std::fs::read_to_string(&path).unwrap_or_default();

        let matter = Matter::<YAML>::new();
        let fm: FrontMatter = matter
            .parse_with_struct::<FrontMatter>(&content)
            .map(|p| p.data)
            .unwrap_or_else(|| parse_frontmatter_fallback(&content));

        // mtime as HH:mm
        let created_time = entry
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .map(|t| {
                let dt: chrono::DateTime<chrono::Local> = t.into();
                dt.format("%H:%M").to_string()
            })
            .unwrap_or_default();

        // collect materials from raw/
        let mut materials: Vec<RawMaterial> = vec![];
        if raw_dir.exists() {
            if let Ok(rdir) = std::fs::read_dir(&raw_dir) {
                for rentry in rdir.flatten() {
                    let rpath = rentry.path();
                    let rname = rpath
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    if is_internal_material(&rname) {
                        continue;
                    }
                    let size = rentry.metadata().map(|m| m.len()).unwrap_or(0);
                    materials.push(RawMaterial {
                        filename: rname.clone(),
                        path: rpath.to_string_lossy().to_string(),
                        kind: material_kind(&rname),
                        size_bytes: size,
                    });
                }
            }
        }

        entries.push(JournalEntry {
            filename,
            path: path.to_string_lossy().to_string(),
            title,
            summary: fm.summary,
            tags: fm.tags,
            year_month: year_month.to_string(),
            day,
            created_time,
            materials,
        });
    }

    // Sort by day descending, then by filename descending within same day
    entries.sort_by(|a, b| b.day.cmp(&a.day).then(b.filename.cmp(&a.filename)));
    Ok(entries)
}

#[tauri::command]
pub fn list_journal_entries(
    app: AppHandle,
    year_month: String,
) -> Result<Vec<JournalEntry>, String> {
    let cfg = config::load_config(&app)?;
    if cfg.workspace_path.is_empty() {
        return Ok(vec![]);
    }
    list_entries(&cfg.workspace_path, &year_month)
}

#[tauri::command]
pub async fn list_all_journal_entries(app: AppHandle) -> Result<Vec<JournalEntry>, String> {
    let cfg = config::load_config(&app)?;
    if cfg.workspace_path.is_empty() {
        return Ok(vec![]);
    }
    let workspace = cfg.workspace_path.clone();
    tokio::task::spawn_blocking(move || {
        let ws_path = std::path::PathBuf::from(&workspace);
        if !ws_path.exists() {
            return Ok(vec![]);
        }

        let mut all: Vec<JournalEntry> = vec![];
        let read_dir = std::fs::read_dir(&ws_path).map_err(|e| e.to_string())?;

        for entry in read_dir.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.len() == 4 && name.chars().all(|c| c.is_ascii_digit()) {
                let mut batch = list_entries(&workspace, &name)?;
                all.append(&mut batch);
            }
        }

        all.sort_by(|a, b| {
            b.year_month
                .cmp(&a.year_month)
                .then(b.day.cmp(&a.day))
                .then(b.filename.cmp(&a.filename))
        });
        Ok(all)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn get_journal_entry_content(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_journal_entry_content(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_journal_entry(path: String) -> Result<(), String> {
    std::fs::remove_file(&path).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_entry_filename_standard() {
        let r = parse_entry_filename("28-AI平台产品会议纪要.md");
        assert_eq!(r, Some((28, "AI平台产品会议纪要".to_string())));
    }

    #[test]
    fn parse_entry_filename_single_digit_day() {
        let r = parse_entry_filename("03-春日感想.md");
        assert_eq!(r, Some((3, "春日感想".to_string())));
    }

    #[test]
    fn parse_entry_filename_no_match() {
        assert_eq!(parse_entry_filename("README.md"), None);
        assert_eq!(parse_entry_filename("not-a-journal"), None);
    }

    #[test]
    fn material_kind_audio() {
        assert_eq!(material_kind("录音.m4a"), "audio");
        assert_eq!(material_kind("rec.wav"), "audio");
        assert_eq!(material_kind("clip.mp3"), "audio");
    }

    #[test]
    fn material_kind_documents() {
        assert_eq!(material_kind("note.txt"), "text");
        assert_eq!(material_kind("note.md"), "markdown");
        assert_eq!(material_kind("report.pdf"), "pdf");
        assert_eq!(material_kind("meeting.docx"), "docx");
    }

    #[test]
    fn material_kind_unknown() {
        assert_eq!(material_kind("image.png"), "other");
    }

    // ── fallback parser tests ─────────────────────────────────────────────────

    #[test]
    fn fallback_extracts_summary_with_unescaped_inner_double_quotes() {
        // Exact pattern from 30-15餐厅的商业与慈善.md — gray_matter returns None for this
        let content = "---\ntags: [journal, article]\nsummary: \"吉米·奥利弗创办\"15餐厅\"，实践\"授人以渔\"的慈善模式。\"\n---\n\n# 标题\n";
        let fm = parse_frontmatter_fallback(content);
        assert_eq!(
            fm.summary,
            "吉米·奥利弗创办\"15餐厅\"，实践\"授人以渔\"的慈善模式。"
        );
        assert_eq!(fm.tags, vec!["journal", "article"]);
    }

    #[test]
    fn fallback_extracts_summary_single_quoted() {
        // Single-quoted YAML: curly " inside is fine, no escaping needed
        let content = concat!(
            "---\ntags: [journal, meeting]\nsummary: '",
            "单引号摘要，含\u{201c}书名号\u{201d}。",
            "'\n---\n\n# 标题\n"
        );
        let fm = parse_frontmatter_fallback(content);
        assert_eq!(fm.summary, "单引号摘要，含\u{201c}书名号\u{201d}。");
        assert_eq!(fm.tags, vec!["journal", "meeting"]);
    }

    #[test]
    fn fallback_extracts_summary_unquoted() {
        let content = "---\ntags: [journal]\nsummary: 简单摘要没有引号\n---\n\n# 标题\n";
        let fm = parse_frontmatter_fallback(content);
        assert_eq!(fm.summary, "简单摘要没有引号");
        assert_eq!(fm.tags, vec!["journal"]);
    }

    #[test]
    fn fallback_returns_default_when_no_frontmatter() {
        let content = "# 没有 frontmatter 的文件\n\n正文。\n";
        let fm = parse_frontmatter_fallback(content);
        assert_eq!(fm.summary, "");
        assert!(fm.tags.is_empty());
    }

    #[test]
    fn list_entries_uses_fallback_for_malformed_yaml() {
        // gray_matter returns None for content with unescaped inner " — verify
        // that list_entries produces non-empty summary via the fallback path
        use gray_matter::{engine::YAML, Matter};
        let content =
            "---\ntags: [journal, article]\nsummary: \"创办\"15餐厅\"实践。\"\n---\n\n# 标题\n";
        // Confirm gray_matter actually fails on this
        assert!(
            Matter::<YAML>::new()
                .parse_with_struct::<FrontMatter>(content)
                .is_none(),
            "test precondition: gray_matter should fail on unescaped inner quotes"
        );
        // Fallback must recover
        let fm = parse_frontmatter_fallback(content);
        assert!(
            !fm.summary.is_empty(),
            "fallback should recover non-empty summary"
        );
    }
}
