use serde::Serialize;
use tauri::AppHandle;

use crate::config;

#[derive(Debug, Serialize)]
pub struct OnboardingStatus {
    pub completed: bool,
    pub last_step: Option<u8>,
}

#[tauri::command]
pub fn get_onboarding_status(app: AppHandle) -> Result<OnboardingStatus, String> {
    let config = config::load_config(&app)?;
    Ok(OnboardingStatus {
        completed: config.onboarding_completed,
        last_step: config.onboarding_last_step,
    })
}

#[tauri::command]
pub fn complete_onboarding(app: AppHandle) -> Result<(), String> {
    let mut config = config::load_config(&app)?;
    config.onboarding_completed = true;
    config.onboarding_last_step = None;
    config::save_config(&app, &config)
}

#[tauri::command]
pub fn set_onboarding_step(app: AppHandle, step: u8) -> Result<(), String> {
    let mut config = config::load_config(&app)?;
    config.onboarding_last_step = Some(step);
    config::save_config(&app, &config)
}

#[tauri::command]
pub fn reset_onboarding(app: AppHandle) -> Result<(), String> {
    let mut config = config::load_config(&app)?;
    config.onboarding_completed = false;
    config.onboarding_last_step = None;
    config::save_config(&app, &config)
}
