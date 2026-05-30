use crate::automation_runner::{run_routine_agent, RoutineAgentFailure};
use crate::automation_schedule::{next_run_after, validate_schedule};
use crate::automation_store::AutomationStore;
use crate::automation_types::{
    AutomationRoutine, AutomationRun, AutomationRunStatus, AutomationRunTrigger,
    CreateRoutineRequest, UpdateRoutineRequest,
};
use crate::config;
use chrono::{Local, NaiveDateTime};
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

pub fn notify_scheduler(app: &AppHandle) {
    app.state::<AutomationNotify>().0.notify_waiters();
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
    let probe = now - chrono::Duration::seconds(60);
    for routine in routines.into_iter().filter(|r| r.enabled) {
        if let Ok(candidate) = next_run_after(&routine.schedule, probe) {
            if candidate > now + chrono::Duration::seconds(2) {
                continue;
            }
            let app_for_run = app.clone();
            tauri::async_runtime::spawn(async move {
                let _ = run_routine(
                    app_for_run,
                    routine.id.clone(),
                    AutomationRunTrigger::Scheduled,
                )
                .await;
            });
        }
    }
}

async fn run_routine(
    app: AppHandle,
    routine_id: String,
    trigger: AutomationRunTrigger,
) -> Result<AutomationRun, String> {
    {
        let runtime = app.state::<AutomationRuntime>();
        let mut in_flight = runtime.in_flight.lock().map_err(|e| e.to_string())?;
        if in_flight.contains(&routine_id) {
            return create_skipped_run(&app, &routine_id, trigger, "routine already running");
        }
        in_flight.insert(routine_id.clone());
    }

    let result = run_routine_inner(app.clone(), routine_id.clone(), trigger).await;

    {
        let runtime = app.state::<AutomationRuntime>();
        let mut in_flight = runtime.in_flight.lock().map_err(|e| e.to_string())?;
        in_flight.remove(&routine_id);
    }

    result
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
    let mut updated_routine = routine;
    updated_routine.last_run = Some(run.summary());
    store.upsert_routine(updated_routine)?;
    let _ = app.emit("automation-run-updated", &run);
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

fn next_wait_duration(app: &AppHandle) -> Result<std::time::Duration, String> {
    let workspace = config::load_config(app)?.workspace_path;
    let routines = AutomationStore::for_workspace(&workspace).list_routines()?;
    next_wait_duration_for_routines(&routines, Local::now().naive_local())
}

fn next_wait_duration_for_routines(
    routines: &[AutomationRoutine],
    now: NaiveDateTime,
) -> Result<std::time::Duration, String> {
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::automation_types::{
        AutomationRun, AutomationRunStatus, AutomationRunTrigger, AutomationSchedule,
        AutomationScope, RunManifest,
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
}
