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

pub fn copy_to_raw(src_path: &str, workspace: &str, year_month: &str) -> Result<PathBuf, String> {
    workspace::ensure_dirs(workspace, year_month)?;
    let raw = workspace::raw_dir(workspace, year_month);
    let filename = dest_filename(src_path);
    let dest = raw.join(&filename);
    // If dest exists, add timestamp suffix
    let dest = if dest.exists() {
        let stem = PathBuf::from(&filename)
            .file_stem().unwrap_or_default().to_string_lossy().to_string();
        let ext = PathBuf::from(&filename)
            .extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
        let ts = chrono::Local::now().format("%H%M%S").to_string();
        raw.join(format!("{}-{}{}", stem, ts, ext))
    } else {
        dest
    };
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
    std::fs::write(&dest, text.as_bytes())
        .map_err(|e| format!("写入粘贴文本失败: {}", e))?;
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
