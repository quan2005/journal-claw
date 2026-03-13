use std::path::PathBuf;
use rubato::{FftFixedIn, Resampler};

const TARGET_RATE: u32 = 48000;

/// Convert i16 PCM (any rate, any channels) to 48 kHz mono f32.
fn resample_to_48k_mono(
    samples: &[i16],
    src_rate: u32,
    channels: u16,
) -> Result<Vec<f32>, String> {
    if channels == 0 {
        return Err("channels must be > 0".to_string());
    }
    let channels = channels as usize;

    // Deinterleave into per-channel f32 buffers
    let frames = samples.len() / channels;
    let mut channel_bufs: Vec<Vec<f32>> = vec![Vec::with_capacity(frames); channels];
    for (i, &s) in samples.iter().enumerate() {
        channel_bufs[i % channels].push(s as f32 / i16::MAX as f32);
    }

    // Mix down to mono
    let mono: Vec<f32> = (0..frames)
        .map(|f| channel_bufs.iter().map(|ch| ch[f]).sum::<f32>() / channels as f32)
        .collect();

    // If already at target rate, return as-is
    if src_rate == TARGET_RATE {
        return Ok(mono);
    }

    // Resample with rubato FftFixedIn
    let chunk_size = 1024usize;
    let mut resampler = FftFixedIn::<f32>::new(
        src_rate as usize,
        TARGET_RATE as usize,
        chunk_size,
        2,
        1,
    ).map_err(|e| e.to_string())?;

    let input_frames = mono.len();
    // Expected output length (before tail flush)
    let expected_frames = (input_frames as u64 * TARGET_RATE as u64 / src_rate as u64) as usize;

    let mut output = Vec::new();
    let mut pos = 0usize;
    let mut used_partial = false;

    while pos < input_frames {
        let end = (pos + chunk_size).min(input_frames);
        let actual_chunk_len = end - pos;

        if actual_chunk_len < chunk_size {
            // Last partial chunk: use process_partial to avoid over-producing
            let chunk = mono[pos..end].to_vec();
            let tail = resampler.process_partial(Some(&[chunk]), None)
                .map_err(|e| e.to_string())?;
            output.extend_from_slice(&tail[0]);
            used_partial = true;
        } else {
            let chunk = mono[pos..end].to_vec();
            let out_chunk = resampler.process(&[chunk], None)
                .map_err(|e| e.to_string())?;
            output.extend_from_slice(&out_chunk[0]);
        }
        pos += chunk_size;
    }

    // Flush rubato's internal delay line only when no partial call was made.
    // If process_partial(Some(...)) was already called above, calling
    // process_partial(None) again would add an extra FFT cycle of near-silence artifacts.
    if !used_partial {
        let tail = resampler.process_partial(None::<&[Vec<f32>]>, None)
            .map_err(|e| e.to_string())?;
        output.extend_from_slice(&tail[0]);
    }

    // Trim to expected length (rubato may produce a few extra frames due to buffering)
    output.truncate(expected_frames);

    Ok(output)
}

use nnnoiseless::DenoiseState;

const FRAME_SIZE: usize = DenoiseState::FRAME_SIZE; // 480

/// Run nnnoiseless RNNoise on 48 kHz mono f32 samples. Returns same-length output.
fn denoise_audio(samples: &[f32]) -> Vec<f32> {
    let mut state = DenoiseState::new();
    let mut output = Vec::with_capacity(samples.len());
    let mut pos = 0usize;

    while pos < samples.len() {
        let end = (pos + FRAME_SIZE).min(samples.len());
        let mut frame = [0.0f32; FRAME_SIZE];
        frame[..end - pos].copy_from_slice(&samples[pos..end]);

        let mut out_frame = [0.0f32; FRAME_SIZE];
        state.process_frame(&mut out_frame, &frame);

        let valid = end - pos;
        output.extend_from_slice(&out_frame[..valid]);
        pos += FRAME_SIZE;
    }

    output
}

const WINDOW: usize = 4800;   // 100 ms
const SILENT_RMS: f32 = 0.01;
const MIN_SILENT_WINDOWS: usize = 30; // 3 s
const BUFFER_SAMPLES: usize = 7200;   // 150 ms

/// Remove gaps of ≥3 s of silence from 48 kHz mono f32 audio.
fn remove_silence(samples: &[f32]) -> Vec<f32> {
    let n = samples.len();
    if n == 0 { return vec![]; }

    // Classify each window as silent or not
    let num_windows = (n + WINDOW - 1) / WINDOW;
    let silent: Vec<bool> = (0..num_windows).map(|w| {
        let start = w * WINDOW;
        let end = (start + WINDOW).min(n);
        let rms = (samples[start..end].iter().map(|&x| x * x).sum::<f32>()
            / (end - start) as f32).sqrt();
        rms < SILENT_RMS
    }).collect();

    // Find contiguous silent runs of ≥ MIN_SILENT_WINDOWS windows
    // Build a list of (start_sample, end_sample) ranges to EXCLUDE
    let mut exclude: Vec<(usize, usize)> = Vec::new();
    let mut i = 0usize;
    while i < num_windows {
        if silent[i] {
            let run_start = i;
            while i < num_windows && silent[i] { i += 1; }
            let run_end = i;
            if run_end - run_start >= MIN_SILENT_WINDOWS {
                // Shrink by buffer on each side
                let sample_start = run_start * WINDOW;
                let sample_end = (run_end * WINDOW).min(n);
                let cut_start = (sample_start + BUFFER_SAMPLES).min(sample_end);
                let cut_end = sample_end.saturating_sub(BUFFER_SAMPLES);
                if cut_end > cut_start {
                    exclude.push((cut_start, cut_end));
                }
            }
        } else {
            i += 1;
        }
    }

    // Build output by copying non-excluded ranges
    let mut output = Vec::with_capacity(n);
    let mut pos = 0usize;
    for (cut_start, cut_end) in &exclude {
        if pos < *cut_start {
            output.extend_from_slice(&samples[pos..*cut_start]);
        }
        pos = *cut_end;
    }
    if pos < n {
        output.extend_from_slice(&samples[pos..]);
    }

    // Edge case: output is empty (whole clip was silent) → return tail
    if output.is_empty() || silent.iter().all(|&s| s) {
        let tail_start = n.saturating_sub(BUFFER_SAMPLES);
        return samples[tail_start..].to_vec();
    }

    output
}

/// Read WAV → resample to 48kHz mono → denoise → remove silence → write back.
/// Per-step graceful degradation: denoise_audio and remove_silence are infallible.
/// Only returns Err if reading or writing the WAV fails (or resampling fails);
/// caller discards the error, preserving the original WAV for afconvert.
pub fn process_audio(wav_path: &PathBuf) -> Result<(), String> {
    // 1. Read WAV
    let mut reader = hound::WavReader::open(wav_path).map_err(|e| e.to_string())?;
    let spec = reader.spec();
    let src_rate = spec.sample_rate;
    let channels = spec.channels;

    let raw_samples: Vec<i16> = reader
        .samples::<i16>()
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // 2. Resample to 48kHz mono f32 — failure aborts (nothing to write back)
    let resampled = resample_to_48k_mono(&raw_samples, src_rate, channels)?;

    // 3. Denoise — infallible, best-effort
    let denoised = denoise_audio(&resampled);

    // 4. Remove silence — infallible, best-effort
    let processed = remove_silence(&denoised);

    // 5. Write back to the same path (atomic: write to .new, rename)
    let tmp_out = wav_path.with_extension("wav.new");
    {
        let out_spec = hound::WavSpec {
            channels: 1,
            sample_rate: TARGET_RATE,
            bits_per_sample: 32,
            sample_format: hound::SampleFormat::Float,
        };
        let mut writer = hound::WavWriter::create(&tmp_out, out_spec)
            .map_err(|e| e.to_string())?;
        for &s in &processed {
            writer.write_sample(s).map_err(|e| e.to_string())?;
        }
        writer.finalize().map_err(|e| e.to_string())?;
    }
    std::fs::rename(&tmp_out, wav_path).map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resample_to_48k_mono_44100_stereo() {
        // 44100 Hz stereo, 0.1 s → 4410 stereo samples = 8820 i16 values
        let samples: Vec<i16> = (0..8820).map(|i| (i % 1000) as i16).collect();
        let out = resample_to_48k_mono(&samples, 44100, 2).unwrap();
        // 0.1 s at 48000 Hz = 4800 samples (allow generous range for rubato buffering + tail flush)
        assert!(out.len() >= 4700 && out.len() <= 5000, "got {} samples", out.len());
    }

    #[test]
    fn test_resample_to_48k_mono_already_48k_mono() {
        // Already 48kHz mono — early-return path, output length == input length
        let samples: Vec<i16> = vec![0i16; 4800];
        let out = resample_to_48k_mono(&samples, 48000, 1).unwrap();
        assert_eq!(out.len(), 4800);
    }

    #[test]
    fn test_denoise_preserves_length() {
        // 48kHz, 1 second of silence-ish signal
        let input: Vec<f32> = vec![0.0f32; 48000];
        let out = denoise_audio(&input);
        assert_eq!(out.len(), input.len());
    }

    #[test]
    fn test_denoise_short_clip() {
        // Less than one frame (480 samples)
        let input: Vec<f32> = vec![0.01f32; 100];
        let out = denoise_audio(&input);
        assert_eq!(out.len(), 100);
    }

    #[test]
    fn test_remove_silence_keeps_speech() {
        // Signal with RMS well above threshold throughout — nothing removed
        let input: Vec<f32> = (0..48000).map(|i| (i as f32 * 0.1).sin() * 0.5).collect();
        let out = remove_silence(&input);
        // Should keep almost everything (only buffer trimming possible)
        assert!(out.len() > 40000, "got {} samples", out.len());
    }

    #[test]
    fn test_remove_silence_strips_long_gap() {
        // 1s speech (48000) + 4s silence (192000) + 1s speech (48000) = 288000 total
        let mut input = Vec::new();
        // speech
        for i in 0..48000usize {
            input.push((i as f32 * 0.1).sin() * 0.5);
        }
        // silence
        input.extend(vec![0.0f32; 192000]);
        // speech
        for i in 0..48000usize {
            input.push((i as f32 * 0.1).sin() * 0.5);
        }
        let out = remove_silence(&input);
        // Gap (4s) should be stripped; result should be noticeably shorter than input
        // Each speech block ~48000 + 2×7200 buffer = ~110400; total ~200000 max
        assert!(out.len() < 200000, "silence not stripped, got {} samples", out.len());
        // But both speech blocks should survive
        assert!(out.len() > 60000, "too much removed, got {} samples", out.len());
    }

    #[test]
    fn test_remove_silence_all_silent_returns_tail() {
        let input = vec![0.0f32; 48000];
        let out = remove_silence(&input);
        assert!(!out.is_empty());
        assert!(out.len() <= 7200 + 1);
    }

    use std::path::PathBuf;

    fn make_wav(path: &PathBuf, rate: u32, channels: u16, samples: &[i16]) {
        let spec = hound::WavSpec {
            channels,
            sample_rate: rate,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        let mut w = hound::WavWriter::create(path, spec).unwrap();
        for &s in samples { w.write_sample(s).unwrap(); }
        w.finalize().unwrap();
    }

    #[test]
    fn test_process_audio_roundtrip() {
        // 44.1 kHz stereo, ~0.5 s speech + 4 s silence + ~0.5 s speech
        let rate = 44100u32;
        let channels = 2u16;
        let speech: Vec<i16> = (0..44100usize)
            .map(|i| ((i as f32 * 0.1).sin() * 20000.0) as i16)
            .collect();
        let silence: Vec<i16> = vec![0i16; rate as usize * 4 * channels as usize];
        let mut samples = Vec::new();
        samples.extend_from_slice(&speech);
        samples.extend_from_slice(&silence);
        samples.extend_from_slice(&speech);

        let tmp = std::env::temp_dir().join("test_process_audio.wav.tmp");
        make_wav(&tmp, rate, channels, &samples);

        let result = process_audio(&tmp);
        // Should succeed (not care about exact output, just no error and file exists)
        assert!(result.is_ok(), "process_audio failed: {:?}", result);
        assert!(tmp.exists());

        // Output WAV should be shorter (silence stripped) and at 48kHz mono
        let mut reader = hound::WavReader::open(&tmp).unwrap();
        let spec = reader.spec();
        assert_eq!(spec.sample_rate, 48000);
        assert_eq!(spec.channels, 1);
        let out_samples: Vec<f32> = reader.samples::<f32>().map(|s| s.unwrap()).collect();
        // Original ~1s speech + 4s silence + ~1s speech at 44.1kHz
        // After processing at 48kHz: ~2s speech ≈ 96000 samples (silence removed)
        // Allow generous range due to resampling and buffer keeping
        assert!(out_samples.len() < 200000, "silence not stripped: {} samples", out_samples.len());
        assert!(out_samples.len() > 50000, "too much removed: {} samples", out_samples.len());

        let _ = std::fs::remove_file(&tmp);
    }
}
