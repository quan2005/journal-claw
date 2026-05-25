use serde::Serialize;
use std::path::PathBuf;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize)]
pub struct TopicEntry {
    pub name: String,
    pub is_dir: bool,
    pub path: String, // workspace-relative, e.g. "AI平台/需求文档.md"
    pub mtime_secs: i64,
}

fn topics_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let cfg = crate::config::load_config(app)?;
    if cfg.workspace_path.is_empty() {
        return Err("请先在设置中配置 Workspace 路径".to_string());
    }
    Ok(PathBuf::from(cfg.workspace_path).join("topics"))
}

#[tauri::command]
pub fn list_topics_dir(app: AppHandle, relative_path: String) -> Result<Vec<TopicEntry>, String> {
    let base = topics_dir(&app)?;
    let dir = if relative_path.is_empty() {
        base
    } else {
        base.join(&relative_path)
    };

    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| format!("创建 topics 目录失败: {}", e))?;
        return Ok(vec![]);
    }

    let mut entries: Vec<TopicEntry> = vec![];
    for entry in std::fs::read_dir(&dir).map_err(|e| format!("读取目录失败: {}", e))? {
        let entry = entry.map_err(|e| format!("读取条目失败: {}", e))?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || name == "DS_Store" {
            continue;
        }
        let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
        let rel = if relative_path.is_empty() {
            name.clone()
        } else {
            format!("{}/{}", relative_path, name)
        };
        let mtime = entry
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .map(|t| {
                t.duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs() as i64
            })
            .unwrap_or(0);
        entries.push(TopicEntry {
            name,
            is_dir,
            path: rel,
            mtime_secs: mtime,
        });
    }
    // Directories first, then files; both sorted by name alphabetically
    entries.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then_with(|| a.name.cmp(&b.name)));
    Ok(entries)
}

#[tauri::command]
pub fn create_topic(
    app: AppHandle,
    name: String,
    parent_path: Option<String>,
) -> Result<(), String> {
    let base = topics_dir(&app)?;
    let dir = if let Some(p) = parent_path {
        base.join(&p).join(&name)
    } else {
        base.join(&name)
    };
    std::fs::create_dir_all(&dir).map_err(|e| format!("创建专题失败: {}", e))
}

#[tauri::command]
pub fn delete_topic(app: AppHandle, relative_path: String) -> Result<(), String> {
    let full = topics_dir(&app)?.join(&relative_path);
    if !full.exists() {
        return Err(format!("路径不存在: {}", relative_path));
    }
    if full.is_dir() {
        std::fs::remove_dir_all(&full).map_err(|e| format!("删除专题失败: {}", e))
    } else {
        std::fs::remove_file(&full).map_err(|e| format!("删除文件失败: {}", e))
    }
}

#[tauri::command]
pub fn import_file_to_topic(
    app: AppHandle,
    source: String,
    topic_path: String,
) -> Result<String, String> {
    let base = topics_dir(&app)?;
    // topic_path is a directory path, not a file path
    let dest_dir = if topic_path.is_empty() {
        base
    } else {
        base.join(&topic_path)
    };
    std::fs::create_dir_all(&dest_dir).map_err(|e| format!("创建目录失败: {}", e))?;

    let src = PathBuf::from(&source);
    let fname = src
        .file_name()
        .ok_or("无效文件名")?
        .to_string_lossy()
        .to_string();
    let dest = dest_dir.join(&fname);
    std::fs::copy(&src, &dest).map_err(|e| format!("复制文件失败: {}", e))?;

    let rel = if topic_path.is_empty() {
        fname
    } else {
        format!("{}/{}", topic_path, fname)
    };
    Ok(rel)
}
