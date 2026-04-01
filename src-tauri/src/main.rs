mod ai_processor;
mod audio_pipeline;
#[allow(dead_code)]
mod audio_process;
mod config;
mod journal;
mod materials;
mod permissions;
mod recorder;
mod recordings;
mod speaker_profiles;
mod transcription;
mod types;
mod workspace;
mod workspace_settings;

use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager, RunEvent};

const MENU_ABOUT_ID: &str = "about";
const MENU_SETTINGS_ID: &str = "settings";
const MENU_QUIT_ID: &str = "quit";

#[tauri::command]
fn open_with_system(path: String) -> Result<(), String> {
    std::process::Command::new("open")
        .arg(&path)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

fn save_main_window_state(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if let (Ok(size), Ok(pos)) = (window.outer_size(), window.outer_position()) {
            if let Ok(mut cfg) = config::load_config(app) {
                cfg.window_state = Some(config::WindowState {
                    width: size.width as f64,
                    height: size.height as f64,
                    x: pos.x as f64,
                    y: pos.y as f64,
                });
                let _ = config::save_config(app, &cfg);
            }
        }
    }
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn main() {
    let (ai_tx, ai_rx) = tokio::sync::mpsc::channel::<ai_processor::QueueTask>(64);
    let allow_exit = Arc::new(AtomicBool::new(false));

    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(recorder::RecorderState(std::sync::Mutex::new(None)))
        .manage(ai_processor::AiQueue(ai_tx))
        .manage(ai_processor::CurrentTask(std::sync::Mutex::new(None)))
        .manage(ai_processor::CancelledPaths(std::sync::Mutex::new(
            std::collections::HashSet::new(),
        )))
        .setup({
            let allow_exit = Arc::clone(&allow_exit);
            move |app| {
                ai_processor::start_queue_consumer(app.handle().clone(), ai_rx);
                eprintln!("[journal] AI queue consumer started");

                // ── Initialize workspace .claude/ on startup ──
                if let Ok(cfg) = config::load_config(app.handle()) {
                    ai_processor::ensure_workspace_dot_claude(&cfg.workspace_path);
                }
                // ── App menu (Cmd+Q, Cmd+H, Cmd+,) ──
                let about_item =
                    MenuItem::with_id(app, MENU_ABOUT_ID, "关于谨迹", true, None::<&str>)?;
                let settings_item =
                    MenuItem::with_id(app, MENU_SETTINGS_ID, "设置...", true, Some("CmdOrCtrl+,"))?;
                let quit_item =
                    MenuItem::with_id(app, MENU_QUIT_ID, "退出谨迹", true, Some("CmdOrCtrl+Q"))?;
                let app_menu = Submenu::with_items(
                    app,
                    "谨迹",
                    true,
                    &[
                        &about_item,
                        &PredefinedMenuItem::separator(app)?,
                        &settings_item,
                        &PredefinedMenuItem::separator(app)?,
                        &PredefinedMenuItem::services(app, None)?,
                        &PredefinedMenuItem::separator(app)?,
                        &PredefinedMenuItem::hide(app, None)?,
                        &PredefinedMenuItem::hide_others(app, None)?,
                        &PredefinedMenuItem::show_all(app, None)?,
                        &PredefinedMenuItem::separator(app)?,
                        &quit_item,
                    ],
                )?;

                // ── File menu (Cmd+W) ──
                let file_menu = Submenu::with_items(
                    app,
                    "File",
                    true,
                    &[&PredefinedMenuItem::close_window(app, None)?],
                )?;

                // ── Edit menu (Cmd+Z, Cmd+X, Cmd+C, Cmd+V, Cmd+A) ──
                let edit_menu = Submenu::with_items(
                    app,
                    "Edit",
                    true,
                    &[
                        &PredefinedMenuItem::undo(app, None)?,
                        &PredefinedMenuItem::redo(app, None)?,
                        &PredefinedMenuItem::separator(app)?,
                        &PredefinedMenuItem::cut(app, None)?,
                        &PredefinedMenuItem::copy(app, None)?,
                        &PredefinedMenuItem::paste(app, None)?,
                        &PredefinedMenuItem::select_all(app, None)?,
                    ],
                )?;

                // ── View menu (fullscreen) ──
                let view_menu = Submenu::with_items(
                    app,
                    "View",
                    true,
                    &[&PredefinedMenuItem::fullscreen(app, None)?],
                )?;

                // ── Window menu (Cmd+M, zoom) ──
                let window_menu = Submenu::with_items(
                    app,
                    "Window",
                    true,
                    &[
                        &PredefinedMenuItem::minimize(app, None)?,
                        &PredefinedMenuItem::maximize(app, None)?,
                    ],
                )?;

                let menu = Menu::with_items(
                    app,
                    &[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu],
                )?;
                app.set_menu(menu)?;

                let menu_handle = app.handle().clone();
                let menu_allow_exit = Arc::clone(&allow_exit);
                app.on_menu_event(move |_app, event| {
                    if event.id() == MENU_ABOUT_ID {
                        let _ = menu_handle.emit_to("main", "open-settings-about", ());
                    } else if event.id() == MENU_SETTINGS_ID {
                        let _ = menu_handle.emit_to("main", "open-settings", ());
                    } else if event.id() == MENU_QUIT_ID {
                        save_main_window_state(&menu_handle);
                        menu_allow_exit.store(true, Ordering::SeqCst);
                        menu_handle.exit(0);
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
                            let _ = window.set_position(tauri::Position::Physical(
                                tauri::PhysicalPosition {
                                    x: ws.x as i32,
                                    y: ws.y as i32,
                                },
                            ));
                        }
                    }
                }

                // ── Close window => save state and hide; explicit quit is the only true exit ──
                let close_handle = app.handle().clone();
                let close_allow_exit = Arc::clone(&allow_exit);
                if let Some(window) = app.get_webview_window("main") {
                    window.on_window_event(move |event| {
                        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                            if close_allow_exit.load(Ordering::SeqCst) {
                                return;
                            }
                            api.prevent_close();
                            save_main_window_state(&close_handle);
                            if let Some(window) = close_handle.get_webview_window("main") {
                                let _ = window.hide();
                            }
                        }
                    });
                }

                Ok(())
            }
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
            audio_pipeline::prepare_audio_for_ai,
            ai_processor::trigger_ai_processing,
            ai_processor::get_workspace_prompt,
            ai_processor::set_workspace_prompt,
            ai_processor::cancel_ai_processing,
            ai_processor::cancel_queued_item,
            ai_processor::trigger_ai_prompt,
            open_with_system,
            workspace_settings::get_workspace_theme,
            workspace_settings::set_workspace_theme,
            config::get_engine_config,
            config::set_engine_config,
            config::get_app_version,
            config::get_asr_config,
            config::set_asr_config,
            config::get_apple_stt_variant,
            config::get_whisperkit_models_dir,
            config::check_whisperkit_model_downloaded,
            config::check_whisperkit_cli_installed,
            config::install_whisperkit_cli,
            config::download_whisperkit_model,
            ai_processor::check_engine_installed,
            ai_processor::install_engine,
            journal::create_sample_entry_if_needed,
            journal::create_sample_entry,
            speaker_profiles::get_speaker_profiles,
            speaker_profiles::update_speaker_name,
            speaker_profiles::delete_speaker_profile,
            speaker_profiles::merge_speaker_profiles,
            permissions::check_app_permissions,
            permissions::open_privacy_settings,
            permissions::request_permission,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            #[cfg(target_os = "macos")]
            if let RunEvent::Reopen {
                has_visible_windows,
                ..
            } = event
            {
                if !has_visible_windows {
                    show_main_window(app);
                }
            }
        });
}
