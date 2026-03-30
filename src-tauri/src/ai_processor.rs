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
    note: Option<String>,
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

// ── Embedded workspace template ──────────────────────────
// Source files live in src-tauri/resources/workspace-template/.claude/
// Edit those files to update the template; include_str! embeds at compile time.

const WORKSPACE_CLAUDE_MD: &str =
    include_str!("../resources/workspace-template/.claude/CLAUDE.md");

const SCRIPT_JOURNAL_NOTE: &str =
    include_str!("../resources/workspace-template/.claude/scripts/journal-note");
const SCRIPT_JOURNAL_AUDIT: &str =
    include_str!("../resources/workspace-template/.claude/scripts/journal-audit");
const SCRIPT_JOURNAL_NORMALIZE: &str =
    include_str!("../resources/workspace-template/.claude/scripts/journal-normalize-frontmatter");
const SCRIPT_JOURNALIZE_CATEGORIES: &str =
    include_str!("../resources/workspace-template/.claude/scripts/journalize-categories");
const SCRIPT_RECENT_SUMMARIES: &str =
    include_str!("../resources/workspace-template/.claude/scripts/recent-summaries");

/// 确保 workspace/.claude/ 已初始化。仅在文件不存在时创建，不覆盖用户修改。
fn ensure_workspace_dot_claude(workspace_path: &str) {
    let dot_claude = std::path::PathBuf::from(workspace_path).join(".claude");
    let scripts_dir = dot_claude.join("scripts");
    let _ = std::fs::create_dir_all(&scripts_dir);

    // Write CLAUDE.md
    let claude_md = dot_claude.join("CLAUDE.md");
    if !claude_md.exists() {
        let _ = std::fs::write(&claude_md, WORKSPACE_CLAUDE_MD);
    }

    // Write scripts, set executable bit
    let scripts: &[(&str, &str)] = &[
        ("journal-note",                    SCRIPT_JOURNAL_NOTE),
        ("journal-audit",                   SCRIPT_JOURNAL_AUDIT),
        ("journal-normalize-frontmatter",   SCRIPT_JOURNAL_NORMALIZE),
        ("journalize-categories",           SCRIPT_JOURNALIZE_CATEGORIES),
        ("recent-summaries",               SCRIPT_RECENT_SUMMARIES),
    ];
    for (name, content) in scripts {
        let path = scripts_dir.join(name);
        if !path.exists() {
            if std::fs::write(&path, content).is_ok() {
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let _ = std::fs::set_permissions(&path,
                        std::fs::Permissions::from_mode(0o755));
                }
            }
        }
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

/// Extract a concise label from a tool_use input object.
/// e.g. Bash("ls -la"), Read("src/main.rs"), Write("output.md")
fn tool_input_label(name: &str, input: &serde_json::Value) -> String {
    let arg = match name {
        "Bash" => input.get("command")
            .or_else(|| input.get("cmd"))
            .and_then(|v| v.as_str())
            .map(|s| {
                // Trim to first line, max 60 chars
                let first = s.lines().next().unwrap_or(s);
                if first.len() > 60 { format!("{}…", &first[..60]) } else { first.to_string() }
            }),
        "Read" | "Write" | "Edit" | "Glob" => {
            input.get("file_path")
                .or_else(|| input.get("path"))
                .or_else(|| input.get("pattern"))
                .and_then(|v| v.as_str())
                .map(|s| {
                    // Show only filename for readability
                    std::path::Path::new(s)
                        .file_name()
                        .and_then(|f| f.to_str())
                        .unwrap_or(s)
                        .to_string()
                })
        },
        "Grep" => input.get("pattern").and_then(|v| v.as_str()).map(|s| s.to_string()),
        _ => None,
    };
    match arg {
        Some(a) => format!("[{}] {}", name, a),
        None => format!("[{}]", name),
    }
}

/// Parse a single stream-json line and return a human-readable log message,
/// or None if the line should be silently ignored.
fn extract_log_line(line: &str) -> Option<String> {
    let val: serde_json::Value = serde_json::from_str(line).ok()?;
    let typ = val.get("type")?.as_str()?;
    match typ {
        "system" => {
            let subtype = val.get("subtype").and_then(|v| v.as_str()).unwrap_or("");
            if subtype == "init" {
                let model = val.get("model").and_then(|v| v.as_str()).unwrap_or("unknown");
                let tools: Vec<&str> = val.get("tools")
                    .and_then(|v| v.as_array())
                    .map(|arr| arr.iter().filter_map(|t| t.as_str()).collect())
                    .unwrap_or_default();
                let tool_str = if tools.is_empty() {
                    String::new()
                } else {
                    format!(" · 工具: {}", tools.join(", "))
                };
                Some(format!("模型: {}{}", model, tool_str))
            } else {
                None
            }
        }
        "assistant" => {
            let contents = val.pointer("/message/content")?.as_array()?;
            for block in contents {
                let block_type = block.get("type")?.as_str()?;
                match block_type {
                    "text" => {
                        let text = block.get("text")?.as_str()?;
                        let trimmed = text.trim();
                        if !trimmed.is_empty() {
                            // Truncate long text blocks to first line + 120 chars
                            let first = trimmed.lines().next().unwrap_or(trimmed);
                            let display = if first.len() > 120 {
                                format!("{}…", &first[..120])
                            } else {
                                first.to_string()
                            };
                            return Some(display);
                        }
                    }
                    "tool_use" => {
                        let name = block.get("name")?.as_str()?;
                        let input = block.get("input").unwrap_or(&serde_json::Value::Null);
                        return Some(tool_input_label(name, input));
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
                // Show duration and cost on success
                let duration_s = val.get("duration_ms")
                    .and_then(|v| v.as_f64())
                    .map(|ms| format!("{:.1}s", ms / 1000.0))
                    .unwrap_or_default();
                let cost = val.get("total_cost_usd")
                    .and_then(|v| v.as_f64())
                    .map(|c| format!("${:.4}", c))
                    .unwrap_or_default();
                let turns = val.get("num_turns")
                    .and_then(|v| v.as_u64())
                    .map(|t| format!("{} turns", t))
                    .unwrap_or_default();
                let parts: Vec<&str> = [&duration_s, &cost, &turns]
                    .iter()
                    .filter(|s| !s.is_empty())
                    .map(|s| s.as_str())
                    .collect();
                if parts.is_empty() {
                    Some("完成".to_string())
                } else {
                    Some(format!("完成 · {}", parts.join(" · ")))
                }
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
            let result = process_material(&app, &task.material_path, &task.year_month, task.note.as_deref(), &current_task).await;
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
    note: Option<&str>,
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

    ensure_workspace_dot_claude(&cfg.workspace_path);

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
    let note_suffix = note
        .filter(|n| !n.trim().is_empty())
        .map(|n| format!("\n用户补充：{}", n.trim()))
        .unwrap_or_default();
    let prompt = format!(
        "深入梳理 @{}，整理为日志条目并直接写文件，不要输出任何解释。\n文件名格式：DD-标题.md，写在 {}/ 目录下（不要写到 raw/ 里）。{}",
        relative_ref, year_month, note_suffix
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
    note: Option<String>,
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
        note,
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
        Ok(WORKSPACE_CLAUDE_MD.to_string())
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
        let relative_ref = format!("{}/raw/{}", year_month, filename);

        // without note
        let note_suffix = "";
        let prompt = format!(
            "深入梳理 @{}，整理为日志条目并直接写文件，不要输出任何解释。\n文件名格式：DD-标题.md，写在 {}/ 目录下（不要写到 raw/ 里）。{}",
            relative_ref, year_month, note_suffix
        );
        assert!(prompt.contains("@2603/raw/note.txt"));
        assert!(prompt.contains("深入梳理"));
        assert!(prompt.contains("DD-标题.md"));
        assert!(prompt.contains("2603/"));
        assert!(!prompt.contains("用户补充"));

        // with note
        let note_suffix = "\n用户补充：这是会议记录";
        let prompt_with_note = format!(
            "深入梳理 @{}，整理为日志条目并直接写文件，不要输出任何解释。\n文件名格式：DD-标题.md，写在 {}/ 目录下（不要写到 raw/ 里）。{}",
            relative_ref, year_month, note_suffix
        );
        assert!(prompt_with_note.contains("用户补充：这是会议记录"));
    }

    #[test]
    fn get_workspace_prompt_returns_default_when_no_file() {
        assert!(!WORKSPACE_CLAUDE_MD.is_empty());
        assert!(WORKSPACE_CLAUDE_MD.contains("tags"));
        assert!(WORKSPACE_CLAUDE_MD.contains("summary"));
    }

    #[test]
    fn extract_log_message_from_stream_json_lines() {
        // assistant text line
        let line = r#"{"type":"assistant","message":{"content":[{"type":"text","text":"正在读取文件...","citations":null,"signature":"","thinking":"","data":"","id":"","input":null,"name":"","content":{"OfWebSearchResultBlockArray":null,"error_code":"","type":"web_search_tool_result_error"},"tool_use_id":""}],"id":"","model":"","role":"assistant","stop_reason":"","stop_sequence":"","type":"message","usage":{"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"input_tokens":0,"output_tokens":0,"server_tool_use":{"web_search_requests":0},"service_tier":""},"context_management":null},"parent_tool_use_id":null,"session_id":"","uuid":""}"#;
        let msg = extract_log_line(line);
        assert_eq!(msg, Some("正在读取文件...".to_string()));

        // tool_use Bash with command
        let tool_line = r#"{"type":"assistant","message":{"content":[{"type":"tool_use","text":"","citations":null,"signature":"","thinking":"","data":"","id":"t1","input":{"command":"ls -la"},"name":"Bash","content":{"OfWebSearchResultBlockArray":null,"error_code":"","type":"web_search_tool_result_error"},"tool_use_id":""}],"id":"","model":"","role":"assistant","stop_reason":"","stop_sequence":"","type":"message","usage":{"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"input_tokens":0,"output_tokens":0,"server_tool_use":{"web_search_requests":0},"service_tier":""},"context_management":null},"parent_tool_use_id":null,"session_id":"","uuid":""}"#;
        assert_eq!(extract_log_line(tool_line), Some("[Bash] ls -la".to_string()));

        // tool_use Read with file_path
        let read_line = r#"{"type":"assistant","message":{"content":[{"type":"tool_use","text":"","citations":null,"signature":"","thinking":"","data":"","id":"t2","input":{"file_path":"src/main.rs"},"name":"Read","content":{"OfWebSearchResultBlockArray":null,"error_code":"","type":"web_search_tool_result_error"},"tool_use_id":""}],"id":"","model":"","role":"assistant","stop_reason":"","stop_sequence":"","type":"message","usage":{"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"input_tokens":0,"output_tokens":0,"server_tool_use":{"web_search_requests":0},"service_tier":""},"context_management":null},"parent_tool_use_id":null,"session_id":"","uuid":""}"#;
        assert_eq!(extract_log_line(read_line), Some("[Read] main.rs".to_string()));

        // system init
        let sys_line = r#"{"type":"system","subtype":"init","cwd":"/tmp","model":"claude-sonnet-4-6","tools":["Bash","Read"]}"#;
        let sys_msg = extract_log_line(sys_line).unwrap();
        assert!(sys_msg.contains("claude-sonnet-4-6"), "expected model name in: {}", sys_msg);
        assert!(sys_msg.contains("Bash"), "expected tools in: {}", sys_msg);

        // system non-init — should be ignored
        let hook_line = r#"{"type":"system","subtype":"hook_started"}"#;
        assert_eq!(extract_log_line(hook_line), None);

        // result success with duration and cost
        let result_ok = r#"{"type":"result","subtype":"success","is_error":false,"duration_ms":5000,"num_turns":3,"total_cost_usd":0.012}"#;
        let ok_msg = extract_log_line(result_ok).unwrap();
        assert!(ok_msg.contains("完成"), "expected 完成 in: {}", ok_msg);
        assert!(ok_msg.contains("5.0s"), "expected duration in: {}", ok_msg);
        assert!(ok_msg.contains("$0.0120"), "expected cost in: {}", ok_msg);

        // result error
        let result_err = r#"{"type":"result","subtype":"error","is_error":true,"result":"无法读取文件"}"#;
        let err_msg = extract_log_line(result_err).unwrap();
        assert!(err_msg.starts_with("[error]"), "expected [error] prefix in: {}", err_msg);
        assert!(err_msg.contains("无法读取文件"), "expected error text in: {}", err_msg);
    }

    #[test]
    fn cancel_with_no_task_is_noop() {
        let state = CurrentTask(std::sync::Mutex::new(None));
        // Should not panic when nothing is running
        let guard = state.0.lock().unwrap();
        assert!(guard.is_none());
        drop(guard);
    }

    #[test]
    fn ensure_workspace_dot_claude_creates_structure() {
        let tmp = std::env::temp_dir().join("journal_dot_claude_test");
        std::fs::create_dir_all(&tmp).unwrap();
        // Clean slate
        let dot_claude = tmp.join(".claude");
        let _ = std::fs::remove_dir_all(&dot_claude);

        ensure_workspace_dot_claude(tmp.to_str().unwrap());

        // CLAUDE.md exists and has expected content
        let claude_md = dot_claude.join("CLAUDE.md");
        assert!(claude_md.exists(), ".claude/CLAUDE.md should exist");
        let content = std::fs::read_to_string(&claude_md).unwrap();
        assert!(content.contains("tags"), "CLAUDE.md should mention tags");
        assert!(content.contains("summary"), "CLAUDE.md should mention summary");
        assert!(content.contains("DD-标题.md"), "CLAUDE.md should mention filename format");

        // Scripts exist and are executable
        use std::os::unix::fs::PermissionsExt;
        for script in &["journal-note", "journal-audit", "journal-normalize-frontmatter",
                        "journalize-categories", "recent-summaries"] {
            let p = dot_claude.join("scripts").join(script);
            assert!(p.exists(), "script {} should exist", script);
            let mode = std::fs::metadata(&p).unwrap().permissions().mode();
            assert!(mode & 0o111 != 0, "script {} should be executable", script);
        }

        // Second call should NOT overwrite existing files
        std::fs::write(&claude_md, "用户自定义内容").unwrap();
        ensure_workspace_dot_claude(tmp.to_str().unwrap());
        let content2 = std::fs::read_to_string(&claude_md).unwrap();
        assert_eq!(content2, "用户自定义内容", "second call must not overwrite");

        std::fs::remove_dir_all(&tmp).ok();
    }
}
