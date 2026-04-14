use crate::recordings::read_duration_pub;
use chrono::Local;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

pub(crate) fn rms_f32(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    let sum_sq: f32 = samples.iter().map(|&s| s * s).sum();
    (sum_sq / samples.len() as f32).sqrt()
}

pub struct RecorderState(pub Mutex<Option<ActiveRecording>>);

pub struct ActiveRecording {
    stream: cpal::Stream,
    output_path: PathBuf,
    writer: Arc<Mutex<Option<hound::WavWriter<std::io::BufWriter<std::fs::File>>>>>,
    /// Shared audio level (0.0–1.0 RMS), updated by stream callback, read by emitter task.
    #[allow(dead_code)]
    pub audio_level: Arc<Mutex<f32>>,
    /// Set to true when stop_recording runs so the emitter task exits.
    stop_emitter: Arc<std::sync::atomic::AtomicBool>,
}

/// Generate a unique filename for a new recording.
/// Format: "DD-rec-HHmm.m4a", with "ss" appended if that file already exists.
fn unique_filename(dir: &Path) -> String {
    use chrono::Datelike;
    let now = Local::now();
    let day = now.day();
    let base = format!("{:02}-rec-{}", day, now.format("%H%M"));
    let candidate = format!("{}.m4a", base);
    if !dir.join(&candidate).exists() {
        return candidate;
    }
    format!("{:02}-rec-{}.m4a", day, now.format("%H%M%S"))
}

#[tauri::command]
pub fn start_recording(app: AppHandle, state: State<'_, RecorderState>) -> Result<String, String> {
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
    let config = device.default_input_config().map_err(|e| {
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

    let audio_level = Arc::new(Mutex::new(0.0f32));
    // ~80ms window: sample_rate × 0.08 / channels (mono mix for level)
    let window_size = (stream_config.sample_rate as f32 * 0.08) as usize;

    // Clone writer handle inside each match arm to avoid double-move
    let stream = match sample_format {
        cpal::SampleFormat::F32 => {
            let writer_clone = Arc::clone(&writer);
            let level_clone = Arc::clone(&audio_level);
            let mut accum: Vec<f32> = Vec::with_capacity(window_size);
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
                        // Accumulate mono samples for RMS
                        let channels = stream_config.channels as usize;
                        let mut i = 0;
                        while i < data.len() {
                            accum.push(data[i]); // use first channel
                            i += channels;
                            if accum.len() >= window_size {
                                let level = rms_f32(&accum);
                                if let Ok(mut l) = level_clone.lock() {
                                    *l = level;
                                }
                                accum.clear();
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
            let level_clone = Arc::clone(&audio_level);
            let mut accum: Vec<f32> = Vec::with_capacity(window_size);
            device
                .build_input_stream(
                    &stream_config,
                    move |data: &[i16], _| {
                        if let Ok(mut g) = writer_clone.lock() {
                            if let Some(w) = g.as_mut() {
                                for &s in data {
                                    let _ = w.write_sample(s);
                                }
                            }
                        }
                        let channels = stream_config.channels as usize;
                        let mut i = 0;
                        while i < data.len() {
                            accum.push(data[i] as f32 / i16::MAX as f32);
                            i += channels;
                            if accum.len() >= window_size {
                                let level = rms_f32(&accum);
                                if let Ok(mut l) = level_clone.lock() {
                                    *l = level;
                                }
                                accum.clear();
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

    // Spawn emitter: polls audio_level every 80ms and emits "audio-level" event
    let level_for_emitter = Arc::clone(&audio_level);
    let app_for_emitter = app.clone();
    let stop_emitter = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let stop_flag = Arc::clone(&stop_emitter);
    tauri::async_runtime::spawn(async move {
        let mut last_emitted = -1.0f32;
        loop {
            tokio::time::sleep(tokio::time::Duration::from_millis(80)).await;
            if stop_flag.load(std::sync::atomic::Ordering::Relaxed) {
                break;
            }
            if let Ok(l) = level_for_emitter.lock() {
                let current = *l;
                if (current - last_emitted).abs() > 0.001 {
                    let _ = app_for_emitter.emit("audio-level", current);
                    last_emitted = current;
                }
            }
        }
    });

    *guard = Some(ActiveRecording {
        stream,
        output_path: output_path.clone(),
        writer,
        audio_level,
        stop_emitter,
    });
    Ok(output_path.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn stop_recording(app: AppHandle, state: State<'_, RecorderState>) -> Result<(), String> {
    // Fast path: stop stream + finalize WAV (sub-second)
    let (wav_path, output_path, filename) = {
        let mut guard = state.0.lock().map_err(|e| e.to_string())?;
        let active = guard.take().ok_or("not_recording")?;

        drop(active.stream);

        // Signal emitter task to exit
        active
            .stop_emitter
            .store(true, std::sync::atomic::Ordering::Relaxed);

        {
            let mut wg = active.writer.lock().map_err(|e| e.to_string())?;
            if let Some(w) = wg.take() {
                w.finalize().map_err(|e| e.to_string())?;
            }
        }

        let filename = active
            .output_path
            .file_name()
            .unwrap()
            .to_string_lossy()
            .into_owned();

        (
            active.output_path.with_extension("wav.tmp"),
            active.output_path,
            filename,
        )
    };

    // Notify frontend that processing has started
    let _ = app.emit("recording-processing", &filename);

    // Heavy path: denoise + convert on a blocking thread
    let app_clone = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        // 先用原始 WAV 直接转成 m4a（保留完整语音内容供转写使用）
        let status = std::process::Command::new("afconvert")
            .args([
                "-f",
                "m4af",
                "-d",
                "aac",
                wav_path.to_str().unwrap(),
                output_path.to_str().unwrap(),
            ])
            .status();

        if let Ok(s) = status {
            if s.success() {
                let _ = std::fs::remove_file(&wav_path);
            }
        }

        let duration_secs = read_duration_pub(&output_path);

        // 录音太短（<5s）直接丢弃，不进入转写/AI流程
        if duration_secs < 5.0 {
            eprintln!(
                "[recorder] recording too short ({:.1}s < 5s), discarding: {}",
                duration_secs, filename
            );
            let _ = std::fs::remove_file(&output_path);
            let _ = app_clone.emit("recording-discarded", &filename);
            return;
        }

        let _ = app_clone.emit(
            "recording-processed",
            serde_json::json!({
                "filename": filename,
                "path": output_path.to_string_lossy().as_ref(),
            }),
        );

        let ym_for_ai = crate::workspace::current_year_month();
        crate::audio_pipeline::start_audio_pipeline(app_clone, output_path, ym_for_ai, true, None);
    });

    Ok(())
}

/// Repair a truncated WAV header left by an unfinalized hound::WavWriter.
/// Fixes the RIFF chunk size and data chunk size fields based on actual file size.
fn repair_wav_header(path: &Path) -> Result<(), String> {
    use std::io::{Read, Seek, SeekFrom, Write};

    let mut f = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .open(path)
        .map_err(|e| format!("open failed: {}", e))?;

    let file_size = f.metadata().map_err(|e| format!("metadata: {}", e))?.len();
    if file_size < 44 {
        return Err("file too small to be a valid WAV".into());
    }

    // Verify RIFF header
    let mut header = [0u8; 12];
    f.read_exact(&mut header)
        .map_err(|e| format!("read header: {}", e))?;
    if &header[0..4] != b"RIFF" || &header[8..12] != b"WAVE" {
        return Err("not a RIFF/WAVE file".into());
    }

    // Fix RIFF chunk size (bytes 4-7): file_size - 8
    f.seek(SeekFrom::Start(4))
        .map_err(|e| format!("seek: {}", e))?;
    f.write_all(&((file_size - 8) as u32).to_le_bytes())
        .map_err(|e| format!("write riff size: {}", e))?;

    // Find "data" chunk by scanning subchunks after byte 12
    let mut pos = 12u64;
    loop {
        if pos + 8 > file_size {
            return Err("data chunk not found".into());
        }
        f.seek(SeekFrom::Start(pos))
            .map_err(|e| format!("seek chunk: {}", e))?;
        let mut chunk_hdr = [0u8; 8];
        f.read_exact(&mut chunk_hdr)
            .map_err(|e| format!("read chunk: {}", e))?;

        if &chunk_hdr[0..4] == b"data" {
            // Fix data chunk size: remaining bytes after this 8-byte header
            let data_size = file_size - pos - 8;
            f.seek(SeekFrom::Start(pos + 4))
                .map_err(|e| format!("seek data size: {}", e))?;
            f.write_all(&(data_size as u32).to_le_bytes())
                .map_err(|e| format!("write data size: {}", e))?;
            break;
        }

        // Skip to next chunk: current pos + 8 (header) + declared chunk size
        let chunk_size =
            u32::from_le_bytes([chunk_hdr[4], chunk_hdr[5], chunk_hdr[6], chunk_hdr[7]]);
        pos += 8 + chunk_size as u64;
    }

    f.flush().map_err(|e| format!("flush: {}", e))?;
    eprintln!(
        "[recorder] repaired WAV header: {:?} ({} bytes)",
        path, file_size
    );
    Ok(())
}

/// Scan all `yyMM/raw/` dirs for orphaned `.wav.tmp` files left by interrupted recordings.
/// For each one, convert to `.m4a` via afconvert and feed into the audio pipeline.
pub fn recover_interrupted_recordings(app: AppHandle, workspace: &str) {
    let workspace = PathBuf::from(workspace);
    let entries = match std::fs::read_dir(&workspace) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let dir_name = entry.file_name().to_string_lossy().to_string();
        // Match yyMM directories (4 digits)
        if dir_name.len() != 4 || !dir_name.chars().all(|c| c.is_ascii_digit()) {
            continue;
        }
        let raw_dir = entry.path().join("raw");
        let raw_entries = match std::fs::read_dir(&raw_dir) {
            Ok(e) => e,
            Err(_) => continue,
        };

        for file in raw_entries.flatten() {
            let path = file.path();
            if path.extension().and_then(|e| e.to_str()) != Some("tmp") {
                continue;
            }
            let name = path.to_string_lossy();
            if !name.ends_with(".wav.tmp") {
                continue;
            }

            // Derive .m4a path: strip ".wav.tmp", append ".m4a"
            let stem = name.trim_end_matches(".wav.tmp");
            let m4a_path = PathBuf::from(format!("{}.m4a", stem));

            if m4a_path.exists() {
                // Conversion already completed; clean up orphan
                eprintln!("[recorder] removing orphaned tmp (m4a exists): {}", name);
                let _ = std::fs::remove_file(&path);
                continue;
            }

            eprintln!("[recorder] recovering interrupted recording: {}", name);
            let app_clone = app.clone();
            let wav_path = path.clone();
            let year_month = dir_name.clone();

            tauri::async_runtime::spawn_blocking(move || {
                // Repair truncated WAV header before conversion
                if let Err(e) = repair_wav_header(&wav_path) {
                    eprintln!("[recorder] WAV repair failed for {:?}: {}", wav_path, e);
                    return;
                }

                let status = std::process::Command::new("afconvert")
                    .args([
                        "-f",
                        "m4af",
                        "-d",
                        "aac",
                        wav_path.to_str().unwrap(),
                        m4a_path.to_str().unwrap(),
                    ])
                    .status();

                if let Ok(s) = &status {
                    if s.success() {
                        let _ = std::fs::remove_file(&wav_path);
                    } else {
                        eprintln!("[recorder] afconvert failed for {:?}", wav_path);
                        return;
                    }
                } else {
                    eprintln!(
                        "[recorder] afconvert error for {:?}: {:?}",
                        wav_path, status
                    );
                    return;
                }

                let filename = m4a_path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();

                let _ = app_clone.emit(
                    "recording-processed",
                    serde_json::json!({
                        "filename": filename,
                        "path": m4a_path.to_string_lossy().as_ref(),
                    }),
                );

                crate::audio_pipeline::start_audio_pipeline(
                    app_clone, m4a_path, year_month, true, None,
                );
            });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rms_silence_is_zero() {
        let samples = vec![0.0f32; 512];
        assert_eq!(rms_f32(&samples), 0.0);
    }

    #[test]
    fn rms_full_scale_sine_approx_point_seven() {
        // Full-scale sine wave RMS = 1/√2 ≈ 0.707
        let samples: Vec<f32> = (0..512)
            .map(|i| (i as f32 * std::f32::consts::TAU / 64.0).sin())
            .collect();
        let r = rms_f32(&samples);
        assert!(
            (r - std::f32::consts::FRAC_1_SQRT_2).abs() < 0.01,
            "expected ~0.707, got {}",
            r
        );
    }

    #[test]
    fn rms_dc_offset_equals_amplitude() {
        let samples = vec![0.5f32; 256];
        assert!((rms_f32(&samples) - 0.5).abs() < 1e-6);
    }

    #[test]
    fn rms_empty_slice_is_zero() {
        assert_eq!(rms_f32(&[]), 0.0);
    }
}
