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
pub struct Transcript {
    pub status: String,
    pub text: String,
}

fn transcripts_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e: tauri::Error| e.to_string())?;
    let dir = dir.join("transcripts");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn transcript_path(app: &AppHandle, filename: &str) -> Result<PathBuf, String> {
    let base = filename.trim_end_matches(".m4a");
    Ok(transcripts_dir(app)?.join(format!("{}.json", base)))
}

fn emit_progress(app: &AppHandle, filename: &str, status: &str) {
    let payload = serde_json::json!({ "filename": filename, "status": status });
    let _ = app.emit("transcription-progress", payload);
}

/// Upload a local audio file to DashScope and return the file_url.
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
    let file_bytes = fs::read(path).map_err(|e| e.to_string())?;

    let part = reqwest::multipart::Part::bytes(file_bytes)
        .file_name(file_name)
        .mime_str("audio/mp4")
        .map_err(|e| e.to_string())?;

    let form = reqwest::multipart::Form::new().part("file", part);

    let resp = client
        .post(UPLOAD_URL)
        .header("Authorization", format!("Bearer {}", api_key))
        .multipart(form)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Upload failed ({}): {}", status, body));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e: reqwest::Error| e.to_string())?;
    let output = data
        .get("output")
        .ok_or("No output in upload response")?;

    // Try multiple response formats for file_url
    let url = output
        .get("uploaded_file")
        .and_then(|f: &serde_json::Value| f.get("file_url"))
        .or_else(|| output.get("file_url"))
        .or_else(|| output.get("url"))
        .and_then(|v: &serde_json::Value| v.as_str())
        .ok_or_else(|| {
            format!(
                "No file_url in upload response: {}",
                serde_json::to_string(&output).unwrap_or_default()
            )
        })?;
    Ok(url.to_string())
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
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Submit failed ({}): {}", status, body));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e: reqwest::Error| e.to_string())?;
    let task_id = data
        .get("output")
        .and_then(|o: &serde_json::Value| o.get("task_id"))
        .and_then(|v: &serde_json::Value| v.as_str())
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

        let data: serde_json::Value = resp.json().await.map_err(|e: reqwest::Error| e.to_string())?;
        let status = data
            .get("output")
            .and_then(|o: &serde_json::Value| o.get("task_status"))
            .and_then(|v: &serde_json::Value| v.as_str())
            .unwrap_or("UNKNOWN");

        match status {
            "PENDING" | "RUNNING" => {
                emit_progress(app, filename, "transcribing");
            }
            "SUCCEEDED" => {
                let transcription_url = data
                    .get("output")
                    .and_then(|o: &serde_json::Value| o.get("results"))
                    .and_then(|r: &serde_json::Value| r.as_array())
                    .and_then(|arr: &Vec<serde_json::Value>| arr.first())
                    .and_then(|r: &serde_json::Value| r.get("transcription_url"))
                    .and_then(|v: &serde_json::Value| v.as_str())
                    .map(String::from);
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

    let body: serde_json::Value = resp.json().await.map_err(|e: reqwest::Error| e.to_string())?;

    // Try multiple output formats
    let text = body
        .get("outputs")
        .and_then(|o: &serde_json::Value| o.as_array())
        .and_then(|arr: &Vec<serde_json::Value>| arr.first())
        .and_then(|o: &serde_json::Value| o.get("text"))
        .and_then(|v: &serde_json::Value| v.as_str())
        .or_else(|| {
            body.get("text")
                .and_then(|v: &serde_json::Value| v.as_str())
        })
        .unwrap_or_default();
    Ok(text.to_string())
}

fn save_transcript(app: &AppHandle, filename: &str, status: &str, text: &str) {
    let transcript = Transcript {
        status: status.to_string(),
        text: text.to_string(),
    };
    let path = match transcript_path(app, filename) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("transcript_path error: {}", e);
            return;
        }
    };
    if let Ok(data) = serde_json::to_string_pretty(&transcript) {
        let _ = fs::write(&path, data);
    }
    emit_progress(app, filename, status);
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

    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let client = reqwest::Client::new();

            emit_progress(&app, &filename, "uploading");

            let file_url = match upload_file(&client, &api_key, &file_path).await {
                Ok(url) => url,
                Err(e) => {
                    eprintln!("Upload failed: {}", e);
                    save_transcript(&app, &filename, "failed", &format!("上传失败: {}", e));
                    return;
                }
            };

            emit_progress(&app, &filename, "transcribing");

            let task_id = match submit_transcription(&client, &api_key, &file_url).await {
                Ok(id) => id,
                Err(e) => {
                    eprintln!("Submit failed: {}", e);
                    save_transcript(&app, &filename, "failed", &format!("提交失败: {}", e));
                    return;
                }
            };

            let transcription_url =
                match poll_task(&client, &api_key, &task_id, &app, &filename).await {
                    Ok(Some(url)) => url,
                    Ok(None) => {
                        save_transcript(&app, &filename, "failed", "未获取到转写结果");
                        return;
                    }
                    Err(e) => {
                        eprintln!("Poll failed: {}", e);
                        save_transcript(
                            &app,
                            &filename,
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
                        &filename,
                        "failed",
                        &format!("获取转写文本失败: {}", e),
                    );
                    return;
                }
            };

            save_transcript(&app, &filename, "completed", &text);
        });
    });
}

#[tauri::command]
pub fn get_transcript(app: AppHandle, filename: String) -> Result<Option<Transcript>, String> {
    let path = transcript_path(&app, &filename)?;
    if !path.exists() {
        return Ok(None);
    }
    let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let transcript: Transcript = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    Ok(Some(transcript))
}

#[tauri::command]
pub fn retry_transcription(app: AppHandle, filename: String) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let file_path = dir.join(&filename);
    if !file_path.exists() {
        return Err("file not found".to_string());
    }
    let duration_secs = crate::recordings::read_duration_pub(&file_path);
    start_transcription(app, filename, file_path, duration_secs);
    Ok(())
}
