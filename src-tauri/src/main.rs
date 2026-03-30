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
use tauri::{Emitter, Manager};

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
        .plugin(tauri_plugin_dialog::init())
        .manage(recorder::RecorderState(std::sync::Mutex::new(None)))
        .manage(ai_processor::AiQueue(ai_tx))
        .manage(ai_processor::CurrentTask(std::sync::Mutex::new(None)))
        .setup(|app| {
            ai_processor::start_queue_consumer(app.handle().clone(), ai_rx);
            eprintln!("[journal] AI queue consumer started");

            // ── Initialize workspace .claude/ on startup ──
            if let Ok(cfg) = config::load_config(app.handle()) {
                ai_processor::ensure_workspace_dot_claude(&cfg.workspace_path);
            }
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
                    let _ = app_handle.emit_to("main", "open-settings", ());
                }
            });

            // ── Restore window size/position ──
            if let Some(window) = app.get_webview_window("main") {
                if let Ok(cfg) = config::load_config(app.handle()) {
                    if let Some(ws) = cfg.window_state {
                        let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                            width: ws.width as u32,
                            height: ws.height as u32,
                        }));
                        let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                            x: ws.x as i32,
                            y: ws.y as i32,
                        }));
                    }
                }
            }

            // ── Save window state on close ──
            let save_handle = app.handle().clone();
            if let Some(window) = app.get_webview_window("main") {
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { .. } = event {
                        let h = save_handle.clone();
                        if let Some(w) = h.get_webview_window("main") {
                            if let (Ok(size), Ok(pos)) = (w.outer_size(), w.outer_position()) {
                                if let Ok(mut cfg) = config::load_config(&h) {
                                    cfg.window_state = Some(config::WindowState {
                                        width: size.width as f64,
                                        height: size.height as f64,
                                        x: pos.x as f64,
                                        y: pos.y as f64,
                                    });
                                    let _ = config::save_config(&h, &cfg);
                                }
                            }
                        }
                    }
                });
            }

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
            materials::import_text_temp,
            ai_processor::trigger_ai_processing,
            ai_processor::get_workspace_prompt,
            ai_processor::set_workspace_prompt,
            ai_processor::cancel_ai_processing,
            ai_processor::trigger_ai_prompt,
            open_with_system,
            workspace_settings::get_workspace_theme,
            workspace_settings::set_workspace_theme,
            config::get_engine_config,
            config::set_engine_config,
            config::get_app_version,
            config::get_asr_config,
            config::set_asr_config,
            ai_processor::check_engine_installed,
            ai_processor::install_engine,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
