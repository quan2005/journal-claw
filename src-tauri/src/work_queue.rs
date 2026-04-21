use crate::config;
use crate::conversation::{self, ConversationStore, ConversationStreamPayload};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Listener, Manager};

// ── Types ────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WorkStatus {
    Queued,
    Processing,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkItem {
    pub id: String,
    pub status: WorkStatus,
    pub session_id: Option<String>,
    pub text: Option<String>,
    pub files: Option<Vec<String>>,
    pub prompt: Option<String>,
    pub display_name: String,
    pub error: Option<String>,
    pub created_at: u64,
}

#[derive(Debug, Serialize, Deserialize)]
struct PersistedQueue {
    items: Vec<WorkItem>,
}

// ── State ────────────────────────────────────────────────

pub struct WorkQueueState {
    pub items: Vec<WorkItem>,
    pub processing: bool,
}

pub struct WorkQueue(pub Mutex<WorkQueueState>);

impl Default for WorkQueue {
    fn default() -> Self {
        Self(Mutex::new(WorkQueueState {
            items: Vec::new(),
            processing: false,
        }))
    }
}

// ── Persistence ──────────────────────────────────────────

fn queue_path(workspace: &str) -> PathBuf {
    PathBuf::from(workspace).join(".work_queue.json")
}

fn save_queue(workspace: &str, items: &[WorkItem]) {
    let path = queue_path(workspace);
    let persisted = PersistedQueue {
        items: items.to_vec(),
    };
    if let Ok(json) = serde_json::to_string_pretty(&persisted) {
        let _ = std::fs::write(path, json);
    }
}

fn load_queue(workspace: &str) -> Vec<WorkItem> {
    let path = queue_path(workspace);
    if !path.exists() {
        return Vec::new();
    }
    match std::fs::read_to_string(&path) {
        Ok(json) => match serde_json::from_str::<PersistedQueue>(&json) {
            Ok(persisted) => persisted.items,
            Err(_) => Vec::new(),
        },
        Err(_) => Vec::new(),
    }
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn emit_queue_updated(app: &AppHandle) {
    let _ = app.emit("work-queue-updated", ());
}

// ── Serial processor ─────────────────────────────────────

/// Called after enqueue or after a work item finishes. Picks the next queued
/// item and runs it through conversation_create + conversation_send, then
/// listens for done/error to advance the queue.
fn process_next(app: AppHandle) {
    let queue_state = app.state::<WorkQueue>();
    let _conv_store = app.state::<ConversationStore>();

    // ── Pick next item under lock ────────────────────────
    let next_item = {
        let mut guard = queue_state.0.lock().unwrap_or_else(|e| e.into_inner());
        if guard.processing {
            return;
        }
        let idx = guard
            .items
            .iter()
            .position(|i| i.status == WorkStatus::Queued);
        match idx {
            Some(i) => {
                guard.items[i].status = WorkStatus::Processing;
                guard.processing = true;
                guard.items[i].clone()
            }
            None => return,
        }
    };

    let workspace = config::load_config(&app)
        .map(|c| c.workspace_path.clone())
        .unwrap_or_default();

    // Persist the status change
    {
        let guard = queue_state.0.lock().unwrap_or_else(|e| e.into_inner());
        save_queue(&workspace, &guard.items);
    }
    emit_queue_updated(&app);

    let item_id = next_item.id.clone();
    let app_clone = app.clone();

    tauri::async_runtime::spawn(async move {
        let result = run_work_item(&app_clone, &next_item).await;
        let queue_state = app_clone.state::<WorkQueue>();
        let workspace = config::load_config(&app_clone)
            .map(|c| c.workspace_path.clone())
            .unwrap_or_default();

        {
            let mut guard = queue_state.0.lock().unwrap_or_else(|e| e.into_inner());
            guard.processing = false;
            if let Some(item) = guard.items.iter_mut().find(|i| i.id == item_id) {
                match result {
                    Ok(sid) => {
                        item.status = WorkStatus::Completed;
                        item.session_id = Some(sid);
                    }
                    Err(e) => {
                        item.status = WorkStatus::Failed;
                        item.error = Some(e);
                    }
                }
            }
            save_queue(&workspace, &guard.items);
        }
        emit_queue_updated(&app_clone);

        // Auto-remove completed items after 2s
        let remove_app = app_clone.clone();
        let remove_id = item_id.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            let queue_state = remove_app.state::<WorkQueue>();
            let workspace = config::load_config(&remove_app)
                .map(|c| c.workspace_path.clone())
                .unwrap_or_default();
            {
                let mut guard = queue_state.0.lock().unwrap_or_else(|e| e.into_inner());
                guard.items.retain(|i| i.id != remove_id);
                save_queue(&workspace, &guard.items);
            }
            emit_queue_updated(&remove_app);
        });

        // Process next in queue
        process_next(app_clone);
    });
}

/// Run a single work item: create conversation, send message, wait for done/error.
async fn run_work_item(app: &AppHandle, item: &WorkItem) -> Result<String, String> {
    let store = app.state::<ConversationStore>();

    // Create conversation session — files are referenced in the user message,
    // NOT injected into the system prompt via context_files.
    let sid = conversation::conversation_create(
        app.clone(),
        store.clone(),
        conversation::SessionMode::Agent,
        None,
        None,
    )
    .await?;

    // Update session_id in queue
    {
        let queue_state = app.state::<WorkQueue>();
        let mut guard = queue_state.0.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(qi) = guard.items.iter_mut().find(|i| i.id == item.id) {
            qi.session_id = Some(sid.clone());
        }
        let workspace = config::load_config(app)
            .map(|c| c.workspace_path.clone())
            .unwrap_or_default();
        save_queue(&workspace, &guard.items);
    }
    emit_queue_updated(app);

    // Build prompt — reference files with @path so the agent reads them via tools
    let prompt = if let Some(ref files) = item.files {
        let refs: Vec<String> = files
            .iter()
            .map(|f| {
                // Use workspace-relative path for @mention
                let workspace = config::load_config(app)
                    .map(|c| c.workspace_path.clone())
                    .unwrap_or_default();
                let rel = f
                    .strip_prefix(&workspace)
                    .unwrap_or(f)
                    .trim_start_matches('/');
                format!("@{}", rel)
            })
            .collect();
        let suffix = item.prompt.as_deref().unwrap_or("请分析和处理");
        format!("{} {}", refs.join(" "), suffix)
    } else if let Some(ref text) = item.text {
        text.clone()
    } else {
        item.prompt
            .clone()
            .unwrap_or_else(|| "请分析和处理".to_string())
    };

    // Notify frontend to auto-open conversation dialog — include prompt so UI can
    // show the user message immediately (before conversation_send appends it).
    let _ = app.emit(
        "work-item-session-created",
        serde_json::json!({
            "item_id": item.id,
            "session_id": sid,
            "prompt": prompt,
        }),
    );

    // Send message
    conversation::conversation_send(app.clone(), store.clone(), sid.clone(), prompt, None).await?;

    // Wait for done/error via oneshot channel.
    // Wrap sender in Mutex<Option<>> so the Fn closure can take ownership once.
    let sid_clone = sid.clone();
    let app_clone = app.clone();
    let (tx, rx) = tokio::sync::oneshot::channel::<Result<(), String>>();
    let tx = std::sync::Mutex::new(Some(tx));

    let listener_id = app.listen("conversation-stream", move |event| {
        if let Ok(payload) = serde_json::from_str::<ConversationStreamPayload>(event.payload()) {
            if payload.session_id != sid_clone {
                return;
            }
            match payload.event.as_str() {
                "done" => {
                    if let Some(tx) = tx.lock().ok().and_then(|mut g| g.take()) {
                        let _ = tx.send(Ok(()));
                    }
                }
                "error" => {
                    if let Some(tx) = tx.lock().ok().and_then(|mut g| g.take()) {
                        let _ = tx.send(Err(payload.data));
                    }
                }
                _ => {}
            }
        }
    });

    let result = rx.await.map_err(|_| "listener dropped".to_string())?;
    app_clone.unlisten(listener_id);

    result.map(|_| sid)
}

// ── Tauri commands ───────────────────────────────────────

#[tauri::command]
pub fn enqueue_work(
    app: AppHandle,
    queue: tauri::State<'_, WorkQueue>,
    text: Option<String>,
    files: Option<Vec<String>>,
    prompt: Option<String>,
    display_name: String,
) -> Result<WorkItem, String> {
    let id = format!("wq-{}", uuid::Uuid::new_v4());
    let item = WorkItem {
        id: id.clone(),
        status: WorkStatus::Queued,
        session_id: None,
        text,
        files,
        prompt,
        display_name,
        error: None,
        created_at: now_secs(),
    };

    let workspace = config::load_config(&app)
        .map(|c| c.workspace_path.clone())
        .unwrap_or_default();

    {
        let mut guard = queue.0.lock().map_err(|e| e.to_string())?;
        guard.items.push(item.clone());
        save_queue(&workspace, &guard.items);
    }
    emit_queue_updated(&app);

    // Kick the processor
    process_next(app);

    Ok(item)
}

#[tauri::command]
pub fn list_work_queue(
    app: AppHandle,
    queue: tauri::State<'_, WorkQueue>,
) -> Result<Vec<WorkItem>, String> {
    let mut guard = queue.0.lock().map_err(|e| e.to_string())?;

    // On first call (empty in-memory), load from disk
    if guard.items.is_empty() {
        let workspace = config::load_config(&app)
            .map(|c| c.workspace_path.clone())
            .unwrap_or_default();
        let persisted = load_queue(&workspace);
        if !persisted.is_empty() {
            guard.items = persisted;
            // Re-queue any items that were processing when app quit
            let mut needs_kick = false;
            for item in &mut guard.items {
                if item.status == WorkStatus::Processing {
                    item.status = WorkStatus::Queued;
                    needs_kick = true;
                }
            }
            // Remove completed items older than 60s
            guard.items.retain(|i| i.status != WorkStatus::Completed);
            save_queue(&workspace, &guard.items);
            if needs_kick {
                drop(guard);
                process_next(app.clone());
                let guard = queue.0.lock().map_err(|e| e.to_string())?;
                return Ok(guard.items.clone());
            }
        }
    }

    Ok(guard.items.clone())
}

#[tauri::command]
pub fn cancel_work_item(
    app: AppHandle,
    queue: tauri::State<'_, WorkQueue>,
    id: String,
) -> Result<(), String> {
    let workspace = config::load_config(&app)
        .map(|c| c.workspace_path.clone())
        .unwrap_or_default();

    let session_to_cancel = {
        let mut guard = queue.0.lock().map_err(|e| e.to_string())?;
        let item = guard
            .items
            .iter_mut()
            .find(|i| i.id == id)
            .ok_or("item not found")?;

        let sid = item.session_id.clone();

        if item.status == WorkStatus::Processing {
            // Cancel the conversation, mark failed
            item.status = WorkStatus::Failed;
            item.error = Some("cancelled".to_string());
            guard.processing = false;
        } else if item.status == WorkStatus::Queued {
            // Just remove from queue
            guard.items.retain(|i| i.id != id);
        }
        save_queue(&workspace, &guard.items);
        sid
    };

    // Cancel conversation if it was processing
    if let Some(sid) = session_to_cancel {
        let store = app.state::<ConversationStore>();
        let _ =
            tauri::async_runtime::block_on(conversation::conversation_cancel(store.clone(), sid));
    }

    emit_queue_updated(&app);

    // Kick processor for next item
    process_next(app);

    Ok(())
}

#[tauri::command]
pub fn retry_work_item(
    app: AppHandle,
    queue: tauri::State<'_, WorkQueue>,
    id: String,
) -> Result<(), String> {
    let workspace = config::load_config(&app)
        .map(|c| c.workspace_path.clone())
        .unwrap_or_default();

    {
        let mut guard = queue.0.lock().map_err(|e| e.to_string())?;
        let item = guard
            .items
            .iter_mut()
            .find(|i| i.id == id)
            .ok_or("item not found")?;

        if item.status != WorkStatus::Failed {
            return Err("can only retry failed items".to_string());
        }

        item.status = WorkStatus::Queued;
        item.error = None;
        item.session_id = None;
        save_queue(&workspace, &guard.items);
    }

    emit_queue_updated(&app);
    process_next(app);

    Ok(())
}

#[tauri::command]
pub fn dismiss_work_item(
    app: AppHandle,
    queue: tauri::State<'_, WorkQueue>,
    id: String,
) -> Result<(), String> {
    let workspace = config::load_config(&app)
        .map(|c| c.workspace_path.clone())
        .unwrap_or_default();

    {
        let mut guard = queue.0.lock().map_err(|e| e.to_string())?;
        guard.items.retain(|i| i.id != id);
        save_queue(&workspace, &guard.items);
    }

    emit_queue_updated(&app);
    Ok(())
}
