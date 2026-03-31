use std::path::PathBuf;
use crate::workspace;

pub fn dest_filename(src_path: &str) -> String {
    // 保留原文件名，若同名则加时间戳后缀
    PathBuf::from(src_path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string()
}

fn file_hash(path: &std::path::Path) -> Option<u64> {
    use std::hash::{Hash, Hasher};
    use std::collections::hash_map::DefaultHasher;
    let data = std::fs::read(path).ok()?;
    let mut h = DefaultHasher::new();
    data.hash(&mut h);
    Some(h.finish())
}

pub fn copy_to_raw(src_path: &str, workspace: &str, year_month: &str) -> Result<PathBuf, String> {
    workspace::ensure_dirs(workspace, year_month)?;
    let raw = workspace::raw_dir(workspace, year_month);
    let src = std::path::Path::new(src_path);
    let hash_str = file_hash(src)
        .map(|h| format!("{:x}", h))
        .unwrap_or_else(|| "unknown".to_string());
    let hash8 = &hash_str[..8.min(hash_str.len())];
    let filename = dest_filename(src_path);
    let stem = PathBuf::from(&filename)
        .file_stem().unwrap_or_default().to_string_lossy().to_string();
    let ext = PathBuf::from(&filename)
        .extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
    let dest_name = format!("{}-{}{}", stem, hash8, ext);
    let dest = raw.join(&dest_name);
    if dest.exists() {
        return Ok(dest);
    }
    std::fs::copy(src_path, &dest)
        .map_err(|e| format!("复制文件失败: {}", e))?;
    Ok(dest)
}

use tauri::AppHandle;
use serde::{Deserialize, Serialize};
use crate::{config, workspace as ws};

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportResult {
    pub path: String,
    pub filename: String,
    pub year_month: String,
}

#[tauri::command]
pub fn import_file(app: AppHandle, src_path: String) -> Result<ImportResult, String> {
    let cfg = config::load_config(&app)?;
    if cfg.workspace_path.is_empty() {
        return Err("请先在设置中配置 Workspace 路径".to_string());
    }
    let ym = ws::current_year_month();
    let dest = copy_to_raw(&src_path, &cfg.workspace_path, &ym)?;
    Ok(ImportResult {
        filename: dest.file_name().unwrap_or_default().to_string_lossy().to_string(),
        path: dest.to_string_lossy().to_string(),
        year_month: ym,
    })
}

fn write_paste_text(dest: &std::path::Path, text: &str) -> Result<(), String> {
    std::fs::write(dest, text.as_bytes())
        .map_err(|e| format!("写入文本失败: {}", e))
}

/// Write text to system temp dir immediately (no workspace needed).
/// The returned path can later be passed to import_file to copy into raw/.
/// Temp files are cleaned up automatically by the OS.
#[tauri::command]
pub fn import_text_temp(text: String) -> Result<ImportResult, String> {
    let ts = chrono::Local::now().format("%Y%m%d-%H%M%S").to_string();
    let filename = format!("paste-{}.txt", ts);
    let dest = std::env::temp_dir().join(&filename);
    write_paste_text(&dest, &text)?;
    Ok(ImportResult {
        filename,
        path: dest.to_string_lossy().to_string(),
        year_month: String::new(),
    })
}

#[tauri::command]
pub fn import_text(app: AppHandle, text: String) -> Result<ImportResult, String> {
    let cfg = config::load_config(&app)?;
    if cfg.workspace_path.is_empty() {
        return Err("请先在设置中配置 Workspace 路径".to_string());
    }
    let ym = ws::current_year_month();
    ws::ensure_dirs(&cfg.workspace_path, &ym)?;
    let raw = ws::raw_dir(&cfg.workspace_path, &ym);
    let ts = chrono::Local::now().format("%Y%m%d-%H%M%S").to_string();
    let filename = format!("paste-{}.txt", ts);
    let dest = raw.join(&filename);
    write_paste_text(&dest, &text)?;
    Ok(ImportResult {
        filename,
        path: dest.to_string_lossy().to_string(),
        year_month: ym,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dest_filename_extracts_name() {
        assert_eq!(dest_filename("/tmp/meeting notes.docx"), "meeting notes.docx");
        assert_eq!(dest_filename("/Users/x/note.txt"), "note.txt");
    }

    #[test]
    fn copy_to_raw_creates_file() {
        let tmp = std::env::temp_dir().join("journal_mat_test");
        let src = tmp.join("source.txt");
        std::fs::create_dir_all(&tmp).unwrap();
        std::fs::write(&src, b"hello").unwrap();

        let dest = copy_to_raw(src.to_str().unwrap(), tmp.to_str().unwrap(), "2603").unwrap();
        assert!(dest.exists());
        assert_eq!(std::fs::read_to_string(&dest).unwrap(), "hello");

        std::fs::remove_dir_all(&tmp).ok();
    }
}
