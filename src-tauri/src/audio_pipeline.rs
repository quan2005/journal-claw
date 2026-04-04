use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize)]
struct AudioAiReadyPayload {
    source_path: String,
    material_path: String,
    filename: String,
}

#[derive(Debug, Clone, Serialize)]
struct AudioAiFailedPayload {
    source_path: String,
    filename: String,
    error: String,
}

fn emit_failed(app: &AppHandle, audio_path: &Path, error: String) {
    let filename = audio_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let _ = app.emit(
        "audio-ai-material-failed",
        AudioAiFailedPayload {
            source_path: audio_path.to_string_lossy().to_string(),
            filename,
            error,
        },
    );
}

async fn run_audio_pipeline(
    app: AppHandle,
    audio_path: PathBuf,
    year_month: String,
    enqueue_ai: bool,
    note: Option<String>,
) -> Result<PathBuf, String> {
    let duration_secs = crate::recordings::read_duration_pub(&audio_path);

    // duration=0 但文件有数据，说明格式不兼容（如 Opus in m4a），直接报错
    if duration_secs <= 0.0 {
        let file_size = std::fs::metadata(&audio_path).map(|m| m.len()).unwrap_or(0);
        if file_size > 10_000 {
            let msg = "不支持的音频格式（可能是 Opus 编码），请转换为 AAC 格式后重试".to_string();
            eprintln!("[audio_pipeline] duration=0, file_size={}, rejecting: {}", file_size, msg);
            emit_failed(&app, &audio_path, msg.clone());
            return Err(msg);
        }
    }

    let material_path = crate::transcription::transcribe_audio_to_ai_markdown(
        app.clone(),
        audio_path.clone(),
        duration_secs,
    )
    .await?;

    let filename = audio_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let _ = app.emit(
        "audio-ai-material-ready",
        AudioAiReadyPayload {
            source_path: audio_path.to_string_lossy().to_string(),
            material_path: material_path.to_string_lossy().to_string(),
            filename: filename.clone(),
        },
    );

    if enqueue_ai {
        // 转写内容为空时跳过 AI 处理
        let material_content = std::fs::read_to_string(&material_path).unwrap_or_default();
        let has_content = material_content
            .split("## 转写内容")
            .nth(1)
            .map(|body| body.trim().len() > 0)
            .unwrap_or(false);

        if !has_content {
            eprintln!("[audio_pipeline] 转写内容为空，跳过 AI 处理: {}", filename);
            return Ok(material_path);
        }

        if let Err(error) = crate::ai_processor::enqueue_material(
            &app,
            material_path.to_string_lossy().to_string(),
            year_month,
            note,
            None,
        )
        .await
        {
            let _ = app.emit(
                "ai-processing",
                crate::ai_processor::ProcessingUpdate {
                    material_path: material_path.to_string_lossy().to_string(),
                    status: "failed".to_string(),
                    error: Some(error),
                },
            );
        }
    }

    Ok(material_path)
}

pub fn start_audio_pipeline(
    app: AppHandle,
    audio_path: PathBuf,
    year_month: String,
    enqueue_ai: bool,
    note: Option<String>,
) {
    tauri::async_runtime::spawn(async move {
        if let Err(error) = run_audio_pipeline(
            app.clone(),
            audio_path.clone(),
            year_month,
            enqueue_ai,
            note,
        )
        .await
        {
            emit_failed(&app, &audio_path, error);
        }
    });
}

#[tauri::command]
pub fn prepare_audio_for_ai(
    app: AppHandle,
    audio_path: String,
    year_month: String,
    note: Option<String>,
) -> Result<(), String> {
    let audio_path_buf = PathBuf::from(&audio_path);
    if !audio_path_buf.exists() {
        emit_failed(&app, &audio_path_buf, format!("文件不存在: {}", audio_path));
        return Ok(());
    }

    start_audio_pipeline(app, audio_path_buf, year_month, true, note);
    Ok(())
}
