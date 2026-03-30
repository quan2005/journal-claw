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

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Manager;

#[tauri::command]
fn open_with_system(path: String) -> Result<(), String> {
    std::process::Command::new("open")
        .arg(&path)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

fn main() {
    let (ai_tx, ai_rx) = tokio::sync::mpsc::channel::<ai_processor::QueueTask>(64);

    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard::init())
        .manage(recorder::RecorderState(std::sync::Mutex::new(None)))
        .manage(ai_processor::AiQueue(ai_tx))
        .setup(|app| {
            ai_processor::start_queue_consumer(app.handle().clone(), ai_rx);
            eprintln!("[journal] AI queue consumer started");
            // ── App menu (Cmd+Q, Cmd+H, Cmd+,) ──
            let settings_item = MenuItem::with_id(app, "settings", "设置...", true, Some("CmdOrCtrl+,"))?;
            let app_menu = Submenu::with_items(app, "谨迹", true, &[
                &PredefinedMenuItem::about(app, None, None)?,
                &PredefinedMenuItem::separator(app)?,
                &settings_item,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::services(app, None)?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::hide(app, None)?,
                &PredefinedMenuItem::hide_others(app, None)?,
                &PredefinedMenuItem::show_all(app, None)?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::quit(app, None)?,
            ])?;

            // ── File menu (Cmd+W) ──
            let file_menu = Submenu::with_items(app, "File", true, &[
                &PredefinedMenuItem::close_window(app, None)?,
            ])?;

            // ── Edit menu (Cmd+Z, Cmd+X, Cmd+C, Cmd+V, Cmd+A) ──
            let edit_menu = Submenu::with_items(app, "Edit", true, &[
                &PredefinedMenuItem::undo(app, None)?,
                &PredefinedMenuItem::redo(app, None)?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::cut(app, None)?,
                &PredefinedMenuItem::copy(app, None)?,
                &PredefinedMenuItem::paste(app, None)?,
                &PredefinedMenuItem::select_all(app, None)?,
            ])?;

            // ── View menu (fullscreen) ──
            let view_menu = Submenu::with_items(app, "View", true, &[
                &PredefinedMenuItem::fullscreen(app, None)?,
            ])?;

            // ── Window menu (Cmd+M, zoom) ──
            let window_menu = Submenu::with_items(app, "Window", true, &[
                &PredefinedMenuItem::minimize(app, None)?,
                &PredefinedMenuItem::maximize(app, None)?,
            ])?;

            let menu = Menu::with_items(app, &[
                &app_menu, &file_menu, &edit_menu, &view_menu, &window_menu,
            ])?;
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
            materials::import_text,
            ai_processor::trigger_ai_processing,
            ai_processor::get_workspace_prompt,
            ai_processor::set_workspace_prompt,
            open_with_system,
            workspace_settings::get_workspace_theme,
            workspace_settings::set_workspace_theme,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
