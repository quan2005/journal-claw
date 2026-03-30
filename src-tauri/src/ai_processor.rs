use tauri::{AppHandle, Emitter};
use crate::config;
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

/// Holds a handle to the currently-running Claude CLI child process.
/// Wrapped in Mutex so the cancel command can reach in and kill it.
pub struct CurrentTask(pub std::sync::Mutex<Option<tokio::process::Child>>);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiLogLine {
    pub material_path: String,
    pub level: String,   // "info" | "error"
    pub message: String,
}

// ── Helpers ──────────────────────────────────────────────

const WORKSPACE_PROMPT: &str = r#"# 谨迹秘书稿规范

你是一个日志整理助手。用户会给你原始素材（录音转写、PDF、文档等），你需要整理成结构化的日志条目。

## 输出格式

每个日志条目是一个 Markdown 文件，格式：

```markdown
---
tags: [标签1, 标签2]
summary: "一句话摘要：先结论后背景"
---

# 标题

## 背景
## 关键讨论 / 核心内容
## 结论
## 行动项
```

## 规则

1. 文件名格式：`DD-标题.md`（DD 是日期数字，如 `28-AI平台产品会议纪要.md`）
2. frontmatter 只保留 `tags` 和 `summary` 两个字段
3. `summary` 写 1-3 句，先结论后背景
4. `tags` 使用小写中文或英文，常用标签：journal, meeting, reading, research, plan, design, guide
5. 正文结构根据内容类型选用：会议用「关键讨论 + 结论 + 行动项」，阅读用「核心观点 + 启发」，日常用「记录 + 感想」
6. 新素材可以创建新条目，也可以追加到当天已有条目（如同一天的多段录音合并为一篇会议纪要）
7. 如果已有同主题条目，更新而不是新建，保留用户手动修改的部分
8. 日志条目文件写在素材对应的 `yyMM/` 目录下（与 raw/ 同级，不要写到 raw/ 子目录里）
9. 不要输出任何解释性文字，只创建/更新文件即可
"#;

/// 确保 workspace 根目录有 CLAUDE.md。仅在文件不存在时创建，不覆盖用户修改。
fn ensure_workspace_prompt(workspace_path: &str) {
    let path = std::path::PathBuf::from(workspace_path).join("CLAUDE.md");
    if !path.exists() {
        let _ = std::fs::write(&path, WORKSPACE_PROMPT);
    }
}

fn build_prompt(material_path: &str) -> String {
    let filename = std::path::PathBuf::from(material_path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    format!(
        "新增素材 @{}，请阅读内容并整理为日志条目。按 CLAUDE.md 中的规范输出，直接创建或更新 .md 文件。",
        filename
    )
}

/// Build CLI args (without --cwd — working dir set via .current_dir()).
fn build_args(material_path: &str, year_month: &str) -> Vec<String> {
    let filename = std::path::PathBuf::from(material_path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let relative_ref = format!("{}/raw/{}", year_month, filename);
    vec![
        "-p".to_string(),
        format!("@{} {}", relative_ref, build_prompt(material_path)),
        "--permission-mode".to_string(),
        "bypassPermissions".to_string(),
        "--output-format".to_string(),
        "json".to_string(),
        "--no-session-persistence".to_string(),
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

fn parse_cli_output(stdout: &str) -> Result<(), String> {
    let parsed: Result<serde_json::Value, _> = serde_json::from_str(stdout.trim());
    match parsed {
        Ok(val) => {
            let is_error = val.get("is_error").and_then(|v| v.as_bool()).unwrap_or(false);
            if is_error {
                let msg = val.get("result")
                    .and_then(|v| v.as_str())
                    .unwrap_or("AI 处理失败");
                Err(msg.to_string())
            } else {
                Ok(())
            }
        }
        Err(_) => Ok(())
    }
}

// ── Queue consumer ───────────────────────────────────────

/// Spawn a single-threaded consumer that processes tasks serially.
/// Call once during app setup; pass the receiver half.
pub fn start_queue_consumer(app: AppHandle, mut rx: mpsc::Receiver<QueueTask>) {
    tauri::async_runtime::spawn(async move {
        eprintln!("[ai_queue] consumer loop started");
        while let Some(task) = rx.recv().await {
            eprintln!("[ai_queue] dequeued task: {} ({})", task.material_path, task.year_month);
            let result = process_material(&app, &task.material_path, &task.year_month).await;
            match &result {
                Ok(()) => eprintln!("[ai_queue] task completed: {}", task.material_path),
                Err(e) => eprintln!("[ai_queue] task failed: {} → {}", task.material_path, e),
            }
        }
        eprintln!("[ai_queue] consumer loop ended (channel closed)");
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

    eprintln!("[ai_processor] start — material={} ym={}", material_path, year_month);
    eprintln!("[ai_processor] cli={} workspace={}", cli, cfg.workspace_path);

    ensure_workspace_prompt(&cfg.workspace_path);

    let _ = app.emit("ai-processing", ProcessingUpdate {
        material_path: material_path.to_string(),
        status: "processing".to_string(),
        error: None,
    });

    let args = build_args(material_path, year_month);
    eprintln!("[ai_processor] running: {} {}", cli, args.join(" "));
    let output = tokio::process::Command::new(&cli)
        .args(&args)
        .current_dir(&cfg.workspace_path)
        .env("PATH", augmented_path())
        .output()
        .await
        .map_err(|e| format!("启动 Claude CLI 失败 ({}): {}", &cli, e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    eprintln!("[ai_processor] exit_code={:?}", output.status.code());
    if !stdout.is_empty() { eprintln!("[ai_processor] stdout: {}", &stdout[..stdout.len().min(500)]); }
    if !stderr.is_empty() { eprintln!("[ai_processor] stderr: {}", &stderr[..stderr.len().min(500)]); }

    if !output.status.success() {
        let err = if stderr.is_empty() { stdout.clone() } else { stderr };
        let _ = app.emit("ai-processing", ProcessingUpdate {
            material_path: material_path.to_string(),
            status: "failed".to_string(),
            error: Some(err.clone()),
        });
        return Err(err);
    }

    match parse_cli_output(&stdout) {
        Ok(()) => {
            let _ = app.emit("ai-processing", ProcessingUpdate {
                material_path: material_path.to_string(),
                status: "completed".to_string(),
                error: None,
            });
            let _ = app.emit("journal-updated", year_month);
            Ok(())
        }
        Err(err) => {
            let _ = app.emit("ai-processing", ProcessingUpdate {
                material_path: material_path.to_string(),
                status: "failed".to_string(),
                error: Some(err.clone()),
            });
            Err(err)
        }
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
    eprintln!("[trigger_ai] material={} ym={}", material_path, year_month);
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

#[tauri::command]
pub fn get_workspace_prompt(app: AppHandle) -> Result<String, String> {
    let cfg = config::load_config(&app)?;
    let path = std::path::PathBuf::from(&cfg.workspace_path).join("CLAUDE.md");
    if path.exists() {
        std::fs::read_to_string(&path).map_err(|e| e.to_string())
    } else {
        Ok(WORKSPACE_PROMPT.to_string())
    }
}

#[tauri::command]
pub fn set_workspace_prompt(app: AppHandle, content: String) -> Result<(), String> {
    let cfg = config::load_config(&app)?;
    let path = std::path::PathBuf::from(&cfg.workspace_path).join("CLAUDE.md");
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cancel_ai_processing(
    current_task: tauri::State<'_, CurrentTask>,
) -> Result<(), String> {
    let mut guard = current_task.0.lock().map_err(|e| e.to_string())?;
    if let Some(child) = guard.as_mut() {
        child.start_kill().map_err(|e| e.to_string())?;
        eprintln!("[ai_processor] cancel: sent SIGKILL to child");
    } else {
        eprintln!("[ai_processor] cancel: no task running");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_args_no_cwd() {
        let args = build_args("/nb/2603/raw/note.txt", "2603");
        assert!(args[0] == "-p");
        assert!(args[1].starts_with("@2603/raw/note.txt"));
        assert!(args[1].contains("新增素材"));
        assert!(!args.iter().any(|a| a == "--cwd"));
    }

    #[test]
    fn build_args_has_required_flags() {
        let args = build_args("/nb/2603/raw/note.txt", "2603");
        assert!(args.contains(&"-p".to_string()));
        assert!(args[1].starts_with("@2603/raw/note.txt"));
        assert!(!args.contains(&"--tools".to_string()));
        assert!(args.contains(&"--permission-mode".to_string()));
        assert!(args.contains(&"bypassPermissions".to_string()));
        assert!(args.contains(&"--output-format".to_string()));
        assert!(args.contains(&"json".to_string()));
        assert!(args.contains(&"--no-session-persistence".to_string()));
        assert!(!args.iter().any(|a| a == "--cwd"));
    }

    #[test]
    fn ensure_workspace_prompt_creates_file() {
        let tmp = std::env::temp_dir().join("journal_prompt_test");
        std::fs::create_dir_all(&tmp).unwrap();
        let prompt_path = tmp.join("CLAUDE.md");
        let _ = std::fs::remove_file(&prompt_path);

        ensure_workspace_prompt(tmp.to_str().unwrap());
        assert!(prompt_path.exists());

        let content = std::fs::read_to_string(&prompt_path).unwrap();
        assert!(content.contains("tags"));
        assert!(content.contains("summary"));
        assert!(content.contains("DD-标题.md"));

        // Second call should NOT overwrite
        std::fs::write(&prompt_path, "用户自定义内容").unwrap();
        ensure_workspace_prompt(tmp.to_str().unwrap());
        let content2 = std::fs::read_to_string(&prompt_path).unwrap();
        assert_eq!(content2, "用户自定义内容");

        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn parse_cli_output_success() {
        let json = r#"{"type":"result","subtype":"success","is_error":false,"result":"done","total_cost_usd":0.05}"#;
        assert!(parse_cli_output(json).is_ok());
    }

    #[test]
    fn parse_cli_output_error() {
        let json = r#"{"type":"result","subtype":"error","is_error":true,"result":"无法读取文件"}"#;
        let result = parse_cli_output(json);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("无法读取文件"));
    }

    #[test]
    fn parse_cli_output_non_json() {
        assert!(parse_cli_output("some plain text").is_ok());
    }

    #[test]
    fn cancel_with_no_task_is_noop() {
        let state = CurrentTask(std::sync::Mutex::new(None));
        // Should not panic when nothing is running
        let guard = state.0.lock().unwrap();
        assert!(guard.is_none());
        drop(guard);
    }
}
