use crate::config;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawMaterial {
    pub filename: String,
    pub path: String,
    pub kind: String, // "audio" | "text" | "pdf" | "docx" | "markdown" | "html" | "other"
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
    pub created_time: String, // "10:15" (from file birthtime, falls back to mtime)
    pub created_at_secs: i64, // birthtime Unix timestamp for stable same-day sorting
    pub mtime_secs: i64,      // mtime Unix timestamp for change detection
    pub materials: Vec<RawMaterial>,
    pub sources: Vec<String>,
}

#[derive(Debug, Deserialize, Default)]
struct FrontMatter {
    #[serde(default)]
    summary: String,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    sources: Vec<String>,
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
    let mut sources: Vec<String> = vec![];

    for line in inner.lines() {
        if let Some(val) = line.strip_prefix("summary:") {
            summary = extract_scalar_value(val.trim());
        } else if let Some(val) = line.strip_prefix("tags:") {
            tags = extract_inline_sequence(val.trim());
        } else if let Some(val) = line.strip_prefix("sources:") {
            sources = extract_inline_sequence(val.trim());
        }
    }

    FrontMatter {
        summary,
        tags,
        sources,
    }
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

/// Repeatedly strip surrounding double/single quotes and escaped quotes from a parsed value.
/// LLMs often wrap summary text in redundant quotes that survive YAML parsing, e.g.:
///   gray_matter parses `summary: "\"摘要\""` → `"摘要"` (quotes still in value)
/// This function peels them off until the core text is clean.
pub fn strip_surrounding_quotes(s: &str) -> String {
    let mut result = s.trim().to_string();
    loop {
        let t = result.trim();
        // ASCII double quotes
        if let Some(inner) = t.strip_prefix('"').and_then(|s| s.strip_suffix('"')) {
            result = inner.to_string();
            continue;
        }
        // ASCII single quotes
        if let Some(inner) = t.strip_prefix('\'').and_then(|s| s.strip_suffix('\'')) {
            result = inner.to_string();
            continue;
        }
        // Curly/smart quotes: \u{201c}…\u{201d}
        if let Some(inner) = t
            .strip_prefix('\u{201c}')
            .and_then(|s| s.strip_suffix('\u{201d}'))
        {
            result = inner.to_string();
            continue;
        }
        // Escaped quotes: \"...\"
        if let Some(inner) = t.strip_prefix("\\\"").and_then(|s| s.strip_suffix("\\\"")) {
            result = inner.to_string();
            continue;
        }
        break;
    }
    result
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

#[allow(dead_code)]
pub(crate) fn material_kind(filename: &str) -> String {
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
        "html" | "htm" => "html",
        _ => "other",
    }
    .to_string()
}

pub fn list_entries(workspace: &str, year_month: &str) -> Result<Vec<JournalEntry>, String> {
    use crate::workspace;
    use gray_matter::{engine::YAML, Matter};

    let ym_dir = workspace::year_month_dir(workspace, year_month);
    if !ym_dir.exists() {
        return Ok(vec![]);
    }

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

        // Skip iCloud evicted (dataless) files — reading them would block on download
        #[cfg(target_os = "macos")]
        {
            use std::os::macos::fs::MetadataExt;
            if let Ok(meta) = std::fs::metadata(&path) {
                const SF_DATALESS: u32 = 0x40000000;
                if meta.st_flags() & SF_DATALESS != 0 {
                    // File not downloaded from iCloud — use title from filename only
                    let meta_opt = entry.metadata().ok();
                    let mtime = meta_opt.as_ref().and_then(|m| m.modified().ok());
                    let mtime_secs = mtime
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs() as i64)
                        .unwrap_or(0);
                    entries.push(JournalEntry {
                        filename,
                        path: path.to_string_lossy().to_string(),
                        title,
                        summary: String::new(),
                        tags: vec![],
                        year_month: year_month.to_string(),
                        day,
                        created_time: String::new(),
                        created_at_secs: mtime_secs,
                        mtime_secs,
                        materials: vec![],
                        sources: vec![],
                    });
                    continue;
                }
            }
        }

        let content = std::fs::read_to_string(&path).unwrap_or_default();

        let matter = Matter::<YAML>::new();
        let fm: FrontMatter = matter
            .parse_with_struct::<FrontMatter>(&content)
            .map(|p| p.data)
            .unwrap_or_else(|| parse_frontmatter_fallback(&content));

        let meta = entry.metadata().ok();
        // birthtime (created) for stable display time and same-day sort order
        let birthtime = meta.as_ref().and_then(|m| m.created().ok());
        // mtime for change detection only
        let mtime = meta.as_ref().and_then(|m| m.modified().ok());

        // Display time comes from birthtime; fall back to mtime if birthtime unavailable
        let display_time = birthtime.or(mtime);
        let created_time = display_time
            .map(|t| {
                let dt: chrono::DateTime<chrono::Local> = t.into();
                dt.format("%H:%M").to_string()
            })
            .unwrap_or_default();
        let created_at_secs = birthtime
            .or(mtime)
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        let mtime_secs = mtime
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);

        entries.push(JournalEntry {
            filename,
            path: path.to_string_lossy().to_string(),
            title,
            summary: strip_surrounding_quotes(&fm.summary),
            tags: fm.tags,
            year_month: year_month.to_string(),
            day,
            created_time,
            created_at_secs,
            mtime_secs,
            materials: vec![],
            sources: fm.sources,
        });
    }

    // Sort by day descending, then by creation time descending within same day
    entries.sort_by(|a, b| {
        b.day
            .cmp(&a.day)
            .then(b.created_at_secs.cmp(&a.created_at_secs))
    });
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
                .then(b.created_at_secs.cmp(&a.created_at_secs))
        });
        Ok(all)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn list_available_months(app: AppHandle) -> Result<Vec<String>, String> {
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
        let read_dir = std::fs::read_dir(&ws_path).map_err(|e| e.to_string())?;
        let mut months: Vec<String> = read_dir
            .flatten()
            .filter_map(|entry| {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.len() == 4 && name.chars().all(|c| c.is_ascii_digit()) {
                    Some(name)
                } else {
                    None
                }
            })
            .collect();
        months.sort_by(|a, b| b.cmp(a));
        Ok(months)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn list_journal_entries_by_months(
    app: AppHandle,
    months: Vec<String>,
) -> Result<Vec<JournalEntry>, String> {
    let cfg = config::load_config(&app)?;
    if cfg.workspace_path.is_empty() {
        return Ok(vec![]);
    }
    let workspace = cfg.workspace_path.clone();
    tokio::task::spawn_blocking(move || {
        let mut all: Vec<JournalEntry> = vec![];
        for ym in &months {
            let mut batch = list_entries(&workspace, ym)?;
            all.append(&mut batch);
        }
        all.sort_by(|a, b| {
            b.year_month
                .cmp(&a.year_month)
                .then(b.day.cmp(&a.day))
                .then(b.created_at_secs.cmp(&a.created_at_secs))
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

/// 示例条目 Markdown 内容（固定文案）
fn sample_entry_content() -> String {
    r#"---
summary: 这是 AI 帮你整理的示例——试着录一段音或粘贴一段会议记录
tags: [示例, 产品, 会议]
---

# 产品评审会议纪要

## 会议结论

- 下一版本功能优先级已确定，重点投入 AI 摘要功能
- UI 改版方案通过评审，进入设计执行阶段
- 技术债处理排期至 Q2 下半段

## 待办事项

- @设计：输出首页改版高保真稿，截止下周五
- @后端：排期 API 优化，评估工作量

## 参会人员

产品、设计、前后端各一名

---

> 这条记录是示例，展示 AI 整理后的效果。你可以删除它，或直接录音 / 粘贴文件开始使用。
"#
    .to_string()
}

/// 在 workspace 的当月目录写入一条示例日志条目。
/// 若文件已存在（同名），直接返回 Ok 不覆盖。
pub fn write_sample_entry(workspace: &str, year_month: &str, day: u32) -> Result<String, String> {
    use crate::workspace;
    workspace::ensure_dirs(workspace, year_month)?;
    let filename = format!("{:02}-产品评审示例.md", day);
    let path = workspace::year_month_dir(workspace, year_month).join(&filename);
    if path.exists() {
        return Ok(path.to_string_lossy().to_string());
    }
    std::fs::write(&path, sample_entry_content()).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// Returns true if the workspace contains at least one .md file in any yyMM/ directory.
/// Raw materials (in raw/) are ignored. Non-existent workspace returns false.
fn workspace_has_any_md(workspace: &str) -> bool {
    use crate::workspace;
    let ws_path = std::path::PathBuf::from(workspace);
    if !ws_path.exists() {
        return false;
    }
    let Ok(read_dir) = std::fs::read_dir(&ws_path) else {
        return false;
    };
    for entry in read_dir.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        // Only 4-digit all-numeric dirs (yyMM format)
        if name.len() != 4 || !name.chars().all(|c| c.is_ascii_digit()) {
            continue;
        }
        let ym_dir = workspace::year_month_dir(workspace, &name);
        let Ok(inner) = std::fs::read_dir(&ym_dir) else {
            continue;
        };
        for file in inner.flatten() {
            let fname = file.file_name().to_string_lossy().to_string();
            if fname.ends_with(".md") {
                return true;
            }
        }
    }
    false
}

/// 无条件写入示例条目（若已存在则不覆盖）。供引导按钮直接调用。
#[tauri::command]
pub fn create_sample_entry(app: tauri::AppHandle) -> Result<(), String> {
    use crate::config;
    use crate::workspace;
    use chrono::Datelike;
    let cfg = config::load_config(&app)?;
    if cfg.workspace_path.is_empty() {
        return Err("workspace not configured".to_string());
    }
    let year_month = workspace::current_year_month();
    let day = chrono::Local::now().day();
    write_sample_entry(&cfg.workspace_path, &year_month, day)?;
    Ok(())
}

/// 首次启动时调用：若 sample_entry_created 为 false，写入示例条目并置 flag 为 true。
/// 返回 true 表示本次写入了示例条目，false 表示 flag 已设置过（无操作）。
#[tauri::command]
pub fn create_sample_entry_if_needed(app: AppHandle) -> Result<bool, String> {
    use crate::config;
    use crate::workspace;
    use chrono::Datelike;
    let mut cfg = config::load_config(&app)?;
    if cfg.sample_entry_created {
        return Ok(false);
    }
    if cfg.workspace_path.is_empty() {
        return Ok(false);
    }
    // Only insert if workspace has no existing .md files
    if workspace_has_any_md(&cfg.workspace_path) {
        return Ok(false);
    }
    let year_month = workspace::current_year_month();
    let day = chrono::Local::now().day();
    write_sample_entry(&cfg.workspace_path, &year_month, day)?;
    cfg.sample_entry_created = true;
    config::save_config(&app, &cfg)?;
    Ok(true)
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

    #[test]
    fn write_sample_entry_creates_file() {
        let tmp = std::env::temp_dir().join(format!(
            "journal_sample_test_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let ws = tmp.to_str().unwrap();
        let result = write_sample_entry(ws, "2604", 1);
        assert!(result.is_ok(), "write_sample_entry failed: {:?}", result);
        let path = std::path::PathBuf::from(result.unwrap());
        assert!(path.exists(), "sample entry file should exist");
        let content = std::fs::read_to_string(&path).unwrap();
        assert!(content.contains("产品评审会议纪要"));
        assert!(content.contains("summary:"));
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn create_sample_skips_when_md_exists() {
        // workspace already has a .md file → function should return Ok(false) and NOT set flag
        // We test the helper directly since the command needs AppHandle.
        let tmp = std::env::temp_dir().join(format!(
            "journal_skip_test_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let ws = tmp.to_str().unwrap();
        // Create a yyMM dir with an existing .md file
        let ym_dir = tmp.join("2604");
        std::fs::create_dir_all(&ym_dir).unwrap();
        std::fs::write(ym_dir.join("01-existing.md"), "# hi").unwrap();
        // Helper should report the workspace is NOT empty
        assert!(workspace_has_any_md(ws), "should detect existing .md");
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn create_sample_proceeds_when_no_md_exists() {
        let tmp = std::env::temp_dir().join(format!(
            "journal_empty_test_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let ws = tmp.to_str().unwrap();
        // Workspace dir exists but has no yyMM dirs
        std::fs::create_dir_all(&tmp).unwrap();
        assert!(
            !workspace_has_any_md(ws),
            "empty workspace should return false"
        );
        std::fs::remove_dir_all(&tmp).ok();
    }

    // ── strip_surrounding_quotes tests ─────────────────────────────────────

    #[test]
    fn strip_quotes_ascii_double() {
        assert_eq!(strip_surrounding_quotes(r#""摘要内容""#), "摘要内容");
    }

    #[test]
    fn strip_quotes_ascii_single() {
        assert_eq!(strip_surrounding_quotes("'摘要内容'"), "摘要内容");
    }

    #[test]
    fn strip_quotes_smart_curly() {
        assert_eq!(
            strip_surrounding_quotes("\u{201c}摘要内容\u{201d}"),
            "摘要内容"
        );
    }

    #[test]
    fn strip_quotes_escaped() {
        assert_eq!(strip_surrounding_quotes(r#"\"摘要内容\""#), "摘要内容");
    }

    #[test]
    fn strip_quotes_nested_layers() {
        // Agent wraps in multiple layers: "\"摘要\"" → after YAML parse → "摘要"
        assert_eq!(strip_surrounding_quotes(r#""\"摘要\"""#), "摘要");
    }

    #[test]
    fn strip_quotes_no_quotes() {
        assert_eq!(strip_surrounding_quotes("正常摘要"), "正常摘要");
    }

    #[test]
    fn strip_quotes_empty() {
        assert_eq!(strip_surrounding_quotes(""), "");
    }

    #[test]
    fn strip_quotes_preserves_inner_quotes() {
        // Only strips matching outer pairs — inner quotes stay
        assert_eq!(
            strip_surrounding_quotes(r#""他说"你好"再见""#),
            "他说\"你好\"再见"
        );
    }

    #[test]
    fn write_sample_entry_does_not_overwrite_existing() {
        let tmp = std::env::temp_dir().join(format!(
            "journal_sample_test_no_overwrite_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let ws = tmp.to_str().unwrap();
        // 先写一次
        let path_str = write_sample_entry(ws, "2604", 1).unwrap();
        // 改写文件内容
        std::fs::write(&path_str, "custom content").unwrap();
        // 再写一次，不应覆盖
        write_sample_entry(ws, "2604", 1).unwrap();
        let content = std::fs::read_to_string(&path_str).unwrap();
        assert_eq!(content, "custom content");
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn fallback_extracts_sources() {
        let content = "---\ntags: [journal]\nsummary: 摘要\nsources: [2604/raw/rec-abc.m4a, 2604/raw/paste-20260409.txt]\n---\n\n# 标题\n";
        let fm = parse_frontmatter_fallback(content);
        assert_eq!(
            fm.sources,
            vec!["2604/raw/rec-abc.m4a", "2604/raw/paste-20260409.txt"]
        );
    }

    #[test]
    fn fallback_sources_empty_when_absent() {
        let content = "---\ntags: [journal]\nsummary: 摘要\n---\n\n# 标题\n";
        let fm = parse_frontmatter_fallback(content);
        assert!(fm.sources.is_empty());
    }
}
