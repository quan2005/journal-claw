mod config;
mod types;
mod recordings;
mod recorder;
mod audio_process;
mod transcription;
mod workspace;
mod workspace_settings;
mod journal;
mod materials;
mod ai_processor;

use tauri::menu::{Menu, MenuItem, Submenu};

#[tauri::command]
fn open_with_system(path: String) -> Result<(), String> {
    std::process::Command::new("open")
        .arg(&path)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .manage(recorder::RecorderState(std::sync::Mutex::new(None)))
        .setup(|app| {
            let settings_item = MenuItem::with_id(app, "settings", "设置...", true, None::<&str>)?;
            let journal_menu = Submenu::with_items(app, "Journal", true, &[&settings_item])?;
            let menu = Menu::with_items(app, &[&journal_menu])?;
            app.set_menu(menu)?;

            let app_handle = app.handle().clone();
            app.on_menu_event(move |_app, event| {
                if event.id() == "settings" {
                    let _ = config::open_settings(app_handle.clone());
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            recordings::list_recordings,
            recordings::delete_recording,
            recordings::reveal_in_finder,
            recordings::play_recording,
            recorder::start_recording,
            recorder::stop_recording,
            config::get_api_key,
            config::set_api_key,
            config::open_settings,
            config::get_workspace_path,
            config::set_workspace_path,
            config::get_claude_cli_path,
            config::set_claude_cli_path,
            transcription::get_transcript,
            transcription::retry_transcription,
            journal::list_all_journal_entries,
            journal::list_journal_entries,
            journal::get_journal_entry_content,
            journal::save_journal_entry_content,
            journal::delete_journal_entry,
            materials::import_file,
            ai_processor::trigger_ai_processing,
            open_with_system,
            workspace_settings::get_workspace_theme,
            workspace_settings::set_workspace_theme,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
