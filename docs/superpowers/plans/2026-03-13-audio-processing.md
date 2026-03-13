# Audio Processing Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically denoise and strip ≥3-second silent gaps from every recording when stop_recording is called.

**Architecture:** A new `audio_process.rs` module exposes a single `process_audio(wav_path)` function that (1) reads the raw WAV, (2) resamples to 48 kHz mono with rubato, (3) denoises with nnnoiseless, (4) removes silent gaps ≥3 s, and (5) writes the result back in-place. `denoise_audio` and `remove_silence` are infallible — they always return best-effort output — so per-step graceful degradation is built in. The entire function is called from `recorder.rs` with errors silently discarded so M4A generation is never blocked.

**Tech Stack:** Rust, hound 3.5 (already present), nnnoiseless 0.5, rubato 0.15, cargo test (inline `#[cfg(test)]`)

---

## Chunk 1: Dependencies + module skeleton

### Task 1: Add Cargo dependencies

**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add nnnoiseless and rubato**

Open `src-tauri/Cargo.toml` and add under `[dependencies]`:

```toml
nnnoiseless = "0.5"
rubato = "0.15"
```

Final `[dependencies]` block:

```toml
[dependencies]
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
cpal = "0.17"
hound = "3.5"
chrono = { version = "0.4", features = ["clock"] }
mp4ameta = "0.13"
nnnoiseless = "0.5"
rubato = "0.15"
```

- [ ] **Step 2: Verify dependency resolution**

```bash
cd src-tauri && cargo fetch
```

Expected: no errors, both crates downloaded.

- [ ] **Step 3: Commit**

```bash
cd src-tauri && git add Cargo.toml Cargo.lock
git commit -m "chore: add nnnoiseless and rubato dependencies"
```

---

### Task 2: Register audio_process module

**Files:**
- Modify: `src-tauri/src/main.rs` (line 3, after `mod recorder;`)
- Create: `src-tauri/src/audio_process.rs` (stub)

- [ ] **Step 1: Create stub file**

Create `src-tauri/src/audio_process.rs` with this exact content:

```rust
use std::path::PathBuf;

pub fn process_audio(_wav_path: &PathBuf) -> Result<(), String> {
    Ok(())
}
```

- [ ] **Step 2: Add mod declaration to main.rs**

In `src-tauri/src/main.rs`, add `mod audio_process;` after `mod recorder;`:

```rust
mod types;
mod recordings;
mod recorder;
mod audio_process;
```

- [ ] **Step 3: Verify it compiles**

```bash
cd src-tauri && cargo check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/main.rs src-tauri/src/audio_process.rs
git commit -m "chore: register audio_process module (stub)"
```

---

## Chunk 2: Core audio_process.rs implementation

### Task 3: Implement resample_to_48k_mono

**Files:**
- Modify: `src-tauri/src/audio_process.rs`

This function converts arbitrary-rate, arbitrary-channel i16 WAV samples into 48 kHz mono f32. It uses rubato's `FftFixedIn` resampler.

- [ ] **Step 1: Write failing test (inline)**

Add to the bottom of `audio_process.rs`:

```rust
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
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd src-tauri && cargo test test_resample_to_48k_mono 2>&1 | tail -20
```

Expected: FAIL — `resample_to_48k_mono` not defined.

- [ ] **Step 3: Implement resample_to_48k_mono**

Replace the contents of `audio_process.rs` above the `#[cfg(test)]` block with:

```rust
use std::path::PathBuf;
use rubato::{FftFixedIn, Resampler};

const TARGET_RATE: u32 = 48000;

/// Convert i16 PCM (any rate, any channels) to 48 kHz mono f32.
fn resample_to_48k_mono(
    samples: &[i16],
    src_rate: u32,
    channels: u16,
) -> Result<Vec<f32>, String> {
    let channels = channels as usize;

    // Deinterleave into per-channel f32 buffers
    let frames = samples.len() / channels;
    let mut channel_bufs: Vec<Vec<f32>> = vec![Vec::with_capacity(frames); channels];
    for (i, &s) in samples.iter().enumerate() {
        channel_bufs[i % channels].push(s as f32 / i16::MAX as f32);
    }

    // Mix down to mono
    let mut mono: Vec<f32> = (0..frames)
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

    let mut output = Vec::new();
    let mut pos = 0usize;

    loop {
        let end = (pos + chunk_size).min(mono.len());
        let mut chunk = mono[pos..end].to_vec();
        if chunk.len() < chunk_size {
            chunk.resize(chunk_size, 0.0);
        }
        let out_chunk = resampler.process(&[chunk], None)
            .map_err(|e| e.to_string())?;
        output.extend_from_slice(&out_chunk[0]);
        pos += chunk_size;
        if pos >= mono.len() { break; }
    }

    // Flush rubato's internal delay line (tail frames)
    let tail = resampler.process_partial(None::<&[Vec<f32>]>, None)
        .map_err(|e| e.to_string())?;
    output.extend_from_slice(&tail[0]);

    Ok(output)
}

pub fn process_audio(_wav_path: &PathBuf) -> Result<(), String> {
    Ok(())
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd src-tauri && cargo test test_resample_to_48k_mono 2>&1 | tail -20
```

Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/audio_process.rs
git commit -m "feat: implement resample_to_48k_mono"
```

---

### Task 4: Implement nnnoiseless denoising

**Files:**
- Modify: `src-tauri/src/audio_process.rs`

nnnoiseless processes audio in 480-sample frames at 48 kHz. Frames shorter than 480 are zero-padded; the last output frame is trimmed back to the original signal length.

- [ ] **Step 1: Write failing test**

Add to the `tests` module in `audio_process.rs`:

```rust
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd src-tauri && cargo test test_denoise 2>&1 | tail -20
```

Expected: FAIL — `denoise_audio` not defined.

- [ ] **Step 3: Implement denoise_audio**

Add after `resample_to_48k_mono` (before `process_audio`):

```rust
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd src-tauri && cargo test test_denoise 2>&1 | tail -20
```

Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/audio_process.rs
git commit -m "feat: implement denoise_audio with nnnoiseless"
```

---

### Task 5: Implement silence removal

**Files:**
- Modify: `src-tauri/src/audio_process.rs`

Parameters (all fixed, no config):
- Window size: 4800 samples = 100 ms at 48 kHz
- Silent window: RMS < 0.01
- Minimum silent run: 30 windows = 3 s
- Buffer: 7200 samples = 150 ms each side of a cut
- Edge case: if entire clip is silent, return last 7200 samples (≥150 ms)

- [ ] **Step 1: Write failing tests**

Add to the `tests` module:

```rust
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd src-tauri && cargo test test_remove_silence 2>&1 | tail -20
```

Expected: FAIL — `remove_silence` not defined.

- [ ] **Step 3: Implement remove_silence**

Add after `denoise_audio` (before `process_audio`):

```rust
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
                let sample_start = (run_start * WINDOW).saturating_sub(0); // raw start
                let sample_end = (run_end * WINDOW).min(n);                 // raw end
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
    if output.is_empty() {
        let tail_start = n.saturating_sub(BUFFER_SAMPLES);
        return samples[tail_start..].to_vec();
    }

    output
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd src-tauri && cargo test test_remove_silence 2>&1 | tail -20
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/audio_process.rs
git commit -m "feat: implement remove_silence (3s threshold, 150ms buffer)"
```

---

### Task 6: Wire up process_audio

**Files:**
- Modify: `src-tauri/src/audio_process.rs` (replace stub `process_audio`)

`process_audio` reads the WAV, calls the three functions in order, and writes the result back to the same path. On any error it returns `Err(String)` — the caller discards it.

- [ ] **Step 1: Write a failing integration test**

Add to the `tests` module:

```rust
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd src-tauri && cargo test test_process_audio_roundtrip 2>&1 | tail -20
```

Expected: FAIL (stub `process_audio` writes nothing back, spec mismatch or length mismatch).

- [ ] **Step 3: Implement process_audio**

Replace the stub `process_audio` at the top of `audio_process.rs`:

```rust
/// Read WAV → resample to 48kHz mono → denoise → remove silence → write back.
/// Per-step graceful degradation: if denoise fails, skip it; if silence removal fails,
/// skip it. Only returns Err if reading or writing the WAV fails.
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

    // 3. Denoise — failure skips this step, use resampled audio as-is
    let denoised = denoise_audio(&resampled);

    // 4. Remove silence — failure skips this step, use denoised audio as-is
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
```

**Note on per-step degradation:** `denoise_audio` and `remove_silence` are both infallible (they return `Vec<f32>`, not `Result`). This is intentional — they process whatever input they receive and return a best-effort result, so degradation is built in. If rubato resampling fails (rare, only on extreme input), the whole pipeline aborts and the original WAV is preserved untouched.

- [ ] **Step 4: Run all tests to verify they pass**

```bash
cd src-tauri && cargo test 2>&1 | tail -30
```

Expected: all tests PASS (resample, denoise, remove_silence, roundtrip).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/audio_process.rs
git commit -m "feat: implement process_audio (resample → denoise → silence removal)"
```

---

## Chunk 3: Integration into recorder.rs

### Task 7: Call process_audio from stop_recording

**Files:**
- Modify: `src-tauri/src/recorder.rs` (between WAV finalize and afconvert, currently lines 133-144)

The call site is after WAV `finalize()` (line 136) and before the `afconvert` `Command` (line 139). The `wav_path` variable is assigned at line 138 — move the `process_audio` call after that assignment.

- [ ] **Step 1: Add the call to stop_recording**

In `src-tauri/src/recorder.rs`, the current `stop_recording` body after WAV finalize:

```rust
    let wav_path = active.output_path.with_extension("wav.tmp");
    let status = std::process::Command::new("afconvert")
```

Change it to:

```rust
    let wav_path = active.output_path.with_extension("wav.tmp");

    // Post-process: denoise + silence removal. Errors are silently discarded.
    let _ = crate::audio_process::process_audio(&wav_path);

    let status = std::process::Command::new("afconvert")
```

- [ ] **Step 2: Verify it compiles**

```bash
cd src-tauri && cargo check
```

Expected: no errors.

- [ ] **Step 3: Run all tests**

```bash
cd src-tauri && cargo test 2>&1 | tail -30
```

Expected: all tests still PASS.

- [ ] **Step 4: Do a manual smoke test**

```bash
cd /Users/yanwu/Projects/github/journal && npm run tauri dev
```

- Record a short clip (with some silence in the middle if possible)
- Stop recording — confirm a new entry appears in the list
- Open the recordings folder and verify the M4A plays back correctly (silence stripped, cleaner audio)

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/recorder.rs
git commit -m "feat: call process_audio in stop_recording (denoise + silence removal)"
```

---
