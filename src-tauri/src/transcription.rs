use crate::config;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

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

fn emit_progress(app: &AppHandle, filename: &str, status: &str) {
    let payload = serde_json::json!({ "filename": filename, "status": status });
    let _ = app.emit("transcription-progress", payload);
}

/// Upload a local audio file to DashScope temporary storage and return the oss:// URL.
async fn upload_file(
    client: &reqwest::Client,
    api_key: &str,
    path: &PathBuf,
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
        .query(&[("action", "getPolicy"), ("model", "qwen3-asr-flash-filetrans")])
        .send()
        .await
        .map_err(|e| format!("Get policy failed: {}", e))?;

    if !policy_resp.status().is_success() {
        let status = policy_resp.status();
        let body = policy_resp.text().await.unwrap_or_default();
        return Err(format!("Get policy failed ({}): {}", status, body));
    }

    let policy_data: serde_json::Value = policy_resp.json().await.map_err(|e| e.to_string())?;
    let data = policy_data.get("data").ok_or("No data in policy response")?;

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
        .mime_str("audio/mp4")
        .map_err(|e| e.to_string())?;

    let form = reqwest::multipart::Form::new()
        .text("OSSAccessKeyId", oss_access_key_id.to_string())
        .text("Signature", signature.to_string())
        .text("policy", policy.to_string())
        .text("x-oss-object-acl", x_oss_object_acl.to_string())
        .text(
            "x-oss-forbid-overwrite",
            x_oss_forbid_overwrite.to_string(),
        )
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
    let url = format!(
        "https://dashscope.aliyuncs.com/api/v1/tasks/{}",
        task_id
    );

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
                    return Err(format!("Task {}: SUCCEEDED but no transcription_url", task_id));
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
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

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
            Some(sp) => speaker_map.get(sp)
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

fn save_transcript(app: &AppHandle, file_path: &PathBuf, status: &str, text: &str) {
    // transcript 放在素材所在 raw/ 目录上一级的 transcripts/ 下
    // raw/录音.m4a → ../transcripts/录音.json
    let raw_dir = file_path.parent().unwrap_or(file_path.as_path());
    let transcripts_dir = raw_dir.parent().unwrap_or(raw_dir).join("transcripts");
    let _ = std::fs::create_dir_all(&transcripts_dir);
    let base = file_path.file_stem().unwrap_or_default().to_string_lossy();
    let json_path = transcripts_dir.join(format!("{}.json", base));
    let transcript = Transcript { status: status.to_string(), text: text.to_string(), segments: vec![] };
    if let Ok(data) = serde_json::to_string(&transcript) {
        let _ = std::fs::write(&json_path, data);
    }
    let filename = file_path.file_name().unwrap_or_default().to_string_lossy().to_string();
    let _ = app.emit("transcription-progress", serde_json::json!({
        "filename": filename, "status": status
    }));
}

/// Public entry point: start transcription in a background thread.
pub fn start_transcription(
    app: AppHandle,
    filename: String,
    file_path: PathBuf,
    duration_secs: f64,
) {
    if duration_secs <= MIN_DURATION_SECS {
        return;
    }

    let api_key = match config::load_config(&app) {
        Ok(cfg) if !cfg.dashscope_api_key.is_empty() => cfg.dashscope_api_key,
        _ => return,
    };

    tauri::async_runtime::spawn(async move {
        let client = reqwest::Client::new();

        emit_progress(&app, &filename, "uploading");

        let file_url = match upload_file(&client, &api_key, &file_path).await {
            Ok(url) => url,
            Err(e) => {
                eprintln!("Upload failed: {}", e);
                save_transcript(&app, &file_path, "failed", &format!("上传失败: {}", e));
                return;
            }
        };

        emit_progress(&app, &filename, "transcribing");

        let task_id = match submit_transcription(&client, &api_key, &file_url).await {
            Ok(id) => id,
            Err(e) => {
                eprintln!("Submit failed: {}", e);
                save_transcript(&app, &file_path, "failed", &format!("提交失败: {}", e));
                return;
            }
        };

        let transcription_url =
            match poll_task(&client, &api_key, &task_id, &app, &filename).await {
                Ok(Some(url)) => url,
                Ok(None) => {
                    save_transcript(&app, &file_path, "failed", "未获取到转写结果");
                    return;
                }
                Err(e) => {
                    eprintln!("Poll failed: {}", e);
                    save_transcript(
                        &app,
                        &file_path,
                        "failed",
                        &format!("转写失败: {}", e),
                    );
                    return;
                }
            };

        let text = match fetch_transcription_text(&client, &transcription_url).await {
            Ok(t) => t,
            Err(e) => {
                save_transcript(
                    &app,
                    &file_path,
                    "failed",
                    &format!("获取转写文本失败: {}", e),
                );
                return;
            }
        };

        save_transcript(&app, &file_path, "completed", &text);
    });
}

/// WhisperKit 转录：调用 whisperkit-cli sidecar，返回格式化 markdown 文本。
/// 同时将 diarized transcript 写入 sidecar 文件（供 UI 展示）。
pub async fn transcribe_with_whisperkit(
    app: AppHandle,
    file_path: PathBuf,
    model: String,
) -> Result<String, String> {
    let filename = file_path.file_name().unwrap_or_default().to_string_lossy().to_string();

    // 模型缓存目录：app_data_dir/whisperkit-models/
    let model_cache_dir = app.path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("whisperkit-models");
    let _ = std::fs::create_dir_all(&model_cache_dir);

    // 找到 sidecar 二进制路径（dev 模式用系统 PATH，bundle 模式用 Tauri resource 路径）
    let cli_path = app.path()
        .resource_dir()
        .ok()
        .map(|d| d.join("binaries").join("whisperkit-cli-aarch64-apple-darwin"))
        .filter(|p| p.exists())
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "whisperkit-cli".to_string());

    let _ = app.emit("transcription-progress", serde_json::json!({
        "filename": filename, "status": "transcribing"
    }));

    let output = tokio::process::Command::new(&cli_path)
        .args([
            "transcribe",
            "--audio-path", file_path.to_str().unwrap_or(""),
            "--diarization",
            "--output-type", "verbose_json",
            "--language", "zh",
            "--model-cache-dir", model_cache_dir.to_str().unwrap_or(""),
            "--model", &model,
        ])
        .output()
        .await
        .map_err(|e| format!("启动 whisperkit-cli 失败: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        save_transcript(&app, &file_path, "failed", &format!("whisperkit 失败: {}", stderr));
        return Err(format!("whisperkit-cli 退出码非零: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();

    // 解析 verbose_json 输出
    let parsed: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|e| format!("解析 whisperkit 输出失败: {}", e))?;

    let segments: Vec<WhisperSegment> = parsed
        .get("segments")
        .and_then(|s| s.as_array())
        .map(|arr| arr.iter().filter_map(|item| {
            Some(WhisperSegment {
                speaker: item.get("speaker").and_then(|v| v.as_str()).map(String::from),
                start: item.get("start").and_then(|v| v.as_f64()).unwrap_or(0.0),
                end: item.get("end").and_then(|v| v.as_f64()).unwrap_or(0.0),
                text: item.get("text").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            })
        }).collect())
        .unwrap_or_default();

    // 全文拼接（向后兼容 UI 展示）
    let full_text: String = segments.iter()
        .map(|s| s.text.trim())
        .collect::<Vec<_>>()
        .join(" ");

    // 写 sidecar
    let raw_dir = file_path.parent().unwrap_or(file_path.as_path());
    let transcripts_dir = raw_dir.parent().unwrap_or(raw_dir).join("transcripts");
    let _ = std::fs::create_dir_all(&transcripts_dir);
    let base = file_path.file_stem().unwrap_or_default().to_string_lossy();
    let json_path = transcripts_dir.join(format!("{}.json", base));
    let transcript = Transcript {
        status: "completed".to_string(),
        text: full_text,
        segments: segments.clone(),
    };
    if let Ok(data) = serde_json::to_string(&transcript) {
        let _ = std::fs::write(&json_path, data);
    }

    let _ = app.emit("transcription-progress", serde_json::json!({
        "filename": filename, "status": "completed"
    }));

    Ok(format_diarized_markdown(&segments))
}

#[tauri::command]
pub fn get_transcript(path: String) -> Result<Option<Transcript>, String> {
    let file_path = PathBuf::from(&path);
    let raw_dir = file_path.parent().ok_or("invalid path")?;
    let transcripts_dir = raw_dir.parent().ok_or("invalid path")?.join("transcripts");
    let base = file_path.file_stem().unwrap_or_default().to_string_lossy();
    let json_path = transcripts_dir.join(format!("{}.json", base));
    if !json_path.exists() { return Ok(None); }
    let data = std::fs::read_to_string(&json_path).map_err(|e| e.to_string())?;
    let t: Transcript = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    Ok(Some(t))
}

#[tauri::command]
pub fn retry_transcription(app: AppHandle, path: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);
    if !file_path.exists() {
        return Err(format!("文件不存在: {}", path));
    }
    let filename = file_path.file_name().unwrap_or_default().to_string_lossy().to_string();
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
            WhisperSegment { speaker: Some("SPEAKER_00".into()), start: 0.0, end: 3.0, text: "大家好".into() },
            WhisperSegment { speaker: Some("SPEAKER_01".into()), start: 3.5, end: 7.0, text: "你好".into() },
        ];
        let md = format_diarized_markdown(&segments);
        assert!(md.contains("**Speaker A**"), "should map SPEAKER_00 to Speaker A");
        assert!(md.contains("**Speaker B**"), "should map SPEAKER_01 to Speaker B");
        assert!(md.contains("(0:00)"), "should format start time");
        assert!(md.contains("大家好"));
        assert!(md.contains("你好"));
    }

    #[test]
    fn format_segments_merges_adjacent_same_speaker() {
        let segments = vec![
            WhisperSegment { speaker: Some("SPEAKER_00".into()), start: 0.0, end: 2.0, text: "第一句".into() },
            WhisperSegment { speaker: Some("SPEAKER_00".into()), start: 2.1, end: 4.0, text: "第二句".into() },
            WhisperSegment { speaker: Some("SPEAKER_01".into()), start: 4.5, end: 6.0, text: "回应".into() },
        ];
        let md = format_diarized_markdown(&segments);
        // SPEAKER_00 header should appear only once
        let count = md.matches("**Speaker A**").count();
        assert_eq!(count, 1, "adjacent same-speaker segments should be merged");
    }

    #[test]
    fn format_segments_time_format() {
        let segments = vec![
            WhisperSegment { speaker: Some("SPEAKER_00".into()), start: 65.0, end: 70.0, text: "一分钟后".into() },
        ];
        let md = format_diarized_markdown(&segments);
        assert!(md.contains("(1:05)"), "65 seconds should format as 1:05");
    }

    #[test]
    fn format_segments_no_speaker_fallback() {
        let segments = vec![
            WhisperSegment { speaker: None, start: 0.0, end: 2.0, text: "无说话人".into() },
        ];
        let md = format_diarized_markdown(&segments);
        assert!(md.contains("无说话人"), "text should be present even without speaker");
    }
}
