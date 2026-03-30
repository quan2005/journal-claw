use crate::recordings::read_duration_pub;
use chrono::Local;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};

pub struct RecorderState(pub Mutex<Option<ActiveRecording>>);

pub struct ActiveRecording {
    stream: cpal::Stream,
    output_path: PathBuf,
    writer: Arc<Mutex<Option<hound::WavWriter<std::io::BufWriter<std::fs::File>>>>>,
}

/// Generate a unique filename for a new recording.
/// Format: "录音 YYYY-MM-DD HH:mm.m4a", with ":SS" appended if that file already exists.
fn unique_filename(dir: &PathBuf) -> String {
    let now = Local::now();
    let base = format!("录音 {}", now.format("%Y-%m-%d %H:%M"));
    let candidate = format!("{}.m4a", base);
    if !dir.join(&candidate).exists() {
        return candidate;
    }
    format!("录音 {}.m4a", now.format("%Y-%m-%d %H:%M:%S"))
}

#[tauri::command]
pub fn start_recording(
    app: AppHandle,
    state: State<'_, RecorderState>,
) -> Result<String, String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    if guard.is_some() {
        return Err("already_recording".to_string());
    }

    let cfg = crate::config::load_config(&app)?;
    if cfg.workspace_path.is_empty() {
        return Err("请先在设置中配置 Workspace 路径".to_string());
    }
    let ym = crate::workspace::current_year_month();
    crate::workspace::ensure_dirs(&cfg.workspace_path, &ym)?;
    let dir = crate::workspace::raw_dir(&cfg.workspace_path, &ym);
    let filename = unique_filename(&dir);
    let output_path = dir.join(&filename);
    let wav_path = output_path.with_extension("wav.tmp");

    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or_else(|| "no_input_device".to_string())?;
    let config = device
        .default_input_config()
        .map_err(|e| {
            // Map macOS permission-denied error to a recognisable string for the frontend
            let msg = e.to_string();
            if msg.contains("PermissionDenied") || msg.contains("permission") {
                "permission_denied".to_string()
            } else {
                msg
            }
        })?;

    // Convert config once — config.into() consumes the value, so do it before the match
    let sample_format = config.sample_format();
    let stream_config: cpal::StreamConfig = config.into();

    let spec = hound::WavSpec {
        channels: stream_config.channels,
        sample_rate: stream_config.sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let writer = Arc::new(Mutex::new(Some(
        hound::WavWriter::create(&wav_path, spec).map_err(|e| e.to_string())?,
    )));

    // Clone writer handle inside each match arm to avoid double-move
    let stream = match sample_format {
        cpal::SampleFormat::F32 => {
            let writer_clone = Arc::clone(&writer);
            device
                .build_input_stream(
                    &stream_config,
                    move |data: &[f32], _| {
                        if let Ok(mut g) = writer_clone.lock() {
                            if let Some(w) = g.as_mut() {
                                for &s in data {
                                    let _ = w.write_sample((s * i16::MAX as f32) as i16);
                                }
                            }
                        }
                    },
                    |err| eprintln!("stream error: {}", err),
                    None,
                )
                .map_err(|e| e.to_string())?
        }
        cpal::SampleFormat::I16 => {
            let writer_clone = Arc::clone(&writer);
            device
                .build_input_stream(
                    &stream_config,
                    move |data: &[i16], _| {
                        if let Ok(mut g) = writer_clone.lock() {
                            if let Some(w) = g.as_mut() {
                                for &s in data { let _ = w.write_sample(s); }
                            }
                        }
                    },
                    |err| eprintln!("stream error: {}", err),
                    None,
                )
                .map_err(|e| e.to_string())?
        }
        _ => return Err("unsupported_sample_format".to_string()),
    };

    stream.play().map_err(|e| e.to_string())?;

    *guard = Some(ActiveRecording { stream, output_path: output_path.clone(), writer });
    Ok(output_path.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn stop_recording(
    app: AppHandle,
    state: State<'_, RecorderState>,
) -> Result<(), String> {
    // Fast path: stop stream + finalize WAV (sub-second)
    let (wav_path, output_path, filename) = {
        let mut guard = state.0.lock().map_err(|e| e.to_string())?;
        let active = guard.take().ok_or("not_recording")?;

        drop(active.stream);

        {
            let mut wg = active.writer.lock().map_err(|e| e.to_string())?;
            if let Some(w) = wg.take() {
                w.finalize().map_err(|e| e.to_string())?;
            }
        }

        let filename = active.output_path
            .file_name().unwrap()
            .to_string_lossy().into_owned();

        (active.output_path.with_extension("wav.tmp"),
         active.output_path,
         filename)
    };

    // Notify frontend that processing has started
    let _ = app.emit("recording-processing", &filename);

    // Heavy path: denoise + convert on a blocking thread
    let app_clone = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _ = crate::audio_process::process_audio(&wav_path);

        let status = std::process::Command::new("afconvert")
            .args(["-f", "m4af", "-d", "aac",
                   wav_path.to_str().unwrap(),
                   output_path.to_str().unwrap()])
            .status();

        if let Ok(s) = status {
            if s.success() {
                let _ = std::fs::remove_file(&wav_path);
            }
        }

        let duration_secs = read_duration_pub(&output_path);

        let _ = app_clone.emit("recording-processed", serde_json::json!({
            "filename": filename,
            "path": output_path.to_string_lossy().as_ref(),
        }));

        let app_for_ai = app_clone.clone();
        let path_for_ai = output_path.to_string_lossy().into_owned();
        let ym_for_ai = crate::workspace::current_year_month();

        let asr_engine = crate::config::load_config(&app_clone)
            .map(|c| c.asr_engine)
            .unwrap_or_else(|_| "dashscope".to_string());
        let whisperkit_model = crate::config::load_config(&app_clone)
            .map(|c| c.whisperkit_model)
            .unwrap_or_else(|_| "base".to_string());

        if asr_engine == "whisperkit" {
            let app_wk = app_clone.clone();
            let path_wk = output_path.clone();
            let ym_wk = ym_for_ai.clone();
            tauri::async_runtime::spawn(async move {
                let markdown = match crate::transcription::transcribe_with_whisperkit(
                    app_wk.clone(),
                    path_wk.clone(),
                    whisperkit_model,
                ).await {
                    Ok(md) => md,
                    Err(e) => {
                        eprintln!("[recorder] whisperkit failed: {}", e);
                        return;
                    }
                };
                let prompt_text = format!(
                    "以下是一段录音的说话人转写内容：\n\n{}\n\n请整理为日志条目并直接写文件，不要输出任何解释。\n文件名格式：DD-标题.md，写在 {}/ 目录下（不要写到 raw/ 里）。",
                    markdown, ym_wk
                );
                let current_task = app_wk.state::<crate::ai_processor::CurrentTask>();
                let path_str = path_wk.to_string_lossy().to_string();
                let _ = crate::ai_processor::process_material(
                    &app_wk, &path_str, &ym_wk, None, Some(&prompt_text), &current_task
                ).await;
            });
        } else {
            // 现有 DashScope 路径不变
            crate::transcription::start_transcription(
                app_clone,
                filename,
                output_path,
                duration_secs,
            );

            tauri::async_runtime::spawn(async move {
                let current_task = app_for_ai.state::<crate::ai_processor::CurrentTask>();
                let _ = crate::ai_processor::process_material(&app_for_ai, &path_for_ai, &ym_for_ai, None, None, &current_task).await;
            });
        }
    });

    Ok(())
}
