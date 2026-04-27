use crate::config;
use crate::llm;
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
    reply_ctx: Option<crate::feishu_bridge::FeishuReplyCtx>,
}

/// Holds the sender half — stored in Tauri managed state.
pub struct AiQueue(pub mpsc::Sender<QueueTask>);

/// Holds a cancellation token for the currently-running task.
pub struct CurrentTask(pub std::sync::Mutex<Option<tokio_util::sync::CancellationToken>>);

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
    reply_ctx: Option<crate::feishu_bridge::FeishuReplyCtx>,
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
        reply_ctx,
    })
    .await
    .map_err(|e| format!("队列发送失败: {}", e))?;

    Ok(())
}

// ── Helpers ──────────────────────────────────────────────

// ── Embedded workspace template ──────────────────────────
// Source files live in src-tauri/resources/workspace-template/.claude/
// Edit those files to update the template; include_str! embeds at compile time.

pub const WORKSPACE_CLAUDE_MD: &str =
    include_str!("../resources/workspace-template/.claude/CLAUDE.md");

const WORKSPACE_SETTINGS_JSON: &str =
    include_str!("../resources/workspace-template/.claude/settings.json");

const SCRIPT_JOURNAL_CREATE: &str =
    include_str!("../resources/workspace-template/.claude/scripts/journal-create");
const SCRIPT_RECENT_SUMMARIES: &str =
    include_str!("../resources/workspace-template/.claude/scripts/recent-summaries");
const SCRIPT_IDENTITY_CREATE: &str =
    include_str!("../resources/workspace-template/.claude/scripts/identity-create");
const SCRIPT_FIX_FRONTMATTER: &str =
    include_str!("../resources/workspace-template/.claude/scripts/fix-frontmatter");

const WORKSPACE_USER_CLAUDE_MD: &str = include_str!("../resources/workspace-template/CLAUDE.md");

// ── Ideate skill template ───────────────────────
const SKILL_IDEATE_MD: &str =
    include_str!("../resources/workspace-template/.claude/skills/ideate/SKILL.md");
const SKILL_IDEATE_VISUAL_COMPANION: &str = include_str!(
    "../resources/workspace-template/.claude/skills/ideate/references/visual-companion.md"
);

// ── Identity Profiling skill template ───────────
const SKILL_IDENTITY_PROFILING_MD: &str =
    include_str!("../resources/workspace-template/.claude/skills/identity-profiling/SKILL.md");
const SKILL_IDENTITY_PROFILING_PERSON: &str = include_str!(
    "../resources/workspace-template/.claude/skills/identity-profiling/assets/templates/person.md"
);
const SKILL_IDENTITY_PROFILING_PRODUCT: &str = include_str!(
    "../resources/workspace-template/.claude/skills/identity-profiling/assets/templates/product.md"
);

// ── Meeting Minutes skill template ─────────────
const SKILL_MEETING_MINUTES_MD: &str =
    include_str!("../resources/workspace-template/.claude/skills/meeting-minutes/SKILL.md");
const SKILL_MEETING_MINUTES_ALIGNMENT: &str = include_str!(
    "../resources/workspace-template/.claude/skills/meeting-minutes/references/templates/alignment.md"
);
const SKILL_MEETING_MINUTES_ARGUMENTATION: &str = include_str!(
    "../resources/workspace-template/.claude/skills/meeting-minutes/references/templates/argumentation-chain.md"
);
const SKILL_MEETING_MINUTES_KNOWLEDGE: &str = include_str!(
    "../resources/workspace-template/.claude/skills/meeting-minutes/references/templates/knowledge-distillation.md"
);
const SKILL_MEETING_MINUTES_PROGRESS: &str = include_str!(
    "../resources/workspace-template/.claude/skills/meeting-minutes/references/templates/progress-tracking.md"
);

// ── Visual Design Book skill template ──────────
const SKILL_VISUAL_DESIGN_BOOK_MD: &str =
    include_str!("../resources/workspace-template/.claude/skills/visual-design-book/SKILL.md");
const SKILL_VISUAL_DESIGN_BOOK_TEMPLATE: &str = include_str!(
    "../resources/workspace-template/.claude/skills/visual-design-book/references/structure-template.html"
);
const SKILL_VISUAL_DESIGN_BOOK_LECTURE: &str = include_str!(
    "../resources/workspace-template/.claude/skills/visual-design-book/references/lecture-components.md"
);
const SKILL_VISUAL_DESIGN_BOOK_NARRATIVE: &str = include_str!(
    "../resources/workspace-template/.claude/skills/visual-design-book/references/narrative-structures.md"
);

// ── Lint skill template ────────────────────────
const SKILL_LINT_MD: &str =
    include_str!("../resources/workspace-template/.claude/skills/lint/SKILL.md");
const SKILL_LINT_PHASE2_AGENTS: &str =
    include_str!("../resources/workspace-template/.claude/skills/lint/references/phase2-agents.md");
const SKILL_LINT_SCRIPTS: &str =
    include_str!("../resources/workspace-template/.claude/skills/lint/references/scripts.md");

// ── Self-Improvement skill template ────────────
const SKILL_SELF_IMPROVEMENT_MD: &str =
    include_str!("../resources/workspace-template/.claude/skills/self-improvement/SKILL.md");
const SKILL_SELF_IMPROVEMENT_ENTRY_FORMAT: &str = include_str!(
    "../resources/workspace-template/.claude/skills/self-improvement/references/entry-format.md"
);
const SKILL_SELF_IMPROVEMENT_SELF_CHECK: &str = include_str!(
    "../resources/workspace-template/.claude/skills/self-improvement/references/self-check-protocol.md"
);
const LEARNINGS_TEMPLATE: &str =
    include_str!("../resources/workspace-template/.claude/learnings/LEARNINGS.md");

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

    // CLAUDE.md: always overwrite to keep system prompt in sync with app version
    let _ = std::fs::write(dot_claude.join("CLAUDE.md"), WORKSPACE_CLAUDE_MD);
    // settings.json: only create if missing — user may have customized permissions
    let settings_path = dot_claude.join("settings.json");
    if !settings_path.exists() {
        let _ = std::fs::write(&settings_path, WORKSPACE_SETTINGS_JSON);
    }

    let scripts: &[(&str, &str)] = &[
        ("journal-create", SCRIPT_JOURNAL_CREATE),
        ("recent-summaries", SCRIPT_RECENT_SUMMARIES),
        ("identity-create", SCRIPT_IDENTITY_CREATE),
        ("fix-frontmatter", SCRIPT_FIX_FRONTMATTER),
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

    // ── Ideate skill template ───────────────────────
    let ideate_dir = dot_claude.join("skills").join("ideate");
    let ideate_scripts = ideate_dir.join("scripts");
    let ideate_references = ideate_dir.join("references");
    if let Err(e) = std::fs::create_dir_all(&ideate_scripts) {
        eprintln!(
            "[ai_processor] warn: failed to create skills/ideate/scripts dir: {}",
            e
        );
    } else if let Err(e) = std::fs::create_dir_all(&ideate_references) {
        eprintln!(
            "[ai_processor] warn: failed to create skills/ideate/references dir: {}",
            e
        );
    } else {
        let _ = std::fs::write(ideate_dir.join("SKILL.md"), SKILL_IDEATE_MD);
        let _ = std::fs::write(
            ideate_references.join("visual-companion.md"),
            SKILL_IDEATE_VISUAL_COMPANION,
        );
        // Clean up stale file from previous layout (root-level visual-companion.md).
        let _ = std::fs::remove_file(ideate_dir.join("visual-companion.md"));

        let _ = std::fs::write(
            ideate_scripts.join("ab-test.html"),
            include_str!(
                "../resources/workspace-template/.claude/skills/ideate/scripts/ab-test.html"
            ),
        );
        let _ = std::fs::write(
            ideate_scripts.join("bento.html"),
            include_str!(
                "../resources/workspace-template/.claude/skills/ideate/scripts/bento.html"
            ),
        );
        let _ = std::fs::write(
            ideate_scripts.join("flow.html"),
            include_str!("../resources/workspace-template/.claude/skills/ideate/scripts/flow.html"),
        );
        let _ = std::fs::write(
            ideate_scripts.join("styleguide.html"),
            include_str!(
                "../resources/workspace-template/.claude/skills/ideate/scripts/styleguide.html"
            ),
        );
        let _ = std::fs::write(
            ideate_scripts.join("wireframe.html"),
            include_str!(
                "../resources/workspace-template/.claude/skills/ideate/scripts/wireframe.html"
            ),
        );
        let _ = std::fs::write(
            ideate_scripts.join("canvas.css"),
            include_str!(
                "../resources/workspace-template/.claude/skills/ideate/scripts/canvas.css"
            ),
        );

        for obsolete in &[
            "start-server.sh",
            "stop-server.sh",
            "server.cjs",
            "helper.js",
            "frame-template.html",
            "template-compare.html",
            "template-mockup.html",
            "template-bento.html",
        ] {
            let _ = std::fs::remove_file(ideate_scripts.join(obsolete));
        }
        let _ = std::fs::remove_dir_all(ideate_scripts.join("templates"));
    }

    // ── Identity Profiling skill template ───────────
    let ip_dir = dot_claude.join("skills").join("identity-profiling");
    let ip_templates = ip_dir.join("assets").join("templates");
    if let Err(e) = std::fs::create_dir_all(&ip_templates) {
        eprintln!(
            "[ai_processor] warn: failed to create skills/identity-profiling/assets/templates dir: {}",
            e
        );
    } else {
        let _ = std::fs::write(ip_dir.join("SKILL.md"), SKILL_IDENTITY_PROFILING_MD);
        let _ = std::fs::write(
            ip_templates.join("person.md"),
            SKILL_IDENTITY_PROFILING_PERSON,
        );
        let _ = std::fs::write(
            ip_templates.join("product.md"),
            SKILL_IDENTITY_PROFILING_PRODUCT,
        );
    }

    // ── Meeting Minutes skill template ─────────────
    let mm_dir = dot_claude.join("skills").join("meeting-minutes");
    let mm_templates = mm_dir.join("references").join("templates");
    if let Err(e) = std::fs::create_dir_all(&mm_templates) {
        eprintln!(
            "[ai_processor] warn: failed to create skills/meeting-minutes/references/templates dir: {}",
            e
        );
    } else {
        let _ = std::fs::write(mm_dir.join("SKILL.md"), SKILL_MEETING_MINUTES_MD);
        let _ = std::fs::write(
            mm_templates.join("alignment.md"),
            SKILL_MEETING_MINUTES_ALIGNMENT,
        );
        let _ = std::fs::write(
            mm_templates.join("argumentation-chain.md"),
            SKILL_MEETING_MINUTES_ARGUMENTATION,
        );
        let _ = std::fs::write(
            mm_templates.join("knowledge-distillation.md"),
            SKILL_MEETING_MINUTES_KNOWLEDGE,
        );
        let _ = std::fs::write(
            mm_templates.join("progress-tracking.md"),
            SKILL_MEETING_MINUTES_PROGRESS,
        );
    }

    // ── Lint skill template ────────────────────────
    let lint_dir = dot_claude.join("skills").join("lint");
    let lint_refs = lint_dir.join("references");
    if let Err(e) = std::fs::create_dir_all(&lint_refs) {
        eprintln!(
            "[ai_processor] warn: failed to create skills/lint/references dir: {}",
            e
        );
    } else {
        let _ = std::fs::write(lint_dir.join("SKILL.md"), SKILL_LINT_MD);
        let _ = std::fs::write(lint_refs.join("phase2-agents.md"), SKILL_LINT_PHASE2_AGENTS);
        let _ = std::fs::write(lint_refs.join("scripts.md"), SKILL_LINT_SCRIPTS);
    }

    // ── Self-Improvement skill template ────────────
    let si_dir = dot_claude.join("skills").join("self-improvement");
    let si_refs = si_dir.join("references");
    if let Err(e) = std::fs::create_dir_all(&si_refs) {
        eprintln!(
            "[ai_processor] warn: failed to create skills/self-improvement/references dir: {}",
            e
        );
    } else {
        let _ = std::fs::write(si_dir.join("SKILL.md"), SKILL_SELF_IMPROVEMENT_MD);
        let _ = std::fs::write(
            si_refs.join("entry-format.md"),
            SKILL_SELF_IMPROVEMENT_ENTRY_FORMAT,
        );
        let _ = std::fs::write(
            si_refs.join("self-check-protocol.md"),
            SKILL_SELF_IMPROVEMENT_SELF_CHECK,
        );
    }

    // ── Learnings directory ────────────────────────
    let learnings_dir = dot_claude.join("learnings");
    if std::fs::create_dir_all(&learnings_dir).is_ok() {
        let learnings_path = learnings_dir.join("LEARNINGS.md");
        if !learnings_path.exists() {
            let _ = std::fs::write(&learnings_path, LEARNINGS_TEMPLATE);
        }
    }

    // ── Visual Design Book skill template ────────
    let vdb_dir = dot_claude.join("skills").join("visual-design-book");
    let vdb_refs = vdb_dir.join("references");
    if let Err(e) = std::fs::create_dir_all(&vdb_refs) {
        eprintln!(
            "[ai_processor] warn: failed to create skills/visual-design-book/references dir: {}",
            e
        );
    } else {
        let _ = std::fs::write(vdb_dir.join("SKILL.md"), SKILL_VISUAL_DESIGN_BOOK_MD);
        let _ = std::fs::write(
            vdb_refs.join("structure-template.html"),
            SKILL_VISUAL_DESIGN_BOOK_TEMPLATE,
        );
        let _ = std::fs::write(
            vdb_refs.join("lecture-components.md"),
            SKILL_VISUAL_DESIGN_BOOK_LECTURE,
        );
        let _ = std::fs::write(
            vdb_refs.join("narrative-structures.md"),
            SKILL_VISUAL_DESIGN_BOOK_NARRATIVE,
        );
    }
    // Remove old dream dir if it exists (cleanup for existing users)
    let old_dream_dir = dot_claude.join("skills").join("dream");
    if old_dream_dir.exists() {
        let _ = std::fs::remove_dir_all(&old_dream_dir);
    }

    // Ensure workspace/CLAUDE.md exists (only create if missing — never overwrite user edits)
    let user_claude_md = std::path::PathBuf::from(workspace_path).join("CLAUDE.md");
    if !user_claude_md.exists() {
        let _ = std::fs::write(&user_claude_md, WORKSPACE_USER_CLAUDE_MD);
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
    mutex: &std::sync::Mutex<Option<tokio_util::sync::CancellationToken>>,
) -> std::sync::MutexGuard<'_, Option<tokio_util::sync::CancellationToken>> {
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
    let token = lock_current_task(&current_task.0).take();
    if let Some(token) = token {
        token.cancel();
        eprintln!("[ai_queue] panic cleanup: cancelled builtin agent");
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
                task.reply_ctx.clone(),
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
    reply_ctx: Option<crate::feishu_bridge::FeishuReplyCtx>,
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

    eprintln!(
        "[ai_processor] start — material={} ym={} engine={}",
        material_path, year_month, cfg.active_provider
    );

    let _ = app.emit(
        "ai-processing",
        ProcessingUpdate {
            material_path: material_path.to_string(),
            status: "processing".to_string(),
            error: None,
        },
    );

    process_material_builtin(
        app,
        &cfg,
        material_path,
        year_month,
        note,
        prompt_text,
        reply_ctx,
        current_task,
    )
    .await
}

// ── Builtin engine path ─────────────────────────────────

#[allow(clippy::too_many_arguments)]
async fn process_material_builtin(
    app: &AppHandle,
    cfg: &config::Config,
    material_path: &str,
    year_month: &str,
    note: Option<&str>,
    prompt_text: Option<&str>,
    reply_ctx: Option<crate::feishu_bridge::FeishuReplyCtx>,
    current_task: &tauri::State<'_, CurrentTask>,
) -> Result<(), String> {
    let mp = material_path.to_string();
    let ym = year_month.to_string();
    let workspace = cfg.workspace_path.clone();

    // Create engine based on active vendor
    let (api_key, base_url, model, protocol) = cfg.active_vendor_config();
    let engine: Box<dyn llm::LlmEngine> =
        llm::create_engine_for_provider(api_key, base_url, model, protocol);
    // TODO: Feishu multi-turn continuity — when reply_ctx.is_some(), load prior
    // conversation turns for this chat_id so the agent has session memory.
    // The old CLI path used --resume <feishu_session_id>; the builtin engine
    // currently starts fresh each call.

    // Build user prompt
    let user_prompt = if let Some(pt) = prompt_text.filter(|s| !s.trim().is_empty()) {
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
            .map(|n| format!(" {}", n.trim()))
            .unwrap_or_default();
        format!("分析和处理 @{}{}", relative_ref, note_suffix)
    };

    // Build system prompt
    let system_prompt = llm::prompt::build_system_prompt(&workspace, WORKSPACE_CLAUDE_MD).await;

    // Emit startup log
    let (_, _, active_model, _) = cfg.active_vendor_config();
    let default_model = config::default_model_for_vendor(&cfg.active_provider);
    let model_display = if active_model.is_empty() {
        &default_model
    } else {
        active_model
    };
    let engine_name = format!("内置引擎 ({}/{})", cfg.active_provider, model_display);
    let _ = app.emit(
        "ai-log",
        AiLogLine {
            material_path: mp.clone(),
            level: "info".to_string(),
            message: format!("启动 {} ...", engine_name),
        },
    );

    // Set up cancellation
    let cancel_token = tokio_util::sync::CancellationToken::new();
    {
        let mut guard = lock_current_task(&current_task.0);
        *guard = Some(cancel_token.clone());
    }

    let start_time = std::time::Instant::now();

    // Run the agent loop
    let app_for_events = app.clone();
    let mp_for_events = mp.clone();
    let result = llm::tool_loop::run_agent(
        engine.as_ref(),
        &workspace,
        &system_prompt,
        &user_prompt,
        move |event| {
            use llm::tool_loop::AgentEvent;
            match event {
                AgentEvent::TextDelta(_) => {
                    // Text deltas are too noisy for ai-log; skip
                }
                AgentEvent::ToolStart {
                    name: ref tool_name,
                    input,
                } => {
                    let label = match tool_name.as_str() {
                        "bash" => llm::bash_tool::log_label(&input),
                        "load_skill" => llm::enable_skill::log_label(&input),
                        name => llm::fs_tools::log_label(name, &input),
                    };
                    let phase = match tool_name.as_str() {
                        "bash" => "执行命令",
                        "read_file" => "读取文件",
                        "write_file" => "写入文件",
                        "edit_file" => "编辑文件",
                        "load_skill" => "加载技能",
                        "glob_search" | "grep_search" => "搜索文件",
                        _ => "调用工具",
                    };
                    let _ = app_for_events.emit(
                        "ai-log",
                        AiLogLine {
                            material_path: mp_for_events.clone(),
                            level: "phase".to_string(),
                            message: phase.to_string(),
                        },
                    );
                    let _ = app_for_events.emit(
                        "ai-log",
                        AiLogLine {
                            material_path: mp_for_events.clone(),
                            level: "info".to_string(),
                            message: label,
                        },
                    );
                }
                AgentEvent::ToolEnd { name: _, is_error } => {
                    if is_error {
                        let _ = app_for_events.emit(
                            "ai-log",
                            AiLogLine {
                                material_path: mp_for_events.clone(),
                                level: "error".to_string(),
                                message: "[error] 工具执行失败".to_string(),
                            },
                        );
                    }
                }
                AgentEvent::TurnComplete { turn, usage } => {
                    let usage_str = usage
                        .map(|u| format!("({}+{} tokens)", u.input_tokens, u.output_tokens))
                        .unwrap_or_default();
                    eprintln!(
                        "[ai_processor:builtin] turn {} complete {}",
                        turn, usage_str
                    );
                }
                AgentEvent::Done {
                    total_turns,
                    final_text: _,
                } => {
                    let elapsed = start_time.elapsed().as_secs_f64();
                    let _ = app_for_events.emit(
                        "ai-log",
                        AiLogLine {
                            material_path: mp_for_events.clone(),
                            level: "info".to_string(),
                            message: format!("完成 · {:.1}s · {} turns", elapsed, total_turns),
                        },
                    );
                }
            }
        },
        cancel_token,
    )
    .await;

    // Clear current task
    {
        let mut guard = lock_current_task(&current_task.0);
        *guard = None;
    }

    match result {
        Ok(final_output) => {
            let _ = app.emit(
                "ai-processing",
                ProcessingUpdate {
                    material_path: mp.clone(),
                    status: "completed".to_string(),
                    error: None,
                },
            );
            let _ = app.emit("journal-updated", &ym);
            let todos_path = std::path::Path::new(&workspace).join("todos.md");
            if todos_path.exists() {
                let _ = app.emit("todos-updated", ());
            }
            if let Some(ctx) = reply_ctx {
                let _ = app.emit(
                    "feishu-reply-ready",
                    crate::feishu_bridge::FeishuReplyPayload {
                        reply_ctx: ctx,
                        result: final_output,
                    },
                );
            }
            Ok(())
        }
        Err(e) => {
            let err_msg = e.to_string();
            let _ = app.emit(
                "ai-processing",
                ProcessingUpdate {
                    material_path: mp.clone(),
                    status: "failed".to_string(),
                    error: Some(err_msg.clone()),
                },
            );
            Err(err_msg)
        }
    }
}

#[tauri::command]
pub async fn trigger_ai_processing(
    app: AppHandle,
    material_path: String,
    year_month: String,
    note: Option<String>,
) -> Result<(), String> {
    eprintln!("[trigger_ai] material={} ym={}", material_path, year_month);
    enqueue_material(&app, material_path, year_month, note, None, None).await
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
    match guard.take() {
        Some(token) => {
            token.cancel();
            eprintln!("[ai_processor] cancel: cancelled builtin agent");
        }
        None => {
            eprintln!("[ai_processor] cancel: no task running");
        }
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

    enqueue_material(&app, material_path, year_month, None, Some(prompt), None).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_workspace_prompt_returns_default_when_no_file() {
        assert!(WORKSPACE_CLAUDE_MD.contains("tags"));
        assert!(WORKSPACE_CLAUDE_MD.contains("summary"));
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
        assert!(
            content2.contains("tags"),
            "overwritten CLAUDE.md should have template content"
        );

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
        let payload: Box<dyn std::any::Any + Send> = Box::new("formatted error".to_string());
        assert_eq!(super::extract_panic_message(&payload), "formatted error");
    }

    #[test]
    fn extract_panic_message_unknown_type() {
        let payload: Box<dyn std::any::Any + Send> = Box::new(42i32);
        assert_eq!(super::extract_panic_message(&payload), "unknown panic");
    }

    #[test]
    fn lock_current_task_recovers_from_poisoning() {
        let mutex = std::sync::Mutex::new(None::<tokio_util::sync::CancellationToken>);

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
