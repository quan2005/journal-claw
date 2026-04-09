use crate::ai_processor::{build_claude_args_with_creds, ensure_workspace_dot_claude};
use crate::config;
use crate::workspace_settings;
use chrono::Datelike;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Notify;

// ── Types ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoLintStatus {
    pub state: String, // "idle" | "running" | "never_run" | "error"
    pub last_run: Option<String>,
    pub last_run_entries: Option<u32>,
    pub next_check: Option<String>,
    pub current_new_entries: u32,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct LastLint {
    last_run: Option<String>,
    entries_at_last_run: Option<u32>,
}

/// Shared state: signals the scheduler loop to re-evaluate config.
pub struct AutoLintNotify(pub std::sync::Arc<Notify>);

/// Whether a dream is currently running (prevents concurrent runs).
pub struct LintRunning(pub Mutex<bool>);

// ── Helpers ──────────────────────────────────────────────

fn last_lint_path(workspace: &str) -> std::path::PathBuf {
    std::path::PathBuf::from(workspace)
        .join(".claude")
        .join("last-lint.json")
}

fn read_last_lint(workspace: &str) -> Option<LastLint> {
    // Try new filename first
    let path = last_lint_path(workspace);
    if let Ok(data) = std::fs::read_to_string(&path) {
        if let Ok(ld) = serde_json::from_str(&data) {
            return Some(ld);
        }
    }
    // Fall back to old filename for existing users
    let old_path = std::path::PathBuf::from(workspace)
        .join(".claude")
        .join("last-dream.json");
    let data = std::fs::read_to_string(old_path).ok()?;
    serde_json::from_str(&data).ok()
}

fn count_journal_entries(workspace: &str) -> u32 {
    let ws = std::path::PathBuf::from(workspace);
    let mut count = 0u32;
    let Ok(entries) = std::fs::read_dir(&ws) else {
        return 0;
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        // Match yyMM dirs (4 digits)
        if name.len() == 4 && name.chars().all(|c| c.is_ascii_digit()) {
            let dir = ws.join(&name);
            if let Ok(files) = std::fs::read_dir(&dir) {
                for f in files.flatten() {
                    let fname = f.file_name().to_string_lossy().to_string();
                    if fname.ends_with(".md") {
                        count += 1;
                    }
                }
            }
        }
    }
    count
}

fn compute_new_entries(workspace: &str) -> u32 {
    let total = count_journal_entries(workspace);
    let last = read_last_lint(workspace)
        .and_then(|ld| ld.entries_at_last_run)
        .unwrap_or(0);
    total.saturating_sub(last)
}

/// Compute next check time from now, given frequency and time-of-day.
fn next_check_time(frequency: &str, time: &str) -> Option<chrono::NaiveDateTime> {
    let (hour, minute) = parse_time(time)?;
    let now = chrono::Local::now().naive_local();
    let today_at = now.date().and_hms_opt(hour, minute, 0)?;

    let candidate = match frequency {
        "daily" => {
            if now < today_at {
                today_at
            } else {
                today_at + chrono::Duration::days(1)
            }
        }
        "weekly" => {
            // Next Sunday
            let weekday = now.date().weekday().num_days_from_sunday(); // 0=Sun
            let days_until_sunday = if weekday == 0 && now < today_at {
                0
            } else {
                (7 - weekday) % 7
            };
            let days_until_sunday = if days_until_sunday == 0 && now >= today_at {
                7
            } else {
                days_until_sunday
            };
            today_at + chrono::Duration::days(days_until_sunday as i64)
        }
        "monthly" => {
            // 1st of next month
            let date = now.date();
            let (y, m) = if date.day() == 1 && now < today_at {
                (date.year(), date.month())
            } else if date.month() == 12 {
                (date.year() + 1, 1)
            } else {
                (date.year(), date.month() + 1)
            };
            chrono::NaiveDate::from_ymd_opt(y, m, 1)?.and_hms_opt(hour, minute, 0)?
        }
        _ => return None,
    };
    Some(candidate)
}

fn parse_time(time: &str) -> Option<(u32, u32)> {
    let parts: Vec<&str> = time.split(':').collect();
    if parts.len() != 2 {
        return None;
    }
    Some((parts[0].parse().ok()?, parts[1].parse().ok()?))
}

// ── Scheduler ────────────────────────────────────────────

pub fn start_scheduler(app: AppHandle) {
    let notify = app.state::<AutoLintNotify>().0.clone();

    tauri::async_runtime::spawn(async move {
        loop {
            // Load config
            let cfg = match workspace_settings::load_auto_lint_config(&app) {
                Ok(c) => c,
                Err(_) => {
                    // No workspace set yet, wait for notification
                    notify.notified().await;
                    continue;
                }
            };

            if !cfg.enabled {
                // Disabled — wait until config changes
                notify.notified().await;
                continue;
            }

            let next = match next_check_time(&cfg.frequency, &cfg.time) {
                Some(t) => t,
                None => {
                    notify.notified().await;
                    continue;
                }
            };

            // Emit status with next check time
            let workspace = workspace_settings::get_workspace_path_for_auto_lint(&app)
                .unwrap_or_default();
            let new_entries = compute_new_entries(&workspace);
            let last = read_last_lint(&workspace);
            let _ = app.emit(
                "auto-lint-status",
                AutoLintStatus {
                    state: "idle".to_string(),
                    last_run: last.as_ref().and_then(|l| l.last_run.clone()),
                    last_run_entries: last.as_ref().and_then(|l| l.entries_at_last_run),
                    next_check: Some(next.format("%Y-%m-%d %H:%M").to_string()),
                    current_new_entries: new_entries,
                    error: None,
                },
            );

            let now = chrono::Local::now().naive_local();
            let wait_duration = (next - now).to_std().unwrap_or(std::time::Duration::from_secs(60));

            // Wait until next check time OR config change
            tokio::select! {
                _ = tokio::time::sleep(wait_duration) => {
                    // Time to check
                    let workspace = match workspace_settings::get_workspace_path_for_auto_lint(&app) {
                        Ok(w) => w,
                        Err(_) => continue,
                    };
                    let new_entries = compute_new_entries(&workspace);
                    let cfg = workspace_settings::load_auto_lint_config(&app).unwrap_or_default();
                    if cfg.enabled && new_entries >= cfg.min_entries {
                        run_lint(&app, &workspace, false).await;
                    }
                }
                _ = notify.notified() => {
                    // Config changed, re-evaluate
                    continue;
                }
            }
        }
    });
}

/// Check if app missed a scheduled run while closed.
pub fn check_missed_run(app: &AppHandle) {
    let cfg = match workspace_settings::load_auto_lint_config(app) {
        Ok(c) => c,
        Err(_) => return,
    };
    if !cfg.enabled {
        return;
    }
    let workspace = match workspace_settings::get_workspace_path_for_auto_lint(app) {
        Ok(w) => w,
        Err(_) => return,
    };
    let last = read_last_lint(&workspace);
    let last_run = last
        .and_then(|l| l.last_run)
        .and_then(|s| chrono::NaiveDateTime::parse_from_str(&s, "%Y-%m-%dT%H:%M:%S%z").ok()
            .or_else(|| chrono::DateTime::parse_from_str(&s, "%Y-%m-%dT%H:%M:%S%z").ok().map(|dt| dt.naive_local()))
            .or_else(|| chrono::NaiveDateTime::parse_from_str(&s, "%Y-%m-%dT%H:%M:%S").ok()));

    if let Some(last_run) = last_run {
        let now = chrono::Local::now().naive_local();
        let overdue = match cfg.frequency.as_str() {
            "daily" => now - last_run > chrono::Duration::days(1),
            "weekly" => now - last_run > chrono::Duration::weeks(1),
            "monthly" => now - last_run > chrono::Duration::days(30),
            _ => false,
        };
        if overdue {
            let new_entries = compute_new_entries(&workspace);
            if new_entries >= cfg.min_entries {
                let app = app.clone();
                let ws = workspace.clone();
                tauri::async_runtime::spawn(async move {
                    run_lint(&app, &ws, false).await;
                });
            }
        }
    }
}

pub async fn run_lint(app: &AppHandle, workspace: &str, force: bool) {
    // Prevent concurrent runs
    {
        let running = app.state::<LintRunning>();
        let mut guard = running.0.lock().unwrap();
        if *guard {
            return;
        }
        *guard = true;
    }

    if !force {
        let new_entries = compute_new_entries(workspace);
        let cfg = workspace_settings::load_auto_lint_config(app).unwrap_or_default();
        if new_entries < cfg.min_entries {
            let running = app.state::<LintRunning>();
            *running.0.lock().unwrap() = false;
            return;
        }
    }

    let _ = app.emit(
        "auto-lint-status",
        AutoLintStatus {
            state: "running".to_string(),
            last_run: None,
            last_run_entries: None,
            next_check: None,
            current_new_entries: 0,
            error: None,
        },
    );

    ensure_workspace_dot_claude(workspace);

    let cfg = config::load_config(app).unwrap_or_default();
    let cli = if cfg.claude_cli_path.is_empty() {
        config::default_claude_cli_detect()
    } else {
        cfg.claude_cli_path.clone()
    };

    let (args, extra_envs) = build_claude_args_with_creds(
        "auto-dream",
        "",
        None,
        Some("/dream"),
        &cfg.claude_code_model,
        &cfg.claude_code_api_key,
        &cfg.claude_code_base_url,
    );

    eprintln!("[auto_lint] running: {} {}", cli, args.join(" "));

    let mut cmd = tokio::process::Command::new(&cli);
    cmd.args(&args)
        .current_dir(workspace)
        .env("PATH", config::augmented_path())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true);
    for (k, v) in &extra_envs {
        cmd.env(k, v);
    }

    let result = match cmd.spawn() {
        Ok(child) => child.wait_with_output().await,
        Err(e) => {
            let error = format!("启动 Claude CLI 失败: {}", e);
            eprintln!("[auto_lint] {}", error);
            let _ = app.emit(
                "auto-lint-status",
                AutoLintStatus {
                    state: "error".to_string(),
                    last_run: None,
                    last_run_entries: None,
                    next_check: None,
                    current_new_entries: 0,
                    error: Some(error),
                },
            );
            let running = app.state::<LintRunning>();
            *running.0.lock().unwrap() = false;
            return;
        }
    };

    let running = app.state::<LintRunning>();
    *running.0.lock().unwrap() = false;

    match result {
        Ok(output) if output.status.success() => {
            eprintln!("[auto_lint] completed successfully");
            // Re-read last-lint.json for updated status
            let last = read_last_lint(workspace);
            let new_entries = compute_new_entries(workspace);
            let _ = app.emit(
                "auto-lint-status",
                AutoLintStatus {
                    state: "idle".to_string(),
                    last_run: last.as_ref().and_then(|l| l.last_run.clone()),
                    last_run_entries: last.as_ref().and_then(|l| l.entries_at_last_run),
                    next_check: None,
                    current_new_entries: new_entries,
                    error: None,
                },
            );
            let _ = app.emit("journal-updated", ());
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let error = format!("dream 执行失败 (exit {}): {}", output.status, stderr.chars().take(200).collect::<String>());
            eprintln!("[auto_lint] {}", error);
            let _ = app.emit(
                "auto-lint-status",
                AutoLintStatus {
                    state: "error".to_string(),
                    last_run: None,
                    last_run_entries: None,
                    next_check: None,
                    current_new_entries: 0,
                    error: Some(error),
                },
            );
        }
        Err(e) => {
            let error = format!("dream 执行异常: {}", e);
            eprintln!("[auto_lint] {}", error);
            let _ = app.emit(
                "auto-lint-status",
                AutoLintStatus {
                    state: "error".to_string(),
                    last_run: None,
                    last_run_entries: None,
                    next_check: None,
                    current_new_entries: 0,
                    error: Some(error),
                },
            );
        }
    }
}

// ── Tauri Commands ───────────────────────────────────────

#[tauri::command]
pub fn get_auto_lint_status(app: AppHandle) -> Result<AutoLintStatus, String> {
    let workspace = workspace_settings::get_workspace_path_for_auto_lint(&app)?;
    let cfg = workspace_settings::load_auto_lint_config(&app)?;
    let last = read_last_lint(&workspace);
    let new_entries = compute_new_entries(&workspace);

    let next_check = if cfg.enabled {
        next_check_time(&cfg.frequency, &cfg.time)
            .map(|t| t.format("%Y-%m-%d %H:%M").to_string())
    } else {
        None
    };

    let running = app.state::<LintRunning>();
    let is_running = *running.0.lock().unwrap();

    let state = if is_running {
        "running"
    } else if last.is_none() {
        "never_run"
    } else {
        "idle"
    };

    Ok(AutoLintStatus {
        state: state.to_string(),
        last_run: last.as_ref().and_then(|l| l.last_run.clone()),
        last_run_entries: last.as_ref().and_then(|l| l.entries_at_last_run),
        next_check,
        current_new_entries: new_entries,
        error: None,
    })
}

#[tauri::command]
pub async fn trigger_lint_now(app: AppHandle) -> Result<(), String> {
    let workspace = workspace_settings::get_workspace_path_for_auto_lint(&app)?;
    run_lint(&app, &workspace, true).await;
    Ok(())
}
