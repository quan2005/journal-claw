use crate::config;
use futures::FutureExt;
use serde::{Deserialize, Serialize};
use std::panic::AssertUnwindSafe;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::mpsc;

// ── Types ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingUpdate {
    pub material_path: String,
    pub status: String, // "queued" | "processing" | "completed" | "failed"
    pub error: Option<String>,
}

pub struct QueueTask {
    material_path: String,
    year_month: String,
    note: Option<String>,
    prompt_text: Option<String>,
}

/// Holds the sender half — stored in Tauri managed state.
pub struct AiQueue(pub mpsc::Sender<QueueTask>);

/// Holds a handle to the currently-running Claude CLI child process.
/// Wrapped in Mutex so the cancel command can reach in and kill it.
pub struct CurrentTask(pub std::sync::Mutex<Option<tokio::process::Child>>);

/// Paths that have been cancelled while still queued (not yet processing).
/// The queue consumer checks this before starting each task.
pub struct CancelledPaths(pub std::sync::Mutex<std::collections::HashSet<String>>);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiLogLine {
    pub material_path: String,
    pub level: String, // "info" | "error"
    pub message: String,
}

pub async fn enqueue_material(
    app: &AppHandle,
    material_path: String,
    year_month: String,
    note: Option<String>,
    prompt_text: Option<String>,
) -> Result<(), String> {
    let _ = app.emit(
        "ai-processing",
        ProcessingUpdate {
            material_path: material_path.clone(),
            status: "queued".to_string(),
            error: None,
        },
    );

    let tx = app.state::<AiQueue>().0.clone();
    tx.send(QueueTask {
        material_path,
        year_month,
        note,
        prompt_text,
    })
    .await
    .map_err(|e| format!("队列发送失败: {}", e))?;

    Ok(())
}

// ── Helpers ──────────────────────────────────────────────

// ── Embedded workspace template ──────────────────────────
// Source files live in src-tauri/resources/workspace-template/.claude/
// Edit those files to update the template; include_str! embeds at compile time.

const WORKSPACE_CLAUDE_MD: &str = include_str!("../resources/workspace-template/.claude/CLAUDE.md");

const WORKSPACE_SETTINGS_JSON: &str =
    include_str!("../resources/workspace-template/.claude/settings.json");

const SCRIPT_JOURNAL_CREATE: &str =
    include_str!("../resources/workspace-template/.claude/scripts/journal-create");
const SCRIPT_RECENT_SUMMARIES: &str =
    include_str!("../resources/workspace-template/.claude/scripts/recent-summaries");
const SCRIPT_IDENTITY_CREATE: &str =
    include_str!("../resources/workspace-template/.claude/scripts/identity-create");

const WORKSPACE_USER_CLAUDE_MD: &str =
    include_str!("../resources/workspace-template/CLAUDE.md");

// ── Ideate skill template ───────────────────────
const SKILL_IDEATE_MD: &str =
    include_str!("../resources/workspace-template/.claude/skills/ideate/SKILL.md");
const SKILL_IDEATE_VISUAL_COMPANION: &str =
    include_str!("../resources/workspace-template/.claude/skills/ideate/visual-companion.md");
const SKILL_IDEATE_FRAME_TEMPLATE: &str =
    include_str!("../resources/workspace-template/.claude/skills/ideate/scripts/frame-template.html");

/// 确保 workspace/.claude/ 已初始化。每次启动强制覆盖，保持与应用版本同步。
pub fn ensure_workspace_dot_claude(workspace_path: &str) {
    let dot_claude = std::path::PathBuf::from(workspace_path).join(".claude");
    let scripts_dir = dot_claude.join("scripts");
    if let Err(e) = std::fs::create_dir_all(&scripts_dir) {
        eprintln!(
            "[ai_processor] warn: failed to create .claude/scripts dir: {}",
            e
        );
        return;
    }

    // Always overwrite template files to keep workspace in sync with app version
    let _ = std::fs::write(dot_claude.join("CLAUDE.md"), WORKSPACE_CLAUDE_MD);
    let _ = std::fs::write(dot_claude.join("settings.json"), WORKSPACE_SETTINGS_JSON);

    let scripts: &[(&str, &str)] = &[
        ("journal-create", SCRIPT_JOURNAL_CREATE),
        ("recent-summaries", SCRIPT_RECENT_SUMMARIES),
        ("identity-create", SCRIPT_IDENTITY_CREATE),
    ];
    for (name, content) in scripts {
        let path = scripts_dir.join(name);
        if std::fs::write(&path, content).is_ok() {
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755));
            }
        }
    }

    // ── Sync ideate skill ───────────────────────────
    let ideate_dir = dot_claude.join("skills").join("ideate");
    let ideate_scripts = ideate_dir.join("scripts");
    if let Err(e) = std::fs::create_dir_all(&ideate_scripts) {
        eprintln!("[ai_processor] warn: failed to create skills/ideate/scripts dir: {}", e);
    } else {
        let _ = std::fs::write(ideate_dir.join("SKILL.md"), SKILL_IDEATE_MD);
        let _ = std::fs::write(ideate_dir.join("visual-companion.md"), SKILL_IDEATE_VISUAL_COMPANION);

        let _ = std::fs::write(ideate_scripts.join("frame-template.html"), SKILL_IDEATE_FRAME_TEMPLATE);

        for obsolete in &["start-server.sh", "stop-server.sh", "server.cjs", "helper.js"] {
            let _ = std::fs::remove_file(ideate_scripts.join(obsolete));
        }
    }

    // Ensure workspace/CLAUDE.md exists (only create if missing — never overwrite user edits)
    let user_claude_md = std::path::PathBuf::from(workspace_path).join("CLAUDE.md");
    if !user_claude_md.exists() {
        let _ = std::fs::write(&user_claude_md, WORKSPACE_USER_CLAUDE_MD);
    }
}

/// Build CLI args and extra environment variables for a Claude Code invocation.
/// Returns `(args, extra_envs)` where `extra_envs` only contains keys that were
/// non-empty (caller merges into the child process environment).
pub fn build_claude_args_with_creds(
    material_path: &str,
    year_month: &str,
    note: Option<&str>,
    prompt_text: Option<&str>,
    model: &str,
    api_key: &str,
    base_url: &str,
) -> (Vec<String>, std::collections::HashMap<String, String>) {
    let prompt = if let Some(pt) = prompt_text.filter(|s| !s.trim().is_empty()) {
        pt.to_string()
    } else {
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
        format!(
            "你是我的个人知识助手，负责将素材整理进我的日志笔记本。\n\
\n\
阅读 @{}，理解其核心内容，然后：\n\
- 若与已有条目高度相关，追加或更新那个文件；\n\
- 否则新建 {}/DD-标题.md。\n\
\n\
直接写文件，不要输出解释。{}",
            relative_ref, year_month, note_suffix
        )
    };

    let mut args = vec![
        "-p".to_string(),
        prompt,
        "--permission-mode".to_string(),
        "bypassPermissions".to_string(),
        "--output-format".to_string(),
        "stream-json".to_string(),
        "--verbose".to_string(),
        "--disallowed-tools".to_string(),
        "AskUserQuestion".to_string(),
    ];
    if !model.is_empty() {
        args.push("--model".to_string());
        args.push(model.to_string());
    }

    let mut envs = std::collections::HashMap::new();
    if !api_key.is_empty() {
        envs.insert("ANTHROPIC_API_KEY".to_string(), api_key.to_string());
    }
    if !base_url.is_empty() {
        envs.insert("ANTHROPIC_BASE_URL".to_string(), base_url.to_string());
    }

    (args, envs)
}

/// Simplified version without credential injection (uses CLI defaults).
#[cfg(test)]
pub fn build_claude_args(
    material_path: &str,
    year_month: &str,
    note: Option<&str>,
    prompt_text: Option<&str>,
    model: &str,
) -> (Vec<String>, std::collections::HashMap<String, String>) {
    build_claude_args_with_creds(material_path, year_month, note, prompt_text, model, "", "")
}

fn augmented_path() -> String {
    crate::config::augmented_path()
}

/// Extract a concise label from a tool_use input object.
/// e.g. Bash("ls -la"), Read("src/main.rs"), Task("review auth flow")
fn normalize_log_text(input: &str) -> String {
    input.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn truncate_for_log(input: &str, max_chars: usize) -> String {
    let normalized = normalize_log_text(input);
    let truncated: String = normalized.chars().take(max_chars).collect();
    if normalized.chars().count() > max_chars {
        format!("{}…", truncated)
    } else {
        truncated
    }
}

fn shell_escape_for_display(arg: &str) -> String {
    let normalized = normalize_log_text(arg);
    if normalized.is_empty() {
        return "''".to_string();
    }

    if normalized.chars().all(|ch| {
        ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-' | '.' | '/' | ':' | '@' | '=')
    }) {
        normalized
    } else {
        format!("'{}'", normalized.replace('\'', r"'\''"))
    }
}

fn build_command_display(program: &str, args: &[String]) -> String {
    std::iter::once(program.to_string())
        .chain(args.iter().map(|arg| shell_escape_for_display(arg)))
        .collect::<Vec<_>>()
        .join(" ")
}

fn json_preview(input: &serde_json::Value) -> Option<String> {
    match input {
        serde_json::Value::Null => None,
        serde_json::Value::String(s) => Some(truncate_for_log(s, 120)),
        serde_json::Value::Array(arr) => {
            let joined = arr
                .iter()
                .filter_map(|v| match v {
                    serde_json::Value::String(s) => Some(s.as_str()),
                    _ => None,
                })
                .take(4)
                .collect::<Vec<_>>()
                .join(", ");
            if joined.is_empty() {
                serde_json::to_string(input)
                    .ok()
                    .map(|s| truncate_for_log(&s, 120))
            } else {
                Some(truncate_for_log(&joined, 120))
            }
        }
        _ => serde_json::to_string(input)
            .ok()
            .map(|s| truncate_for_log(&s, 120)),
    }
}

fn input_string_field(input: &serde_json::Value, keys: &[&str]) -> Option<String> {
    for key in keys {
        let Some(value) = input.get(*key) else {
            continue;
        };
        match value {
            serde_json::Value::String(s) if !s.trim().is_empty() => {
                return Some(truncate_for_log(s, 120));
            }
            serde_json::Value::Array(_) | serde_json::Value::Object(_) => {
                if let Some(preview) = json_preview(value) {
                    return Some(preview);
                }
            }
            _ => {}
        }
    }
    None
}

fn tool_input_label(name: &str, input: &serde_json::Value) -> String {
    let arg = match name {
        "Bash" => input
            .get("command")
            .or_else(|| input.get("cmd"))
            .and_then(|v| v.as_str())
            .map(|s| truncate_for_log(s, 120))
            .or_else(|| input_string_field(input, &["description"])),
        "Read" | "Write" | "Edit" | "NotebookEdit" | "Glob" => input
            .get("file_path")
            .or_else(|| input.get("path"))
            .or_else(|| input.get("pattern"))
            .and_then(|v| v.as_str())
            .map(|s| {
                std::path::Path::new(s)
                    .file_name()
                    .and_then(|f| f.to_str())
                    .unwrap_or(s)
                    .to_string()
            })
            .map(|s| truncate_for_log(&s, 120)),
        "Grep" => input_string_field(input, &["pattern", "query"]),
        "Task" => input_string_field(input, &["description", "prompt", "subagent_type"]),
        "Skill" => input_string_field(input, &["command", "skill", "name", "args"]),
        "WebSearch" => input_string_field(input, &["query", "q"]),
        "WebFetch" => input_string_field(input, &["url", "prompt"]),
        "ReadMcpResourceTool" => input_string_field(input, &["server", "uri"]),
        "ListMcpResourcesTool" => input_string_field(input, &["server", "cursor"]),
        "RemoteTrigger" => input_string_field(input, &["trigger", "name", "url"]),
        "TodoWrite" => input_string_field(input, &["todos", "content", "items"]),
        "TaskOutput" => input_string_field(input, &["task_id", "summary", "content"]),
        "TaskStop" => input_string_field(input, &["task_id", "reason"]),
        "CronCreate" | "CronDelete" | "CronList" | "EnterPlanMode" | "EnterWorktree"
        | "ExitPlanMode" | "ExitWorktree" | "LSP" => json_preview(input),
        _ => input_string_field(
            input,
            &[
                "command",
                "cmd",
                "description",
                "prompt",
                "query",
                "pattern",
                "path",
                "file_path",
                "url",
                "uri",
                "name",
                "message",
            ],
        )
        .or_else(|| json_preview(input)),
    };
    match arg {
        Some(a) => format!("{}: {}", name, a),
        None => format!("{}", name),
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
                let model = val
                    .get("model")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown");
                Some(format!("模型: {}", model))
            } else {
                None
            }
        }
        "assistant" => {
            let contents = val.pointer("/message/content")?.as_array()?;
            for block in contents {
                let Some(block_type) = block.get("type").and_then(|v| v.as_str()) else {
                    continue;
                };
                match block_type {
                    "text" => {
                        if let Some(text) = block.get("text").and_then(|v| v.as_str()) {
                            let trimmed = text.trim();
                            if !trimmed.is_empty() {
                                return Some(trimmed.to_string());
                            }
                        }
                    }
                    "tool_use" => {
                        if let Some(name) = block.get("name").and_then(|v| v.as_str()) {
                            let input = block.get("input").unwrap_or(&serde_json::Value::Null);
                            return Some(tool_input_label(name, input));
                        }
                    }
                    _ => {}
                }
            }
            None
        }
        "user" => {
            // Tool results — show the output content
            let contents = val.pointer("/message/content")?.as_array()?;
            for block in contents {
                if block.get("type").and_then(|v| v.as_str()) == Some("tool_result") {
                    let text = match block.get("content") {
                        Some(serde_json::Value::String(s)) => s.trim().to_string(),
                        Some(serde_json::Value::Array(arr)) => arr
                            .iter()
                            .filter_map(|v| v.get("text").and_then(|t| t.as_str()))
                            .collect::<Vec<_>>()
                            .join("\n")
                            .trim()
                            .to_string(),
                        _ => continue,
                    };
                    if !text.is_empty() {
                        return Some(text);
                    }
                }
            }
            None
        }
        "result" => {
            let is_error = val
                .get("is_error")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            if is_error {
                let msg = val.get("result").and_then(|v| v.as_str()).unwrap_or("失败");
                Some(format!("[error] {}", msg))
            } else {
                // Show duration and cost on success
                let duration_s = val
                    .get("duration_ms")
                    .and_then(|v| v.as_f64())
                    .map(|ms| format!("{:.1}s", ms / 1000.0))
                    .unwrap_or_default();
                let cost = val
                    .get("total_cost_usd")
                    .and_then(|v| v.as_f64())
                    .map(|c| format!("${:.4}", c))
                    .unwrap_or_default();
                let turns = val
                    .get("num_turns")
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

/// Extract a human-readable message from a catch_unwind panic payload.
fn extract_panic_message(payload: &Box<dyn std::any::Any + Send>) -> String {
    if let Some(s) = payload.downcast_ref::<&str>() {
        s.to_string()
    } else if let Some(s) = payload.downcast_ref::<String>() {
        s.clone()
    } else {
        "unknown panic".to_string()
    }
}

/// Lock the CurrentTask mutex, recovering from poisoning if necessary.
/// The inner `Option<Child>` has no complex invariants, so accessing
/// through a poisoned mutex is safe.
fn lock_current_task(
    mutex: &std::sync::Mutex<Option<tokio::process::Child>>,
) -> std::sync::MutexGuard<'_, Option<tokio::process::Child>> {
    mutex.lock().unwrap_or_else(|poisoned| {
        eprintln!("[ai_queue] CurrentTask mutex poisoned, recovering");
        poisoned.into_inner()
    })
}

/// After a panic inside process_material, the CurrentTask mutex may be
/// poisoned and may still hold a child process handle. This function
/// recovers the mutex and kills any leftover child process.
fn cleanup_current_task_after_panic(app: &AppHandle) {
    let current_task = app.state::<CurrentTask>();
    let maybe_child = lock_current_task(&current_task.0).take();
    if let Some(mut child) = maybe_child {
        #[cfg(unix)]
        {
            if let Some(pid) = child.id() {
                let pgid = pid as i32;
                unsafe {
                    libc::killpg(pgid, libc::SIGKILL);
                }
                eprintln!("[ai_queue] panic cleanup: killed process group {}", pgid);
            }
        }
        let _ = child.start_kill();
        eprintln!("[ai_queue] panic cleanup: killed leftover child process");
    }
}

/// Spawn a single-threaded consumer that processes tasks serially.
/// Call once during app setup; pass the receiver half.
pub fn start_queue_consumer(app: AppHandle, mut rx: mpsc::Receiver<QueueTask>) {
    tauri::async_runtime::spawn(async move {
        eprintln!("[ai_queue] consumer loop started");
        while let Some(task) = rx.recv().await {
            eprintln!(
                "[ai_queue] dequeued task: {} ({})",
                task.material_path, task.year_month
            );

            // Check if this task was cancelled while waiting in the queue
            let was_cancelled = {
                let cancelled = app.state::<CancelledPaths>();
                let mut set = cancelled.0.lock().unwrap_or_else(|e| {
                    eprintln!("[ai_queue] CancelledPaths mutex poisoned, recovering");
                    e.into_inner()
                });
                set.remove(&task.material_path)
            };
            if was_cancelled {
                eprintln!("[ai_queue] skipping cancelled task: {}", task.material_path);
                continue;
            }

            let material_path = task.material_path.clone();

            let current_task = app.state::<CurrentTask>();
            let result = AssertUnwindSafe(process_material(
                &app,
                &task.material_path,
                &task.year_month,
                task.note.as_deref(),
                task.prompt_text.as_deref(),
                &current_task,
            ))
            .catch_unwind()
            .await;

            match result {
                Ok(Ok(())) => {
                    eprintln!("[ai_queue] task completed: {}", material_path);
                }
                Ok(Err(e)) => {
                    eprintln!("[ai_queue] task failed: {} → {}", material_path, e);
                }
                Err(panic_payload) => {
                    let panic_msg = extract_panic_message(&panic_payload);
                    eprintln!(
                        "[ai_queue] PANIC in process_material for {}: {}",
                        material_path, panic_msg
                    );

                    cleanup_current_task_after_panic(&app);

                    let error_msg = format!("内部错误 (panic): {}", panic_msg);
                    let _ = app.emit(
                        "ai-processing",
                        ProcessingUpdate {
                            material_path: material_path.clone(),
                            status: "failed".to_string(),
                            error: Some(error_msg.clone()),
                        },
                    );
                    let _ = app.emit(
                        "ai-log",
                        AiLogLine {
                            material_path: material_path.clone(),
                            level: "error".to_string(),
                            message: format!("处理器崩溃: {}", panic_msg),
                        },
                    );

                    eprintln!("[ai_queue] recovered from panic, continuing consumer loop");
                }
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
    prompt_text: Option<&str>,
    current_task: &tauri::State<'_, CurrentTask>,
) -> Result<(), String> {
    let cfg = config::load_config(app).inspect_err(|e| {
        let _ = app.emit(
            "ai-processing",
            ProcessingUpdate {
                material_path: material_path.to_string(),
                status: "failed".to_string(),
                error: Some(e.clone()),
            },
        );
    })?;
    let cli = if cfg.claude_cli_path.is_empty() {
        crate::config::default_claude_cli_detect()
    } else {
        cfg.claude_cli_path.clone()
    };

    eprintln!(
        "[ai_processor] start — material={} ym={}",
        material_path, year_month
    );
    eprintln!(
        "[ai_processor] cli={} workspace={}",
        cli, cfg.workspace_path
    );

    ensure_workspace_dot_claude(&cfg.workspace_path);

    let _ = app.emit(
        "ai-processing",
        ProcessingUpdate {
            material_path: material_path.to_string(),
            status: "processing".to_string(),
            error: None,
        },
    );

    let (model, api_key, base_url) = (
        cfg.claude_code_model.as_str(),
        cfg.claude_code_api_key.as_str(),
        cfg.claude_code_base_url.as_str(),
    );
    let (args, extra_envs) = build_claude_args_with_creds(
        material_path,
        year_month,
        note,
        prompt_text,
        model,
        api_key,
        base_url,
    );
    // Generate session ID for resume support
    let t = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let nanos = t.as_nanos();
    let session_id = format!(
        "{:08x}-{:04x}-4{:03x}-{:04x}-{:012x}",
        (nanos & 0xFFFFFFFF) as u32,
        ((nanos >> 32) & 0xFFFF) as u16,
        ((nanos >> 48) & 0x0FFF) as u16,
        ((nanos >> 60) & 0xFFFF) as u16,
        ((nanos >> 76) & 0xFFFFFFFFFFFF) as u64 & 0xFFFFFFFFFFFF,
    );
    let session_file = std::env::temp_dir().join("journal-claude-session-id");
    let _ = std::fs::write(&session_file, &session_id);
    let mut args = args;
    args.push("--session-id".to_string());
    args.push(session_id);
    let command_display = build_command_display(&cli, &args);

    // Emit startup log
    let _ = app.emit(
        "ai-log",
        AiLogLine {
            material_path: material_path.to_string(),
            level: "info".to_string(),
            message: format!("启动 {} ...", cli),
        },
    );
    let _ = app.emit(
        "ai-log",
        AiLogLine {
            material_path: material_path.to_string(),
            level: "info".to_string(),
            message: format!("命令: {}", command_display),
        },
    );

    eprintln!("[ai_processor] running: {} {}", cli, args.join(" "));

    use tokio::io::AsyncBufReadExt;

    let mut cmd = tokio::process::Command::new(&cli);
    cmd.args(&args)
        .current_dir(&cfg.workspace_path)
        .env("PATH", augmented_path())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true);
    #[cfg(unix)]
    {
        // Spawn in a new process group so cancel can kill the entire tree
        // (claude CLI may spawn Node.js workers that inherit the stdout pipe)
        cmd.process_group(0);
    }
    for (k, v) in &extra_envs {
        cmd.env(k, v);
    }
    let mut child = cmd.spawn().map_err(|e| {
        let msg = format!("启动 Claude CLI 失败 ({}): {}", &cli, e);
        let _ = app.emit(
            "ai-processing",
            ProcessingUpdate {
                material_path: material_path.to_string(),
                status: "failed".to_string(),
                error: Some(msg.clone()),
            },
        );
        msg
    })?;

    let stdout = child.stdout.take().ok_or_else(|| "无法获取 stdout".to_string())?;
    let stderr_handle = child.stderr.take().ok_or_else(|| "无法获取 stderr".to_string())?;

    // Store child (without stdout/stderr — they're taken above)
    {
        let mut guard = lock_current_task(&current_task.0);
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
                let _ = app_stderr.emit(
                    "ai-log",
                    AiLogLine {
                        material_path: mp_stderr.clone(),
                        level: "info".to_string(),
                        message: line,
                    },
                );
            }
        }
    });

    // Read stdout (stream-json NDJSON) and emit log lines
    let mut stdout_reader = tokio::io::BufReader::new(stdout).lines();
    let mut final_result: Result<(), String> = Ok(());

    while let Ok(Some(line)) = stdout_reader.next_line().await {
        eprintln!("[ai_processor:stream] {}", truncate_for_log(&line, 200));
        if let Some(msg) = extract_log_line(&line) {
            let level = if msg.starts_with("[error]") {
                "error"
            } else {
                "info"
            };
            let _ = app_clone.emit(
                "ai-log",
                AiLogLine {
                    material_path: mp.clone(),
                    level: level.to_string(),
                    message: msg.clone(),
                },
            );
            if msg.starts_with("[error]") {
                final_result = Err(msg);
            }
        }
        // Check if this is the result line to detect success/failure
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&line) {
            if val.get("type").and_then(|v| v.as_str()) == Some("result") {
                let is_error = val
                    .get("is_error")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);
                if is_error {
                    let msg = val
                        .get("result")
                        .and_then(|v| v.as_str())
                        .unwrap_or("AI 处理失败");
                    final_result = Err(msg.to_string());
                }
                // result 行是 stream-json 的最后一条，主动 break 避免等待
                // Node worker 继承 stdout fd 导致 pipe 不关闭而卡死
                break;
            }
        }
    }

    // stderr 仅用于日志，不参与结果判断。
    // Claude CLI 会 spawn Node worker 并继承 stderr fd，导致 stderr pipe 在主进程退出后
    // 仍未关闭。直接 drop task，让它在后台自然结束，避免卡死。
    drop(stderr_task);

    // Wait for child and check exit status
    // Take child out of the mutex before awaiting to avoid holding MutexGuard across .await
    let maybe_child = {
        let mut guard = lock_current_task(&current_task.0);
        guard.take()
    };

    let exit_status = if let Some(mut child) = maybe_child {
        child.wait().await.map_err(|e| e.to_string())?
    } else {
        // Child was killed via cancel_ai_processing
        let _ = app_clone.emit(
            "ai-processing",
            ProcessingUpdate {
                material_path: mp.clone(),
                status: "failed".to_string(),
                error: Some("已取消".to_string()),
            },
        );
        return Err("已取消".to_string());
    };

    eprintln!("[ai_processor] exit_code={:?}", exit_status.code());

    if !exit_status.success() && final_result.is_ok() {
        final_result = Err(format!("进程退出码: {:?}", exit_status.code()));
    }

    match final_result {
        Ok(()) => {
            let _ = app_clone.emit(
                "ai-processing",
                ProcessingUpdate {
                    material_path: mp.clone(),
                    status: "completed".to_string(),
                    error: None,
                },
            );
            let _ = app_clone.emit("journal-updated", year_month);
            // Check if todos.md was modified by AI and notify frontend
            let todos_path = std::path::Path::new(&cfg.workspace_path).join("todos.md");
            if todos_path.exists() {
                let _ = app_clone.emit("todos-updated", ());
            }
            Ok(())
        }
        Err(err) => {
            let _ = app_clone.emit(
                "ai-processing",
                ProcessingUpdate {
                    material_path: mp.clone(),
                    status: "failed".to_string(),
                    error: Some(err.clone()),
                },
            );
            Err(err)
        }
    }
}

// ── Tauri command ────────────────────────────────────────

#[tauri::command]
pub async fn trigger_ai_processing(
    app: AppHandle,
    material_path: String,
    year_month: String,
    note: Option<String>,
) -> Result<(), String> {
    eprintln!("[trigger_ai] material={} ym={}", material_path, year_month);
    enqueue_material(&app, material_path, year_month, note, None).await
}

#[tauri::command]
pub fn get_workspace_prompt(app: AppHandle) -> Result<String, String> {
    let cfg = config::load_config(&app)?;
    let path = std::path::PathBuf::from(&cfg.workspace_path).join("CLAUDE.md");
    if path.exists() {
        std::fs::read_to_string(&path).map_err(|e| e.to_string())
    } else {
        Ok(WORKSPACE_USER_CLAUDE_MD.to_string())
    }
}

#[tauri::command]
pub fn set_workspace_prompt(app: AppHandle, content: String) -> Result<(), String> {
    let cfg = config::load_config(&app)?;
    let path = std::path::PathBuf::from(&cfg.workspace_path).join("CLAUDE.md");
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reset_workspace_prompt(app: AppHandle) -> Result<String, String> {
    let cfg = config::load_config(&app)?;
    let path = std::path::PathBuf::from(&cfg.workspace_path).join("CLAUDE.md");
    std::fs::write(&path, WORKSPACE_USER_CLAUDE_MD).map_err(|e| e.to_string())?;
    Ok(WORKSPACE_USER_CLAUDE_MD.to_string())
}

#[tauri::command]
pub async fn cancel_ai_processing(
    current_task: tauri::State<'_, CurrentTask>,
) -> Result<(), String> {
    let mut guard = lock_current_task(&current_task.0);
    if let Some(mut child) = guard.take() {
        // On Unix, kill the entire process group to ensure Node.js workers
        // (spawned by claude CLI) are also terminated, closing the stdout pipe.
        #[cfg(unix)]
        {
            if let Some(pid) = child.id() {
                let pgid = pid as i32;
                unsafe {
                    libc::killpg(pgid, libc::SIGKILL);
                }
                eprintln!(
                    "[ai_processor] cancel: sent SIGKILL to process group {}",
                    pgid
                );
            }
        }
        // Fallback / Windows: kill just the direct child
        let _ = child.start_kill();
        eprintln!("[ai_processor] cancel: sent kill to child process");
    } else {
        eprintln!("[ai_processor] cancel: no task running");
    }
    Ok(())
}

/// No event is emitted — the frontend handles UI removal directly.
#[allow(dead_code)]
#[tauri::command]
pub async fn cancel_queued_item(
    cancelled_paths: tauri::State<'_, CancelledPaths>,
    material_path: String,
) -> Result<(), String> {
    let mut set = cancelled_paths.0.lock().map_err(|e| e.to_string())?;
    set.insert(material_path.clone());
    eprintln!(
        "[ai_processor] cancel_queued: marked for skip: {}",
        material_path
    );
    Ok(())
}

#[tauri::command]
pub async fn trigger_ai_prompt(app: AppHandle, prompt: String) -> Result<(), String> {
    // Use first 20 chars of prompt as display label in ProcessingQueue
    let label: String = prompt.chars().take(20).collect();
    let material_path = if prompt.chars().count() > 20 {
        format!("{}…", label)
    } else {
        label
    };
    let year_month = crate::workspace::current_year_month();

    eprintln!("[trigger_ai_prompt] prompt_label={}", material_path);

    enqueue_material(&app, material_path, year_month, None, Some(prompt)).await
}

/// 检测引擎是否已安装。engine: "claude" | "qwen"
#[tauri::command]
pub fn check_engine_installed(engine: String) -> Result<bool, String> {
    let bin = match engine.as_str() {
        "claude" => "claude",
        "qwen" => "qwen",
        _ => return Err(format!("unknown engine: {}", engine)),
    };
    let output = std::process::Command::new("/usr/bin/which")
        .arg(bin)
        .env("PATH", augmented_path())
        .output()
        .map_err(|e| e.to_string())?;
    Ok(output.status.success())
}

/// 安装引擎，立即返回，通过 "engine-install-log" 事件流式推送日志。
/// payload: { engine, line, done, success }
#[tauri::command]
pub fn install_engine(app: tauri::AppHandle, engine: String) -> Result<(), String> {
    use crate::config::augmented_path;

    let (program, args): (&str, Vec<&str>) = match engine.as_str() {
        "claude" => ("brew", vec!["install", "--cask", "claude-code"]),
        "qwen" => ("bash", vec![
            "-c",
            "bash <(curl -fsSL https://qwen-code-assets.oss-cn-hangzhou.aliyuncs.com/installation/install-qwen.sh) -s --source qwenchat",
        ]),
        _ => return Err(format!("unknown engine: {}", engine)),
    };

    let mut child = std::process::Command::new(program)
        .args(&args)
        .env("PATH", augmented_path())
        .env("HOMEBREW_NO_AUTO_UPDATE", "1")
        .env("HOMEBREW_NO_ENV_HINTS", "1")
        .env("HOMEBREW_NO_ANALYTICS", "1")
        .env("CI", "1")
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("启动安装失败: {}", e))?;

    tauri::async_runtime::spawn_blocking(move || {
        use std::io::{BufRead, BufReader};
        use tauri::Emitter;

        let emit = |app: &tauri::AppHandle, line: &str, done: bool, success: bool| {
            let _ = app.emit("engine-install-log", serde_json::json!({
                "engine": engine, "line": line, "done": done, "success": success,
            }));
        };

        if let Some(stderr) = child.stderr.take() {
            let app_c = app.clone();
            let eng = engine.clone();
            std::thread::spawn(move || {
                for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                    let t = line.trim().to_string();
                    if !t.is_empty() {
                        let _ = app_c.emit("engine-install-log", serde_json::json!({
                            "engine": eng, "line": t, "done": false, "success": false,
                        }));
                    }
                }
            });
        }
        if let Some(stdout) = child.stdout.take() {
            let app_c = app.clone();
            let eng = engine.clone();
            std::thread::spawn(move || {
                for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                    let t = line.trim().to_string();
                    if !t.is_empty() {
                        let _ = app_c.emit("engine-install-log", serde_json::json!({
                            "engine": eng, "line": t, "done": false, "success": false,
                        }));
                    }
                }
            });
        }

        let success = child.wait().map(|s| s.success()).unwrap_or(false);
        emit(&app, if success { "安装完成" } else { "安装失败" }, true, success);
    });

    Ok(())
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
            "你是我的个人知识助手，负责将素材整理进我的日志笔记本。\n\
\n\
阅读 @{}，理解其核心内容，然后：\n\
- 若与已有条目高度相关，追加或更新那个文件；\n\
- 否则新建 {}/DD-标题.md。\n\
\n\
直接写文件，不要输出解释。{}",
            relative_ref, year_month, note_suffix
        );
        assert!(prompt.contains("@2603/raw/note.txt"));
        assert!(prompt.contains("DD-标题.md"));
        assert!(prompt.contains("2603/"));
        assert!(!prompt.contains("用户补充"));

        // with note
        let note_suffix = "\n用户补充：这是会议记录";
        let prompt_with_note = format!(
            "你是我的个人知识助手，负责将素材整理进我的日志笔记本。\n\
\n\
阅读 @{}，理解其核心内容，然后：\n\
- 若与已有条目高度相关，追加或更新那个文件；\n\
- 否则新建 {}/DD-标题.md。\n\
\n\
直接写文件，不要输出解释。{}",
            relative_ref, year_month, note_suffix
        );
        assert!(prompt_with_note.contains("用户补充：这是会议记录"));
    }

    #[test]
    fn get_workspace_prompt_returns_default_when_no_file() {
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
        assert_eq!(
            extract_log_line(tool_line),
            Some("Bash: ls -la".to_string())
        );

        // tool_use Read with file_path
        let read_line = r#"{"type":"assistant","message":{"content":[{"type":"tool_use","text":"","citations":null,"signature":"","thinking":"","data":"","id":"t2","input":{"file_path":"src/main.rs"},"name":"Read","content":{"OfWebSearchResultBlockArray":null,"error_code":"","type":"web_search_tool_result_error"},"tool_use_id":""}],"id":"","model":"","role":"assistant","stop_reason":"","stop_sequence":"","type":"message","usage":{"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"input_tokens":0,"output_tokens":0,"server_tool_use":{"web_search_requests":0},"service_tier":""},"context_management":null},"parent_tool_use_id":null,"session_id":"","uuid":""}"#;
        assert_eq!(
            extract_log_line(read_line),
            Some("Read: main.rs".to_string())
        );

        // system init
        let sys_line = r#"{"type":"system","subtype":"init","cwd":"/tmp","model":"claude-sonnet-4-6","tools":["Bash","Read"]}"#;
        let sys_msg = extract_log_line(sys_line).unwrap();
        assert!(
            sys_msg.contains("claude-sonnet-4-6"),
            "expected model name in: {}",
            sys_msg
        );
        assert!(
            !sys_msg.contains("工具"),
            "expected no tool list in: {}",
            sys_msg
        );

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
        let result_err =
            r#"{"type":"result","subtype":"error","is_error":true,"result":"无法读取文件"}"#;
        let err_msg = extract_log_line(result_err).unwrap();
        assert!(
            err_msg.starts_with("[error]"),
            "expected [error] prefix in: {}",
            err_msg
        );
        assert!(
            err_msg.contains("无法读取文件"),
            "expected error text in: {}",
            err_msg
        );
    }

    #[test]
    fn build_claude_args_includes_model_when_set() {
        let (args, _envs) = build_claude_args("note.txt", "2603", None, None, "claude-sonnet-4-6");
        let model_idx = args
            .iter()
            .position(|a| a == "--model")
            .expect("--model not found");
        assert_eq!(args[model_idx + 1], "claude-sonnet-4-6");
    }

    #[test]
    fn build_claude_args_omits_model_when_empty() {
        let (args, _envs) = build_claude_args("note.txt", "2603", None, None, "");
        assert!(
            !args.contains(&"--model".to_string()),
            "--model should be absent when empty"
        );
    }

    #[test]
    fn build_claude_args_injects_api_key_env() {
        let (_args, envs) =
            build_claude_args_with_creds("note.txt", "2603", None, None, "", "sk-test-key", "");
        assert_eq!(
            envs.get("ANTHROPIC_API_KEY").map(|s| s.as_str()),
            Some("sk-test-key")
        );
    }

    #[test]
    fn build_claude_args_injects_base_url_env() {
        let (_args, envs) = build_claude_args_with_creds(
            "note.txt",
            "2603",
            None,
            None,
            "",
            "",
            "https://my-proxy.example.com",
        );
        assert_eq!(
            envs.get("ANTHROPIC_BASE_URL").map(|s| s.as_str()),
            Some("https://my-proxy.example.com")
        );
    }

    #[test]
    fn build_claude_args_omits_env_when_empty() {
        let (_args, envs) =
            build_claude_args_with_creds("note.txt", "2603", None, None, "", "", "");
        assert!(
            !envs.contains_key("ANTHROPIC_API_KEY"),
            "should not set API key env when empty"
        );
        assert!(
            !envs.contains_key("ANTHROPIC_BASE_URL"),
            "should not set base URL env when empty"
        );
    }

    #[test]
    fn build_command_display_shows_engine_invocation() {
        let args = vec![
            "-p".to_string(),
            "深入梳理 @2603/raw/note.txt，整理为日志条目。".to_string(),
            "--output-format".to_string(),
            "stream-json".to_string(),
        ];
        let command = build_command_display("claude", &args);
        assert!(
            command.starts_with("claude -p "),
            "expected command prefix in: {}",
            command
        );
        assert!(
            command.contains("--output-format stream-json"),
            "expected output flag in: {}",
            command
        );
        assert!(
            command.contains("深入梳理 @2603/raw/note.txt"),
            "expected prompt in: {}",
            command
        );
    }

    #[test]
    fn tool_input_label_prefers_input_command_preview() {
        let task_input = serde_json::json!({
            "description": "review authentication flow and identify the main entrypoint"
        });
        assert_eq!(
            tool_input_label("Task", &task_input),
            "Task: review authentication flow and identify the main entrypoint"
        );

        let web_fetch_input = serde_json::json!({
            "url": "https://example.com/some/really/long/path"
        });
        assert_eq!(
            tool_input_label("WebFetch", &web_fetch_input),
            "WebFetch: https://example.com/some/really/long/path"
        );

        let cron_input = serde_json::json!({
            "schedule": "0 9 * * 1",
            "command": "run-weekly-report"
        });
        let cron_label = tool_input_label("CronCreate", &cron_input);
        assert!(
            cron_label.starts_with("CronCreate: "),
            "unexpected label: {}",
            cron_label
        );
        assert!(
            cron_label.contains("run-weekly-report"),
            "expected compact JSON preview: {}",
            cron_label
        );
    }

    #[test]
    fn cancel_with_no_task_is_noop() {
        let state = CurrentTask(std::sync::Mutex::new(None));
        // Should not panic when nothing is running
        let guard = state.0.lock().unwrap();
        assert!(guard.is_none());
        drop(guard);
    }

    #[cfg(unix)]
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
        assert!(
            content.contains("summary"),
            "CLAUDE.md should mention summary"
        );
        assert!(
            content.contains("journal-create"),
            "CLAUDE.md should mention journal-create script"
        );

        // Scripts exist and are executable
        use std::os::unix::fs::PermissionsExt;
        for script in &["journal-create", "recent-summaries"] {
            let p = dot_claude.join("scripts").join(script);
            assert!(p.exists(), "script {} should exist", script);
            let mode = std::fs::metadata(&p).unwrap().permissions().mode();
            assert!(mode & 0o111 != 0, "script {} should be executable", script);
        }

        // Second call SHOULD overwrite with embedded template
        std::fs::write(&claude_md, "用户自定义内容").unwrap();
        ensure_workspace_dot_claude(tmp.to_str().unwrap());
        let content2 = std::fs::read_to_string(&claude_md).unwrap();
        assert_ne!(content2, "用户自定义内容", "second call must overwrite");
        assert!(content2.contains("tags"), "overwritten CLAUDE.md should have template content");

        // settings.json exists and contains the SessionStart hook
        let settings_json = dot_claude.join("settings.json");
        assert!(settings_json.exists(), ".claude/settings.json should exist");
        let settings_content = std::fs::read_to_string(&settings_json).unwrap();
        assert!(
            settings_content.contains("SessionStart"),
            "settings.json should have SessionStart hook"
        );
        assert!(
            settings_content.contains("recent-summaries"),
            "settings.json should reference recent-summaries"
        );

        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn prompt_text_used_directly_as_prompt() {
        let (args, _) = build_claude_args("note.txt", "2603", None, Some("帮我整理今天的工作"), "");
        assert_eq!(args[1], "帮我整理今天的工作");
        assert!(!args[1].contains('@'));
        assert!(!args[1].contains("深入梳理"));
    }

    #[test]
    fn prompt_text_none_falls_back_to_material_prompt() {
        let (args, _) = build_claude_args("meeting.txt", "2603", None, None, "");
        assert!(args[1].contains("@2603/raw/meeting.txt"));
        assert!(args[1].contains("知识助手"));
    }

    #[test]
    fn prompt_label_truncates_at_20_chars() {
        let prompt = "帮我把今天所有的会议记录整理成日志条目，按重要程度排序";
        let label: String = prompt.chars().take(20).collect();
        let material_path = if prompt.chars().count() > 20 {
            format!("{}…", label)
        } else {
            label
        };
        assert!(material_path.ends_with('…'));
        let char_count = material_path.chars().count();
        assert_eq!(char_count, 21); // 20 chars + ellipsis
    }

    #[test]
    fn prompt_label_no_truncation_when_short() {
        let prompt = "你好";
        let label: String = prompt.chars().take(20).collect();
        let material_path = if prompt.chars().count() > 20 {
            format!("{}…", label)
        } else {
            label
        };
        assert_eq!(material_path, "你好");
        assert!(!material_path.ends_with('…'));
    }

    #[test]
    fn extract_panic_message_from_str() {
        let payload: Box<dyn std::any::Any + Send> = Box::new("something went wrong");
        assert_eq!(
            super::extract_panic_message(&payload),
            "something went wrong"
        );
    }

    #[test]
    fn extract_panic_message_from_string() {
        let payload: Box<dyn std::any::Any + Send> =
            Box::new("formatted error".to_string());
        assert_eq!(
            super::extract_panic_message(&payload),
            "formatted error"
        );
    }

    #[test]
    fn extract_panic_message_unknown_type() {
        let payload: Box<dyn std::any::Any + Send> = Box::new(42i32);
        assert_eq!(super::extract_panic_message(&payload), "unknown panic");
    }

    #[test]
    fn lock_current_task_recovers_from_poisoning() {
        let mutex = std::sync::Mutex::new(None::<tokio::process::Child>);

        // Poison the mutex by panicking while holding the lock
        let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let _guard = mutex.lock().unwrap();
            panic!("intentional poison");
        }));

        // Verify it's poisoned
        assert!(mutex.lock().is_err());

        // Verify our helper recovers
        let guard = super::lock_current_task(&mutex);
        assert!(guard.is_none());
    }
}
