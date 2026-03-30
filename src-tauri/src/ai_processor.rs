use tauri::{AppHandle, Emitter, Manager};
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

fn augmented_path() -> String {
    let path_env = std::env::var("PATH").unwrap_or_default();
    format!(
        "{}:/usr/local/bin:/opt/homebrew/bin:{}/.local/bin",
        path_env,
        std::env::var("HOME").unwrap_or_default()
    )
}

/// Parse a single stream-json line and return a human-readable log message,
/// or None if the line should be silently ignored.
fn extract_log_line(line: &str) -> Option<String> {
    let val: serde_json::Value = serde_json::from_str(line).ok()?;
    let typ = val.get("type")?.as_str()?;
    match typ {
        "assistant" => {
            let contents = val.pointer("/message/content")?.as_array()?;
            for block in contents {
                let block_type = block.get("type")?.as_str()?;
                match block_type {
                    "text" => {
                        let text = block.get("text")?.as_str()?;
                        if !text.trim().is_empty() {
                            return Some(text.trim().to_string());
                        }
                    }
                    "tool_use" => {
                        let name = block.get("name")?.as_str()?;
                        return Some(format!("[tool] {}", name));
                    }
                    _ => {}
                }
            }
            None
        }
        "result" => {
            let is_error = val.get("is_error").and_then(|v| v.as_bool()).unwrap_or(false);
            if is_error {
                let msg = val.get("result").and_then(|v| v.as_str()).unwrap_or("失败");
                Some(format!("[error] {}", msg))
            } else {
                None
            }
        }
        _ => None,
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
            let current_task = app.state::<CurrentTask>();
            let result = process_material(&app, &task.material_path, &task.year_month, &current_task).await;
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
    current_task: &tauri::State<'_, CurrentTask>,
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

    // Build args — switch to stream-json for real-time output
    let filename = std::path::PathBuf::from(material_path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let relative_ref = format!("{}/raw/{}", year_month, filename);
    let prompt = format!(
        "@{} 新增素材 @{}，请阅读内容并整理为日志条目。按 CLAUDE.md 中的规范输出，直接创建或更新 .md 文件。",
        relative_ref, filename
    );
    let args = vec![
        "-p".to_string(),
        prompt,
        "--permission-mode".to_string(),
        "bypassPermissions".to_string(),
        "--output-format".to_string(),
        "stream-json".to_string(),
        "--verbose".to_string(),
        "--no-session-persistence".to_string(),
        "--bare".to_string(),
    ];

    // Emit startup log
    let _ = app.emit("ai-log", AiLogLine {
        material_path: material_path.to_string(),
        level: "info".to_string(),
        message: format!("启动 {} ...", cli),
    });

    eprintln!("[ai_processor] running: {} {}", cli, args.join(" "));

    use tokio::io::AsyncBufReadExt;

    let mut child = tokio::process::Command::new(&cli)
        .args(&args)
        .current_dir(&cfg.workspace_path)
        .env("PATH", augmented_path())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("启动 Claude CLI 失败 ({}): {}", &cli, e))?;

    let stdout = child.stdout.take().unwrap();
    let stderr_handle = child.stderr.take().unwrap();

    // Store child (without stdout/stderr — they're taken above)
    {
        let mut guard = current_task.0.lock().map_err(|e| e.to_string())?;
        *guard = Some(child);
    }

    let mp = material_path.to_string();
    let app_clone = app.clone();

    // Read stderr in background (for unexpected errors)
    let mp_stderr = mp.clone();
    let app_stderr = app_clone.clone();
    let stderr_task = tauri::async_runtime::spawn(async move {
        let mut reader = tokio::io::BufReader::new(stderr_handle).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            if !line.trim().is_empty() {
                eprintln!("[ai_processor:stderr] {}", line);
                let _ = app_stderr.emit("ai-log", AiLogLine {
                    material_path: mp_stderr.clone(),
                    level: "info".to_string(),
                    message: line,
                });
            }
        }
    });

    // Read stdout (stream-json NDJSON) and emit log lines
    let mut stdout_reader = tokio::io::BufReader::new(stdout).lines();
    let mut final_result: Result<(), String> = Ok(());

    while let Ok(Some(line)) = stdout_reader.next_line().await {
        eprintln!("[ai_processor:stream] {}", &line[..line.len().min(200)]);
        if let Some(msg) = extract_log_line(&line) {
            let level = if msg.starts_with("[error]") { "error" } else { "info" };
            let _ = app_clone.emit("ai-log", AiLogLine {
                material_path: mp.clone(),
                level: level.to_string(),
                message: msg.clone(),
            });
            if msg.starts_with("[error]") {
                final_result = Err(msg);
            }
        }
        // Check if this is the result line to detect success/failure
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&line) {
            if val.get("type").and_then(|v| v.as_str()) == Some("result") {
                let is_error = val.get("is_error").and_then(|v| v.as_bool()).unwrap_or(false);
                if is_error {
                    let msg = val.get("result").and_then(|v| v.as_str()).unwrap_or("AI 处理失败");
                    final_result = Err(msg.to_string());
                }
            }
        }
    }

    let _ = stderr_task.await;

    // Wait for child and check exit status
    // Take child out of the mutex before awaiting to avoid holding MutexGuard across .await
    let maybe_child = {
        let mut guard = current_task.0.lock().map_err(|e| e.to_string())?;
        guard.take()
    };

    let exit_status = if let Some(mut child) = maybe_child {
        child.wait().await.map_err(|e| e.to_string())?
    } else {
        // Child was killed via cancel_ai_processing
        let _ = app_clone.emit("ai-processing", ProcessingUpdate {
            material_path: mp.clone(),
            status: "failed".to_string(),
            error: Some("已取消".to_string()),
        });
        return Err("已取消".to_string());
    };

    eprintln!("[ai_processor] exit_code={:?}", exit_status.code());

    if !exit_status.success() && final_result.is_ok() {
        final_result = Err(format!("进程退出码: {:?}", exit_status.code()));
    }

    match final_result {
        Ok(()) => {
            let _ = app_clone.emit("ai-processing", ProcessingUpdate {
                material_path: mp.clone(),
                status: "completed".to_string(),
                error: None,
            });
            let _ = app_clone.emit("journal-updated", year_month);
            Ok(())
        }
        Err(err) => {
            let _ = app_clone.emit("ai-processing", ProcessingUpdate {
                material_path: mp.clone(),
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
    if let Some(mut child) = guard.take() {
        child.start_kill().map_err(|e| e.to_string())?;
        eprintln!("[ai_processor] cancel: sent SIGKILL to child");
    } else {
        eprintln!("[ai_processor] cancel: no task running");
    }
    Ok(())
}

/// 检测引擎是否已安装。engine: "claude" | "qwen"
#[tauri::command]
pub fn check_engine_installed(engine: String) -> Result<bool, String> {
    let bin = match engine.as_str() {
        "claude" => "claude",
        "qwen" => "qwen",
        _ => return Err(format!("unknown engine: {}", engine)),
    };
    let output = std::process::Command::new("which")
        .arg(bin)
        .output()
        .map_err(|e| e.to_string())?;
    Ok(output.status.success())
}

/// 安装引擎，通过 Tauri 事件流式推送日志。
/// 事件名："engine-install-log"，payload: { engine, line, done, success }
#[tauri::command]
pub async fn install_engine(app: tauri::AppHandle, engine: String) -> Result<(), String> {
    use tokio::io::AsyncBufReadExt;

    let (program, args): (&str, Vec<&str>) = match engine.as_str() {
        "claude" => ("npm", vec!["install", "-g", "@anthropic-ai/claude-code"]),
        "qwen" => ("bash", vec![
            "-c",
            "bash <(curl -fsSL https://qwen-code-assets.oss-cn-hangzhou.aliyuncs.com/installation/install-qwen.sh) -s --source qwenchat",
        ]),
        _ => return Err(format!("unknown engine: {}", engine)),
    };

    let mut child = tokio::process::Command::new(program)
        .args(&args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to spawn: {}", e))?;

    // Stream stdout and save handle
    let stdout_handle = if let Some(stdout) = child.stdout.take() {
        let app_clone = app.clone();
        let engine_clone = engine.clone();
        Some(tokio::spawn(async move {
            let reader = tokio::io::BufReader::new(stdout);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app_clone.emit("engine-install-log", serde_json::json!({
                    "engine": engine_clone,
                    "line": line,
                    "done": false,
                    "success": false,
                }));
            }
        }))
    } else {
        None
    };

    // Stream stderr and save handle
    let stderr_handle = if let Some(stderr) = child.stderr.take() {
        let app_clone = app.clone();
        let engine_clone = engine.clone();
        Some(tokio::spawn(async move {
            let reader = tokio::io::BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app_clone.emit("engine-install-log", serde_json::json!({
                    "engine": engine_clone,
                    "line": line,
                    "done": false,
                    "success": false,
                }));
            }
        }))
    } else {
        None
    };

    let status = child.wait().await.map_err(|e| e.to_string())?;

    // Await both handles to drain remaining output before emitting done
    if let Some(h) = stdout_handle {
        let _ = h.await;
    }
    if let Some(h) = stderr_handle {
        let _ = h.await;
    }

    let success = status.success();
    let _ = app.emit("engine-install-log", serde_json::json!({
        "engine": engine,
        "line": if success { "安装完成" } else { "安装失败" },
        "done": true,
        "success": success,
    }));

    if success { Ok(()) } else { Err("installation failed".to_string()) }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prompt_contains_material_reference() {
        let filename = "note.txt";
        let year_month = "2603";
        let prompt = format!(
            "@{}/raw/{} 新增素材 @{}，请阅读内容并整理为日志条目。按 CLAUDE.md 中的规范输出，直接创建或更新 .md 文件。",
            year_month, filename, filename
        );
        assert!(prompt.contains("@2603/raw/note.txt"));
        assert!(prompt.contains("新增素材"));
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
    fn extract_log_message_from_stream_json_lines() {
        // assistant text line
        let line = r#"{"type":"assistant","message":{"content":[{"type":"text","text":"正在读取文件...","citations":null,"signature":"","thinking":"","data":"","id":"","input":null,"name":"","content":{"OfWebSearchResultBlockArray":null,"error_code":"","type":"web_search_tool_result_error"},"tool_use_id":""}],"id":"","model":"","role":"assistant","stop_reason":"","stop_sequence":"","type":"message","usage":{"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"input_tokens":0,"output_tokens":0,"server_tool_use":{"web_search_requests":0},"service_tier":""},"context_management":null},"parent_tool_use_id":null,"session_id":"","uuid":""}"#;
        let msg = extract_log_line(line);
        assert_eq!(msg, Some("正在读取文件...".to_string()));

        // tool_use line
        let tool_line = r#"{"type":"assistant","message":{"content":[{"type":"tool_use","text":"","citations":null,"signature":"","thinking":"","data":"","id":"t1","input":null,"name":"Read","content":{"OfWebSearchResultBlockArray":null,"error_code":"","type":"web_search_tool_result_error"},"tool_use_id":""}],"id":"","model":"","role":"assistant","stop_reason":"","stop_sequence":"","type":"message","usage":{"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"input_tokens":0,"output_tokens":0,"server_tool_use":{"web_search_requests":0},"service_tier":""},"context_management":null},"parent_tool_use_id":null,"session_id":"","uuid":""}"#;
        let msg2 = extract_log_line(tool_line);
        assert_eq!(msg2, Some("[tool] Read".to_string()));

        // system init — should be ignored
        let sys_line = r#"{"type":"system","subtype":"init","cwd":"/tmp"}"#;
        assert_eq!(extract_log_line(sys_line), None);
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
