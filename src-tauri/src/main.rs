mod types;
mod recordings;
mod recorder;

fn main() {
    tauri::Builder::default()
        .manage(recorder::RecorderState(std::sync::Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            recordings::list_recordings,
            recordings::delete_recording,
            recordings::reveal_in_finder,
            recordings::play_recording,
            recorder::start_recording,
            recorder::stop_recording,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
