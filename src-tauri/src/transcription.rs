use crate::config;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const UPLOAD_URL: &str = "https://dashscope.aliyuncs.com/api/v1/uploads";
const TRANSCRIBE_URL: &str =
    "https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription";
const MIN_DURATION_SECS: f64 = 30.0;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transcript {
    pub status: String,
    pub text: String,
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

fn save_transcript(app: &AppHandle, file_path: &PathBuf, status: &str, text: &str) {
    // transcript 放在素材所在 raw/ 目录上一级的 transcripts/ 下
    // raw/录音.m4a → ../transcripts/录音.json
    let raw_dir = file_path.parent().unwrap_or(file_path.as_path());
    let transcripts_dir = raw_dir.parent().unwrap_or(raw_dir).join("transcripts");
    let _ = std::fs::create_dir_all(&transcripts_dir);
    let base = file_path.file_stem().unwrap_or_default().to_string_lossy();
    let json_path = transcripts_dir.join(format!("{}.json", base));
    let transcript = Transcript { status: status.to_string(), text: text.to_string() };
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
