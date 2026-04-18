use crate::config;
use crate::config::Config;
use crate::speaker_profiles;
use async_trait::async_trait;
use base64::Engine as _;
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use futures::stream::StreamExt;
use futures::SinkExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{Read as IoRead, Write as IoWrite};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio_tungstenite::tungstenite;

const DASHSCOPE_CHAT_URL: &str =
    "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeakerSegment {
    pub label: String,
    pub start: f64,
    pub end: f64,
}

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
    /// Which speech engine produced this transcript (e.g. "speech_analyzer", "sf_speech_recognizer", "whisperkit", "dashscope")
    #[serde(default)]
    pub engine: Option<String>,
}

// ── ASR Engine trait ──────────────────────────────────────────────

pub struct AsrInput {
    pub app: AppHandle,
    pub file_path: PathBuf,
    pub duration_secs: f64,
    pub speaker_segments: Vec<SpeakerSegment>,
}

#[async_trait]
pub trait AsrEngine: Send + Sync {
    fn name(&self) -> &'static str;
    #[allow(dead_code)]
    fn has_timestamps(&self) -> bool;
    async fn transcribe(&self, input: &AsrInput) -> Result<Transcript, String>;
}

struct AppleSttEngine;
struct WhisperKitEngine {
    model: String,
}
struct DashScopeEngine;
struct VolcengineEngine {
    api_key: String,
    resource_id: String,
}
struct ZhipuEngine {
    api_key: String,
}

#[async_trait]
impl AsrEngine for AppleSttEngine {
    fn name(&self) -> &'static str {
        "apple"
    }
    fn has_timestamps(&self) -> bool {
        true
    }
    async fn transcribe(&self, input: &AsrInput) -> Result<Transcript, String> {
        transcribe_with_apple_stt(
            input.app.clone(),
            input.file_path.clone(),
            input.duration_secs,
        )
        .await
    }
}

#[async_trait]
impl AsrEngine for WhisperKitEngine {
    fn name(&self) -> &'static str {
        "whisperkit"
    }
    fn has_timestamps(&self) -> bool {
        true
    }
    async fn transcribe(&self, input: &AsrInput) -> Result<Transcript, String> {
        transcribe_with_whisperkit(
            input.app.clone(),
            input.file_path.clone(),
            self.model.clone(),
        )
        .await
    }
}

#[async_trait]
impl AsrEngine for DashScopeEngine {
    fn name(&self) -> &'static str {
        "dashscope"
    }
    fn has_timestamps(&self) -> bool {
        false
    }
    async fn transcribe(&self, input: &AsrInput) -> Result<Transcript, String> {
        transcribe_with_dashscope(&input.app, &input.file_path, input.duration_secs).await
    }
}

#[async_trait]
impl AsrEngine for VolcengineEngine {
    fn name(&self) -> &'static str {
        "volcengine"
    }
    fn has_timestamps(&self) -> bool {
        true
    }
    async fn transcribe(&self, input: &AsrInput) -> Result<Transcript, String> {
        transcribe_with_volcengine(
            &input.app,
            &input.file_path,
            input.duration_secs,
            &self.api_key,
            &self.resource_id,
        )
        .await
    }
}

#[async_trait]
impl AsrEngine for ZhipuEngine {
    fn name(&self) -> &'static str {
        "zhipu"
    }
    fn has_timestamps(&self) -> bool {
        false
    }
    async fn transcribe(&self, input: &AsrInput) -> Result<Transcript, String> {
        transcribe_with_zhipu(
            &input.app,
            &input.file_path,
            input.duration_secs,
            &self.api_key,
            &input.speaker_segments,
        )
        .await
    }
}

fn create_asr_engine(cfg: &Config) -> Box<dyn AsrEngine> {
    match cfg.asr_engine.as_str() {
        "apple" => Box::new(AppleSttEngine),
        "whisperkit" => Box::new(WhisperKitEngine {
            model: cfg.whisperkit_model.clone(),
        }),
        "volcengine" => Box::new(VolcengineEngine {
            api_key: cfg.volcengine_asr_api_key.clone(),
            resource_id: cfg.volcengine_asr_resource_id.clone(),
        }),
        "zhipu" => Box::new(ZhipuEngine {
            api_key: cfg.zhipu_asr_api_key.clone(),
        }),
        _ => Box::new(DashScopeEngine),
    }
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
        engine: None,
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
            // Only canonicalise machine-generated SpeakerKit IDs (SPEAKER_00, SPEAKER_01, …).
            // 5-digit speaker IDs (from speaker profiles) and profile names ("张三", "说话人 2", etc.)
            // are passed through as-is so user-assigned names are preserved.
            if sp.starts_with("SPEAKER_") {
                let label = speaker_map.entry(sp.clone()).or_insert_with(|| {
                    let current = *next_label as char;
                    *next_label += 1;
                    current
                });
                format!("发言人 {}", label)
            } else {
                sp.clone()
            }
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
        let sep_idx = [
            "m4a: ", "mp4: ", "wav: ", "mp3: ", "aac: ", "ogg: ", "flac: ",
        ]
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
        engine: None,
    }
}

/// 将词级别的 segments 合并为句子级别。
/// SFSpeechRecognizer 返回的每个 segment 只有一两个词，没有标点。
/// 合并策略：当两个相邻词之间的时间间隔 > PAUSE_THRESHOLD 秒时断句，
/// 并在中文句尾添加句号。
fn merge_word_segments_to_sentences(segments: &[WhisperSegment]) -> Vec<WhisperSegment> {
    if segments.is_empty() {
        return vec![];
    }

    const PAUSE_THRESHOLD: f64 = 0.7; // 停顿超过 0.7 秒视为句子边界

    let mut result: Vec<WhisperSegment> = Vec::new();
    let mut current_text = String::new();
    let mut current_start = segments[0].start;
    let mut current_end = segments[0].end;
    let mut current_speaker = segments[0].speaker.clone();

    for (i, seg) in segments.iter().enumerate() {
        let gap = if i > 0 {
            seg.start - segments[i - 1].end
        } else {
            0.0
        };
        let speaker_changed = seg.speaker != current_speaker;

        if i > 0 && (gap > PAUSE_THRESHOLD || speaker_changed) {
            // 断句：保存当前累积的句子
            let text = finalize_sentence_text(&current_text);
            result.push(WhisperSegment {
                speaker: current_speaker.clone(),
                start: current_start,
                end: current_end,
                text,
            });
            current_text.clear();
            current_start = seg.start;
            current_speaker = seg.speaker.clone();
        }

        // CJK 文本之间不加空格
        if !current_text.is_empty() {
            let needs_space = !ends_with_cjk(&current_text) || !starts_with_cjk(seg.text.trim());
            if needs_space {
                current_text.push(' ');
            }
        }
        current_text.push_str(seg.text.trim());
        current_end = seg.end;
    }

    // 最后一个句子
    if !current_text.is_empty() {
        let text = finalize_sentence_text(&current_text);
        result.push(WhisperSegment {
            speaker: current_speaker,
            start: current_start,
            end: current_end,
            text,
        });
    }

    result
}

/// 给句子末尾添加标点（如果还没有的话）
fn finalize_sentence_text(text: &str) -> String {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    let last_char = trimmed.chars().last().unwrap();
    // 已有标点则不添加
    if "。！？.!?，,、；;：:…".contains(last_char) {
        return trimmed.to_string();
    }
    // 末尾是 CJK 字符 → 加中文句号，否则加英文句号
    if is_cjk(last_char) {
        format!("{}。", trimmed)
    } else {
        format!("{}.", trimmed)
    }
}

/// 判断字符是否为 CJK（中日韩）字符
fn is_cjk(c: char) -> bool {
    matches!(c,
        '\u{4E00}'..='\u{9FFF}'   // CJK Unified Ideographs
        | '\u{3400}'..='\u{4DBF}' // CJK Extension A
        | '\u{3000}'..='\u{303F}' // CJK Symbols and Punctuation
        | '\u{FF00}'..='\u{FFEF}' // Fullwidth Forms
        | '\u{3040}'..='\u{309F}' // Hiragana
        | '\u{30A0}'..='\u{30FF}' // Katakana
    )
}

fn ends_with_cjk(s: &str) -> bool {
    s.chars().last().is_some_and(is_cjk)
}

fn starts_with_cjk(s: &str) -> bool {
    s.chars().next().is_some_and(is_cjk)
}

fn format_ai_body(transcript: &Transcript) -> String {
    if transcript.segments.is_empty() {
        return normalize_text_line(&transcript.text);
    }

    // 检查是否所有 segments 文本为空（DashScope + SpeakerKit 场景：有说话人时间段但无分段文本）
    let all_text_empty = transcript.segments.iter().all(|s| s.text.trim().is_empty());
    if all_text_empty {
        return format_speaker_timeline_with_text(transcript);
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
                    let needs_space = !ends_with_cjk(content) || !starts_with_cjk(&cleaned);
                    if needs_space {
                        content.push(' ');
                    }
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

/// DashScope 等引擎只有纯文本 + SpeakerKit 说话人时间段（无分段文本）时，
/// 输出说话人时间线 + 完整转写文本。
fn format_speaker_timeline_with_text(transcript: &Transcript) -> String {
    let mut speaker_map: std::collections::HashMap<String, char> = std::collections::HashMap::new();
    let mut next_label = b'A';

    // 合并相邻同说话人段落
    let mut blocks: Vec<(Option<String>, f64, f64)> = Vec::new();
    for seg in &transcript.segments {
        match blocks.last_mut() {
            Some((speaker, _start, end)) if *speaker == seg.speaker => {
                *end = seg.end;
            }
            _ => blocks.push((seg.speaker.clone(), seg.start, seg.end)),
        }
    }

    let fmt_time = |secs: f64| -> String {
        let total = secs as u64;
        let m = total / 60;
        let s = total % 60;
        format!("{}:{:02}", m, s)
    };

    let timeline: Vec<String> = blocks
        .into_iter()
        .map(|(speaker, start, end)| {
            let label = format_ai_speaker_label(&mut speaker_map, &speaker, &mut next_label);
            format!("**{}** ({} – {})", label, fmt_time(start), fmt_time(end))
        })
        .collect();

    let full_text = normalize_text_line(&transcript.text);
    format!("{}\n\n{}", timeline.join("\n"), full_text)
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
    // 显示实际使用的底层引擎（如 speech_analyzer / sf_speech_recognizer）
    let engine_display = match &transcript.engine {
        Some(e) => format!("{} ({})", asr_engine, e),
        None => asr_engine.to_string(),
    };
    format!(
        "# 音频素材\n\n- 来源音频: {}\n- 转写引擎: {}\n- 语言: zh\n- 说话人分离: {}\n\n## 转写内容\n\n{}\n",
        audio_filename,
        engine_display,
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

    let cfg = config::load_config(app).inspect_err(|e| {
        save_transcript(app, file_path, "failed", e);
    })?;

    if cfg.dashscope_api_key.is_empty() {
        let message = "请先配置 DashScope API Key".to_string();
        save_transcript(app, file_path, "failed", &message);
        return Err(message);
    }

    // DashScope 文件转写 API 要求音频 > 30s
    if duration_secs > 0.0 && duration_secs < 30.0 {
        let msg = format!(
            "DashScope 不支持 {:.0}s 以下的音频（最短 30s），请切换其他引擎",
            duration_secs
        );
        save_transcript(app, file_path, "failed", &msg);
        return Err(msg);
    }

    let model = if cfg.dashscope_asr_model.is_empty() {
        "qwen3-asr-flash".to_string()
    } else {
        cfg.dashscope_asr_model.clone()
    };

    emit_progress(app, &filename, "transcribing");

    // Read audio file and encode as base64 data URI
    let file_bytes = fs::read(file_path).map_err(|e| {
        let msg = format!("读取音频文件失败: {}", e);
        save_transcript(app, file_path, "failed", &msg);
        msg
    })?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&file_bytes);
    let mime = audio_mime_type(file_path);
    let data_uri = format!("data:{};base64,{}", mime, b64);

    // Call OpenAI-compatible chat completions API
    let body = serde_json::json!({
        "model": model,
        "messages": [{
            "role": "user",
            "content": [{
                "type": "input_audio",
                "input_audio": {
                    "data": data_uri
                }
            }]
        }],
        "stream": false
    });

    let timeout_secs = (duration_secs * 5.0).max(300.0) as u64;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .unwrap_or_default();
    let resp = client
        .post(DASHSCOPE_CHAT_URL)
        .header("Authorization", format!("Bearer {}", cfg.dashscope_api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            let msg = format!("DashScope ASR 请求失败: {}", e);
            save_transcript(app, file_path, "failed", &msg);
            msg
        })?;

    if !resp.status().is_success() {
        let status = resp.status();
        let resp_body = resp.text().await.unwrap_or_default();
        let msg = format!("DashScope ASR 失败 ({}): {}", status, resp_body);
        save_transcript(app, file_path, "failed", &msg);
        return Err(msg);
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| {
        let msg = format!("解析 DashScope 响应失败: {}", e);
        save_transcript(app, file_path, "failed", &msg);
        msg
    })?;

    let text = data
        .get("choices")
        .and_then(|c| c.as_array())
        .and_then(|arr| arr.first())
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    if text.is_empty() {
        let msg = "DashScope ASR 返回空文本".to_string();
        save_transcript(app, file_path, "failed", &msg);
        return Err(msg);
    }

    let transcript = Transcript {
        status: "completed".to_string(),
        text,
        segments: vec![],
        engine: Some("dashscope".to_string()),
    };
    save_transcript_data(file_path, &transcript);
    emit_progress(app, &filename, "completed");
    Ok(transcript)
}

// ── Volcengine ASR (火山方舟) ─────────────────────────────────────

async fn transcribe_with_volcengine(
    app: &AppHandle,
    file_path: &Path,
    duration_secs: f64,
    api_key: &str,
    resource_id: &str,
) -> Result<Transcript, String> {
    let filename = file_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    if api_key.is_empty() {
        let msg = "请先配置火山引擎 ASR API Key".to_string();
        save_transcript(app, file_path, "failed", &msg);
        return Err(msg);
    }

    emit_progress(app, &filename, "transcribing");

    // Convert audio to WAV PCM s16le 16kHz mono for the streaming API
    let wav_tmp = std::env::temp_dir().join(format!(
        "volc_pcm_{}.wav",
        file_path.file_stem().unwrap_or_default().to_string_lossy()
    ));
    let af_status = tokio::process::Command::new("afconvert")
        .args([
            "-d",
            "LEI16",
            "-f",
            "WAVE",
            "-c",
            "1",
            "-r",
            "16000",
            &file_path.to_string_lossy(),
            &wav_tmp.to_string_lossy(),
        ])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .await
        .map_err(|e| {
            let msg = format!("音频转换失败: {}", e);
            save_transcript(app, file_path, "failed", &msg);
            msg
        })?;
    if !af_status.success() {
        let msg = "afconvert 转换 WAV 失败".to_string();
        save_transcript(app, file_path, "failed", &msg);
        return Err(msg);
    }

    let pcm_bytes = fs::read(&wav_tmp).map_err(|e| {
        let msg = format!("读取 WAV 文件失败: {}", e);
        save_transcript(app, file_path, "failed", &msg);
        msg
    })?;
    let _ = fs::remove_file(&wav_tmp);

    // Parse WAV header to find actual data chunk offset (handles non-standard headers with LIST/INFO chunks)
    let pcm_data_owned;
    let pcm_data = {
        let mut cursor = std::io::Cursor::new(&pcm_bytes);
        let data_offset = find_wav_data_offset(&mut cursor).unwrap_or(44);
        pcm_data_owned = if pcm_bytes.len() > data_offset {
            pcm_bytes[data_offset..].to_vec()
        } else {
            pcm_bytes.clone()
        };
        &pcm_data_owned[..]
    };

    // Map file-API resource IDs to streaming equivalents
    let stream_resource_id = match resource_id {
        "volc.bigasr.auc" => "volc.bigasr.sauc.duration",
        _ => "volc.seedasr.sauc.duration",
    };

    let connect_id = uuid::Uuid::new_v4().to_string();
    let ws_url = "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream";

    let request = tungstenite::http::Request::builder()
        .uri(ws_url)
        .header("Host", "openspeech.bytedance.com")
        .header("X-Api-Key", api_key)
        .header("X-Api-Resource-Id", stream_resource_id)
        .header("X-Api-Connect-Id", &connect_id)
        .header(
            "Sec-WebSocket-Key",
            tungstenite::handshake::client::generate_key(),
        )
        .header("Sec-WebSocket-Version", "13")
        .header("Connection", "Upgrade")
        .header("Upgrade", "websocket")
        .body(())
        .map_err(|e| {
            let msg = format!("构建 WebSocket 请求失败: {}", e);
            save_transcript(app, file_path, "failed", &msg);
            msg
        })?;

    let (mut ws, _) = tokio_tungstenite::connect_async(request)
        .await
        .map_err(|e| {
            let msg = format!("火山 ASR WebSocket 连接失败: {}", e);
            save_transcript(app, file_path, "failed", &msg);
            msg
        })?;

    // Step 1: Send full client request
    let payload_json = serde_json::json!({
        "user": { "uid": "journal-app" },
        "audio": {
            "format": "pcm",
            "rate": 16000,
            "bits": 16,
            "channel": 1,
            "language": "zh-CN"
        },
        "request": {
            "model_name": "bigmodel",
            "enable_itn": true,
            "enable_punc": true,
            "show_utterances": true,
            "result_type": "full"
        }
    });
    let json_bytes = serde_json::to_vec(&payload_json).unwrap();
    let compressed = volc_gzip_compress(&json_bytes);

    // Header: version=1, header_size=1, msg_type=0001(full_client_req), flags=0000, serial=0001(JSON), compress=0001(gzip), reserved=0x00
    let header: [u8; 4] = [0x11, 0x10, 0x11, 0x00];
    let mut frame = Vec::with_capacity(4 + 4 + compressed.len());
    frame.extend_from_slice(&header);
    frame.extend_from_slice(&(compressed.len() as u32).to_be_bytes());
    frame.extend_from_slice(&compressed);

    ws.send(tungstenite::Message::Binary(frame))
        .await
        .map_err(|e| {
            let msg = format!("发送 full client request 失败: {}", e);
            save_transcript(app, file_path, "failed", &msg);
            msg
        })?;

    // Read initial server response
    volc_read_response(&mut ws).await.inspect_err(|e| {
        save_transcript(app, file_path, "failed", e);
    })?;

    // Step 2: Send audio chunks (200ms each = 6400 bytes at 16kHz 16bit mono)
    let chunk_size = 6400;
    let total_chunks = pcm_data.len().div_ceil(chunk_size);

    for (i, chunk) in pcm_data.chunks(chunk_size).enumerate() {
        let is_last = i == total_chunks - 1;
        let compressed_audio = volc_gzip_compress(chunk);

        // Header: version=1, header_size=1, msg_type=0010(audio_only), flags, serial=0000(none), compress=0001(gzip), reserved=0x00
        let flags = if is_last { 0x02 } else { 0x00 }; // 0b0010 = last packet
        let audio_header: [u8; 4] = [0x11, 0x20 | flags, 0x01, 0x00];
        let mut audio_frame = Vec::with_capacity(4 + 4 + compressed_audio.len());
        audio_frame.extend_from_slice(&audio_header);
        audio_frame.extend_from_slice(&(compressed_audio.len() as u32).to_be_bytes());
        audio_frame.extend_from_slice(&compressed_audio);

        ws.send(tungstenite::Message::Binary(audio_frame))
            .await
            .map_err(|e| {
                let msg = format!("发送音频数据失败: {}", e);
                save_transcript(app, file_path, "failed", &msg);
                msg
            })?;

        // Small delay between chunks to avoid overwhelming the server
        if !is_last {
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
    }

    // Step 3: Read responses until we get the final one
    let timeout = compute_stt_timeout(duration_secs);
    let deadline = tokio::time::Instant::now() + timeout;
    let mut final_text = String::new();
    let mut final_utterances: Vec<WhisperSegment> = vec![];

    loop {
        let resp = tokio::time::timeout_at(deadline, volc_read_response(&mut ws)).await;
        match resp {
            Ok(Ok(payload)) => {
                let is_final = payload.0;
                if let Some(data) = payload.1 {
                    if let Some(text) = data.pointer("/result/text").and_then(|v| v.as_str()) {
                        final_text = text.to_string();
                    }
                    if let Some(arr) = data
                        .pointer("/result/utterances")
                        .and_then(|v| v.as_array())
                    {
                        final_utterances = arr
                            .iter()
                            .filter(|u| {
                                u.get("definite").and_then(|v| v.as_bool()).unwrap_or(false)
                            })
                            .map(|u| WhisperSegment {
                                speaker: None,
                                start: u.get("start_time").and_then(|v| v.as_f64()).unwrap_or(0.0)
                                    / 1000.0,
                                end: u.get("end_time").and_then(|v| v.as_f64()).unwrap_or(0.0)
                                    / 1000.0,
                                text: u
                                    .get("text")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("")
                                    .to_string(),
                            })
                            .collect();
                    }
                }
                if is_final {
                    break;
                }
            }
            Ok(Err(e)) => {
                let _ = ws.close(None).await;
                save_transcript(app, file_path, "failed", &e);
                return Err(e);
            }
            Err(_) => {
                let msg = "火山 ASR 超时".to_string();
                let _ = ws.close(None).await;
                save_transcript(app, file_path, "failed", &msg);
                return Err(msg);
            }
        }
    }

    let _ = ws.close(None).await;

    let transcript = Transcript {
        status: "completed".to_string(),
        text: final_text,
        segments: final_utterances,
        engine: Some("volcengine".to_string()),
    };
    save_transcript_data(file_path, &transcript);
    emit_progress(app, &filename, "completed");
    Ok(transcript)
}

/// Parse a WAV file's RIFF chunks to find the byte offset of the `data` chunk payload.
/// Falls back to 44 (standard header size) if parsing fails.
fn find_wav_data_offset(cursor: &mut std::io::Cursor<&Vec<u8>>) -> Option<usize> {
    use std::io::{Read, Seek, SeekFrom};
    let mut tag = [0u8; 4];
    cursor.seek(SeekFrom::Start(12)).ok()?; // skip RIFF(4) + size(4) + WAVE(4)
    loop {
        cursor.read_exact(&mut tag).ok()?;
        let mut size_buf = [0u8; 4];
        cursor.read_exact(&mut size_buf).ok()?;
        let chunk_size = u32::from_le_bytes(size_buf) as u64;
        if &tag == b"data" {
            return Some(cursor.stream_position().ok()? as usize);
        }
        cursor.seek(SeekFrom::Current(chunk_size as i64)).ok()?;
    }
}

fn volc_gzip_compress(data: &[u8]) -> Vec<u8> {    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(data).unwrap();
    encoder.finish().unwrap()
}

fn volc_gzip_decompress(data: &[u8]) -> Result<Vec<u8>, String> {
    let mut decoder = GzDecoder::new(data);
    let mut out = Vec::new();
    decoder
        .read_to_end(&mut out)
        .map_err(|e| format!("gzip 解压失败: {}", e))?;
    Ok(out)
}

type VolcWs =
    tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>;

/// Returns (is_final, Option<json_payload>)
async fn volc_read_response(ws: &mut VolcWs) -> Result<(bool, Option<serde_json::Value>), String> {
    loop {
        let msg = ws
            .next()
            .await
            .ok_or_else(|| "WebSocket 连接意外关闭".to_string())?
            .map_err(|e| format!("WebSocket 读取失败: {}", e))?;

        match msg {
            tungstenite::Message::Binary(data) => {
                if data.len() < 4 {
                    return Err("火山 ASR 响应帧过短".to_string());
                }
                let msg_type = (data[1] >> 4) & 0x0F;
                let msg_flags = data[1] & 0x0F;
                let compression = data[2] & 0x0F;

                // Error message (msg_type = 0b1111)
                if msg_type == 0x0F {
                    let error_code = if data.len() >= 8 {
                        u32::from_be_bytes([data[4], data[5], data[6], data[7]])
                    } else {
                        0
                    };
                    let error_msg = if data.len() > 12 {
                        let msg_size =
                            u32::from_be_bytes([data[8], data[9], data[10], data[11]]) as usize;
                        let msg_bytes = &data[12..12 + msg_size.min(data.len() - 12)];
                        String::from_utf8_lossy(msg_bytes).to_string()
                    } else {
                        "unknown".to_string()
                    };
                    return Err(format!("火山 ASR 错误 ({}): {}", error_code, error_msg));
                }

                // Full server response (msg_type = 0b1001)
                if msg_type == 0x09 {
                    let is_final = msg_flags == 0x03 || msg_flags == 0x02;
                    // Header(4) + sequence(4) + payload_size(4) + payload
                    if data.len() < 12 {
                        return Ok((is_final, None));
                    }
                    let payload_size =
                        u32::from_be_bytes([data[8], data[9], data[10], data[11]]) as usize;
                    if payload_size == 0 {
                        return Ok((is_final, None));
                    }
                    let payload_bytes = &data[12..12 + payload_size.min(data.len() - 12)];
                    let json_bytes = if compression == 0x01 {
                        volc_gzip_decompress(payload_bytes)?
                    } else {
                        payload_bytes.to_vec()
                    };
                    let json: serde_json::Value = serde_json::from_slice(&json_bytes)
                        .map_err(|e| format!("解析火山 ASR JSON 失败: {}", e))?;
                    return Ok((is_final, Some(json)));
                }

                // Other message types — skip
            }
            tungstenite::Message::Close(_) => {
                return Err("火山 ASR WebSocket 被服务端关闭".to_string());
            }
            _ => continue, // ping/pong/text — ignore
        }
    }
}

// ── Zhipu ASR (智谱) ─────────────────────────────────────────────

const ZHIPU_ASR_URL: &str = "https://open.bigmodel.cn/api/paas/v4/audio/transcriptions";
const ZHIPU_MAX_CHUNK_SECS: f64 = 28.0;

fn chunk_segments_by_duration(segments: &[SpeakerSegment], max_secs: f64) -> Vec<(f64, f64)> {
    if segments.is_empty() {
        return vec![];
    }
    let mut chunks = vec![];
    let mut chunk_start = segments[0].start;
    let mut chunk_end = segments[0].end;

    for seg in &segments[1..] {
        if seg.end - chunk_start > max_secs {
            chunks.push((chunk_start, chunk_end));
            chunk_start = seg.start;
            chunk_end = seg.end;
        } else {
            chunk_end = seg.end;
        }
    }
    chunks.push((chunk_start, chunk_end));
    chunks
}

fn chunk_fixed_duration(total_secs: f64, max_secs: f64) -> Vec<(f64, f64)> {
    let mut chunks = vec![];
    let mut start = 0.0;
    while start < total_secs {
        let end = (start + max_secs).min(total_secs);
        chunks.push((start, end));
        start = end;
    }
    chunks
}

async fn extract_audio_slice(source: &Path, start: f64, end: f64) -> Result<PathBuf, String> {
    let duration = end - start;
    let tmp = std::env::temp_dir().join(format!(
        "zhipu_chunk_{}_{:.0}_{:.0}.wav",
        source.file_stem().unwrap_or_default().to_string_lossy(),
        start * 1000.0,
        end * 1000.0
    ));

    let status = tokio::process::Command::new("ffmpeg")
        .args([
            "-y",
            "-ss",
            &format!("{:.3}", start),
            "-t",
            &format!("{:.3}", duration),
            "-i",
            &source.to_string_lossy(),
            "-ar",
            "16000",
            "-ac",
            "1",
            "-f",
            "wav",
            &tmp.to_string_lossy(),
        ])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .await
        .map_err(|e| format!("ffmpeg 切片失败: {}", e))?;

    if !status.success() {
        // fallback: afconvert (macOS built-in) — convert whole file then trim with hound
        let wav_tmp = std::env::temp_dir().join(format!(
            "zhipu_full_{}.wav",
            source.file_stem().unwrap_or_default().to_string_lossy()
        ));
        let af_status = tokio::process::Command::new("afconvert")
            .args([
                "-d",
                "LEI16",
                "-f",
                "WAVE",
                "-c",
                "1",
                &source.to_string_lossy(),
                &wav_tmp.to_string_lossy(),
            ])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .await
            .map_err(|e| format!("afconvert 失败: {}", e))?;

        if !af_status.success() {
            return Err("无法转换音频格式（ffmpeg 和 afconvert 均失败）".to_string());
        }

        let reader =
            hound::WavReader::open(&wav_tmp).map_err(|e| format!("读取 WAV 失败: {}", e))?;
        let spec = reader.spec();
        let sample_rate = spec.sample_rate as f64;
        let start_sample = (start * sample_rate) as usize;
        let end_sample = (end * sample_rate) as usize;

        let all_samples: Vec<i16> = reader
            .into_samples::<i16>()
            .filter_map(|s| s.ok())
            .collect();

        let slice =
            &all_samples[start_sample.min(all_samples.len())..end_sample.min(all_samples.len())];

        let mut writer = hound::WavWriter::create(&tmp, spec)
            .map_err(|e| format!("创建 WAV 切片失败: {}", e))?;
        for &s in slice {
            writer
                .write_sample(s)
                .map_err(|e| format!("写入 WAV 样本失败: {}", e))?;
        }
        writer
            .finalize()
            .map_err(|e| format!("完成 WAV 切片失败: {}", e))?;

        let _ = std::fs::remove_file(&wav_tmp);
    }

    Ok(tmp)
}

async fn transcribe_with_zhipu(
    app: &AppHandle,
    file_path: &Path,
    duration_secs: f64,
    api_key: &str,
    speaker_segments: &[SpeakerSegment],
) -> Result<Transcript, String> {
    let filename = file_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    if api_key.is_empty() {
        let msg = "请先配置智谱 ASR API Key".to_string();
        save_transcript(app, file_path, "failed", &msg);
        return Err(msg);
    }

    emit_progress(app, &filename, "transcribing");

    // Determine chunks based on 30s limit
    let chunks = if !speaker_segments.is_empty() {
        chunk_segments_by_duration(speaker_segments, ZHIPU_MAX_CHUNK_SECS)
    } else {
        chunk_fixed_duration(duration_secs, ZHIPU_MAX_CHUNK_SECS)
    };

    // Short audio (≤30s): send directly without slicing
    if chunks.len() <= 1 && duration_secs <= 30.0 {
        let text = zhipu_transcribe_file(app, file_path, api_key).await?;
        let transcript = Transcript {
            status: "completed".to_string(),
            text,
            segments: vec![],
            engine: Some("zhipu".to_string()),
        };
        save_transcript_data(file_path, &transcript);
        emit_progress(app, &filename, "completed");
        return Ok(transcript);
    }

    // Long audio: slice and transcribe each chunk
    let mut all_text = String::new();
    let total = chunks.len();
    for (i, (start, end)) in chunks.iter().enumerate() {
        eprintln!(
            "[zhipu] transcribing chunk {}/{} ({:.1}s-{:.1}s)",
            i + 1,
            total,
            start,
            end
        );
        let chunk_path = extract_audio_slice(file_path, *start, *end).await?;
        match zhipu_transcribe_file(app, &chunk_path, api_key).await {
            Ok(text) => {
                if !all_text.is_empty() && !text.is_empty() {
                    all_text.push(' ');
                }
                all_text.push_str(&text);
            }
            Err(e) => {
                eprintln!("[zhipu] chunk {}/{} failed: {}", i + 1, total, e);
            }
        }
        let _ = std::fs::remove_file(&chunk_path);
    }

    if all_text.is_empty() {
        let msg = "智谱 ASR 所有分片均返回空文本".to_string();
        save_transcript(app, file_path, "failed", &msg);
        return Err(msg);
    }

    let transcript = Transcript {
        status: "completed".to_string(),
        text: all_text,
        segments: vec![],
        engine: Some("zhipu".to_string()),
    };
    save_transcript_data(file_path, &transcript);
    emit_progress(app, &filename, "completed");
    Ok(transcript)
}

async fn zhipu_transcribe_file(
    app: &AppHandle,
    file_path: &Path,
    api_key: &str,
) -> Result<String, String> {
    let file_bytes = fs::read(file_path).map_err(|e| {
        let msg = format!("读取音频文件失败: {}", e);
        save_transcript(app, file_path, "failed", &msg);
        msg
    })?;

    let file_name = file_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let ext = file_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("wav");
    let mime_str = match ext {
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        _ => "audio/wav",
    };

    let file_part = reqwest::multipart::Part::bytes(file_bytes)
        .file_name(file_name)
        .mime_str(mime_str)
        .map_err(|e| format!("构建 multipart 失败: {}", e))?;

    let form = reqwest::multipart::Form::new()
        .part("file", file_part)
        .text("model", "glm-asr-2512");

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .unwrap_or_default();
    let resp = client
        .post(ZHIPU_ASR_URL)
        .header("Authorization", format!("Bearer {}", api_key))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("智谱 ASR 请求失败: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("智谱 ASR 失败 ({}): {}", status, body));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("解析智谱响应失败: {}", e))?;

    Ok(data
        .get("text")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string())
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
    // 前置检查：不兼容的音频编码（如 Opus in m4a）
    if crate::recordings::is_unsupported_codec(&file_path) {
        let msg = "不支持的音频编码（Opus），请转换为 AAC 格式后重试".to_string();
        eprintln!("[transcription] Opus codec detected, rejecting");
        save_transcript(&app, &file_path, "failed", &msg);
        return Err(msg);
    }

    // 前置检查：macOS 麦克风 + 语音识别权限
    #[cfg(target_os = "macos")]
    {
        use crate::permissions::PermStatus;
        let mic = crate::permissions::macos::microphone_status();
        let speech = crate::permissions::macos::speech_recognition_status();
        if matches!(mic, PermStatus::Denied) || matches!(speech, PermStatus::Denied) {
            let msg = "缺少麦克风或语音识别权限，请前往「系统设置 → 隐私与安全性」授权".to_string();
            save_transcript(&app, &file_path, "failed", &msg);
            return Err(msg);
        }
    }

    let cfg = config::load_config(&app).inspect_err(|error| {
        save_transcript(&app, &file_path, "failed", error);
    })?;
    let engine = create_asr_engine(&cfg);

    let filename = file_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    // Step 1: 人声分割对齐（SpeakerKit diarization）
    emit_progress(&app, &filename, "diarizing");
    let (speakers, diarize_ok) =
        match diarize_with_speakerkit(app.clone(), file_path.clone(), duration_secs).await {
            Ok((mut speakers, embeddings)) => {
                // Step 2: 声纹识别 — 匹配已知档案或注册新说话人
                if !embeddings.is_empty() {
                    let name_map = speaker_profiles::identify_or_register_all(&app, &embeddings);
                    for seg in &mut speakers {
                        if let Some(display) = name_map.get(&seg.label) {
                            seg.label = display.clone();
                        }
                    }
                    let _ = app.emit("speakers-updated", ());
                }
                (speakers, true)
            }
            Err(e) => {
                eprintln!(
                    "[transcription] SpeakerKit failed, continuing without diarization: {}",
                    e
                );
                (vec![], false)
            }
        };

    // Step 3: ASR 转写（通过 trait 分发到具体引擎，失败时自动降级到 Apple STT）
    emit_progress(&app, &filename, "transcribing");
    let input = AsrInput {
        app: app.clone(),
        file_path: file_path.clone(),
        duration_secs,
        speaker_segments: speakers.clone(),
    };
    let (transcript, used_engine) = {
        let primary_name = engine.name().to_string();
        match engine.transcribe(&input).await {
            Ok(t) => (t, primary_name),
            Err(e) if primary_name != "apple" => {
                eprintln!(
                    "[transcription] engine '{}' failed: {}, falling back to Apple STT",
                    primary_name, e
                );
                let _ = app.emit(
                    "transcription-progress",
                    serde_json::json!({
                        "filename": filename,
                        "status": "transcribing",
                        "message": format!("引擎 {} 失败，切换到 Apple STT…", primary_name),
                    }),
                );
                let fallback = AppleSttEngine;
                let t = fallback.transcribe(&input).await?;
                (t, "apple".to_string())
            }
            Err(e) => return Err(e),
        }
    };

    // Step 4: 合并说话人标签与转写结果
    let final_transcript = if diarize_ok && !speakers.is_empty() {
        let merged = if transcript.segments.is_empty() {
            // 无时间戳引擎（DashScope、Zhipu）：用 diarization segments 作为 timeline 骨架
            let speaker_segments: Vec<WhisperSegment> = speakers
                .iter()
                .map(|sp| WhisperSegment {
                    speaker: Some(sp.label.clone()),
                    start: sp.start,
                    end: sp.end,
                    text: String::new(),
                })
                .collect();
            Transcript {
                status: transcript.status.clone(),
                text: transcript.text.clone(),
                segments: speaker_segments,
                engine: transcript.engine.clone(),
            }
        } else {
            // 有时间戳引擎（Apple、WhisperKit、Volcengine）：清除引擎自带 speaker，用 diarization 覆盖
            let transcript_unlabeled = Transcript {
                status: transcript.status.clone(),
                text: transcript.text.clone(),
                segments: transcript
                    .segments
                    .iter()
                    .map(|s| WhisperSegment {
                        speaker: None,
                        ..s.clone()
                    })
                    .collect(),
                engine: transcript.engine.clone(),
            };
            merge_transcript_with_speakers(&transcript_unlabeled, &speakers)
        };
        save_transcript_data(&file_path, &merged);
        merged
    } else {
        save_transcript_data(&file_path, &transcript);
        transcript
    };

    // Step 5: 生成 audio-ai.md
    emit_progress(&app, &filename, "completed");

    let markdown = render_audio_ai_markdown(&filename, &used_engine, &final_transcript);
    let markdown_path = audio_ai_markdown_path_for_audio(file_path.as_path());

    std::fs::write(&markdown_path, markdown.as_bytes())
        .map_err(|e| format!("写入音频 AI markdown 失败: {}", e))?;

    Ok(markdown_path)
}

/// 计算 CLI 调用超时：max(duration_secs * 10, 600) 秒
pub fn compute_stt_timeout(duration_secs: f64) -> Duration {
    let secs = (duration_secs * 10.0).max(600.0);
    Duration::from_secs(secs as u64)
}

/// 查找 journal-speech sidecar 二进制路径。
///
/// Tauri v2 打包时会去掉 target triple 后缀：
///   源文件  binaries/journal-speech-aarch64-apple-darwin
///   包内路径 Contents/MacOS/journal-speech（无 triple）
///
/// 按以下顺序查找，并在全部失败时报告所有已查找路径，方便诊断。
pub fn find_journal_speech_path(app: &AppHandle) -> Result<PathBuf, String> {
    // 打包后的二进制名（Tauri 去掉了 target triple 后缀）
    let bundle_name = "journal-speech";
    // 开发环境源目录里的文件名（保留 triple，与 externalBin 命名规范一致）
    let dev_name = if cfg!(target_arch = "aarch64") {
        "journal-speech-aarch64-apple-darwin"
    } else {
        "journal-speech-x86_64-apple-darwin"
    };

    let mut tried: Vec<PathBuf> = Vec::new();

    // 1. current_exe().parent() → Contents/MacOS/journal-speech（Tauri v2 标准位置）
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let p = exe_dir.join(bundle_name);
            if p.exists() {
                return Ok(p);
            }
            tried.push(p);
        }
    }

    // 2. resource_dir()/../MacOS/journal-speech（通过 Tauri 路径 API 推导，同一位置的备用查找）
    if let Ok(resource_dir) = app.path().resource_dir() {
        if let Some(contents_dir) = resource_dir.parent() {
            let p = contents_dir.join("MacOS").join(bundle_name);
            if p.exists() {
                return Ok(p);
            }
            tried.push(p);
        }
    }

    // 3. 开发环境回退：src-tauri/binaries/（CARGO_MANIFEST_DIR 编译期常量）
    {
        let p = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("binaries")
            .join(dev_name);
        if p.exists() {
            return Ok(p);
        }
        tried.push(p);
    }

    // 4. 系统 PATH
    if let Ok(output) = std::process::Command::new("/usr/bin/which")
        .arg(bundle_name)
        .env("PATH", config::augmented_path())
        .output()
    {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return Ok(PathBuf::from(path));
            }
        }
    }

    let tried_list = tried
        .iter()
        .map(|p| format!("  • {}", p.display()))
        .collect::<Vec<_>>()
        .join("\n");
    Err(format!(
        "未找到 journal-speech，请重新安装应用。\n已查找路径：\n{}",
        tried_list
    ))
}

/// Apple STT 转写：调用 journal-speech transcribe sidecar。
pub async fn transcribe_with_apple_stt(
    app: AppHandle,
    file_path: PathBuf,
    duration_secs: f64,
) -> Result<Transcript, String> {
    let filename = file_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let cli_path = find_journal_speech_path(&app).inspect_err(|e| {
        save_transcript(&app, &file_path, "failed", e);
    })?;

    // 推送 "transcribing" 状态
    emit_progress(&app, &filename, "transcribing");

    let mut cmd = Command::new(&cli_path);
    cmd.args([
        "transcribe",
        "--audio",
        file_path.to_str().unwrap_or(""),
        "--language",
        "zh-CN",
    ]);

    use std::process::Stdio;
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| {
        let msg = format!("启动 journal-speech 失败: {}", e);
        save_transcript(&app, &file_path, "failed", &msg);
        msg
    })?;

    // 流式读取 stderr 日志，同时累积用于错误报告
    let stderr_lines = std::sync::Arc::new(std::sync::Mutex::new(Vec::<String>::new()));
    let stderr_handle = if let Some(stderr) = child.stderr.take() {
        let app_clone = app.clone();
        let fname = filename.clone();
        let lines_clone = std::sync::Arc::clone(&stderr_lines);
        Some(tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                if line.trim().is_empty() {
                    continue;
                }
                if let Ok(mut v) = lines_clone.lock() {
                    v.push(line.trim().to_string());
                }
                let _ = app_clone.emit(
                    "transcription-progress",
                    serde_json::json!({
                        "filename": fname,
                        "status": "transcribing",
                        "message": line.trim(),
                    }),
                );
            }
        }))
    } else {
        None
    };
    // 收集 stdout（带超时，防止子进程卡死导致无限阻塞）
    let timeout = compute_stt_timeout(duration_secs);
    let stdout_bytes = if let Some(stdout) = child.stdout.take() {
        let mut reader = BufReader::new(stdout);
        let mut buf = String::new();
        use tokio::io::AsyncReadExt;
        match tokio::time::timeout(timeout, reader.read_to_string(&mut buf)).await {
            Ok(Ok(_)) => buf,
            Ok(Err(_)) => String::new(),
            Err(_) => {
                // stdout 读取超时，杀掉子进程
                let _ = child.kill().await;
                if let Some(h) = stderr_handle {
                    let _ = h.await;
                }
                let msg = format!(
                    "Apple STT 转写超时（{}秒），stdout 读取阻塞，已终止进程",
                    timeout.as_secs()
                );
                save_transcript(&app, &file_path, "failed", &msg);
                return Err(msg);
            }
        }
    } else {
        String::new()
    };

    // 等待子进程退出（带超时）
    let wait_result = tokio::time::timeout(timeout, child.wait()).await;

    // 清理 stderr reader
    if let Some(h) = stderr_handle {
        let _ = h.await;
    }

    let status = match wait_result {
        Ok(Ok(s)) => s,
        Ok(Err(e)) => {
            let msg = format!("等待 journal-speech 进程失败: {}", e);
            save_transcript(&app, &file_path, "failed", &msg);
            return Err(msg);
        }
        Err(_) => {
            // 超时：终止子进程
            let msg = format!("Apple STT 转写超时（{}秒），已终止进程", timeout.as_secs());
            save_transcript(&app, &file_path, "failed", &msg);
            return Err(msg);
        }
    };

    if !status.success() {
        // 优先从 stdout JSON 解析错误，其次用累积的 stderr 行
        let stderr_summary = stderr_lines
            .lock()
            .ok()
            .map(|v| v.join("; "))
            .filter(|s| !s.is_empty());
        let error_msg = serde_json::from_str::<serde_json::Value>(&stdout_bytes)
            .ok()
            .and_then(|v| v.get("error").and_then(|e| e.as_str()).map(String::from))
            .or(stderr_summary)
            .unwrap_or_else(|| "journal-speech 转写失败".to_string());
        save_transcript(&app, &file_path, "failed", &error_msg);
        return Err(error_msg);
    }

    // 解析 JSON stdout 为 Transcript
    let parsed: serde_json::Value = serde_json::from_str(&stdout_bytes).map_err(|e| {
        let msg = format!("解析 journal-speech 输出失败: {}", e);
        save_transcript(&app, &file_path, "failed", &msg);
        msg
    })?;

    // 检查 CLI 返回的 status 字段
    let cli_status = parsed
        .get("status")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");
    if cli_status == "failed" {
        let error_msg = parsed
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("未知错误")
            .to_string();
        save_transcript(&app, &file_path, "failed", &error_msg);
        return Err(error_msg);
    }

    let text = parsed
        .get("text")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

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

    let engine = parsed
        .get("engine")
        .and_then(|v| v.as_str())
        .map(String::from);

    // SFSpeechRecognizer 返回词级别 segments，合并为句子级别
    let merged_segments = merge_word_segments_to_sentences(&segments);
    // 用合并后的句子文本替换原始 text（带标点）
    let merged_text = merged_segments
        .iter()
        .map(|s| s.text.as_str())
        .collect::<Vec<_>>()
        .join("");

    let transcript = Transcript {
        status: "completed".to_string(),
        text: if merged_segments.is_empty() {
            text
        } else {
            merged_text
        },
        segments: merged_segments,
        engine,
    };

    save_transcript_data(&file_path, &transcript);
    emit_progress(&app, &filename, "completed");

    Ok(transcript)
}

/// SpeakerKit 说话人分离：调用 journal-speech diarize sidecar。
/// 返回 (segments, embeddings)，embeddings 可能为空 map（旧版 CLI 或失败时）。
pub async fn diarize_with_speakerkit(
    app: AppHandle,
    file_path: PathBuf,
    duration_secs: f64,
) -> Result<(Vec<SpeakerSegment>, HashMap<String, Vec<f32>>), String> {
    let filename = file_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let cli_path = find_journal_speech_path(&app)?;

    // 推送 "diarizing" 状态
    emit_progress(&app, &filename, "diarizing");

    let mut cmd = Command::new(&cli_path);
    cmd.args(["diarize", "--audio", file_path.to_str().unwrap_or("")]);

    // Pass model folder explicitly so Swift CLI can find models in dev mode
    // (Tauri dev copies sidecar to target/debug/, breaking relative path resolution)
    let model_candidates = [
        // Packaged .app: Contents/MacOS/../Resources/resources/speakerkit-models
        cli_path
            .parent()
            .and_then(|d| d.parent())
            .map(|p| p.join("Resources/resources/speakerkit-models")),
        // Dev: binary dir/../resources/speakerkit-models
        cli_path
            .parent()
            .map(|d| d.join("../resources/speakerkit-models")),
        // Dev fallback: CARGO_MANIFEST_DIR/resources/speakerkit-models
        Some(
            std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("resources/speakerkit-models"),
        ),
    ];
    if let Some(folder) = model_candidates.into_iter().flatten().find(|p| p.exists()) {
        if let Some(s) = folder
            .canonicalize()
            .ok()
            .and_then(|p| p.to_str().map(String::from))
        {
            cmd.args(["--model-folder", &s]);
        }
    }

    use std::process::Stdio;
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("启动 journal-speech diarize 失败: {}", e))?;

    // 流式读取 stderr 日志
    let stderr_handle = if let Some(stderr) = child.stderr.take() {
        let app_clone = app.clone();
        let fname = filename.clone();
        Some(tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                if line.trim().is_empty() {
                    continue;
                }
                let _ = app_clone.emit(
                    "transcription-progress",
                    serde_json::json!({
                        "filename": fname,
                        "status": "diarizing",
                        "message": line.trim(),
                    }),
                );
            }
        }))
    } else {
        None
    };

    // 收集 stdout（带超时，防止子进程卡死导致无限阻塞）
    let timeout = compute_stt_timeout(duration_secs);
    let stdout_bytes = if let Some(stdout) = child.stdout.take() {
        let mut reader = BufReader::new(stdout);
        let mut buf = String::new();
        use tokio::io::AsyncReadExt;
        match tokio::time::timeout(timeout, reader.read_to_string(&mut buf)).await {
            Ok(Ok(_)) => buf,
            Ok(Err(_)) => String::new(),
            Err(_) => {
                let _ = child.kill().await;
                if let Some(h) = stderr_handle {
                    let _ = h.await;
                }
                return Err(format!(
                    "SpeakerKit diarize 超时（{}秒），已终止进程",
                    timeout.as_secs()
                ));
            }
        }
    } else {
        String::new()
    };

    // 等待子进程退出（带超时）
    let wait_result = tokio::time::timeout(timeout, child.wait()).await;

    // 清理 stderr reader
    if let Some(h) = stderr_handle {
        let _ = h.await;
    }

    let status = match wait_result {
        Ok(Ok(s)) => s,
        Ok(Err(e)) => {
            return Err(format!("等待 journal-speech diarize 进程失败: {}", e));
        }
        Err(_) => {
            return Err(format!(
                "SpeakerKit 说话人分离超时（{}秒），已终止进程",
                timeout.as_secs()
            ));
        }
    };

    if !status.success() {
        let error_msg = serde_json::from_str::<serde_json::Value>(&stdout_bytes)
            .ok()
            .and_then(|v| v.get("error").and_then(|e| e.as_str()).map(String::from))
            .unwrap_or_else(|| "journal-speech diarize 失败".to_string());
        return Err(error_msg);
    }

    // 解析 JSON stdout
    let parsed: serde_json::Value = serde_json::from_str(&stdout_bytes)
        .map_err(|e| format!("解析 journal-speech diarize 输出失败: {}", e))?;

    // 检查 CLI 返回的 status 字段
    let cli_status = parsed
        .get("status")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");
    if cli_status == "failed" {
        let error_msg = parsed
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("未知错误")
            .to_string();
        return Err(error_msg);
    }

    // 解析 speakers 数组为 Vec<SpeakerSegment>
    let speakers: Vec<SpeakerSegment> = parsed
        .get("speakers")
        .and_then(|s| s.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|item| {
                    Some(SpeakerSegment {
                        label: item.get("label").and_then(|v| v.as_str())?.to_string(),
                        start: item.get("start").and_then(|v| v.as_f64())?,
                        end: item.get("end").and_then(|v| v.as_f64())?,
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    // 解析声纹嵌入向量（新版 CLI 才有；旧版返回 null 或缺失时忽略）
    let has_embeddings_key = parsed.get("embeddings").is_some();
    let embeddings: HashMap<String, Vec<f32>> = parsed
        .get("embeddings")
        .and_then(|v| v.as_object())
        .map(|obj| {
            obj.iter()
                .filter_map(|(label, arr)| {
                    let vec: Vec<f32> = arr
                        .as_array()?
                        .iter()
                        .filter_map(|x| x.as_f64().map(|f| f as f32))
                        .collect();
                    if vec.is_empty() {
                        None
                    } else {
                        Some((label.clone(), vec))
                    }
                })
                .collect()
        })
        .unwrap_or_default();
    eprintln!(
        "[speaker_profiles] CLI output: {} speakers, embeddings key={}, parsed {} embeddings",
        speakers.len(),
        has_embeddings_key,
        embeddings.len(),
    );
    if !has_embeddings_key {
        eprintln!("[speaker_profiles] WARNING: no embeddings in CLI output. Swift CLI may not have SpeakerEmbedder model loaded.");
    }

    Ok((speakers, embeddings))
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

    let cli_path = match config::find_whisperkit_cli_path() {
        Some(path) => path,
        None => {
            let message =
                "未找到 whisperkit-cli，请先安装：brew install whisperkit-cli".to_string();
            save_transcript(&app, &file_path, "failed", &message);
            return Err(message);
        }
    };

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

    cmd.env("HF_ENDPOINT", "https://hf-mirror.com");
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

    // 收集 stdout（带超时，防止子进程卡死导致无限阻塞）
    let timeout = std::time::Duration::from_secs(1800); // whisperkit 首次需编译模型，给 30 分钟
    let stdout_bytes = if let Some(stdout) = child.stdout.take() {
        let mut reader = BufReader::new(stdout);
        let mut buf = String::new();
        use tokio::io::AsyncReadExt;
        match tokio::time::timeout(timeout, reader.read_to_string(&mut buf)).await {
            Ok(Ok(_)) => buf,
            Ok(Err(_)) => String::new(),
            Err(_) => {
                let _ = child.kill().await;
                if let Some(h) = stderr_handle {
                    let _ = h.await;
                }
                save_transcript(
                    &app,
                    &file_path,
                    "failed",
                    "WhisperKit 转录超时（1800秒），已终止进程",
                );
                return Err("WhisperKit 转录超时（1800秒），已终止进程".to_string());
            }
        }
    } else {
        String::new()
    };

    let wait_result = tokio::time::timeout(timeout, child.wait()).await;
    if let Some(h) = stderr_handle {
        let _ = h.await;
    }

    let status = match wait_result {
        Ok(Ok(s)) => s,
        Ok(Err(e)) => {
            let msg = format!("等待 whisperkit-cli 进程失败: {}", e);
            save_transcript(&app, &file_path, "failed", &msg);
            return Err(msg);
        }
        Err(_) => {
            let _ = child.kill().await;
            save_transcript(
                &app,
                &file_path,
                "failed",
                "WhisperKit 转录超时（1800秒），已终止进程",
            );
            return Err("WhisperKit 转录超时（1800秒），已终止进程".to_string());
        }
    };

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
            engine: Some("whisperkit".to_string()),
        }
    } else {
        let mut t = parse_whisperkit_stdout(&stdout_bytes);
        t.engine = Some("whisperkit".to_string());
        t
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

/// 将转写结果与说话人分离结果按时间戳合并。
///
/// 对每个转写 segment，找到时间重叠最大的 speaker segment 并赋予其说话人标签。
/// 如果 segment 已有 speaker 标签（非 None），则保留不覆盖。
/// 如果没有任何 speaker segment 与之重叠，赋予 "SPEAKER_UNKNOWN"。
/// 输出 segments 按 start 时间升序排列。
pub fn merge_transcript_with_speakers(
    transcript: &Transcript,
    speakers: &[SpeakerSegment],
) -> Transcript {
    let mut merged_segments: Vec<WhisperSegment> = transcript
        .segments
        .iter()
        .map(|seg| {
            // If the segment already has a speaker label, preserve it
            if seg.speaker.is_some() {
                return seg.clone();
            }

            // Find the speaker segment with the maximum overlap
            let mut best_label: Option<&str> = None;
            let mut best_overlap: f64 = 0.0;

            for sp in speakers {
                let overlap_start = seg.start.max(sp.start);
                let overlap_end = seg.end.min(sp.end);
                let overlap = overlap_end - overlap_start;

                if overlap > best_overlap {
                    best_overlap = overlap;
                    best_label = Some(&sp.label);
                }
            }

            WhisperSegment {
                speaker: Some(best_label.unwrap_or("SPEAKER_UNKNOWN").to_string()),
                start: seg.start,
                end: seg.end,
                text: seg.text.clone(),
            }
        })
        .collect();

    // Sort by start time ascending
    merged_segments.sort_by(|a, b| {
        a.start
            .partial_cmp(&b.start)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    Transcript {
        status: transcript.status.clone(),
        text: transcript.text.clone(),
        segments: merged_segments,
        engine: transcript.engine.clone(),
    }
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

    #[test]
    fn compute_stt_timeout_uses_duration_times_ten() {
        let timeout = compute_stt_timeout(30.0);
        assert_eq!(timeout, Duration::from_secs(600));
    }

    #[test]
    fn compute_stt_timeout_minimum_600_seconds() {
        let timeout = compute_stt_timeout(10.0);
        assert_eq!(timeout, Duration::from_secs(600));
    }

    #[test]
    fn compute_stt_timeout_zero_duration_returns_600() {
        let timeout = compute_stt_timeout(0.0);
        assert_eq!(timeout, Duration::from_secs(600));
    }

    #[test]
    fn compute_stt_timeout_large_duration() {
        let timeout = compute_stt_timeout(120.0);
        assert_eq!(timeout, Duration::from_secs(1200));
    }

    #[test]
    fn merge_basic_two_speakers() {
        let transcript = Transcript {
            status: "completed".into(),
            text: "大家好 今天讨论排期".into(),
            segments: vec![
                WhisperSegment {
                    speaker: None,
                    start: 0.0,
                    end: 3.0,
                    text: "大家好".into(),
                },
                WhisperSegment {
                    speaker: None,
                    start: 3.5,
                    end: 7.0,
                    text: "今天讨论排期".into(),
                },
            ],
            engine: None,
        };
        let speakers = vec![
            SpeakerSegment {
                label: "SPEAKER_00".into(),
                start: 0.0,
                end: 3.2,
            },
            SpeakerSegment {
                label: "SPEAKER_01".into(),
                start: 3.3,
                end: 7.5,
            },
        ];

        let merged = merge_transcript_with_speakers(&transcript, &speakers);
        assert_eq!(merged.segments.len(), 2);
        assert_eq!(merged.segments[0].speaker.as_deref(), Some("SPEAKER_00"));
        assert_eq!(merged.segments[1].speaker.as_deref(), Some("SPEAKER_01"));
        // Verify sorted by start time
        assert!(merged.segments[0].start <= merged.segments[1].start);
    }

    #[test]
    fn merge_single_speaker() {
        let transcript = Transcript {
            status: "completed".into(),
            text: "独白内容".into(),
            segments: vec![WhisperSegment {
                speaker: None,
                start: 0.0,
                end: 5.0,
                text: "独白内容".into(),
            }],
            engine: None,
        };
        let speakers = vec![SpeakerSegment {
            label: "SPEAKER_00".into(),
            start: 0.0,
            end: 10.0,
        }];

        let merged = merge_transcript_with_speakers(&transcript, &speakers);
        assert_eq!(merged.segments.len(), 1);
        assert_eq!(merged.segments[0].speaker.as_deref(), Some("SPEAKER_00"));
        assert_eq!(merged.segments[0].text, "独白内容");
    }

    #[test]
    fn merge_preserves_existing_speaker_labels() {
        let transcript = Transcript {
            status: "completed".into(),
            text: "已有标签".into(),
            segments: vec![
                WhisperSegment {
                    speaker: Some("EXISTING_A".into()),
                    start: 0.0,
                    end: 3.0,
                    text: "已有标签".into(),
                },
                WhisperSegment {
                    speaker: None,
                    start: 3.5,
                    end: 6.0,
                    text: "无标签".into(),
                },
            ],
            engine: None,
        };
        let speakers = vec![SpeakerSegment {
            label: "SPEAKER_01".into(),
            start: 0.0,
            end: 7.0,
        }];

        let merged = merge_transcript_with_speakers(&transcript, &speakers);
        assert_eq!(
            merged.segments[0].speaker.as_deref(),
            Some("EXISTING_A"),
            "existing speaker label should not be overwritten"
        );
        assert_eq!(
            merged.segments[1].speaker.as_deref(),
            Some("SPEAKER_01"),
            "missing speaker should be assigned from speakers list"
        );
    }

    #[test]
    fn merge_empty_speakers_assigns_unknown() {
        let transcript = Transcript {
            status: "completed".into(),
            text: "无说话人数据".into(),
            segments: vec![WhisperSegment {
                speaker: None,
                start: 0.0,
                end: 3.0,
                text: "无说话人数据".into(),
            }],
            engine: None,
        };
        let speakers: Vec<SpeakerSegment> = vec![];

        let merged = merge_transcript_with_speakers(&transcript, &speakers);
        assert_eq!(merged.segments.len(), 1);
        assert_eq!(
            merged.segments[0].speaker.as_deref(),
            Some("SPEAKER_UNKNOWN")
        );
    }
}
