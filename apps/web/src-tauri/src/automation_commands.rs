use crate::automation;
use crate::automation_store::AutomationStore;
use crate::automation_templates;
use crate::automation_types::{
    AutomationRoutine, AutomationRun, AutomationTemplate, CreateRoutineRequest,
    UpdateRoutineRequest,
};
use crate::config;
use tauri::AppHandle;

#[tauri::command]
pub fn list_automation_templates() -> Result<Vec<AutomationTemplate>, String> {
    Ok(automation_templates::built_in_templates())
}

#[tauri::command]
pub fn list_routines(app: AppHandle) -> Result<Vec<AutomationRoutine>, String> {
    let workspace = config::load_config(&app)?.workspace_path;
    AutomationStore::for_workspace(&workspace).list_routines()
}

#[tauri::command]
pub fn create_routine(
    app: AppHandle,
    request: CreateRoutineRequest,
) -> Result<AutomationRoutine, String> {
    automation::create_routine(&app, request)
}

#[tauri::command]
pub fn update_routine(
    app: AppHandle,
    id: String,
    patch: UpdateRoutineRequest,
) -> Result<AutomationRoutine, String> {
    automation::update_routine(&app, &id, patch)
}

#[tauri::command]
pub fn delete_routine(app: AppHandle, id: String) -> Result<(), String> {
    automation::delete_routine(&app, &id)
}

#[tauri::command]
pub fn pause_routine(app: AppHandle, id: String) -> Result<AutomationRoutine, String> {
    automation::update_routine(
        &app,
        &id,
        UpdateRoutineRequest {
            enabled: Some(false),
            ..UpdateRoutineRequest::default()
        },
    )
}

#[tauri::command]
pub fn resume_routine(app: AppHandle, id: String) -> Result<AutomationRoutine, String> {
    automation::update_routine(
        &app,
        &id,
        UpdateRoutineRequest {
            enabled: Some(true),
            ..UpdateRoutineRequest::default()
        },
    )
}

#[tauri::command]
pub async fn run_routine_now(app: AppHandle, id: String) -> Result<AutomationRun, String> {
    automation::run_routine_now(app, id).await
}

#[tauri::command]
pub fn list_routine_runs(app: AppHandle, id: String) -> Result<Vec<AutomationRun>, String> {
    let workspace = config::load_config(&app)?.workspace_path;
    AutomationStore::for_workspace(&workspace).list_runs_for_routine(&id)
}

#[tauri::command]
pub fn get_automation_run(app: AppHandle, id: String) -> Result<AutomationRun, String> {
    let workspace = config::load_config(&app)?.workspace_path;
    AutomationStore::for_workspace(&workspace).get_run(&id)
}
