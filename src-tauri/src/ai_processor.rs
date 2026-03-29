use tauri::{AppHandle, Emitter};
use crate::{config, workspace};
use serde::{Deserialize, Serialize};

pub fn build_prompt(_material_path: &str) -> String {
    "新增资料，请阅读并整理记录".to_string()
}

pub fn build_command(cli_path: &str, material_path: &str, workspace_ym_dir: &str) -> Vec<String> {
    vec![
        cli_path.to_string(),
        "--cwd".to_string(),
        workspace_ym_dir.to_string(),
        "-p".to_string(),
        format!("@{} {}", material_path, build_prompt(material_path)),
    ]
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingUpdate {
    pub material_path: String,
    pub status: String,   // "processing" | "completed" | "failed"
    pub error: Option<String>,
}

pub async fn process_material(
    app: AppHandle,
    material_path: String,
    year_month: String,
) -> Result<(), String> {
    let cfg = config::load_config(&app)?;
    let cli = if cfg.claude_cli_path.is_empty() {
        "claude".to_string()
    } else {
        cfg.claude_cli_path.clone()
    };
    let ym_dir = workspace::year_month_dir(&cfg.workspace_path, &year_month);

    let _ = app.emit("ai-processing", ProcessingUpdate {
        material_path: material_path.clone(),
        status: "processing".to_string(),
        error: None,
    });

    let args = build_command(&cli, &material_path, ym_dir.to_str().unwrap_or(""));
    let output = tokio::process::Command::new(&args[0])
        .args(&args[1..])
        .output()
        .await
        .map_err(|e| format!("启动 Claude CLI 失败: {}", e))?;

    if output.status.success() {
        let _ = app.emit("ai-processing", ProcessingUpdate {
            material_path: material_path.clone(),
            status: "completed".to_string(),
            error: None,
        });
        let _ = app.emit("journal-updated", &year_month);
        Ok(())
    } else {
        let err = String::from_utf8_lossy(&output.stderr).to_string();
        let _ = app.emit("ai-processing", ProcessingUpdate {
            material_path: material_path.clone(),
            status: "failed".to_string(),
            error: Some(err.clone()),
        });
        Err(err)
    }
}

#[tauri::command]
pub async fn trigger_ai_processing(
    app: AppHandle,
    material_path: String,
    year_month: String,
) -> Result<(), String> {
    tokio::spawn(async move {
        let _ = process_material(app, material_path, year_month).await;
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_command_structure() {
        let cmd = build_command("claude", "/nb/2603/raw/note.txt", "/nb/2603");
        assert_eq!(cmd[0], "claude");
        assert_eq!(cmd[1], "--cwd");
        assert_eq!(cmd[2], "/nb/2603");
        assert_eq!(cmd[3], "-p");
        assert!(cmd[4].starts_with("@/nb/2603/raw/note.txt"));
        assert!(cmd[4].contains("新增资料"));
    }
}
