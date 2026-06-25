use crate::automation_runner::{run_routine_agent, RoutineAgentFailure};
use crate::automation_schedule::{next_run_after, parse_time, validate_schedule};
use crate::automation_store::AutomationStore;
use crate::automation_types::{
    AutomationRoutine, AutomationRun, AutomationRunStatus, AutomationRunSummary,
    AutomationRunTrigger, AutomationSchedule, CreateRoutineRequest, UpdateRoutineRequest,
};
use crate::config;
use chrono::{Datelike, Duration, Local, NaiveDate, NaiveDateTime, Weekday};
use std::collections::HashSet;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Notify;
use uuid::Uuid;

pub struct AutomationNotify(pub Arc<Notify>);

pub struct AutomationRuntime {
    pub in_flight: Mutex<HashSet<String>>,
}

impl Default for AutomationRuntime {
    fn default() -> Self {
        Self {
            in_flight: Mutex::new(HashSet::new()),
        }
    }
}

pub fn start_scheduler(app: AppHandle) {
    let notify = app.state::<AutomationNotify>().0.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            let wait = next_wait_duration(&app).unwrap_or(std::time::Duration::from_secs(60));
            tokio::select! {
                _ = tokio::time::sleep(wait) => {
                    run_due_routines(app.clone()).await;
                }
                _ = notify.notified() => {
                    continue;
                }
            }
        }
    });
}

pub fn reconcile_running_runs(app: &AppHandle) -> Result<(), String> {
    let workspace = config::load_config(app)?.workspace_path;
    let store = AutomationStore::for_workspace(&workspace);
    let runs = mark_running_runs_failed(&store, &Local::now().to_rfc3339())?;
    for run in runs {
        let _ = app.emit("automation-run-updated", &run);
    }
    Ok(())
}

pub fn notify_scheduler(app: &AppHandle) {
    app.state::<AutomationNotify>().0.notify_one();
}

pub fn ensure_legacy_lint_routine(app: &AppHandle) -> Result<(), String> {
    let cfg = crate::workspace_settings::load_auto_lint_config(app).unwrap_or_default();
    if !cfg.enabled {
        return Ok(());
    }

    let workspace = config::load_config(app)?.workspace_path;
    let store = AutomationStore::for_workspace(&workspace);
    let existing = store
        .list_routines()?
        .into_iter()
        .any(|routine| routine.template_id.as_deref() == Some("journal-lint"));
    if existing {
        return Ok(());
    }

    let template = crate::automation_templates::get_template("journal-lint")
        .ok_or_else(|| "journal-lint template missing".to_string())?;
    let schedule =
        legacy_lint_schedule(&cfg.frequency, &cfg.time, template.default_schedule.clone());
    let now = Local::now().to_rfc3339();
    store.upsert_routine(AutomationRoutine {
        id: "routine_journal_lint_legacy".to_string(),
        title: template.title.clone(),
        template_id: Some(template.id.clone()),
        prompt: format!(
            "{}\n\n仅当距离上次整理至少新增 {} 条日志时才执行整理；否则记录跳过原因。",
            template.default_prompt, cfg.min_entries
        ),
        schedule,
        scope: template.default_scope.clone(),
        enabled: true,
        full_agent_access: true,
        created_at: now.clone(),
        updated_at: now,
        last_run: None,
    })
}

fn legacy_lint_schedule(
    frequency: &str,
    time: &str,
    fallback: AutomationSchedule,
) -> AutomationSchedule {
    match frequency {
        "daily" => AutomationSchedule::Daily {
            time: time.to_string(),
            timezone: "Asia/Hong_Kong".to_string(),
        },
        "weekly" => AutomationSchedule::Weekly {
            weekday: 0,
            time: time.to_string(),
            timezone: "Asia/Hong_Kong".to_string(),
        },
        "monthly" => AutomationSchedule::Monthly {
            day: 1,
            time: time.to_string(),
            timezone: "Asia/Hong_Kong".to_string(),
        },
        _ => fallback,
    }
}

pub fn create_routine(
    app: &AppHandle,
    request: CreateRoutineRequest,
) -> Result<AutomationRoutine, String> {
    validate_schedule(&request.schedule)?;
    let workspace = config::load_config(app)?.workspace_path;
    let store = AutomationStore::for_workspace(&workspace);
    let now = Local::now().to_rfc3339();
    let routine = AutomationRoutine {
        id: format!("routine_{}", Uuid::new_v4()),
        title: request.title,
        template_id: request.template_id,
        prompt: request.prompt,
        schedule: request.schedule,
        scope: request.scope,
        enabled: request.enabled,
        full_agent_access: true,
        created_at: now.clone(),
        updated_at: now,
        last_run: None,
    };
    store.upsert_routine(routine.clone())?;
    notify_scheduler(app);
    Ok(routine)
}

pub fn update_routine(
    app: &AppHandle,
    id: &str,
    patch: UpdateRoutineRequest,
) -> Result<AutomationRoutine, String> {
    if let Some(schedule) = &patch.schedule {
        validate_schedule(schedule)?;
    }

    let workspace = config::load_config(app)?.workspace_path;
    let store = AutomationStore::for_workspace(&workspace);
    let mut routine = store.get_routine(id)?;
    if let Some(title) = patch.title {
        routine.title = title;
    }
    if let Some(prompt) = patch.prompt {
        routine.prompt = prompt;
    }
    if let Some(schedule) = patch.schedule {
        routine.schedule = schedule;
    }
    if let Some(scope) = patch.scope {
        routine.scope = scope;
    }
    if let Some(enabled) = patch.enabled {
        routine.enabled = enabled;
    }
    routine.updated_at = Local::now().to_rfc3339();
    store.upsert_routine(routine.clone())?;
    notify_scheduler(app);
    Ok(routine)
}

pub fn delete_routine(app: &AppHandle, id: &str) -> Result<(), String> {
    let workspace = config::load_config(app)?.workspace_path;
    AutomationStore::for_workspace(&workspace).delete_routine(id)?;
    notify_scheduler(app);
    Ok(())
}

pub async fn run_routine_now(app: AppHandle, id: String) -> Result<AutomationRun, String> {
    run_routine(app, id, AutomationRunTrigger::Manual).await
}

async fn run_due_routines(app: AppHandle) {
    let Ok(workspace) = config::load_config(&app).map(|c| c.workspace_path) else {
        return;
    };
    let store = AutomationStore::for_workspace(&workspace);
    let Ok(routines) = store.list_routines() else {
        return;
    };
    let now = Local::now().naive_local();
    for routine in routines.into_iter().filter(|r| r.enabled) {
        if should_run_due(&routine, now) {
            let app_for_run = app.clone();
            let routine_id = routine.id.clone();
            let Ok(marked) = mark_routine_in_flight(&app_for_run, &routine_id) else {
                continue;
            };
            if !marked {
                continue;
            }
            let _ =
                run_marked_routine(app_for_run, routine_id, AutomationRunTrigger::Scheduled).await;
        }
    }
}

async fn run_routine(
    app: AppHandle,
    routine_id: String,
    trigger: AutomationRunTrigger,
) -> Result<AutomationRun, String> {
    if !mark_routine_in_flight(&app, &routine_id)? {
        return create_skipped_run(&app, &routine_id, trigger, "routine already running");
    }

    run_marked_routine(app, routine_id, trigger).await
}

async fn run_marked_routine(
    app: AppHandle,
    routine_id: String,
    trigger: AutomationRunTrigger,
) -> Result<AutomationRun, String> {
    let result = run_routine_inner(app.clone(), routine_id.clone(), trigger).await;

    clear_routine_in_flight(&app, &routine_id);
    notify_scheduler(&app);
    result
}

fn mark_routine_in_flight(app: &AppHandle, routine_id: &str) -> Result<bool, String> {
    let runtime = app.state::<AutomationRuntime>();
    let mut in_flight = runtime.in_flight.lock().map_err(|e| e.to_string())?;
    if in_flight.contains(routine_id) {
        return Ok(false);
    }
    in_flight.insert(routine_id.to_string());
    Ok(true)
}

fn clear_routine_in_flight(app: &AppHandle, routine_id: &str) {
    {
        let runtime = app.state::<AutomationRuntime>();
        let Ok(mut in_flight) = runtime.in_flight.lock() else {
            return;
        };
        in_flight.remove(routine_id);
    }
}

async fn run_routine_inner(
    app: AppHandle,
    routine_id: String,
    trigger: AutomationRunTrigger,
) -> Result<AutomationRun, String> {
    let workspace = config::load_config(&app)?.workspace_path;
    let store = AutomationStore::for_workspace(&workspace);
    let routine = store.get_routine(&routine_id)?;
    let mut run = AutomationRun {
        id: format!("run_{}", Uuid::new_v4()),
        routine_id: routine.id.clone(),
        trigger,
        status: AutomationRunStatus::Running,
        started_at: Local::now().to_rfc3339(),
        completed_at: None,
        error: None,
        conversation_id: None,
        manifest: None,
    };
    store.upsert_run(run.clone())?;
    let _ = app.emit("automation-run-updated", &run);

    match run_routine_agent(app.clone(), &workspace, &routine, &run).await {
        Ok((conversation_id, manifest)) => {
            run.status = AutomationRunStatus::Succeeded;
            run.completed_at = Some(Local::now().to_rfc3339());
            run.conversation_id = Some(conversation_id);
            run.manifest = Some(manifest);
        }
        Err(error) => {
            apply_agent_failure_to_run(&mut run, error);
            run.completed_at = Some(Local::now().to_rfc3339());
        }
    }

    store.upsert_run(run.clone())?;
    let _ = app.emit("automation-run-updated", &run);
    if let Err(error) = update_routine_last_run(&store, &routine.id, run.summary()) {
        eprintln!(
            "[automation] failed to update last_run for {}: {}",
            routine.id, error
        );
    }
    let _ = app.emit("journal-updated", ());
    Ok(run)
}

fn create_skipped_run(
    app: &AppHandle,
    routine_id: &str,
    trigger: AutomationRunTrigger,
    reason: &str,
) -> Result<AutomationRun, String> {
    let workspace = config::load_config(app)?.workspace_path;
    let store = AutomationStore::for_workspace(&workspace);
    let now = Local::now().to_rfc3339();
    let run = AutomationRun {
        id: format!("run_{}", Uuid::new_v4()),
        routine_id: routine_id.to_string(),
        trigger,
        status: AutomationRunStatus::Skipped,
        started_at: now.clone(),
        completed_at: Some(now),
        error: Some(reason.to_string()),
        conversation_id: None,
        manifest: None,
    };
    store.upsert_run(run.clone())?;
    let _ = app.emit("automation-run-updated", &run);
    Ok(run)
}

fn apply_agent_failure_to_run(run: &mut AutomationRun, failure: RoutineAgentFailure) {
    run.status = AutomationRunStatus::Failed;
    run.error = Some(failure.message);
    run.conversation_id = failure.conversation_id;
    run.manifest = failure.manifest;
}

fn update_routine_last_run(
    store: &AutomationStore,
    routine_id: &str,
    summary: AutomationRunSummary,
) -> Result<(), String> {
    let mut routine = match store.get_routine(routine_id) {
        Ok(routine) => routine,
        Err(error) if error.contains("routine not found") => return Ok(()),
        Err(error) => return Err(error),
    };
    routine.last_run = Some(summary);
    store.upsert_routine(routine)
}

fn mark_running_runs_failed(
    store: &AutomationStore,
    completed_at: &str,
) -> Result<Vec<AutomationRun>, String> {
    let mut reconciled = Vec::new();
    for mut run in store.list_runs()? {
        if run.status != AutomationRunStatus::Running {
            continue;
        }
        run.status = AutomationRunStatus::Failed;
        run.completed_at = Some(completed_at.to_string());
        run.error = Some("app closed during automation run".to_string());
        store.upsert_run(run.clone())?;
        update_routine_last_run(store, &run.routine_id, run.summary())?;
        reconciled.push(run);
    }
    Ok(reconciled)
}

fn next_wait_duration(app: &AppHandle) -> Result<std::time::Duration, String> {
    let workspace = config::load_config(app)?.workspace_path;
    let routines = AutomationStore::for_workspace(&workspace).list_routines()?;
    let in_flight = {
        let runtime = app.state::<AutomationRuntime>();
        let snapshot = runtime.in_flight.lock().map_err(|e| e.to_string())?.clone();
        snapshot
    };
    next_wait_duration_for_routines_with_in_flight(
        &routines,
        Local::now().naive_local(),
        &in_flight,
    )
}

#[cfg(test)]
fn next_wait_duration_for_routines(
    routines: &[AutomationRoutine],
    now: NaiveDateTime,
) -> Result<std::time::Duration, String> {
    next_wait_duration_for_routines_with_in_flight(routines, now, &HashSet::new())
}

fn next_wait_duration_for_routines_with_in_flight(
    routines: &[AutomationRoutine],
    now: NaiveDateTime,
    in_flight: &HashSet<String>,
) -> Result<std::time::Duration, String> {
    if routines
        .iter()
        .filter(|routine| routine.enabled)
        .any(|routine| !in_flight.contains(&routine.id) && should_run_due(routine, now))
    {
        return Ok(std::time::Duration::from_secs(0));
    }

    let next = routines
        .iter()
        .filter(|routine| routine.enabled)
        .filter_map(|routine| next_run_after(&routine.schedule, now).ok())
        .min();
    Ok(match next {
        Some(next_at) => (next_at - now)
            .to_std()
            .unwrap_or(std::time::Duration::from_secs(1)),
        None => std::time::Duration::from_secs(60 * 60),
    })
}

fn should_run_due(routine: &AutomationRoutine, now: NaiveDateTime) -> bool {
    let Ok(Some(due_at)) = latest_due_at(&routine.schedule, now) else {
        return false;
    };

    if parse_rfc3339_local_naive(&routine.created_at)
        .map(|created_at| created_at > due_at)
        .unwrap_or(false)
    {
        return false;
    }

    routine
        .last_run
        .as_ref()
        .and_then(|summary| parse_rfc3339_local_naive(&summary.started_at))
        .map(|last_run_at| last_run_at < due_at)
        .unwrap_or(true)
}

fn parse_rfc3339_local_naive(value: &str) -> Option<NaiveDateTime> {
    chrono::DateTime::parse_from_rfc3339(value)
        .ok()
        .map(|dt| dt.naive_local())
}

fn latest_due_at(
    schedule: &AutomationSchedule,
    now: NaiveDateTime,
) -> Result<Option<NaiveDateTime>, String> {
    validate_schedule(schedule)?;
    match schedule {
        AutomationSchedule::Daily { time, .. } => {
            let today = at_date(now.date(), time)?;
            if today <= now {
                Ok(Some(today))
            } else {
                Ok(Some(today - Duration::days(1)))
            }
        }
        AutomationSchedule::Weekdays { time, .. } => {
            for offset in 0..=7 {
                let date = now.date() - Duration::days(offset);
                if matches!(
                    date.weekday(),
                    Weekday::Mon | Weekday::Tue | Weekday::Wed | Weekday::Thu | Weekday::Fri
                ) {
                    let candidate = at_date(date, time)?;
                    if candidate <= now {
                        return Ok(Some(candidate));
                    }
                }
            }
            Ok(None)
        }
        AutomationSchedule::Weekly { weekday, time, .. } => {
            for offset in 0..=7 {
                let date = now.date() - Duration::days(offset);
                if date.weekday().num_days_from_sunday() == *weekday {
                    let candidate = at_date(date, time)?;
                    if candidate <= now {
                        return Ok(Some(candidate));
                    }
                }
            }
            Ok(None)
        }
        AutomationSchedule::Monthly { day, time, .. } => {
            let mut year = now.year();
            let mut month = now.month();
            for _ in 0..14 {
                if let Some(date) = NaiveDate::from_ymd_opt(year, month, *day) {
                    let candidate = at_date(date, time)?;
                    if candidate <= now {
                        return Ok(Some(candidate));
                    }
                }
                if month == 1 {
                    year -= 1;
                    month = 12;
                } else {
                    month -= 1;
                }
            }
            Ok(None)
        }
    }
}

fn at_date(date: NaiveDate, time: &str) -> Result<NaiveDateTime, String> {
    let (hour, minute) = parse_time(time)?;
    date.and_hms_opt(hour, minute, 0)
        .ok_or_else(|| "invalid date/time".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::automation_types::{
        AutomationRun, AutomationRunStatus, AutomationRunSummary, AutomationRunTrigger,
        AutomationSchedule, AutomationScope, RunManifest,
    };

    fn dt(s: &str) -> NaiveDateTime {
        NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S").unwrap()
    }

    fn routine(id: &str, time: &str, enabled: bool) -> AutomationRoutine {
        AutomationRoutine {
            id: id.to_string(),
            title: id.to_string(),
            template_id: None,
            prompt: "run".to_string(),
            schedule: AutomationSchedule::Daily {
                time: time.to_string(),
                timezone: "Asia/Hong_Kong".to_string(),
            },
            scope: AutomationScope::Workspace,
            enabled,
            full_agent_access: true,
            created_at: "2026-05-30T08:00:00+08:00".to_string(),
            updated_at: "2026-05-30T08:00:00+08:00".to_string(),
            last_run: None,
        }
    }

    fn run(routine_id: &str, status: AutomationRunStatus) -> AutomationRun {
        AutomationRun {
            id: "run_1".to_string(),
            routine_id: routine_id.to_string(),
            trigger: AutomationRunTrigger::Scheduled,
            status,
            started_at: "2026-05-30T08:00:00+08:00".to_string(),
            completed_at: None,
            error: None,
            conversation_id: Some("session_1".to_string()),
            manifest: None,
        }
    }

    fn summary(started_at: &str) -> AutomationRunSummary {
        AutomationRunSummary {
            id: "run_1".to_string(),
            status: AutomationRunStatus::Succeeded,
            trigger: AutomationRunTrigger::Scheduled,
            started_at: started_at.to_string(),
            completed_at: Some(started_at.to_string()),
            summary: Some("done".to_string()),
            error: None,
            conversation_id: Some("session_1".to_string()),
        }
    }

    #[test]
    fn runtime_starts_with_empty_in_flight_set() {
        let runtime = AutomationRuntime::default();
        assert!(runtime.in_flight.lock().unwrap().is_empty());
    }

    #[test]
    fn next_wait_uses_earliest_enabled_schedule() {
        let routines = vec![
            routine("disabled", "08:01", false),
            routine("later", "09:00", true),
            routine("soon", "08:30", true),
        ];

        assert_eq!(
            next_wait_duration_for_routines(&routines, dt("2026-05-30 08:00:00")).unwrap(),
            std::time::Duration::from_secs(30 * 60)
        );
    }

    #[test]
    fn next_wait_is_immediate_when_routine_missed_due_time() {
        let mut routine = routine("missed", "08:00", true);
        routine.created_at = "2026-05-29T08:00:00+08:00".to_string();

        assert_eq!(
            next_wait_duration_for_routines(&[routine], dt("2026-05-30 10:00:00")).unwrap(),
            std::time::Duration::from_secs(0)
        );
    }

    #[test]
    fn next_wait_ignores_due_routines_already_in_flight() {
        let mut routine = routine("missed", "08:00", true);
        routine.created_at = "2026-05-29T08:00:00+08:00".to_string();
        let in_flight = HashSet::from(["missed".to_string()]);

        let wait = next_wait_duration_for_routines_with_in_flight(
            &[routine],
            dt("2026-05-30 10:00:00"),
            &in_flight,
        )
        .unwrap();

        assert!(wait > std::time::Duration::from_secs(0));
    }

    #[test]
    fn next_wait_is_immediate_when_any_due_routine_is_not_in_flight() {
        let mut running = routine("running", "08:00", true);
        running.created_at = "2026-05-29T08:00:00+08:00".to_string();
        let mut waiting = routine("waiting", "08:00", true);
        waiting.created_at = "2026-05-29T08:00:00+08:00".to_string();
        let in_flight = HashSet::from(["running".to_string()]);

        assert_eq!(
            next_wait_duration_for_routines_with_in_flight(
                &[running, waiting],
                dt("2026-05-30 10:00:00"),
                &in_flight,
            )
            .unwrap(),
            std::time::Duration::from_secs(0)
        );
    }

    #[test]
    fn should_not_run_due_before_routine_existed() {
        let mut routine = routine("new", "08:00", true);
        routine.created_at = "2026-05-30T09:00:00+08:00".to_string();

        assert!(!should_run_due(&routine, dt("2026-05-30 10:00:00")));
    }

    #[test]
    fn should_not_run_due_when_last_run_covers_latest_due_time() {
        let mut routine = routine("already", "08:00", true);
        routine.created_at = "2026-05-29T08:00:00+08:00".to_string();
        routine.last_run = Some(summary("2026-05-30T08:30:00+08:00"));

        assert!(!should_run_due(&routine, dt("2026-05-30 10:00:00")));
    }

    #[test]
    fn last_run_update_merges_into_current_routine_and_skips_deleted() {
        let dir = tempfile::tempdir().unwrap();
        let store = AutomationStore::for_workspace(dir.path().to_str().unwrap());
        let mut current = routine("routine_1", "08:00", true);
        current.title = "edited title".to_string();
        store.upsert_routine(current).unwrap();

        update_routine_last_run(&store, "routine_1", summary("2026-05-30T08:30:00+08:00")).unwrap();
        let updated = store.get_routine("routine_1").unwrap();
        assert_eq!(updated.title, "edited title");
        assert_eq!(updated.last_run.as_ref().unwrap().id, "run_1");

        store.delete_routine("routine_1").unwrap();
        update_routine_last_run(&store, "routine_1", summary("2026-05-30T09:30:00+08:00")).unwrap();
        assert!(store.list_routines().unwrap().is_empty());
    }

    #[test]
    fn startup_reconcile_marks_running_runs_failed() {
        let dir = tempfile::tempdir().unwrap();
        let store = AutomationStore::for_workspace(dir.path().to_str().unwrap());
        store
            .upsert_routine(routine("routine_1", "08:00", true))
            .unwrap();
        store
            .upsert_run(run("routine_1", AutomationRunStatus::Running))
            .unwrap();

        let reconciled = mark_running_runs_failed(&store, "2026-05-30T09:00:00+08:00").unwrap();

        assert_eq!(reconciled.len(), 1);
        assert_eq!(reconciled[0].status, AutomationRunStatus::Failed);
        assert_eq!(
            reconciled[0].error.as_deref(),
            Some("app closed during automation run")
        );
        let routine = store.get_routine("routine_1").unwrap();
        assert_eq!(
            routine.last_run.as_ref().unwrap().status,
            AutomationRunStatus::Failed
        );
    }

    #[test]
    fn failed_agent_run_preserves_conversation_and_manifest() {
        let mut run = AutomationRun {
            id: "run_1".to_string(),
            routine_id: "routine_1".to_string(),
            trigger: AutomationRunTrigger::Manual,
            status: AutomationRunStatus::Running,
            started_at: "2026-05-30T08:00:00+08:00".to_string(),
            completed_at: None,
            error: None,
            conversation_id: None,
            manifest: None,
        };
        let manifest = RunManifest {
            summary: "partial summary".to_string(),
            conversation_id: "session_1".to_string(),
            ..RunManifest::default()
        };

        apply_agent_failure_to_run(
            &mut run,
            RoutineAgentFailure {
                message: "agent failed".to_string(),
                conversation_id: Some("session_1".to_string()),
                manifest: Some(manifest.clone()),
            },
        );

        assert_eq!(run.status, AutomationRunStatus::Failed);
        assert_eq!(run.error.as_deref(), Some("agent failed"));
        assert_eq!(run.conversation_id.as_deref(), Some("session_1"));
        assert_eq!(run.manifest, Some(manifest));
    }

    #[test]
    fn legacy_lint_schedule_maps_old_config_values() {
        let fallback = AutomationSchedule::Daily {
            time: "03:00".to_string(),
            timezone: "Asia/Hong_Kong".to_string(),
        };

        assert_eq!(
            legacy_lint_schedule("daily", "12:00", fallback.clone()),
            AutomationSchedule::Daily {
                time: "12:00".to_string(),
                timezone: "Asia/Hong_Kong".to_string(),
            }
        );
        assert_eq!(
            legacy_lint_schedule("weekly", "22:00", fallback.clone()),
            AutomationSchedule::Weekly {
                weekday: 0,
                time: "22:00".to_string(),
                timezone: "Asia/Hong_Kong".to_string(),
            }
        );
        assert_eq!(
            legacy_lint_schedule("monthly", "03:00", fallback.clone()),
            AutomationSchedule::Monthly {
                day: 1,
                time: "03:00".to_string(),
                timezone: "Asia/Hong_Kong".to_string(),
            }
        );
        assert_eq!(
            legacy_lint_schedule("unknown", "03:00", fallback.clone()),
            fallback
        );
    }
}
