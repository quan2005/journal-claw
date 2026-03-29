use tauri::{AppHandle, Emitter};
use crate::{config, workspace};
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;

// ── Types ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingUpdate {
    pub material_path: String,
    pub status: String,        // "queued" | "processing" | "completed" | "failed"
    pub error: Option<String>,
}

pub struct QueueTask {
    material_path: String,
    year_month: String,
}

/// Holds the sender half — stored in Tauri managed state.
pub struct AiQueue(pub mpsc::Sender<QueueTask>);

// ── Helpers ──────────────────────────────────────────────

fn build_prompt(_material_path: &str) -> String {
    "新增资料，请阅读并整理记录".to_string()
}

/// Build CLI args (without --cwd — working dir set via .current_dir()).
fn build_args(material_path: &str) -> Vec<String> {
    vec![
        "-p".to_string(),
        format!("@{} {}", material_path, build_prompt(material_path)),
    ]
}

fn augmented_path() -> String {
    let path_env = std::env::var("PATH").unwrap_or_default();
    format!(
        "{}:/usr/local/bin:/opt/homebrew/bin:{}/.local/bin",
        path_env,
        std::env::var("HOME").unwrap_or_default()
    )
}

// ── Queue consumer ───────────────────────────────────────

/// Spawn a single-threaded consumer that processes tasks serially.
/// Call once during app setup; pass the receiver half.
pub fn start_queue_consumer(app: AppHandle, mut rx: mpsc::Receiver<QueueTask>) {
    tokio::spawn(async move {
        while let Some(task) = rx.recv().await {
            let _ = process_material(&app, &task.material_path, &task.year_month).await;
        }
    });
}

pub async fn process_material(
    app: &AppHandle,
    material_path: &str,
    year_month: &str,
) -> Result<(), String> {
    let cfg = config::load_config(app)?;
    let cli = if cfg.claude_cli_path.is_empty() {
        "claude".to_string()
    } else {
        cfg.claude_cli_path.clone()
    };
    let ym_dir = workspace::year_month_dir(&cfg.workspace_path, year_month);

    // Emit "processing"
    let _ = app.emit("ai-processing", ProcessingUpdate {
        material_path: material_path.to_string(),
        status: "processing".to_string(),
        error: None,
    });

    let args = build_args(material_path);
    let output = tokio::process::Command::new(&cli)
        .args(&args)
        .current_dir(&ym_dir)
        .env("PATH", augmented_path())
        .output()
        .await
        .map_err(|e| format!("启动 Claude CLI 失败 ({}): {}", &cli, e))?;

    if output.status.success() {
        let _ = app.emit("ai-processing", ProcessingUpdate {
            material_path: material_path.to_string(),
            status: "completed".to_string(),
            error: None,
        });
        let _ = app.emit("journal-updated", year_month);
        Ok(())
    } else {
        let err = String::from_utf8_lossy(&output.stderr).to_string();
        let _ = app.emit("ai-processing", ProcessingUpdate {
            material_path: material_path.to_string(),
            status: "failed".to_string(),
            error: Some(err.clone()),
        });
        Err(err)
    }
}

// ── Tauri command ────────────────────────────────────────

#[tauri::command]
pub async fn trigger_ai_processing(
    app: AppHandle,
    queue: tauri::State<'_, AiQueue>,
    material_path: String,
    year_month: String,
) -> Result<(), String> {
    // Emit "queued" immediately
    let _ = app.emit("ai-processing", ProcessingUpdate {
        material_path: material_path.clone(),
        status: "queued".to_string(),
        error: None,
    });

    queue.0.send(QueueTask {
        material_path,
        year_month,
    }).await.map_err(|e| format!("队列发送失败: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_args_no_cwd() {
        let args = build_args("/nb/2603/raw/note.txt");
        assert_eq!(args[0], "-p");
        assert!(args[1].starts_with("@/nb/2603/raw/note.txt"));
        assert!(args[1].contains("新增资料"));
        assert!(!args.iter().any(|a| a == "--cwd"));
    }
}
