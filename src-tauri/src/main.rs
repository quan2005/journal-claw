mod config;
mod types;
mod recordings;
mod recorder;
mod audio_process;
mod transcription;
mod workspace;
mod journal;

use tauri::menu::{Menu, MenuItem, Submenu};

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
