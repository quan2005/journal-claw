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

    while pos < input_frames {
        let end = (pos + chunk_size).min(input_frames);
        let actual_chunk_len = end - pos;

        if actual_chunk_len < chunk_size {
            // Last partial chunk: use process_partial to avoid over-producing
            let chunk = mono[pos..end].to_vec();
            let tail = resampler.process_partial(Some(&[chunk]), None)
                .map_err(|e| e.to_string())?;
            output.extend_from_slice(&tail[0]);
        } else {
            let chunk = mono[pos..end].to_vec();
            let out_chunk = resampler.process(&[chunk], None)
                .map_err(|e| e.to_string())?;
            output.extend_from_slice(&out_chunk[0]);
        }
        pos += chunk_size;
    }

    // Flush rubato's internal delay line (tail frames)
    let tail = resampler.process_partial(None::<&[Vec<f32>]>, None)
        .map_err(|e| e.to_string())?;
    output.extend_from_slice(&tail[0]);

    // Trim to expected length (rubato may produce a few extra frames due to buffering)
    output.truncate(expected_frames);

    Ok(output)
}

pub fn process_audio(_wav_path: &PathBuf) -> Result<(), String> {
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
}
