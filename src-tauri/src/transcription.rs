use crate::config;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

const UPLOAD_URL: &str = "https://dashscope.aliyuncs.com/api/v1/uploads";
const TRANSCRIBE_URL: &str =
    "https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription";
const MIN_DURATION_SECS: f64 = 30.0;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhisperSegment {
    pub speaker: Option<String>,
    pub start: f64,
    pub end: f64,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transcript {
    pub status: String,
    pub text: String,
    #[serde(default)]
    pub segments: Vec<WhisperSegment>,
}

pub fn transcript_json_path_for_audio(file_path: &std::path::Path) -> PathBuf {
    let raw_dir = file_path.parent().unwrap_or(file_path);
    let base = file_path.file_stem().unwrap_or_default().to_string_lossy();
    raw_dir.join(format!("{}.transcript.json", base))
}

pub fn audio_ai_markdown_path_for_audio(file_path: &std::path::Path) -> PathBuf {
    let raw_dir = file_path.parent().unwrap_or(file_path);
    let base = file_path.file_stem().unwrap_or_default().to_string_lossy();
    raw_dir.join(format!("{}.audio-ai.md", base))
}

fn resolve_audio_path(app: &AppHandle, path: &str) -> Result<PathBuf, String> {
    let candidate = PathBuf::from(path);
    if candidate.exists() {
        return Ok(candidate);
    }

    if candidate.parent().is_none()
        || candidate
            .parent()
            .is_some_and(|parent| parent.as_os_str().is_empty())
    {
        return crate::recordings::recordings_dir(app).map(|dir| dir.join(path));
    }

    Ok(candidate)
}

fn emit_progress(app: &AppHandle, filename: &str, status: &str) {
    let payload = serde_json::json!({ "filename": filename, "status": status });
    let _ = app.emit("transcription-progress", payload);
}

fn audio_mime_type(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_lowercase()
        .as_str()
    {
        "wav" => "audio/wav",
        "mp3" => "audio/mpeg",
        "ogg" => "audio/ogg",
        "flac" => "audio/flac",
        "aac" | "m4a" | "mp4" => "audio/mp4",
        _ => "application/octet-stream",
    }
}

/// Upload a local audio file to DashScope temporary storage and return the oss:// URL.
async fn upload_file(
    client: &reqwest::Client,
    api_key: &str,
    path: &Path,
) -> Result<String, String> {
    let file_name = path
        .file_name()
        .ok_or("no filename")?
        .to_string_lossy()
        .to_string();

    // Step 1: Get upload policy (OSS credentials)
    let policy_resp = client
        .get(UPLOAD_URL)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .query(&[
            ("action", "getPolicy"),
            ("model", "qwen3-asr-flash-filetrans"),
        ])
        .send()
        .await
        .map_err(|e| format!("Get policy failed: {}", e))?;

    if !policy_resp.status().is_success() {
        let status = policy_resp.status();
        let body = policy_resp.text().await.unwrap_or_default();
        return Err(format!("Get policy failed ({}): {}", status, body));
    }

    let policy_data: serde_json::Value = policy_resp.json().await.map_err(|e| e.to_string())?;
    let data = policy_data
        .get("data")
        .ok_or("No data in policy response")?;

    let upload_host = data
        .get("upload_host")
        .and_then(|v| v.as_str())
        .ok_or("No upload_host in policy response")?;
    let upload_dir = data
        .get("upload_dir")
        .and_then(|v| v.as_str())
        .ok_or("No upload_dir in policy response")?;
    let oss_access_key_id = data
        .get("oss_access_key_id")
        .and_then(|v| v.as_str())
        .ok_or("No oss_access_key_id")?;
    let signature = data
        .get("signature")
        .and_then(|v| v.as_str())
        .ok_or("No signature")?;
    let policy = data
        .get("policy")
        .and_then(|v| v.as_str())
        .ok_or("No policy")?;
    let x_oss_object_acl = data
        .get("x_oss_object_acl")
        .and_then(|v| v.as_str())
        .ok_or("No x_oss_object_acl")?;
    let x_oss_forbid_overwrite = data
        .get("x_oss_forbid_overwrite")
        .and_then(|v| v.as_str())
        .ok_or("No x_oss_forbid_overwrite")?;

    // Step 2: Upload file to OSS via multipart POST
    let key = format!("{}/{}", upload_dir, file_name);
    let file_bytes = fs::read(path).map_err(|e| format!("Read file failed: {}", e))?;

    let file_part = reqwest::multipart::Part::bytes(file_bytes)
        .file_name(file_name.clone())
        .mime_str(audio_mime_type(path))
        .map_err(|e| e.to_string())?;

    let form = reqwest::multipart::Form::new()
        .text("OSSAccessKeyId", oss_access_key_id.to_string())
        .text("Signature", signature.to_string())
        .text("policy", policy.to_string())
        .text("x-oss-object-acl", x_oss_object_acl.to_string())
        .text("x-oss-forbid-overwrite", x_oss_forbid_overwrite.to_string())
        .text("key", key.clone())
        .text("success_action_status", "200".to_string())
        .part("file", file_part);

    let upload_resp = client
        .post(upload_host)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Upload to OSS failed: {}", e))?;

    if !upload_resp.status().is_success() {
        let status = upload_resp.status();
        let body = upload_resp.text().await.unwrap_or_default();
        return Err(format!("Upload to OSS failed ({}): {}", status, body));
    }

    // Step 3: Construct the oss:// URL
    Ok(format!("oss://{}", key))
}

/// Submit a transcription task and return the task_id.
async fn submit_transcription(
    client: &reqwest::Client,
    api_key: &str,
    file_url: &str,
) -> Result<String, String> {
    let body = serde_json::json!({
        "model": "qwen3-asr-flash-filetrans",
        "input": {
            "file_url": file_url
        },
        "parameters": {
            "channel_id": [0]
        }
    });

    let resp = client
        .post(TRANSCRIBE_URL)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .header("X-DashScope-Async", "enable")
        .header("X-DashScope-OssResourceResolve", "enable")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Submit failed ({}): {}", status, body));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let task_id = data
        .get("output")
        .and_then(|o| o.get("task_id"))
        .and_then(|v| v.as_str())
        .ok_or("No task_id in submit response")?;
    Ok(task_id.to_string())
}

/// Poll a task until it reaches a terminal state. Returns the transcription URL if available.
async fn poll_task(
    client: &reqwest::Client,
    api_key: &str,
    task_id: &str,
    app: &AppHandle,
    filename: &str,
) -> Result<Option<String>, String> {
    let url = format!("https://dashscope.aliyuncs.com/api/v1/tasks/{}", task_id);

    loop {
        tokio::time::sleep(Duration::from_secs(3)).await;

        let resp = client
            .get(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Poll failed: {}", body));
        }

        let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        let status = data
            .get("output")
            .and_then(|o| o.get("task_status"))
            .and_then(|v| v.as_str())
            .unwrap_or("UNKNOWN");

        match status {
            "PENDING" | "RUNNING" => {
                emit_progress(app, filename, "transcribing");
            }
            "SUCCEEDED" => {
                let transcription_url = data
                    .get("output")
                    .and_then(|o| o.get("result"))
                    .and_then(|r| r.get("transcription_url"))
                    .and_then(|v| v.as_str())
                    .map(String::from);
                if transcription_url.is_none() {
                    return Err(format!(
                        "Task {}: SUCCEEDED but no transcription_url",
                        task_id
                    ));
                }
                return Ok(transcription_url);
            }
            "FAILED" | "UNKNOWN" => {
                return Err(format!("Task {}: {}", task_id, status));
            }
            _ => {
                emit_progress(app, filename, "transcribing");
            }
        }
    }
}

/// Fetch transcription text from a transcription_url.
async fn fetch_transcription_text(client: &reqwest::Client, url: &str) -> Result<String, String> {
    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("Fetch transcription failed: {}", resp.status()));
    }

    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    // Format: { "transcripts": [{ "text": "full text", "sentences": [...] }] }
    let text = body
        .get("transcripts")
        .and_then(|t| t.as_array())
        .and_then(|arr| arr.first())
        .and_then(|t| t.get("text"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    Ok(text)
}

/// 将说话人分段列表格式化为 markdown 纯文本。
/// 相邻同说话人段落合并；时间戳格式 M:SS。
#[cfg_attr(not(test), allow(dead_code))]
pub fn format_diarized_markdown(segments: &[WhisperSegment]) -> String {
    if segments.is_empty() {
        return String::new();
    }

    // 说话人 ID → 匿名标签映射（SPEAKER_00 → A, SPEAKER_01 → B, ...）
    let mut speaker_map: std::collections::HashMap<String, char> = std::collections::HashMap::new();
    let mut next_label = b'A';
    for seg in segments {
        if let Some(ref sp) = seg.speaker {
            if !speaker_map.contains_key(sp) {
                speaker_map.insert(sp.clone(), next_label as char);
                next_label += 1;
            }
        }
    }

    let label_for = |speaker: &Option<String>| -> String {
        match speaker {
            Some(sp) => speaker_map
                .get(sp)
                .map(|c| format!("Speaker {}", c))
                .unwrap_or_else(|| "Speaker ?".to_string()),
            None => "Speaker ?".to_string(),
        }
    };

    let fmt_time = |secs: f64| -> String {
        let total = secs as u64;
        let m = total / 60;
        let s = total % 60;
        format!("{}:{:02}", m, s)
    };

    let mut result = String::new();
    let mut current_speaker: Option<String> = None;
    let mut current_start = 0.0f64;
    let mut current_text = String::new();

    for seg in segments {
        let same_speaker = current_speaker == seg.speaker;
        if same_speaker && !current_text.is_empty() {
            // 合并相邻同说话人段落
            current_text.push(' ');
            current_text.push_str(seg.text.trim());
        } else {
            // 写出上一个说话人块
            if !current_text.is_empty() {
                let label = label_for(&current_speaker);
                result.push_str(&format!(
                    "**{}** ({})\n{}\n\n",
                    label,
                    fmt_time(current_start),
                    current_text.trim()
                ));
            }
            current_speaker = seg.speaker.clone();
            current_start = seg.start;
            current_text = seg.text.trim().to_string();
        }
    }

    // 写出最后一个块
    if !current_text.is_empty() {
        let label = label_for(&current_speaker);
        result.push_str(&format!(
            "**{}** ({})\n{}\n\n",
            label,
            fmt_time(current_start),
            current_text.trim()
        ));
    }

    result.trim_end().to_string()
}

fn save_transcript_data(file_path: &Path, transcript: &Transcript) {
    let json_path = transcript_json_path_for_audio(file_path);
    if let Ok(data) = serde_json::to_string(transcript) {
        let _ = std::fs::write(&json_path, data);
    }
}

fn save_transcript(app: &AppHandle, file_path: &Path, status: &str, text: &str) {
    let transcript = Transcript {
        status: status.to_string(),
        text: text.to_string(),
        segments: vec![],
    };
    save_transcript_data(file_path, &transcript);
    let filename = file_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let _ = app.emit(
        "transcription-progress",
        serde_json::json!({
            "filename": filename, "status": status
        }),
    );
}

fn format_ai_speaker_label(
    speaker_map: &mut std::collections::HashMap<String, char>,
    speaker: &Option<String>,
    next_label: &mut u8,
) -> String {
    match speaker {
        Some(sp) => {
            let label = speaker_map.entry(sp.clone()).or_insert_with(|| {
                let current = *next_label as char;
                *next_label += 1;
                current
            });
            format!("发言人 {}", label)
        }
        None => "发言内容".to_string(),
    }
}

fn normalize_text_line(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn strip_ansi_and_progress(text: &str) -> String {
    let mut output = String::with_capacity(text.len());
    let mut chars = text.chars().peekable();

    while let Some(ch) = chars.next() {
        match ch {
            '\u{1b}' => {
                if matches!(chars.peek(), Some('[')) {
                    chars.next();
                    for ansi_ch in chars.by_ref() {
                        if ('@'..='~').contains(&ansi_ch) {
                            break;
                        }
                    }
                }
            }
            '\r' => {
                output.push('\n');
            }
            _ => output.push(ch),
        }
    }

    output
}

fn truncate_at_first_marker<'a>(text: &'a str, markers: &[&str]) -> &'a str {
    let end = markers
        .iter()
        .filter_map(|marker| text.find(marker))
        .min()
        .unwrap_or(text.len());
    &text[..end]
}

fn extract_whisperkit_transcription_text(stdout_text: &str) -> String {
    if let Some(start_idx) = stdout_text.find("Transcription of ") {
        let suffix = &stdout_text[start_idx..];
        // The line format is "Transcription of <filename>: <text>"
        // The filename may itself contain ':' (e.g. "录音 14:04:51.m4a"),
        // so we must find the ": " that follows the filename extension, not the
        // first ':' in the string.  We look for ": " (colon + space) after a
        // known audio extension to skip colons inside the filename.
        let sep_idx = ["m4a: ", "mp4: ", "wav: ", "mp3: ", "aac: ", "ogg: ", "flac: "]
            .iter()
            .filter_map(|ext| suffix.find(ext).map(|i| i + ext.len() - 2)) // point at ': '
            .min()
            .or_else(|| suffix.find(": "));
        if let Some(colon_idx) = sep_idx {
            let body = truncate_at_first_marker(
                &suffix[colon_idx + 2..],
                &[
                    "Preparing diarization models...",
                    "---- Speaker Diarization Results ----",
                    "Transcription Performance:",
                    "Processing transcription result for:",
                ],
            );
            let cleaned = normalize_text_line(body);
            if !cleaned.is_empty() {
                return cleaned;
            }
        }
    }

    stdout_text
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .filter(|line| !line.starts_with("Starting transcription process"))
        .filter(|line| !line.starts_with("Resolved audio paths:"))
        .filter(|line| !line.starts_with("Using transcription task"))
        .filter(|line| !line.starts_with("Task:"))
        .filter(|line| !line.starts_with("Initializing models"))
        .filter(|line| !line.starts_with("Model initialization complete"))
        .filter(|line| !line.starts_with("- Model folder:"))
        .filter(|line| !line.starts_with("- Tokenizer folder:"))
        .filter(|line| !line.starts_with("- Total load time:"))
        .filter(|line| !line.starts_with("- Encoder load time:"))
        .filter(|line| !line.starts_with("- Decoder load time:"))
        .filter(|line| !line.starts_with("- Tokenizer load time:"))
        .filter(|line| !line.starts_with("Configuring decoding options"))
        .filter(|line| !line.starts_with("Starting transcription with progress tracking"))
        .filter(|line| !line.starts_with("Transcription Performance:"))
        .filter(|line| !line.starts_with("- Tokens per second:"))
        .filter(|line| !line.starts_with("- Real-time factor:"))
        .filter(|line| !line.starts_with("- Speed factor:"))
        .filter(|line| !line.starts_with("Processing transcription result for:"))
        .filter(|line| !line.starts_with("Preparing diarization models..."))
        .filter(|line| !line.starts_with("Diarization model initialization complete"))
        .filter(|line| !line.starts_with("---- Speaker Diarization Results ----"))
        .filter(|line| !line.starts_with("SPEAKER "))
        .filter(|line| !line.contains("Elapsed Time:"))
        .map(normalize_text_line)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

fn parse_whisperkit_diarization_line(line: &str) -> Option<WhisperSegment> {
    let tokens: Vec<&str> = line.split_whitespace().collect();
    if tokens.len() < 9 || tokens.first().copied() != Some("SPEAKER") {
        return None;
    }

    let speaker_idx = tokens.len().checked_sub(3)?;
    let text_end_idx = speaker_idx.checked_sub(1)?;
    if text_end_idx == 0 {
        return None;
    }

    let mut float_indices = tokens
        .iter()
        .enumerate()
        .skip(1)
        .filter(|(_, token)| token.contains('.') && token.parse::<f64>().is_ok())
        .map(|(idx, _)| idx);

    let start_idx = float_indices.next()?;
    let duration_idx = float_indices.next()?;
    if duration_idx + 1 > text_end_idx {
        return None;
    }

    let start = tokens[start_idx].parse::<f64>().ok()?;
    let duration = tokens[duration_idx].parse::<f64>().ok()?;
    let text = normalize_text_line(&tokens[duration_idx + 1..text_end_idx].join(" "));
    if text.is_empty() {
        return None;
    }

    Some(WhisperSegment {
        speaker: Some(tokens[speaker_idx].to_string()),
        start,
        end: start + duration,
        text,
    })
}

fn extract_whisperkit_segments(stdout_text: &str) -> Vec<WhisperSegment> {
    let diarization_section = match stdout_text.find("---- Speaker Diarization Results ----") {
        Some(idx) => &stdout_text[idx..],
        None => return vec![],
    };

    diarization_section
        .lines()
        .map(str::trim)
        .filter(|line| line.starts_with("SPEAKER "))
        .filter_map(parse_whisperkit_diarization_line)
        .collect()
}

fn parse_whisperkit_stdout(stdout_bytes: &str) -> Transcript {
    let cleaned = strip_ansi_and_progress(stdout_bytes);
    let segments = extract_whisperkit_segments(&cleaned);
    let text = {
        let extracted = extract_whisperkit_transcription_text(&cleaned);
        if !extracted.is_empty() {
            extracted
        } else {
            segments
                .iter()
                .map(|segment| segment.text.as_str())
                .collect::<Vec<_>>()
                .join(" ")
        }
    };

    Transcript {
        status: "completed".to_string(),
        text,
        segments,
    }
}

fn format_ai_body(transcript: &Transcript) -> String {
    if transcript.segments.is_empty() {
        return normalize_text_line(&transcript.text);
    }

    let mut speaker_map: std::collections::HashMap<String, char> = std::collections::HashMap::new();
    let mut next_label = b'A';
    let mut blocks: Vec<(Option<String>, String)> = Vec::new();

    for segment in &transcript.segments {
        let cleaned = normalize_text_line(segment.text.trim());
        if cleaned.is_empty() {
            continue;
        }

        match blocks.last_mut() {
            Some((speaker, content)) if *speaker == segment.speaker => {
                if !content.is_empty() {
                    content.push(' ');
                }
                content.push_str(&cleaned);
            }
            _ => blocks.push((segment.speaker.clone(), cleaned)),
        }
    }

    blocks
        .into_iter()
        .map(|(speaker, content)| {
            let label = format_ai_speaker_label(&mut speaker_map, &speaker, &mut next_label);
            format!("**{}**\n{}", label, content)
        })
        .collect::<Vec<_>>()
        .join("\n\n")
}

fn render_audio_ai_markdown(
    audio_filename: &str,
    asr_engine: &str,
    transcript: &Transcript,
) -> String {
    let has_speaker = transcript
        .segments
        .iter()
        .any(|segment| segment.speaker.is_some());
    let body = format_ai_body(transcript);
    format!(
        "# 音频素材\n\n- 来源音频: {}\n- 转写引擎: {}\n- 语言: zh\n- 说话人分离: {}\n\n## 转写内容\n\n{}\n",
        audio_filename,
        asr_engine,
        if has_speaker { "是" } else { "否" },
        body,
    )
}

async fn transcribe_with_dashscope(
    app: &AppHandle,
    file_path: &Path,
    duration_secs: f64,
) -> Result<Transcript, String> {
    let filename = file_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    if duration_secs > 0.0 && duration_secs <= MIN_DURATION_SECS {
        let message = format!(
            "DashScope 文件转写仅支持大于 {:.0} 秒的音频",
            MIN_DURATION_SECS
        );
        save_transcript(app, file_path, "failed", &message);
        return Err(message);
    }

    let api_key = match config::load_config(app) {
        Ok(cfg) if !cfg.dashscope_api_key.is_empty() => cfg.dashscope_api_key,
        Ok(_) => {
            let message = "请先配置 DashScope API Key".to_string();
            save_transcript(app, file_path, "failed", &message);
            return Err(message);
        }
        Err(error) => {
            save_transcript(app, file_path, "failed", &error);
            return Err(error);
        }
    };

    let client = reqwest::Client::new();
    emit_progress(app, &filename, "uploading");

    let file_url = match upload_file(&client, &api_key, file_path).await {
        Ok(url) => url,
        Err(error) => {
            eprintln!("Upload failed: {}", error);
            let message = format!("上传失败: {}", error);
            save_transcript(app, file_path, "failed", &message);
            return Err(message);
        }
    };

    emit_progress(app, &filename, "transcribing");

    let task_id = match submit_transcription(&client, &api_key, &file_url).await {
        Ok(id) => id,
        Err(error) => {
            eprintln!("Submit failed: {}", error);
            let message = format!("提交失败: {}", error);
            save_transcript(app, file_path, "failed", &message);
            return Err(message);
        }
    };

    let transcription_url = match poll_task(&client, &api_key, &task_id, app, &filename).await {
        Ok(Some(url)) => url,
        Ok(None) => {
            let message = "未获取到转写结果".to_string();
            save_transcript(app, file_path, "failed", &message);
            return Err(message);
        }
        Err(error) => {
            eprintln!("Poll failed: {}", error);
            let message = format!("转写失败: {}", error);
            save_transcript(app, file_path, "failed", &message);
            return Err(message);
        }
    };

    let text = match fetch_transcription_text(&client, &transcription_url).await {
        Ok(value) => value,
        Err(error) => {
            let message = format!("获取转写文本失败: {}", error);
            save_transcript(app, file_path, "failed", &message);
            return Err(message);
        }
    };

    let transcript = Transcript {
        status: "completed".to_string(),
        text,
        segments: vec![],
    };
    save_transcript_data(file_path, &transcript);
    emit_progress(app, &filename, "completed");
    Ok(transcript)
}

/// Public entry point: start transcription in a background thread.
pub fn start_transcription(
    app: AppHandle,
    _filename: String,
    file_path: PathBuf,
    duration_secs: f64,
) {
    tauri::async_runtime::spawn(async move {
        let _ = transcribe_audio_to_ai_markdown(app, file_path, duration_secs).await;
    });
}

pub async fn transcribe_audio_to_ai_markdown(
    app: AppHandle,
    file_path: PathBuf,
    duration_secs: f64,
) -> Result<PathBuf, String> {
    let cfg = config::load_config(&app).inspect_err(|error| {
        save_transcript(&app, &file_path, "failed", error);
    })?;
    let asr_engine = cfg.asr_engine.clone();

    let transcript = if asr_engine == "whisperkit" {
        transcribe_with_whisperkit(app.clone(), file_path.clone(), cfg.whisperkit_model).await?
    } else {
        transcribe_with_dashscope(&app, &file_path, duration_secs).await?
    };

    let audio_filename = file_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let markdown = render_audio_ai_markdown(&audio_filename, &asr_engine, &transcript);
    let markdown_path = audio_ai_markdown_path_for_audio(file_path.as_path());

    std::fs::write(&markdown_path, markdown.as_bytes())
        .map_err(|e| format!("写入音频 AI markdown 失败: {}", e))?;

    Ok(markdown_path)
}

/// WhisperKit 转录：调用 whisperkit-cli sidecar，返回格式化 markdown 文本。
/// 同时将 diarized transcript 写入 sidecar 文件（供 UI 展示）。
pub async fn transcribe_with_whisperkit(
    app: AppHandle,
    file_path: PathBuf,
    model: String,
) -> Result<Transcript, String> {
    let filename = file_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    // 模型缓存目录：app_data_dir/whisperkit-models/
    let model_cache_dir = config::whisperkit_models_dir(&app)?;
    let _ = std::fs::create_dir_all(&model_cache_dir);

    // 找到 sidecar 二进制路径（bundle 模式用 Tauri resource 路径，dev 模式用 target/debug/）
    let cli_path = app
        .path()
        .resource_dir()
        .ok()
        .map(|d| {
            d.join("binaries")
                .join("whisperkit-cli-aarch64-apple-darwin")
        })
        .filter(|p| p.exists())
        .or_else(|| {
            let p = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("target/debug/whisperkit-cli");
            if p.exists() { Some(p) } else { None }
        })
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "whisperkit-cli".to_string());

    let _ = app.emit(
        "transcription-progress",
        serde_json::json!({
            "filename": filename, "status": "transcribing"
        }),
    );

    // 优先复用内置或已下载的模型目录；只有本机和应用资源里都不存在时才触发下载。
    let model_dir = config::find_whisperkit_model_dir(&app, &model);
    let cli_model = config::whisperkit_cli_model_name(&model);

    let mut cmd = Command::new(&cli_path);
    cmd.args([
        "transcribe",
        "--audio-path",
        file_path.to_str().unwrap_or(""),
        "--diarization",
        "--verbose",
        "--language",
        "zh",
    ]);
    if let Some(ref dir) = model_dir {
        cmd.args(["--model-path", dir.to_str().unwrap_or("")]);
    } else {
        cmd.args([
            "--download-model-path",
            model_cache_dir.to_str().unwrap_or(""),
            "--download-tokenizer-path",
            model_cache_dir.to_str().unwrap_or(""),
            "--model",
            &cli_model,
        ]);
    }

    use std::process::Stdio;
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("启动 whisperkit-cli 失败: {}", e))?;

    // 流式读取 stderr（whisperkit-cli 的进度/日志输出在 stderr）
    let stderr_handle = if let Some(stderr) = child.stderr.take() {
        let app_clone = app.clone();
        let fname = filename.clone();
        Some(tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                // whisperkit-cli 下载进度行格式举例：
                //   "Downloading model: 45.2 MB / 147.0 MB"
                //   "Initializing models..."
                //   "Starting transcription process..."
                let msg = if line.contains("Downloading") || line.contains("MB") {
                    line.clone()
                } else if line.contains("Initializing") {
                    "正在初始化模型…".to_string()
                } else if line.contains("Starting transcription") {
                    "正在转录…".to_string()
                } else {
                    continue;
                };
                let _ = app_clone.emit(
                    "transcription-progress",
                    serde_json::json!({
                        "filename": fname, "status": "transcribing", "message": msg
                    }),
                );
            }
        }))
    } else {
        None
    };

    // 收集 stdout（最终 JSON 输出）
    let stdout_bytes = if let Some(stdout) = child.stdout.take() {
        let mut reader = BufReader::new(stdout);
        let mut buf = String::new();
        use tokio::io::AsyncReadExt;
        reader.read_to_string(&mut buf).await.ok();
        buf
    } else {
        String::new()
    };

    let status = child.wait().await.map_err(|e| e.to_string())?;
    if let Some(h) = stderr_handle {
        let _ = h.await;
    }

    if !status.success() {
        save_transcript(&app, &file_path, "failed", "whisperkit 转录失败");
        return Err("whisperkit-cli 退出码非零".to_string());
    }

    let transcript = if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&stdout_bytes) {
        let segments: Vec<WhisperSegment> = parsed
            .get("segments")
            .and_then(|s| s.as_array())
            .map(|arr| {
                arr.iter()
                    .map(|item| WhisperSegment {
                        speaker: item
                            .get("speaker")
                            .and_then(|v| v.as_str())
                            .map(String::from),
                        start: item.get("start").and_then(|v| v.as_f64()).unwrap_or(0.0),
                        end: item.get("end").and_then(|v| v.as_f64()).unwrap_or(0.0),
                        text: item
                            .get("text")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string(),
                    })
                    .collect()
            })
            .unwrap_or_default();
        let text = segments
            .iter()
            .map(|segment| segment.text.trim())
            .collect::<Vec<_>>()
            .join(" ");
        Transcript {
            status: "completed".to_string(),
            text,
            segments,
        }
    } else {
        parse_whisperkit_stdout(&stdout_bytes)
    };
    save_transcript_data(&file_path, &transcript);

    let _ = app.emit(
        "transcription-progress",
        serde_json::json!({
            "filename": filename, "status": "completed"
        }),
    );

    Ok(transcript)
}

#[tauri::command]
pub fn get_transcript(app: AppHandle, path: String) -> Result<Option<Transcript>, String> {
    let file_path = resolve_audio_path(&app, &path)?;
    let json_path = transcript_json_path_for_audio(file_path.as_path());
    if !json_path.exists() {
        return Ok(None);
    }
    let data = std::fs::read_to_string(&json_path).map_err(|e| e.to_string())?;
    let t: Transcript = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    Ok(Some(t))
}

#[tauri::command]
pub fn retry_transcription(app: AppHandle, path: String) -> Result<(), String> {
    let file_path = resolve_audio_path(&app, &path)?;
    if !file_path.exists() {
        return Err(format!("文件不存在: {}", path));
    }
    let filename = file_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let duration = crate::recordings::read_duration_pub(&file_path);
    start_transcription(app, filename, file_path, duration);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_segments_as_markdown_basic() {
        let segments = vec![
            WhisperSegment {
                speaker: Some("SPEAKER_00".into()),
                start: 0.0,
                end: 3.0,
                text: "大家好".into(),
            },
            WhisperSegment {
                speaker: Some("SPEAKER_01".into()),
                start: 3.5,
                end: 7.0,
                text: "你好".into(),
            },
        ];
        let md = format_diarized_markdown(&segments);
        assert!(
            md.contains("**Speaker A**"),
            "should map SPEAKER_00 to Speaker A"
        );
        assert!(
            md.contains("**Speaker B**"),
            "should map SPEAKER_01 to Speaker B"
        );
        assert!(md.contains("(0:00)"), "should format start time");
        assert!(md.contains("大家好"));
        assert!(md.contains("你好"));
    }

    #[test]
    fn format_segments_merges_adjacent_same_speaker() {
        let segments = vec![
            WhisperSegment {
                speaker: Some("SPEAKER_00".into()),
                start: 0.0,
                end: 2.0,
                text: "第一句".into(),
            },
            WhisperSegment {
                speaker: Some("SPEAKER_00".into()),
                start: 2.1,
                end: 4.0,
                text: "第二句".into(),
            },
            WhisperSegment {
                speaker: Some("SPEAKER_01".into()),
                start: 4.5,
                end: 6.0,
                text: "回应".into(),
            },
        ];
        let md = format_diarized_markdown(&segments);
        // SPEAKER_00 header should appear only once
        let count = md.matches("**Speaker A**").count();
        assert_eq!(count, 1, "adjacent same-speaker segments should be merged");
    }

    #[test]
    fn format_segments_time_format() {
        let segments = vec![WhisperSegment {
            speaker: Some("SPEAKER_00".into()),
            start: 65.0,
            end: 70.0,
            text: "一分钟后".into(),
        }];
        let md = format_diarized_markdown(&segments);
        assert!(md.contains("(1:05)"), "65 seconds should format as 1:05");
    }

    #[test]
    fn format_segments_no_speaker_fallback() {
        let segments = vec![WhisperSegment {
            speaker: None,
            start: 0.0,
            end: 2.0,
            text: "无说话人".into(),
        }];
        let md = format_diarized_markdown(&segments);
        assert!(
            md.contains("无说话人"),
            "text should be present even without speaker"
        );
    }

    #[test]
    fn parse_whisperkit_stdout_strips_runtime_noise_and_keeps_transcript() {
        let raw = r#"Starting transcription process...
Resolved audio paths:
- /tmp/test.m4a
Initializing models...
Processing transcription result for: /tmp/test.m4a
Transcription of test.m4a: 喂喂喂 你好 现在测试录音
Preparing diarization models...
"#;

        let transcript = parse_whisperkit_stdout(raw);
        assert_eq!(transcript.text, "喂喂喂 你好 现在测试录音");
        assert!(transcript.segments.is_empty());
    }

    #[test]
    fn parse_whisperkit_stdout_extracts_diarization_segments() {
        let raw = r#"Transcription of test.m4a: 喂喂喂 你好 现在测试录音
---- Speaker Diarization Results ----
SPEAKER test 1 5.200 6.000 喂喂喂 你好 <NA> A <NA> <NA>
SPEAKER test 1 12.000 4.500 现在测试录音 <NA> B <NA> <NA>
"#;

        let transcript = parse_whisperkit_stdout(raw);
        assert_eq!(transcript.text, "喂喂喂 你好 现在测试录音");
        assert_eq!(transcript.segments.len(), 2);
        assert_eq!(transcript.segments[0].speaker.as_deref(), Some("A"));
        assert_eq!(transcript.segments[0].start, 5.2);
        assert_eq!(transcript.segments[0].end, 11.2);
        assert_eq!(transcript.segments[0].text, "喂喂喂 你好");
        assert_eq!(transcript.segments[1].speaker.as_deref(), Some("B"));
        assert_eq!(transcript.segments[1].text, "现在测试录音");
    }
}
