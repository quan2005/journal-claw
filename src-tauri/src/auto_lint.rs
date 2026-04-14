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

/// Whether a lint run is currently running (prevents concurrent runs).
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
            let workspace =
                workspace_settings::get_workspace_path_for_auto_lint(&app).unwrap_or_default();
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
            let wait_duration = (next - now)
                .to_std()
                .unwrap_or(std::time::Duration::from_secs(60));

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
    let last_run = last.and_then(|l| l.last_run).and_then(|s| {
        chrono::NaiveDateTime::parse_from_str(&s, "%Y-%m-%dT%H:%M:%S%z")
            .ok()
            .or_else(|| {
                chrono::DateTime::parse_from_str(&s, "%Y-%m-%dT%H:%M:%S%z")
                    .ok()
                    .map(|dt| dt.naive_local())
            })
            .or_else(|| chrono::NaiveDateTime::parse_from_str(&s, "%Y-%m-%dT%H:%M:%S").ok())
    });

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
        "auto-lint",
        "",
        None,
        Some("/lint"),
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
            let error = format!(
                "lint 执行失败 (exit {}): {}",
                output.status,
                stderr.chars().take(200).collect::<String>()
            );
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
            let error = format!("lint 执行异常: {}", e);
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
        next_check_time(&cfg.frequency, &cfg.time).map(|t| t.format("%Y-%m-%d %H:%M").to_string())
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

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Timelike;

    #[test]
    fn parse_time_valid() {
        assert_eq!(parse_time("09:30"), Some((9, 30)));
        assert_eq!(parse_time("00:00"), Some((0, 0)));
        assert_eq!(parse_time("23:59"), Some((23, 59)));
    }

    #[test]
    fn parse_time_invalid() {
        assert_eq!(parse_time("invalid"), None);
        assert_eq!(parse_time("09"), None);
        assert_eq!(parse_time("09:30:00"), None);
        assert_eq!(parse_time("ab:cd"), None);
    }

    #[test]
    fn last_lint_path_construction() {
        let p = last_lint_path("/tmp/ws");
        assert_eq!(
            p,
            std::path::PathBuf::from("/tmp/ws/.claude/last-lint.json")
        );
    }

    #[test]
    fn count_entries_empty_workspace() {
        let tmp = std::env::temp_dir().join("auto_lint_count_empty");
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        assert_eq!(count_journal_entries(tmp.to_str().unwrap()), 0);
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn count_entries_with_md_files() {
        let tmp = std::env::temp_dir().join("auto_lint_count_md");
        let _ = std::fs::remove_dir_all(&tmp);
        let d1 = tmp.join("2603");
        let d2 = tmp.join("2604");
        std::fs::create_dir_all(&d1).unwrap();
        std::fs::create_dir_all(&d2).unwrap();
        std::fs::write(d1.join("01-a.md"), "a").unwrap();
        std::fs::write(d2.join("01-b.md"), "b").unwrap();
        std::fs::write(d2.join("02-c.md"), "c").unwrap();
        assert_eq!(count_journal_entries(tmp.to_str().unwrap()), 3);
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn count_entries_ignores_non_yymm_dirs() {
        let tmp = std::env::temp_dir().join("auto_lint_count_ignore");
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(tmp.join("notes")).unwrap();
        std::fs::create_dir_all(tmp.join("2604")).unwrap();
        std::fs::write(tmp.join("notes").join("01-x.md"), "x").unwrap();
        std::fs::write(tmp.join("2604").join("01-y.md"), "y").unwrap();
        assert_eq!(count_journal_entries(tmp.to_str().unwrap()), 1);
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn count_entries_nonexistent_workspace() {
        assert_eq!(count_journal_entries("/tmp/auto_lint_no_such_dir_xyz"), 0);
    }

    #[test]
    fn read_last_lint_missing_file() {
        let tmp = std::env::temp_dir().join("auto_lint_read_missing");
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        assert!(read_last_lint(tmp.to_str().unwrap()).is_none());
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn read_last_lint_valid_json() {
        let tmp = std::env::temp_dir().join("auto_lint_read_valid");
        let _ = std::fs::remove_dir_all(&tmp);
        let claude_dir = tmp.join(".claude");
        std::fs::create_dir_all(&claude_dir).unwrap();
        std::fs::write(
            claude_dir.join("last-lint.json"),
            r#"{"last_run":"2026-04-10T09:00:00","entries_at_last_run":15}"#,
        )
        .unwrap();
        let result = read_last_lint(tmp.to_str().unwrap()).unwrap();
        assert_eq!(result.last_run.as_deref(), Some("2026-04-10T09:00:00"));
        assert_eq!(result.entries_at_last_run, Some(15));
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn read_last_lint_falls_back_to_old_filename() {
        let tmp = std::env::temp_dir().join("auto_lint_read_fallback");
        let _ = std::fs::remove_dir_all(&tmp);
        let claude_dir = tmp.join(".claude");
        std::fs::create_dir_all(&claude_dir).unwrap();
        std::fs::write(
            claude_dir.join("last-dream.json"),
            r#"{"last_run":"2026-03-01T08:00:00","entries_at_last_run":5}"#,
        )
        .unwrap();
        let result = read_last_lint(tmp.to_str().unwrap()).unwrap();
        assert_eq!(result.entries_at_last_run, Some(5));
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn read_last_lint_invalid_json() {
        let tmp = std::env::temp_dir().join("auto_lint_read_invalid");
        let _ = std::fs::remove_dir_all(&tmp);
        let claude_dir = tmp.join(".claude");
        std::fs::create_dir_all(&claude_dir).unwrap();
        std::fs::write(claude_dir.join("last-lint.json"), "not json").unwrap();
        assert!(read_last_lint(tmp.to_str().unwrap()).is_none());
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn compute_new_entries_no_prior_lint() {
        let tmp = std::env::temp_dir().join("auto_lint_compute_no_prior");
        let _ = std::fs::remove_dir_all(&tmp);
        let dir = tmp.join("2604");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("01-a.md"), "a").unwrap();
        std::fs::write(dir.join("02-b.md"), "b").unwrap();
        assert_eq!(compute_new_entries(tmp.to_str().unwrap()), 2);
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn compute_new_entries_saturates_at_zero() {
        let tmp = std::env::temp_dir().join("auto_lint_compute_saturate");
        let _ = std::fs::remove_dir_all(&tmp);
        let claude_dir = tmp.join(".claude");
        std::fs::create_dir_all(&claude_dir).unwrap();
        std::fs::write(
            claude_dir.join("last-lint.json"),
            r#"{"last_run":"2026-04-10T09:00:00","entries_at_last_run":100}"#,
        )
        .unwrap();
        assert_eq!(compute_new_entries(tmp.to_str().unwrap()), 0);
        std::fs::remove_dir_all(&tmp).ok();
    }

    #[test]
    fn next_check_time_invalid_frequency() {
        assert!(next_check_time("biweekly", "09:00").is_none());
    }

    #[test]
    fn next_check_time_invalid_time() {
        assert!(next_check_time("daily", "invalid").is_none());
    }

    #[test]
    fn next_check_time_daily_returns_some() {
        let result = next_check_time("daily", "03:00");
        assert!(result.is_some());
        let dt = result.unwrap();
        assert_eq!(dt.time().hour(), 3);
        assert_eq!(dt.time().minute(), 0);
    }

    #[test]
    fn next_check_time_weekly_returns_sunday() {
        use chrono::Datelike;
        let result = next_check_time("weekly", "10:00");
        assert!(result.is_some());
        let dt = result.unwrap();
        assert_eq!(dt.date().weekday(), chrono::Weekday::Sun);
    }

    #[test]
    fn next_check_time_monthly_returns_first() {
        use chrono::Datelike;
        let result = next_check_time("monthly", "08:30");
        assert!(result.is_some());
        let dt = result.unwrap();
        assert_eq!(dt.date().day(), 1);
        assert_eq!(dt.time().hour(), 8);
        assert_eq!(dt.time().minute(), 30);
    }

    #[test]
    fn next_check_time_is_in_the_future() {
        let now = chrono::Local::now().naive_local();
        for freq in &["daily", "weekly", "monthly"] {
            let result = next_check_time(freq, "00:00").unwrap();
            assert!(result >= now, "{} next_check should be >= now", freq);
        }
    }
}
