use crate::recordings::{recordings_dir, parse_filename_pub, read_duration_pub};
use crate::types::RecordingItem;
use chrono::Local;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, State};

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

    let dir = recordings_dir(&app)?;
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
pub fn stop_recording(
    app: AppHandle,
    state: State<'_, RecorderState>,
) -> Result<RecordingItem, String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    let active = guard.take().ok_or("not_recording")?;

    drop(active.stream);

    {
        let mut wg = active.writer.lock().map_err(|e| e.to_string())?;
        if let Some(w) = wg.take() {
            w.finalize().map_err(|e| e.to_string())?;
        }
    }

    let wav_path = active.output_path.with_extension("wav.tmp");

    // Post-process: denoise + silence removal. Errors are silently discarded.
    let _ = crate::audio_process::process_audio(&wav_path);

    let status = std::process::Command::new("afconvert")
        .args(["-f", "m4af", "-d", "aac",
               wav_path.to_str().unwrap(),
               active.output_path.to_str().unwrap()])
        .status()
        .map_err(|e| e.to_string())?;

    if !status.success() {
        return Err("afconvert_failed".to_string());
    }
    let _ = std::fs::remove_file(&wav_path);

    let filename = active.output_path
        .file_name().unwrap()
        .to_string_lossy().into_owned();
    let (display_name, year_month) = parse_filename_pub(&filename);
    let duration_secs = read_duration_pub(&active.output_path);

    let result_item = RecordingItem {
        filename: filename.clone(),
        path: active.output_path.to_string_lossy().into_owned(),
        display_name,
        duration_secs,
        year_month,
        transcript_status: None,
    };

    // Auto-trigger transcription if duration > 30s
    crate::transcription::start_transcription(
        app,
        filename,
        active.output_path,
        duration_secs,
    );

    Ok(result_item)
}
