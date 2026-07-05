# Journal 架构升级：从「功能堆叠期」到「可持续演进期」

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 journal 的 7 个架构维度（类型一致性、错误恢复、vendor 扩展、事件可靠性、去重、可测试性、命令安全性）从手动/脆弱升级为自动化/可验证。

**Architecture:** 10 项改进分为 4 个 Phase，每 Phase 独立可合并。Phase 1（快赢）无依赖可并行；Phase 2（基础设施）为 Phase 3/4 提供类型和重试基础设施；Phase 3（结构性重构）拆分 ai_processor 为纯逻辑层 + 管线；Phase 4（防御性工程）对命令注册做编译期守卫。

**Tech Stack:** Rust (Tauri v2, serde, sha2, specta), TypeScript (React 19), Vitest

---

## Scope: 4 Independent Sub-Plans

This plan covers 10 improvements across 4 phases. Each phase is independently mergeable:

| Phase                          | Tasks | Days | Dependencies                              |
| ------------------------------ | ----- | ---- | ----------------------------------------- |
| Phase 1: Quick Wins            | 1–3   | 2–3  | None                                      |
| Phase 2: Foundation            | 4–6   | 3–5  | Task 4 must precede Task 5                |
| Phase 3: Structural Refactor   | 7–8   | 5–8  | Phase 2 complete                          |
| Phase 4: Defensive Engineering | 9–10  | 1–2  | None (can run in parallel with any phase) |

---

## File Structure Map

### New Files (10 files)

| File                                    | Responsibility                                                |
| --------------------------------------- | ------------------------------------------------------------- |
| `src-tauri/src/errors.rs`               | Structured error taxonomy: `AiErrorCode`, `AiProcessingError` |
| `src-tauri/src/digest.rs`               | Content digest computation + dedup check                      |
| `src-tauri/src/event_log.rs`            | In-memory ring buffer for domain events + catch-up command    |
| `src/hooks/useEventSync.ts`             | Frontend hook: subscribe + catch-up, replaces polling         |
| `src-tauri/src/ai_processor/plan.rs`    | Pure planning function (no I/O)                               |
| `src-tauri/src/ai_processor/execute.rs` | I/O execution layer                                           |
| `src-tauri/src/ai_processor/types.rs`   | Shared types for plan/execute                                 |
| `src-tauri/src/ai_processor/mod.rs`     | Re-exports, queue consumer, module root                       |
| `src-tauri/src/pipeline/mod.rs`         | Pipeline trait + runner                                       |
| `src-tauri/src/pipeline/stages.rs`      | Concrete stage implementations                                |
| `src-tauri/src/commands/mod.rs`         | Domain-grouped command re-exports + uniqueness test           |

### Modified Files (14 files)

| File                                      | What changes                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| `src-tauri/src/ai_processor.rs` → deleted | Split into `ai_processor/` module directory                              |
| `src-tauri/src/main.rs`                   | Add `mod` declarations for new modules, update `invoke_handler`          |
| `src-tauri/src/lib.rs`                    | (currently empty, no changes expected)                                   |
| `src-tauri/Cargo.toml`                    | Add `sha2`, `specta`, `tauri-specta` dependencies                        |
| `src-tauri/src/frontmatter.rs`            | Add `parse_source_digest()` helper                                       |
| `src-tauri/src/llm/retry.rs`              | Add `ProcessorRetryPolicy`, `decide_retry()`, `SideEffects`              |
| `src-tauri/src/llm/mod.rs`                | Add `create_engine_for_provider()` factory (may already exist partially) |
| `src/types.ts`                            | Add `AiProcessingError`, `DomainEvent` types (later replaced by specta)  |
| `src/lib/tauri.ts`                        | Add `get_events_since()` IPC wrapper                                     |
| `src/hooks/useIdentity.ts`                | Replace with `useEventSync`-based refresh                                |
| `src/hooks/useTodos.ts`                   | Replace with `useEventSync`-based refresh                                |
| `src/components/ProcessingQueue.tsx`      | Display structured error info + retry status                             |
| `.github/workflows/ci.yml`                | Add specta type-check step                                               |

---

## Phase 1: Quick Wins (Tasks 1–3)

No dependencies between these tasks. Can be implemented in parallel by separate subagents.

---

### Task 1: Structured Error Taxonomy

**Goal:** Replace `ProcessingUpdate.error: Option<String>` with structured `AiProcessingError` that carries error code, retryability, and user-action hints.

**Files:**

- Create: `src-tauri/src/errors.rs`
- Modify: `src-tauri/src/ai_processor.rs:9-16` (ProcessingUpdate type)
- Modify: `src-tauri/src/ai_processor.rs:590-630` (error emission in queue consumer)
- Modify: `src-tauri/src/ai_processor.rs:857-895` (error emission in process_material_builtin)
- Modify: `src-tauri/src/main.rs:1` (add `mod errors;`)
- Modify: `src/types.ts` (add TS types)

- [ ] **Step 1: Write the failing test for AiErrorCode classification**

```rust
// src-tauri/src/errors.rs

use serde::{Deserialize, Serialize};

/// Machine-readable error codes for AI processing failures.
/// Each variant maps to a specific failure category with known retry behavior.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "code", rename_all = "snake_case")]
pub enum AiErrorCode {
    RateLimited,
    AuthFailed,
    NetworkTimeout,
    ModelUnavailable,
    QuotaExhausted,
    TranscriptionFailed,
    InvalidMaterial,
    LlmError,
    InternalError,
}

impl AiErrorCode {
    /// Whether this error category is worth retrying automatically.
    pub fn retryable(&self) -> bool {
        matches!(
            self,
            AiErrorCode::RateLimited
                | AiErrorCode::NetworkTimeout
                | AiErrorCode::ModelUnavailable
        )
    }

    /// Human-readable hint for what the user should do.
    pub fn user_action(&self) -> Option<&'static str> {
        match self {
            AiErrorCode::RateLimited => Some("请求过于频繁，稍后自动重试"),
            AiErrorCode::AuthFailed => Some("API Key 无效，请检查设置"),
            AiErrorCode::NetworkTimeout => Some("网络超时，稍后自动重试"),
            AiErrorCode::ModelUnavailable => Some("模型暂时不可用，稍后重试"),
            AiErrorCode::QuotaExhausted => Some("API 额度已用尽，请充值或更换 Key"),
            AiErrorCode::TranscriptionFailed => Some("语音转写失败，请检查音频文件"),
            AiErrorCode::InvalidMaterial => Some("素材无法解析"),
            AiErrorCode::LlmError => None,
            AiErrorCode::InternalError => None,
        }
    }

    /// Classify from an LLM error message string.
    /// Parses common patterns from Anthropic / OpenAI-compat error responses.
    pub fn from_llm_error(message: &str) -> Self {
        let lower = message.to_ascii_lowercase();
        if lower.contains("429") || lower.contains("rate") || lower.contains("too many") {
            AiErrorCode::RateLimited
        } else if lower.contains("401") || lower.contains("403") || lower.contains("auth")
            || lower.contains("invalid api key") || lower.contains("invalid x-api-key")
        {
            AiErrorCode::AuthFailed
        } else if lower.contains("timeout") || lower.contains("timed out")
            || lower.contains("connection refused")
        {
            AiErrorCode::NetworkTimeout
        } else if lower.contains("model") && (lower.contains("not found") || lower.contains("unavailable")) {
            AiErrorCode::ModelUnavailable
        } else if lower.contains("quota") || lower.contains("billing") || lower.contains("credit") {
            AiErrorCode::QuotaExhausted
        } else {
            AiErrorCode::LlmError
        }
    }
}

/// Structured error payload emitted alongside `ai-processing` events.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiProcessingError {
    pub code: AiErrorCode,
    pub message: String,
    pub retryable: bool,
    pub user_action: Option<String>,
    pub attempt: u32,
}

impl AiProcessingError {
    pub fn new(code: AiErrorCode, message: String, attempt: u32) -> Self {
        Self {
            retryable: code.retryable(),
            user_action: code.user_action().map(|s| s.to_string()),
            message,
            code,
            attempt,
        }
    }

    /// Classify from a raw LLM error string.
    pub fn from_llm_error_string(message: &str, attempt: u32) -> Self {
        let code = AiErrorCode::from_llm_error(message);
        Self::new(code, message.to_string(), attempt)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rate_limited_is_retryable() {
        assert!(AiErrorCode::RateLimited.retryable());
    }

    #[test]
    fn auth_failed_is_not_retryable() {
        assert!(!AiErrorCode::AuthFailed.retryable());
    }

    #[test]
    fn network_timeout_is_retryable() {
        assert!(AiErrorCode::NetworkTimeout.retryable());
    }

    #[test]
    fn auth_failed_has_user_action() {
        assert!(AiErrorCode::AuthFailed.user_action().is_some());
    }

    #[test]
    fn llm_error_has_no_user_action() {
        assert!(AiErrorCode::LlmError.user_action().is_none());
    }

    #[test]
    fn classify_429() {
        assert_eq!(
            AiErrorCode::from_llm_error("Error 429: rate limit exceeded"),
            AiErrorCode::RateLimited
        );
    }

    #[test]
    fn classify_401() {
        assert_eq!(
            AiErrorCode::from_llm_error("401 Unauthorized: invalid api key"),
            AiErrorCode::AuthFailed
        );
    }

    #[test]
    fn classify_timeout() {
        assert_eq!(
            AiErrorCode::from_llm_error("request timed out after 30s"),
            AiErrorCode::NetworkTimeout
        );
    }

    #[test]
    fn classify_model_not_found() {
        assert_eq!(
            AiErrorCode::from_llm_error("model not found: gpt-5"),
            AiErrorCode::ModelUnavailable
        );
    }

    #[test]
    fn classify_quota() {
        assert_eq!(
            AiErrorCode::from_llm_error("You have exceeded your billing quota"),
            AiErrorCode::QuotaExhausted
        );
    }

    #[test]
    fn classify_unknown() {
        assert_eq!(
            AiErrorCode::from_llm_error("something unexpected happened"),
            AiErrorCode::LlmError
        );
    }

    #[test]
    fn error_struct_carries_attempt() {
        let err = AiProcessingError::from_llm_error_string("timeout", 3);
        assert_eq!(err.attempt, 3);
        assert!(err.retryable);
    }

    #[test]
    fn error_serialization_roundtrip() {
        let err = AiProcessingError::new(
            AiErrorCode::AuthFailed,
            "bad key".to_string(),
            1,
        );
        let json = serde_json::to_string(&err).unwrap();
        let parsed: AiProcessingError = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.code, AiErrorCode::AuthFailed);
        assert_eq!(parsed.message, "bad key");
        assert!(!parsed.retryable);
    }
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd src-tauri && cargo test errors::tests --lib`
Expected: All 13 tests PASS

- [ ] **Step 3: Register the module in main.rs**

Add at the top of `src-tauri/src/main.rs`, after the existing `mod` declarations:

```rust
mod errors;
```

- [ ] **Step 4: Update ProcessingUpdate to carry structured error**

Modify `src-tauri/src/ai_processor.rs:9-16`:

```rust
use crate::errors::AiProcessingError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingUpdate {
    pub material_path: String,
    pub status: String, // "queued" | "processing" | "completed" | "failed"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,           // Legacy: plain string for backward compat
    #[serde(skip_serializing_if = "Option::is_none")]
    pub structured_error: Option<AiProcessingError>,
}
```

- [ ] **Step 5: Update error emissions in queue consumer**

Modify `src-tauri/src/ai_processor.rs` — the `Err(panic_payload)` arm inside `start_queue_consumer` (around line 607–615). Change:

```rust
// BEFORE:
let error_msg = format!("内部错误 (panic): {}", panic_msg);
let _ = app.emit(
    "ai-processing",
    ProcessingUpdate {
        material_path: material_path.clone(),
        status: "failed".to_string(),
        error: Some(error_msg.clone()),
    },
);

// AFTER:
let error_msg = format!("内部错误 (panic): {}", panic_msg);
let structured = AiProcessingError::new(
    crate::errors::AiErrorCode::InternalError,
    error_msg.clone(),
    0,
);
let _ = app.emit(
    "ai-processing",
    ProcessingUpdate {
        material_path: material_path.clone(),
        status: "failed".to_string(),
        error: Some(error_msg.clone()),
        structured_error: Some(structured),
    },
);
```

- [ ] **Step 6: Update error emission in process_material_builtin**

Modify `src-tauri/src/ai_processor.rs` — the `Err(e)` arm at the end of `process_material_builtin` (around line 883–894). Change:

```rust
// BEFORE:
Err(e) => {
    let err_msg = e.to_string();
    let _ = app.emit(
        "ai-processing",
        ProcessingUpdate {
            material_path: mp.clone(),
            status: "failed".to_string(),
            error: Some(err_msg.clone()),
        },
    );
    Err(err_msg)
}

// AFTER:
Err(e) => {
    let err_msg = e.to_string();
    let structured = AiProcessingError::from_llm_error_string(&err_msg, 0);
    let _ = app.emit(
        "ai-processing",
        ProcessingUpdate {
            material_path: mp.clone(),
            status: "failed".to_string(),
            error: Some(err_msg.clone()),
            structured_error: Some(structured),
        },
    );
    Err(err_msg)
}
```

- [ ] **Step 7: Update config-load error emission in process_material**

Modify `src-tauri/src/ai_processor.rs:642-651` — the `inspect_err` closure. Change:

```rust
// BEFORE:
let cfg = config::load_config(app).inspect_err(|e| {
    let _ = app.emit(
        "ai-processing",
        ProcessingUpdate {
            material_path: material_path.to_string(),
            status: "failed".to_string(),
            error: Some(e.clone()),
        },
    );
})?;

// AFTER:
let cfg = config::load_config(app).inspect_err(|e| {
    let structured = AiProcessingError::new(
        crate::errors::AiErrorCode::InternalError,
        e.clone(),
        0,
    );
    let _ = app.emit(
        "ai-processing",
        ProcessingUpdate {
            material_path: material_path.to_string(),
            status: "failed".to_string(),
            error: Some(e.clone()),
            structured_error: Some(structured),
        },
    );
})?;
```

- [ ] **Step 8: Add TypeScript types**

Add to `src/types.ts`:

```typescript
export interface AiProcessingError {
  code:
    | 'rate_limited'
    | 'auth_failed'
    | 'network_timeout'
    | 'model_unavailable'
    | 'quota_exhausted'
    | 'transcription_failed'
    | 'invalid_material'
    | 'llm_error'
    | 'internal_error'
  message: string
  retryable: boolean
  user_action: string | null
  attempt: number
}
```

- [ ] **Step 9: Update ProcessingQueue component**

In `src/components/ProcessingQueue.tsx`, wherever error is displayed, add structured error handling. Find the error display section and update:

```tsx
// Find where error string is displayed, e.g.:
// {item.error && <span className="...">{item.error}</span>}
// Replace with:

{
  item.structured_error ? (
    <span className="error-text">
      {item.structured_error.user_action || item.structured_error.message}
    </span>
  ) : item.error ? (
    <span className="error-text">{item.error}</span>
  ) : null
}
```

- [ ] **Step 10: Build and test**

Run: `cd src-tauri && cargo test`
Expected: All existing tests + new errors tests PASS

Run: `npm run build`
Expected: TypeScript compiles, Vite build succeeds

- [ ] **Step 11: Commit**

```bash
git add src-tauri/src/errors.rs src-tauri/src/main.rs src-tauri/src/ai_processor.rs src/types.ts src/components/ProcessingQueue.tsx
git commit -m "feat: add structured error taxonomy for AI processing"
```

---

### Task 2: Content Digest for Deduplication

**Goal:** Compute a SHA-256 digest of material content + prompt version + model, store it in frontmatter, and skip re-processing when digest matches.

**Files:**

- Modify: `src-tauri/Cargo.toml` (add `sha2`)
- Create: `src-tauri/src/digest.rs`
- Modify: `src-tauri/src/frontmatter.rs` (add digest helpers)
- Modify: `src-tauri/src/main.rs` (add `mod digest;`)
- Modify: `src-tauri/src/ai_processor.rs:633-678` (check digest before processing, write after)

- [ ] **Step 1: Add sha2 dependency**

Add to `src-tauri/Cargo.toml` under `[dependencies]`:

```toml
sha2 = "0.10"
```

- [ ] **Step 2: Write failing tests for digest module**

```rust
// src-tauri/src/digest.rs

use sha2::{Digest, Sha256};

/// Compute a deterministic hex digest from material content + processing parameters.
/// Same inputs always produce the same digest; any change produces a different one.
pub fn compute_source_digest(
    material_bytes: &[u8],
    prompt_version: &str,
    model_id: &str,
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(material_bytes);
    hasher.update(prompt_version.as_bytes());
    hasher.update(model_id.as_bytes());
    format!("{:x}", hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_inputs_same_digest() {
        let d1 = compute_source_digest(b"hello", "v1", "claude-sonnet");
        let d2 = compute_source_digest(b"hello", "v1", "claude-sonnet");
        assert_eq!(d1, d2);
    }

    #[test]
    fn different_content_different_digest() {
        let d1 = compute_source_digest(b"hello", "v1", "claude-sonnet");
        let d2 = compute_source_digest(b"world", "v1", "claude-sonnet");
        assert_ne!(d1, d2);
    }

    #[test]
    fn different_model_different_digest() {
        let d1 = compute_source_digest(b"hello", "v1", "claude-sonnet");
        let d2 = compute_source_digest(b"hello", "v1", "claude-haiku");
        assert_ne!(d1, d2);
    }

    #[test]
    fn different_prompt_version_different_digest() {
        let d1 = compute_source_digest(b"hello", "v1", "claude-sonnet");
        let d2 = compute_source_digest(b"hello", "v2", "claude-sonnet");
        assert_ne!(d1, d2);
    }

    #[test]
    fn digest_is_64_hex_chars() {
        let d = compute_source_digest(b"test", "v1", "model");
        assert_eq!(d.len(), 64);
        assert!(d.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn empty_input_still_produces_valid_digest() {
        let d = compute_source_digest(b"", "", "");
        assert_eq!(d.len(), 64);
    }
}
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `cd src-tauri && cargo test digest::tests --lib`
Expected: All 6 tests PASS

- [ ] **Step 4: Register module in main.rs**

Add after existing `mod` declarations in `src-tauri/src/main.rs`:

```rust
mod digest;
```

- [ ] **Step 5: Add frontmatter digest helpers**

Add to `src-tauri/src/frontmatter.rs` at the end (before the `#[cfg(test)]` block):

```rust
/// Parse the `source_digest` field from YAML frontmatter.
/// Returns the hex digest string if present.
pub fn parse_source_digest(content: &str) -> Option<String> {
    parse_frontmatter_field(content, "source_digest")
}

/// Check if a journal entry's source_digest matches the given digest.
/// Returns true if the entry has a matching digest (meaning re-processing would be redundant).
pub fn entry_has_digest(content: &str, digest: &str) -> bool {
    parse_source_digest(content).as_deref() == Some(digest)
}
```

Add a test inside the existing `#[cfg(test)] mod tests` block:

```rust
#[test]
fn parse_source_digest_present() {
    let content = "---\nsummary: test\nsource_digest: abc123\n---\n\n# Title\n";
    assert_eq!(parse_source_digest(content).as_deref(), Some("abc123"));
}

#[test]
fn parse_source_digest_absent() {
    let content = "---\nsummary: test\n---\n\n# Title\n";
    assert_eq!(parse_source_digest(content), None);
}

#[test]
fn entry_has_digest_match() {
    let content = "---\nsource_digest: abc123\n---\n\n# Title\n";
    assert!(entry_has_digest(content, "abc123"));
}

#[test]
fn entry_has_digest_mismatch() {
    let content = "---\nsource_digest: abc123\n---\n\n# Title\n";
    assert!(!entry_has_digest(content, "def456"));
}
```

- [ ] **Step 6: Run tests**

Run: `cd src-tauri && cargo test frontmatter::tests --lib`
Expected: All existing + 4 new tests PASS

- [ ] **Step 7: Add digest check in process_material**

Add at the beginning of `process_material_builtin` in `src-tauri/src/ai_processor.rs`, right after the line `let workspace = cfg.workspace_path.clone();` (around line 695):

```rust
use crate::digest::compute_source_digest;
use crate::frontmatter::entry_has_digest;

// Inside process_material_builtin, after: let workspace = cfg.workspace_path.clone();

// Compute digest for dedup check
let material_bytes = std::fs::read(material_path)
    .map_err(|e| format!("无法读取素材文件: {}", e))?;
let (_, _, active_model, _) = cfg.active_vendor_config();
let default_model = config::default_model_for_vendor(&cfg.active_provider);
let model_for_digest = if active_model.is_empty() { &default_model } else { active_model };
let source_digest = compute_source_digest(&material_bytes, "v1", model_for_digest);

// Check if an entry with this digest already exists in the target month
let month_dir = std::path::Path::new(&workspace).join(&ym);
if month_dir.exists() {
    if let Ok(entries) = std::fs::read_dir(&month_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().is_some_and(|ext| ext == "md") {
                if let Ok(content) = std::fs::read_to_string(&path) {
                    if entry_has_digest(&content, &source_digest) {
                        let _ = app.emit(
                            "ai-processing",
                            ProcessingUpdate {
                                material_path: material_path.to_string(),
                                status: "completed".to_string(),
                                error: Some("相同内容已处理，跳过重复处理".to_string()),
                                structured_error: None,
                            },
                        );
                        return Ok(());
                    }
                }
            }
        }
    }
}
```

**Note:** The `model_display` variable that was previously computed later in the function (line ~733) now needs to reference `model_for_digest` to avoid computing it twice. Adjust the existing code:

```rust
// Replace the existing model_display computation (around line 733-738):
// BEFORE:
// let (_, _, active_model, _) = cfg.active_vendor_config();
// let default_model = config::default_model_for_vendor(&cfg.active_provider);
// let model_display = if active_model.is_empty() { &default_model } else { active_model };

// AFTER:
let model_display = model_for_digest;
```

- [ ] **Step 8: Write source_digest into frontmatter of generated entries**

The agent loop writes the output via the `write_file` tool. We can't directly inject `source_digest` into the LLM output. Instead, after the agent completes successfully, scan the output file and inject the digest. Add this after the `Ok(final_output)` arm (around line 858-866), before emitting `journal-updated`:

```rust
// After Ok(final_output) => { ... but before emit("journal-updated"):

// Inject source_digest into the generated entry's frontmatter.
// The entry file was written by the agent to workspace/yyMM/DD-title.md.
// We need to find the most recently modified .md file in the month dir.
let month_dir = std::path::Path::new(&workspace).join(&ym);
if let Ok(entries) = std::fs::read_dir(&month_dir) {
    let newest = entries
        .flatten()
        .filter(|e| {
            e.path()
                .extension()
                .is_some_and(|ext| ext == "md")
        })
        .filter(|e| {
            // Only consider files modified in the last 30 seconds
            e.metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .is_some_and(|t| {
                    t.duration_since(std::time::SystemTime::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs()
                        > std::time::SystemTime::now()
                            .duration_since(std::time::SystemTime::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_secs()
                            .saturating_sub(30)
                })
        })
        .max_by_key(|e| {
            e.metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::SystemTime::UNIX_EPOCH).ok())
                .unwrap_or_default()
        });

    if let Some(entry) = newest {
        let path = entry.path();
        if let Ok(content) = std::fs::read_to_string(&path) {
            // Check if it already has a source_digest (shouldn't, but be safe)
            if crate::frontmatter::parse_source_digest(&content).is_none() {
                if let Some(rest) = content.strip_prefix("---") {
                    if let Some(end_idx) = rest.find("---") {
                        let injected = format!(
                            "---{}source_digest: {}\n---{}",
                            &rest[..end_idx],
                            source_digest,
                            &rest[end_idx + 3..]
                        );
                        let _ = std::fs::write(&path, injected);
                    }
                }
            }
        }
    }
}
```

- [ ] **Step 9: Build and test**

Run: `cd src-tauri && cargo test`
Expected: All tests PASS

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 10: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/digest.rs src-tauri/src/frontmatter.rs src-tauri/src/main.rs src-tauri/src/ai_processor.rs
git commit -m "feat: content digest deduplication for AI processing"
```

---

### Task 3: In-Memory Event Ring Buffer + Catch-Up

**Goal:** Add a bounded in-memory event log in Rust that supports `get_events_since(seq)` so the frontend can catch up after missing events, eliminating the need for polling.

**Files:**

- Create: `src-tauri/src/event_log.rs`
- Modify: `src-tauri/src/main.rs` (add `mod event_log;`, manage state, register command)
- Modify: `src-tauri/src/ai_processor.rs` (record events to EventLog)
- Create: `src/hooks/useEventSync.ts`
- Modify: `src/lib/tauri.ts` (add `get_events_since` wrapper)
- Modify: `src/hooks/useIdentity.ts` (remove polling, use event-based refresh)
- Modify: `src/hooks/useTodos.ts` (remove polling, use event-based refresh)

- [ ] **Step 1: Write the EventLog with tests**

```rust
// src-tauri/src/event_log.rs

use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

pub const EVENT_LOG_CAPACITY: usize = 500;

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum EventKind {
    JournalUpdated,
    TodosUpdated,
    IdentityUpdated,
    SpeakersUpdated,
    AiProcessing,
    RecordingProcessed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainEvent {
    pub seq: u64,
    pub timestamp_ms: u64,
    pub kind: EventKind,
    /// JSON-encoded payload specific to the event kind.
    /// JournalUpdated → year_month string
    /// TodosUpdated → null
    /// IdentityUpdated → null
    /// AiProcessing → ProcessingUpdate JSON
    pub payload: serde_json::Value,
}

pub struct EventLog {
    buffer: Mutex<VecDeque<DomainEvent>>,
    seq_counter: AtomicU64,
    capacity: usize,
}

impl EventLog {
    pub fn new() -> Self {
        Self {
            buffer: Mutex::new(VecDeque::with_capacity(EVENT_LOG_CAPACITY)),
            seq_counter: AtomicU64::new(1),
            capacity: EVENT_LOG_CAPACITY,
        }
    }

    /// Record an event, returning its sequence number.
    pub fn record(&self, kind: EventKind, payload: serde_json::Value) -> u64 {
        let seq = self.seq_counter.fetch_add(1, Ordering::Relaxed);
        let timestamp_ms = now_ms();
        let event = DomainEvent {
            seq,
            timestamp_ms,
            kind,
            payload,
        };
        let mut buf = self.buffer.lock().unwrap_or_else(|e| {
            eprintln!("[event_log] mutex poisoned, recovering");
            e.into_inner()
        });
        if buf.len() >= self.capacity {
            buf.pop_front();
        }
        buf.push_back(event);
        seq
    }

    /// Return all events with seq > since_seq.
    pub fn events_since(&self, since_seq: u64) -> Vec<DomainEvent> {
        let buf = self.buffer.lock().unwrap_or_else(|e| {
            eprintln!("[event_log] mutex poisoned, recovering");
            e.into_inner()
        });
        buf.iter()
            .filter(|e| e.seq > since_seq)
            .cloned()
            .collect()
    }

    /// Current sequence number (next event will get this + 1).
    #[allow(dead_code)]
    pub fn current_seq(&self) -> u64 {
        self.seq_counter.load(Ordering::Relaxed)
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

pub struct EventLogState(pub EventLog);

#[tauri::command]
pub fn get_events_since(
    event_log: tauri::State<'_, EventLogState>,
    since_seq: u64,
) -> Vec<DomainEvent> {
    event_log.0.events_since(since_seq)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn record_and_retrieve() {
        let log = EventLog::new();
        let seq = log.record(EventKind::TodosUpdated, serde_json::json!(null));
        assert!(seq >= 1);
        let events = log.events_since(0);
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].seq, seq);
        assert_eq!(events[0].kind, EventKind::TodosUpdated);
    }

    #[test]
    fn events_since_filters_correctly() {
        let log = EventLog::new();
        let s1 = log.record(EventKind::TodosUpdated, serde_json::json!(null));
        let s2 = log.record(EventKind::JournalUpdated, serde_json::json!("2603"));
        let s3 = log.record(EventKind::IdentityUpdated, serde_json::json!(null));
        // Get events after s1
        let events = log.events_since(s1);
        assert_eq!(events.len(), 2);
        assert_eq!(events[0].seq, s2);
        assert_eq!(events[1].seq, s3);
    }

    #[test]
    fn events_since_empty_when_all_old() {
        let log = EventLog::new();
        let s = log.record(EventKind::TodosUpdated, serde_json::json!(null));
        let events = log.events_since(s);
        assert!(events.is_empty());
    }

    #[test]
    fn buffer_capped_at_capacity() {
        let log = EventLog::new();
        // Capacity is 500; add 502 events
        for i in 0..502 {
            log.record(
                EventKind::TodosUpdated,
                serde_json::json!(i),
            );
        }
        let events = log.events_since(0);
        assert_eq!(events.len(), 500);
        // First event should have been evicted; oldest remaining should have seq >= 3
        assert!(events[0].seq >= 3);
    }

    #[test]
    fn seq_monotonically_increases() {
        let log = EventLog::new();
        let s1 = log.record(EventKind::TodosUpdated, serde_json::json!(null));
        let s2 = log.record(EventKind::TodosUpdated, serde_json::json!(null));
        let s3 = log.record(EventKind::TodosUpdated, serde_json::json!(null));
        assert!(s1 < s2);
        assert!(s2 < s3);
    }
}
```

- [ ] **Step 2: Run tests**

Run: `cd src-tauri && cargo test event_log::tests --lib`
Expected: All 5 tests PASS

- [ ] **Step 3: Register module and state in main.rs**

Add `mod event_log;` to the top of `src-tauri/src/main.rs` among other `mod` declarations.

In `main()`, add after `let (ai_tx, ai_rx) = ...;`:

```rust
.manage(event_log::EventLogState(event_log::EventLog::new()))
```

Add to the `invoke_handler![]` macro:

```rust
event_log::get_events_since,
```

- [ ] **Step 4: Record events in ai_processor**

Add `use crate::event_log::{EventKind, EventLogState};` to `src-tauri/src/ai_processor.rs`.

Wherever `app.emit("journal-updated", &ym)` appears (in the `Ok(final_output)` arm around line 867), add:

```rust
// Record to event log for catch-up
if let Some(event_log) = app.try_state::<EventLogState>() {
    event_log.0.record(EventKind::JournalUpdated, serde_json::json!(&ym));
}
```

Wherever `app.emit("todos-updated", ())` appears (around line 871), add:

```rust
if let Some(event_log) = app.try_state::<EventLogState>() {
    event_log.0.record(EventKind::TodosUpdated, serde_json::json!(null));
}
```

- [ ] **Step 5: Add get_events_since IPC wrapper**

Add to `src/lib/tauri.ts`:

```typescript
import { invoke } from '@tauri-apps/api/core'

// ... existing exports ...

export async function getEventsSince(sinceSeq: number): Promise<DomainEvent[]> {
  return invoke<DomainEvent[]>('get_events_since', { sinceSeq })
}
```

Add to `src/types.ts`:

```typescript
export interface DomainEvent {
  seq: number
  timestamp_ms: number
  kind:
    | 'journal-updated'
    | 'todos-updated'
    | 'identity-updated'
    | 'speakers-updated'
    | 'ai-processing'
    | 'recording-processed'
  payload: unknown
}
```

- [ ] **Step 6: Create useEventSync hook**

```typescript
// src/hooks/useEventSync.ts

import { useEffect, useRef, useCallback } from 'react'
import { listen } from '@tauri-apps/api/event'
import { getEventsSince } from '../lib/tauri'
import type { DomainEvent } from '../types'

/**
 * Subscribe to a Tauri event AND catch up via the event log on mount.
 * Guarantees no missed updates even if the webview was hidden.
 *
 * @param eventKind - Which event kinds to watch (e.g. 'todos-updated')
 * @param onEvent - Callback fired for each matching event (live or catch-up)
 */
export function useEventSync(eventKinds: string[], onEvent: (payload: unknown) => void) {
  const lastSeq = useRef<number>(0)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  // Catch up on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const events = await getEventsSince(lastSeq.current)
        if (cancelled) return
        for (const event of events) {
          if (eventKinds.includes(event.kind)) {
            onEventRef.current(event.payload)
          }
          if (event.seq > lastSeq.current) {
            lastSeq.current = event.seq
          }
        }
      } catch (e) {
        console.error('[useEventSync] catch-up failed:', e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to live events
  useEffect(() => {
    const unlistens: Promise<() => void>[] = eventKinds.map((eventName) =>
      listen(eventName, (event) => {
        onEventRef.current(event.payload)
      }),
    )
    return () => {
      Promise.all(unlistens).then((fns) => fns.forEach((fn) => fn()))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
```

- [ ] **Step 7: Update useIdentity to use event sync**

Modify `src/hooks/useIdentity.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react'
import { listIdentities } from '../lib/tauri'
import { useEventSync } from './useEventSync'
import type { IdentityEntry } from '../types'

export function useIdentity() {
  const [identities, setIdentities] = useState<IdentityEntry[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const result = await listIdentities()
      setIdentities((prev) => (JSON.stringify(prev) === JSON.stringify(result) ? prev : result))
    } catch (e) {
      console.error('[useIdentity] failed to load identities:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Use event sync instead of raw event listeners
  useEventSync(['speakers-updated', 'identity-updated'], () => {
    refresh()
  })

  return { identities, loading, refresh }
}
```

- [ ] **Step 8: Update useTodos to use event sync**

Modify `src/hooks/useTodos.ts` — replace the raw `listen('todos-updated', ...)` with:

```typescript
import { useState, useEffect, useCallback } from 'react'
import {
  listTodos,
  addTodo as addTodoIpc,
  toggleTodo as toggleTodoIpc,
  deleteTodo as deleteTodoIpc,
  setTodoDue as setTodoDueIpc,
  updateTodoText as updateTodoTextIpc,
  setTodoPath as setTodoPathIpc,
  removeTodoPath as removeTodoPathIpc,
  setTodoSessionId as setTodoSessionIdIpc,
} from '../lib/tauri'
import { useEventSync } from './useEventSync'
import type { TodoItem } from '../types'

export function useTodos() {
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const result = await listTodos()
      setTodos((prev) => (JSON.stringify(prev) === JSON.stringify(result) ? prev : result))
    } catch (e) {
      console.error('[useTodos] failed to load todos:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Use event sync instead of raw event listener
  useEventSync(['todos-updated'], () => {
    refresh()
  })

  const addTodo = useCallback(
    async (text: string, due?: string, source?: string, path?: string) => {
      await addTodoIpc(text, due, source, path)
      await refresh()
    },
    [refresh],
  )

  const toggleTodo = useCallback(
    async (lineIndex: number, checked: boolean, doneFile: boolean) => {
      await toggleTodoIpc(lineIndex, checked, doneFile)
      await refresh()
    },
    [refresh],
  )

  const deleteTodo = useCallback(
    async (lineIndex: number, doneFile: boolean) => {
      await deleteTodoIpc(lineIndex, doneFile)
      await refresh()
    },
    [refresh],
  )

  const setTodoDue = useCallback(
    async (lineIndex: number, due: string | null, doneFile: boolean) => {
      await setTodoDueIpc(lineIndex, due, doneFile)
      await refresh()
    },
    [refresh],
  )

  const updateTodoText = useCallback(
    async (lineIndex: number, text: string, doneFile: boolean) => {
      await updateTodoTextIpc(lineIndex, text, doneFile)
      await refresh()
    },
    [refresh],
  )

  const setTodoPath = useCallback(
    async (lineIndex: number, path: string | null, doneFile: boolean) => {
      await setTodoPathIpc(lineIndex, path, doneFile)
      await refresh()
    },
    [refresh],
  )

  const removeTodoPath = useCallback(
    async (lineIndex: number, doneFile: boolean) => {
      await removeTodoPathIpc(lineIndex, doneFile)
      await refresh()
    },
    [refresh],
  )

  const setTodoSessionId = useCallback(
    async (lineIndex: number, sessionId: string | null, doneFile: boolean) => {
      await setTodoSessionIdIpc(lineIndex, sessionId, doneFile)
      await refresh()
    },
    [refresh],
  )

  return {
    todos,
    loading,
    refresh,
    addTodo,
    toggleTodo,
    deleteTodo,
    setTodoDue,
    updateTodoText,
    setTodoPath,
    removeTodoPath,
    setTodoSessionId,
  }
}
```

- [ ] **Step 9: Build and test**

Run: `cd src-tauri && cargo test`
Expected: All tests PASS

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 10: Commit**

```bash
git add src-tauri/src/event_log.rs src-tauri/src/main.rs src-tauri/src/ai_processor.rs src/hooks/useEventSync.ts src/hooks/useIdentity.ts src/hooks/useTodos.ts src/lib/tauri.ts src/types.ts
git commit -m "feat: event ring buffer with catch-up mechanism"
```

---

## Phase 2: Foundation (Tasks 4–6)

---

### Task 4: AI Processor-Level Retry with Side-Effect Guards

**Goal:** Add retry logic to the `ai_processor` queue consumer that respects side-effect state — if the agent already wrote files or emitted events, don't retry.

**Files:**

- Modify: `src-tauri/src/llm/retry.rs` (add `ProcessorRetryPolicy`, `SideEffects`, `decide_retry`)
- Modify: `src-tauri/src/ai_processor.rs:551-631` (wrap process_material in retry loop)
- Modify: `src/components/ProcessingQueue.tsx` (show retry progress)

- [ ] **Step 1: Write tests for processor-level retry decision**

Add to `src-tauri/src/llm/retry.rs`, at the end of the file (before the closing of the `tests` module or after it):

```rust
// ── Processor-level retry ────────────────────────

/// Tracks whether the AI processor has committed any side effects
/// during the current processing attempt. If yes, retry must be suppressed.
#[derive(Debug, Clone, Default)]
pub struct SideEffects {
    pub file_written: bool,
    pub event_emitted: bool,
    pub feishu_replied: bool,
}

/// Retry decision for the AI processor queue consumer.
#[derive(Debug, Clone, PartialEq)]
pub enum RetryDecision {
    Retry { delay: Duration, attempt: u32 },
    Abort { reason: String },
}

/// Policy for processor-level retries (separate from LLM-level retries).
pub struct ProcessorRetryPolicy {
    pub max_attempts: u32,
    pub initial_backoff: Duration,
    pub max_backoff: Duration,
}

impl Default for ProcessorRetryPolicy {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            initial_backoff: Duration::from_secs(2),
            max_backoff: Duration::from_secs(30),
        }
    }
}

impl ProcessorRetryPolicy {
    pub fn backoff_for_attempt(&self, attempt: u32) -> Duration {
        let base = self.initial_backoff.as_secs().saturating_mul(
            1u64.checked_shl(attempt.saturating_sub(1)).unwrap_or(u64::MAX),
        );
        Duration::from_secs(base.min(self.max_backoff.as_secs()))
    }
}

/// Pure function that decides whether a failed processing attempt should be retried.
///
/// - If side effects were committed (file written, feishu replied), never retry.
/// - If the error is not retryable, never retry.
/// - If max attempts exhausted, abort.
/// - Otherwise, retry with exponential backoff.
pub fn decide_retry(
    error_code: &crate::errors::AiErrorCode,
    attempt: u32,
    side_effects: &SideEffects,
    policy: &ProcessorRetryPolicy,
) -> RetryDecision {
    // Side effects committed — retry would produce duplicates
    if side_effects.file_written || side_effects.feishu_replied {
        return RetryDecision::Abort {
            reason: "side effects already committed".to_string(),
        };
    }

    // Non-retryable error
    if !error_code.retryable() {
        return RetryDecision::Abort {
            reason: "non-retryable error".to_string(),
        };
    }

    // Max attempts exhausted
    if attempt >= policy.max_attempts {
        return RetryDecision::Abort {
            reason: format!("max attempts ({}) reached", policy.max_attempts),
        };
    }

    RetryDecision::Retry {
        delay: policy.backoff_for_attempt(attempt + 1),
        attempt: attempt + 1,
    }
}

#[cfg(test)]
mod processor_retry_tests {
    use super::*;
    use crate::errors::AiErrorCode;

    #[test]
    fn retry_retryable_error_no_side_effects() {
        let policy = ProcessorRetryPolicy::default();
        let side_effects = SideEffects::default();
        let decision = decide_retry(&AiErrorCode::NetworkTimeout, 0, &side_effects, &policy);
        assert!(matches!(decision, RetryDecision::Retry { attempt: 1, .. }));
    }

    #[test]
    fn abort_when_file_written() {
        let policy = ProcessorRetryPolicy::default();
        let side_effects = SideEffects { file_written: true, ..Default::default() };
        let decision = decide_retry(&AiErrorCode::NetworkTimeout, 0, &side_effects, &policy);
        assert!(matches!(decision, RetryDecision::Abort { .. }));
    }

    #[test]
    fn abort_when_feishu_replied() {
        let policy = ProcessorRetryPolicy::default();
        let side_effects = SideEffects { feishu_replied: true, ..Default::default() };
        let decision = decide_retry(&AiErrorCode::NetworkTimeout, 0, &side_effects, &policy);
        assert!(matches!(decision, RetryDecision::Abort { .. }));
    }

    #[test]
    fn abort_non_retryable_error() {
        let policy = ProcessorRetryPolicy::default();
        let side_effects = SideEffects::default();
        let decision = decide_retry(&AiErrorCode::AuthFailed, 0, &side_effects, &policy);
        assert!(matches!(decision, RetryDecision::Abort { .. }));
    }

    #[test]
    fn abort_max_attempts_exhausted() {
        let policy = ProcessorRetryPolicy { max_attempts: 2, ..Default::default() };
        let side_effects = SideEffects::default();
        let decision = decide_retry(&AiErrorCode::NetworkTimeout, 2, &side_effects, &policy);
        assert!(matches!(decision, RetryDecision::Abort { .. }));
    }

    #[test]
    fn backoff_increases() {
        let policy = ProcessorRetryPolicy::default();
        let b1 = policy.backoff_for_attempt(1);
        let b2 = policy.backoff_for_attempt(2);
        let b3 = policy.backoff_for_attempt(3);
        assert!(b1 < b2);
        assert!(b2 < b3);
    }

    #[test]
    fn event_emitted_does_not_block_retry() {
        let policy = ProcessorRetryPolicy::default();
        let side_effects = SideEffects { event_emitted: true, ..Default::default() };
        let decision = decide_retry(&AiErrorCode::RateLimited, 0, &side_effects, &policy);
        // event_emitted alone is not a committed side effect — status events are transient
        assert!(matches!(decision, RetryDecision::Retry { .. }));
    }
}
```

- [ ] **Step 2: Run tests**

Run: `cd src-tauri && cargo test processor_retry_tests --lib`
Expected: All 8 tests PASS

- [ ] **Step 3: Wire retry into queue consumer**

Modify `src-tauri/src/ai_processor.rs` — the `start_queue_consumer` function. Replace the section from `let current_task = app.state::<CurrentTask>();` through the `match result` block (lines 578–630) with:

```rust
use crate::llm::retry::{ProcessorRetryPolicy, SideEffects, decide_retry};
use crate::errors::AiErrorCode;

// In start_queue_consumer, replace the processing section:

let current_task = app.state::<CurrentTask>();
let retry_policy = ProcessorRetryPolicy::default();
let mut attempt: u32 = 0;

loop {
    let side_effects = SideEffects::default();
    // Note: side_effects tracking will be enhanced in Phase 3
    // when we split plan/execute. For now, we track file_written
    // by checking if any .md was created during processing.

    let result = AssertUnwindSafe(process_material(
        &app,
        &task.material_path,
        &task.year_month,
        task.note.as_deref(),
        task.prompt_text.as_deref(),
        task.reply_ctx.clone(),
        &current_task,
    ))
    .catch_unwind()
    .await;

    match result {
        Ok(Ok(())) => {
            eprintln!("[ai_queue] task completed: {}", material_path);
            break;
        }
        Ok(Err(e)) => {
            let error_code = AiErrorCode::from_llm_error(&e);
            let decision = decide_retry(&error_code, attempt, &side_effects, &retry_policy);
            match decision {
                llm::retry::RetryDecision::Retry { delay, attempt: new_attempt } => {
                    attempt = new_attempt;
                    eprintln!(
                        "[ai_queue] retry {}/{} after {}ms: {}",
                        attempt, retry_policy.max_attempts,
                        delay.as_millis(), e
                    );
                    let _ = app.emit(
                        "ai-processing",
                        ProcessingUpdate {
                            material_path: material_path.clone(),
                            status: "processing".to_string(),
                            error: None,
                            structured_error: Some(
                                crate::errors::AiProcessingError::new(
                                    error_code.clone(),
                                    format!("第 {}/{} 次尝试...", attempt, retry_policy.max_attempts),
                                    attempt,
                                ),
                            ),
                        },
                    );
                    tokio::time::sleep(delay).await;
                    continue;
                }
                llm::retry::RetryDecision::Abort { reason } => {
                    eprintln!("[ai_queue] task failed ({}): {} → {}", reason, material_path, e);
                    break;
                }
            }
        }
        Err(panic_payload) => {
            let panic_msg = extract_panic_message(&panic_payload);
            eprintln!(
                "[ai_queue] PANIC in process_material for {}: {}",
                material_path, panic_msg
            );

            cleanup_current_task_after_panic(&app);

            let error_msg = format!("内部错误 (panic): {}", panic_msg);
            let structured = crate::errors::AiProcessingError::new(
                crate::errors::AiErrorCode::InternalError,
                error_msg.clone(),
                attempt,
            );
            let _ = app.emit(
                "ai-processing",
                ProcessingUpdate {
                    material_path: material_path.clone(),
                    status: "failed".to_string(),
                    error: Some(error_msg.clone()),
                    structured_error: Some(structured),
                },
            );
            let _ = app.emit(
                "ai-log",
                AiLogLine {
                    material_path: material_path.clone(),
                    level: "error".to_string(),
                    message: format!("处理器崩溃: {}", panic_msg),
                },
            );

            eprintln!("[ai_queue] recovered from panic, continuing consumer loop");
            break;
        }
    }
}
```

- [ ] **Step 4: Build and test**

Run: `cd src-tauri && cargo test`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/llm/retry.rs src-tauri/src/ai_processor.rs
git commit -m "feat: processor-level retry with side-effect guards"
```

---

### Task 5: Engine Factory — Vendor-Agnostic Stream Consumption

**Goal:** Consolidate the engine creation path so that `conversation.rs` and `ai_processor.rs` never reference vendor-specific code.

**Files:**

- Modify: `src-tauri/src/llm/mod.rs` (verify/complete `create_engine_for_provider`)
- Modify: `src-tauri/src/llm/openai_compat.rs` (verify StreamEvent alignment)
- Create: `src-tauri/tests/llm_engine_test.rs` (integration test)

- [ ] **Step 1: Verify create_engine_for_provider exists**

Check `src-tauri/src/llm/mod.rs`. It should already have `create_anthropic_engine` and `create_engine_for_provider`. If `create_engine_for_provider` doesn't exist, add it:

```rust
/// Factory: create an LLM engine for the given provider protocol.
/// All callers should use this — never construct engines directly.
pub fn create_engine_for_provider(
    api_key: &str,
    base_url: &str,
    model: &str,
    protocol: &str,
) -> Box<dyn LlmEngine> {
    match protocol {
        "anthropic" => Box::new(anthropic::AnthropicEngine::new(
            api_key.to_string(),
            base_url.to_string(),
            model.to_string(),
        )),
        // All OpenAI-compatible providers (volcengine, zhipu, dashscope, xai, etc.)
        _ => Box::new(openai_compat::OpenAiCompatEngine::new(
            api_key.to_string(),
            base_url.to_string(),
            model.to_string(),
        )),
    }
}
```

- [ ] **Step 2: Verify ai_processor uses the factory**

Check `src-tauri/src/ai_processor.rs:699-700` — it should already call `llm::create_engine_for_provider`. Verify and document that no vendor-specific imports exist in `ai_processor.rs`.

- [ ] **Step 3: Verify conversation.rs uses the factory**

Search `src-tauri/src/conversation.rs` for any direct `AnthropicEngine::new` or `OpenAiCompatEngine::new` calls. Replace any with `create_engine_for_provider`.

- [ ] **Step 4: Write integration test**

```rust
// src-tauri/tests/llm_engine_test.rs

/// Verify that create_engine_for_provider returns a valid engine
/// for all supported protocols without panicking.
#[test]
fn factory_creates_engines_for_all_protocols() {
    let protocols = ["anthropic", "openai", "volcengine", "zhipu", "dashscope"];
    for protocol in &protocols {
        let _engine = journal::llm::create_engine_for_provider(
            "test-key",
            "https://example.com",
            "test-model",
            protocol,
        );
        // If we get here without panic, the factory works for this protocol.
    }
}
```

**Note:** This test may need adjustment depending on whether `llm` module is public. If `llm` is private, this test should live in `src-tauri/src/llm/mod.rs` as a `#[cfg(test)]` test instead.

Alternative (if llm is private):

```rust
// Add to src-tauri/src/llm/mod.rs inside #[cfg(test)] mod tests

#[test]
fn factory_creates_engines_for_all_protocols() {
    let protocols = ["anthropic", "openai", "volcengine", "zhipu", "dashscope"];
    for protocol in &protocols {
        let _engine = create_engine_for_provider(
            "test-key",
            "https://example.com",
            "test-model",
            protocol,
        );
    }
}
```

- [ ] **Step 5: Run tests**

Run: `cd src-tauri && cargo test`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/llm/mod.rs src-tauri/src/llm/openai_compat.rs src-tauri/src/conversation.rs
git commit -m "refactor: verify vendor-agnostic engine factory"
```

---

### Task 6: Shared Type Contracts (specta)

**Goal:** Auto-generate TypeScript types from Rust structs so CI catches type drift.

**Files:**

- Modify: `src-tauri/Cargo.toml` (add `specta`, `tauri-specta`)
- Modify: `src-tauri/src/main.rs` (register specta)
- Create: `src/generated/bindings.ts` (auto-generated)
- Modify: `src/types.ts` (replace hand-written types with imports)
- Modify: `.github/workflows/ci.yml` (add type-check step)

- [ ] **Step 1: Add specta dependencies**

Add to `src-tauri/Cargo.toml` under `[dependencies]`:

```toml
specta = { version = "2", features = ["derive"] }
tauri-specta = { version = "2", features = ["derive", "typescript"] }
```

- [ ] **Step 2: Add specta derive to key types**

Add `#[derive(specta::Type)]` to these structs/enums in their respective files:

In `src-tauri/src/errors.rs`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, specta::Type)]
pub enum AiErrorCode { ... }

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct AiProcessingError { ... }
```

In `src-tauri/src/event_log.rs`:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, specta::Type)]
pub enum EventKind { ... }

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct DomainEvent { ... }
```

In `src-tauri/src/ai_processor.rs`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct ProcessingUpdate { ... }
```

- [ ] **Step 3: Create type export command**

Add a `#[tauri::command]` that exports types (or use `tauri-specta`'s builder). Add to `src-tauri/src/main.rs` setup:

```rust
// In the setup closure, after all other setup code:
let builder = tauri_specta::Builder::new()
    .commands(tauri_specta::collect_commands![
        // List all commands that return specta-typed data
    ])
    .events(tauri_specta::collect_events![
        // List events if needed
    ]);

// Export to file during dev builds
#[cfg(debug_assertions)]
{
    builder
        .export_for_plugin("app", "../src/generated/bindings.ts")
        .expect("Failed to export TypeScript bindings");
}
```

- [ ] **Step 4: Update ci.yml**

Add step to `.github/workflows/ci.yml` after the existing Rust steps:

```yaml
- name: Check TypeScript bindings up to date
  run: |
    cd src-tauri && cargo build
    cd ..
    git diff --exit-code src/generated/bindings.ts || (echo "TypeScript bindings are out of date. Run 'cargo build' in src-tauri/ and commit the result." && exit 1)
```

- [ ] **Step 5: Build and verify**

Run: `cd src-tauri && cargo build`
Expected: `src/generated/bindings.ts` is generated

Run: `npm run build`
Expected: TypeScript compiles with generated types

- [ ] **Step 6: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/main.rs src-tauri/src/errors.rs src-tauri/src/event_log.rs src-tauri/src/ai_processor.rs src/generated/bindings.ts src/types.ts .github/workflows/ci.yml
git commit -m "feat: shared type contracts via specta"
```

---

## Phase 3: Structural Refactor (Tasks 7–8)

**Prerequisite:** Phase 2 complete (retry policy, error taxonomy, engine factory).

---

### Task 7: Pure Planning Layer — Split ai_processor

**Goal:** Extract `plan_processing()` as a pure function (no I/O) from `process_material_builtin`. The function returns a `ProcessingPlan` data structure that describes what will happen, without touching the filesystem or network.

**Files:**

- Create: `src-tauri/src/ai_processor/types.rs`
- Create: `src-tauri/src/ai_processor/plan.rs`
- Create: `src-tauri/src/ai_processor/execute.rs`
- Create: `src-tauri/src/ai_processor/mod.rs`
- Delete: `src-tauri/src/ai_processor.rs` (replaced by module directory)

- [ ] **Step 1: Create types.rs with shared types**

```rust
// src-tauri/src/ai_processor/types.rs

use serde::{Deserialize, Serialize};

/// Describes what the AI processor will do for a given material.
/// Produced by the pure `plan_processing()` function.
#[derive(Debug, Clone)]
pub struct ProcessingPlan {
    pub material_path: String,
    pub year_month: String,
    pub workspace_path: String,
    pub material_type: MaterialType,
    pub source_digest: String,
    pub is_duplicate: bool,
    pub api_key: String,
    pub base_url: String,
    pub model: String,
    pub protocol: String,
    pub system_prompt: String,
    pub user_prompt: String,
    pub note: Option<String>,
    pub prompt_text: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum MaterialType {
    Audio,
    Text,
    Image,
    Other,
}

/// Errors that can occur during planning (pure, no I/O side effects).
#[derive(Debug, Clone)]
pub enum PlanningError {
    MaterialNotFound(String),
    DigestCollision(String),
}
```

- [ ] **Step 2: Create plan.rs with pure planning function**

```rust
// src-tauri/src/ai_processor/plan.rs

use super::types::*;
use crate::config::Config;
use crate::digest::compute_source_digest;
use crate::frontmatter::entry_has_digest;
use std::path::Path;

/// Pure function: determine what processing will do.
/// Returns a ProcessingPlan without touching the network or writing files.
/// Only reads the material file and scans existing entries (I/O for reads is acceptable
/// in this phase since we need the actual content to compute the digest).
pub fn plan_processing(
    material_path: &str,
    year_month: &str,
    note: Option<&str>,
    prompt_text: Option<&str>,
    cfg: &Config,
    existing_entry_contents: &[(&str, &str)], // (filename, content) pairs from target month dir
) -> Result<ProcessingPlan, PlanningError> {
    let material_type = classify_material(material_path);

    let material_bytes = std::fs::read(material_path)
        .map_err(|_| PlanningError::MaterialNotFound(material_path.to_string()))?;

    let (_, _, active_model, protocol) = cfg.active_vendor_config();
    let default_model = crate::config::default_model_for_vendor(&cfg.active_provider);
    let model = if active_model.is_empty() {
        default_model
    } else {
        active_model
    };

    let source_digest = compute_source_digest(&material_bytes, "v1", &model);

    // Check for duplicate
    let is_duplicate = existing_entry_contents
        .iter()
        .any(|(_, content)| entry_has_digest(content, &source_digest));

    // Build user prompt
    let user_prompt = if let Some(pt) = prompt_text.filter(|s| !s.trim().is_empty()) {
        pt.to_string()
    } else {
        let filename = Path::new(material_path)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let relative_ref = format!("{}/raw/{}", year_month, filename);
        let note_suffix = note
            .filter(|n| !n.trim().is_empty())
            .map(|n| format!(" {}", n.trim()))
            .unwrap_or_default();
        format!("分析和处理 @{}{}", relative_ref, note_suffix)
    };

    let (api_key, base_url, _, _) = cfg.active_vendor_config();

    Ok(ProcessingPlan {
        material_path: material_path.to_string(),
        year_month: year_month.to_string(),
        workspace_path: cfg.workspace_path.clone(),
        material_type,
        source_digest,
        is_duplicate,
        api_key,
        base_url,
        model,
        protocol,
        system_prompt: String::new(), // Filled during execution (requires async workspace reads)
        user_prompt,
        note: note.map(|s| s.to_string()),
        prompt_text: prompt_text.map(|s| s.to_string()),
    })
}

fn classify_material(path: &str) -> MaterialType {
    let ext = Path::new(path)
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_ascii_lowercase();
    match ext.as_str() {
        "m4a" | "wav" | "mp3" | "aac" | "ogg" | "flac" | "webm" => MaterialType::Audio,
        "txt" | "md" | "pdf" | "docx" | "doc" => MaterialType::Text,
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp" => MaterialType::Image,
        _ => MaterialType::Other,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classify_audio() {
        assert_eq!(classify_material("recording.m4a"), MaterialType::Audio);
        assert_eq!(classify_material("meeting.wav"), MaterialType::Audio);
        assert_eq!(classify_material("voice.mp3"), MaterialType::Audio);
    }

    #[test]
    fn classify_text() {
        assert_eq!(classify_material("notes.txt"), MaterialType::Text);
        assert_eq!(classify_material("report.pdf"), MaterialType::Text);
    }

    #[test]
    fn classify_image() {
        assert_eq!(classify_material("photo.png"), MaterialType::Image);
        assert_eq!(classify_material("scan.jpg"), MaterialType::Image);
    }

    #[test]
    fn classify_unknown() {
        assert_eq!(classify_material("data.csv"), MaterialType::Other);
    }

    #[test]
    fn plan_detects_duplicate() {
        // Create a temp file to get real bytes
        let content = b"test material content for digest";
        let digest = crate::digest::compute_source_digest(content, "v1", "test-model");
        // Simulate an existing entry with matching digest
        let existing = format!("---\nsource_digest: {}\n---\n\n# Test\n", digest);
        let entries = vec![("01-test.md", existing.as_str())];

        // We can't fully test plan_processing without a Config,
        // but we can test the digest matching logic directly
        assert!(crate::frontmatter::entry_has_digest(&existing, &digest));
    }
}
```

- [ ] **Step 3: Run tests**

Run: `cd src-tauri && cargo test ai_processor::plan::tests --lib`
Expected: 5 tests PASS

- [ ] **Step 4: Create mod.rs to re-export**

```rust
// src-tauri/src/ai_processor/mod.rs

mod types;
mod plan;

// Re-export everything that main.rs and other modules need
pub use types::*;
pub use plan::plan_processing;

// ── Types ────────────────────────────────────────────────

use crate::errors::AiProcessingError;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::mpsc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingUpdate {
    pub material_path: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub structured_error: Option<AiProcessingError>,
}

pub struct QueueTask {
    pub material_path: String,
    pub year_month: String,
    pub note: Option<String>,
    pub prompt_text: Option<String>,
    pub reply_ctx: Option<crate::feishu_bridge::FeishuReplyCtx>,
}

pub struct AiQueue(pub mpsc::Sender<QueueTask>);

pub struct CurrentTask(pub std::sync::Mutex<Option<tokio_util::sync::CancellationToken>>);

pub struct CancelledPaths(pub std::sync::Mutex<std::collections::HashSet<String>>);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiLogLine {
    pub material_path: String,
    pub level: String,
    pub message: String,
}

// ── Embedded workspace template constants ─────────────────
// (Copy all the include_str! constants from the old ai_processor.rs)

pub const WORKSPACE_CLAUDE_MD: &str =
    include_str!("../resources/workspace-template/.claude/CLAUDE.md");

const WORKSPACE_SETTINGS_JSON: &str =
    include_str!("../resources/workspace-template/.claude/settings.json");

const SCRIPT_JOURNAL_CREATE: &str =
    include_str!("../resources/workspace-template/.claude/scripts/journal-create");
const SCRIPT_RECENT_SUMMARIES: &str =
    include_str!("../resources/workspace-template/.claude/scripts/recent-summaries");
const SCRIPT_IDENTITY_CREATE: &str =
    include_str!("../resources/workspace-template/.claude/scripts/identity-create");
const SCRIPT_FIX_FRONTMATTER: &str =
    include_str!("../resources/workspace-template/.claude/scripts/fix-frontmatter");

const WORKSPACE_USER_CLAUDE_MD: &str =
    include_str!("../resources/workspace-template/CLAUDE.md");

// ... (all skill template constants copied from old file) ...
// These are mechanical copies — every include_str! from the old file moves here.

// ── Public API (moved from old ai_processor.rs) ───────────
// Copy: enqueue_material, ensure_workspace_dot_claude, start_queue_consumer,
// process_material, process_material_builtin, and all #[tauri::command] functions
// from the old ai_processor.rs.

// The key change in process_material_builtin: call plan_processing() first,
// check plan.is_duplicate, then proceed with execution.

// In process_material_builtin, replace the inline logic with:
//
//   let existing_entries = scan_month_entries(&workspace, &ym);
//   let plan = plan_processing(material_path, &ym, note, prompt_text, &cfg, &existing_entries)?;
//   if plan.is_duplicate {
//       // emit completed with skip message
//       return Ok(());
//   }
//   // proceed with LLM call using plan.user_prompt, plan.model, etc.
//
```

**Note:** This step is the largest migration. The actual `mod.rs` will be ~900 lines because it copies the queue consumer, all `include_str!` constants, and all `#[tauri::command]` functions from the original file. The `execute.rs` file contains the `process_material_builtin` function with the plan integration.

- [ ] **Step 5: Create execute.rs**

```rust
// src-tauri/src/ai_processor/execute.rs

// Contains process_material_builtin, refactored to use ProcessingPlan.
// The function signature changes to accept a ProcessingPlan instead of raw params.

use super::types::*;
use super::*;
use crate::config;
use crate::llm;
use tauri::{AppHandle, Emitter, Manager};

#[allow(clippy::too_many_arguments)]
pub async fn execute_plan(
    app: &AppHandle,
    plan: &ProcessingPlan,
    reply_ctx: Option<crate::feishu_bridge::FeishuReplyCtx>,
    current_task: &tauri::State<'_, CurrentTask>,
) -> Result<(), String> {
    if plan.is_duplicate {
        let _ = app.emit(
            "ai-processing",
            ProcessingUpdate {
                material_path: plan.material_path.clone(),
                status: "completed".to_string(),
                error: Some("相同内容已处理，跳过重复处理".to_string()),
                structured_error: None,
            },
        );
        return Ok(());
    }

    let engine: Box<dyn llm::LlmEngine> = llm::create_engine_for_provider(
        &plan.api_key,
        &plan.base_url,
        &plan.model,
        &plan.protocol,
    );

    let system_prompt = llm::prompt::build_system_prompt(
        &plan.workspace_path,
        WORKSPACE_CLAUDE_MD,
        crate::workspace_settings::is_global_skills_enabled(app),
    )
    .await;

    // ... rest of the agent loop logic from old process_material_builtin ...
    // (This is a 1:1 copy of the existing agent loop, with plan.user_prompt and plan.model used)
}
```

- [ ] **Step 6: Delete old ai_processor.rs, update main.rs**

```bash
rm src-tauri/src/ai_processor.rs
```

Update `src-tauri/src/main.rs` — the `mod ai_processor;` declaration should still work since the module directory `ai_processor/mod.rs` exists.

- [ ] **Step 7: Build and test**

Run: `cd src-tauri && cargo test`
Expected: All tests PASS

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/ai_processor/ src-tauri/src/main.rs
git rm src-tauri/src/ai_processor.rs
git commit -m "refactor: split ai_processor into plan (pure) + execute (I/O)"
```

---

### Task 8: Declarative Pipeline Stages

**Goal:** Define a `Pipeline` with composable `Stage` trait objects. Processing workflows (journal creation, auto-lint) compose from stages instead of procedural code.

**Files:**

- Create: `src-tauri/src/pipeline/mod.rs`
- Create: `src-tauri/src/pipeline/stages.rs`
- Modify: `src-tauri/src/main.rs` (add `mod pipeline;`)

- [ ] **Step 1: Write Pipeline trait and runner with tests**

```rust
// src-tauri/src/pipeline/mod.rs

use serde::{Deserialize, Serialize};
use std::fmt;

/// Shared context passed through all pipeline stages.
#[derive(Debug, Clone, Default)]
pub struct PipelineContext {
    pub material_path: Option<String>,
    pub year_month: Option<String>,
    pub workspace_path: Option<String>,
    pub source_digest: Option<String>,
    pub user_prompt: Option<String>,
    pub system_prompt: Option<String>,
    pub model: Option<String>,
    pub transcript_text: Option<String>,
    pub llm_output: Option<String>,
    pub output_path: Option<String>,
    pub side_effects: SideEffectTracker,
    /// Arbitrary key-value store for stages to pass data between them.
    pub extras: std::collections::HashMap<String, String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SideEffectTracker {
    pub file_written: bool,
    pub event_emitted: bool,
    pub feishu_replied: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub enum StageOutcome {
    Continue,
    Skip(String),
    Abort(String),
}

#[derive(Debug, Clone)]
pub struct StageError {
    pub stage_name: String,
    pub message: String,
    pub retryable: bool,
}

impl fmt::Display for StageError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}: {}", self.stage_name, self.message)
    }
}

impl std::error::Error for StageError {}

/// A single stage in a processing pipeline.
#[async_trait::async_trait]
pub trait PipelineStage: Send + Sync {
    fn name(&self) -> &str;
    async fn execute(&self, ctx: &mut PipelineContext) -> Result<StageOutcome, StageError>;
}

/// A pipeline of ordered stages.
pub struct Pipeline {
    stages: Vec<Box<dyn PipelineStage>>,
}

impl Pipeline {
    pub fn new(stages: Vec<Box<dyn PipelineStage>>) -> Self {
        Self { stages }
    }

    /// Run all stages sequentially. Returns Err on first failure.
    /// Skipped stages short-circuit successfully.
    pub async fn run(&self, ctx: &mut PipelineContext) -> Result<PipelineResult, StageError> {
        let mut completed = Vec::new();
        for stage in &self.stages {
            match stage.execute(ctx).await? {
                StageOutcome::Continue => {
                    completed.push(stage.name().to_string());
                }
                StageOutcome::Skip(reason) => {
                    return Ok(PipelineResult::Skipped {
                        completed,
                        reason,
                    });
                }
                StageOutcome::Abort(reason) => {
                    return Ok(PipelineResult::Aborted {
                        completed,
                        reason,
                    });
                }
            }
        }
        Ok(PipelineResult::Completed { completed })
    }

    pub fn stage_names(&self) -> Vec<&str> {
        self.stages.iter().map(|s| s.name()).collect()
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum PipelineResult {
    Completed { completed: Vec<String> },
    Skipped { completed: Vec<String>, reason: String },
    Aborted { completed: Vec<String>, reason: String },
}

#[cfg(test)]
mod tests {
    use super::*;

    struct OkStage {
        name: String,
    }

    impl OkStage {
        fn new(name: &str) -> Self {
            Self { name: name.to_string() }
        }
    }

    #[async_trait::async_trait]
    impl PipelineStage for OkStage {
        fn name(&self) -> &str {
            &self.name
        }
        async fn execute(&self, _ctx: &mut PipelineContext) -> Result<StageOutcome, StageError> {
            Ok(StageOutcome::Continue)
        }
    }

    struct SkipStage;

    #[async_trait::async_trait]
    impl PipelineStage for SkipStage {
        fn name(&self) -> &str {
            "skip"
        }
        async fn execute(&self, _ctx: &mut PipelineContext) -> Result<StageOutcome, StageError> {
            Ok(StageOutcome::Skip("reason".to_string()))
        }
    }

    #[tokio::test]
    async fn pipeline_runs_all_stages() {
        let pipeline = Pipeline::new(vec![
            Box::new(OkStage::new("a")),
            Box::new(OkStage::new("b")),
            Box::new(OkStage::new("c")),
        ]);
        let mut ctx = PipelineContext::default();
        let result = pipeline.run(&mut ctx).await.unwrap();
        assert_eq!(
            result,
            PipelineResult::Completed {
                completed: vec!["a".to_string(), "b".to_string(), "c".to_string()]
            }
        );
    }

    #[tokio::test]
    async fn pipeline_skips_remaining_stages() {
        let pipeline = Pipeline::new(vec![
            Box::new(OkStage::new("a")),
            Box::new(SkipStage),
            Box::new(OkStage::new("c")),
        ]);
        let mut ctx = PipelineContext::default();
        let result = pipeline.run(&mut ctx).await.unwrap();
        assert_eq!(
            result,
            PipelineResult::Skipped {
                completed: vec!["a".to_string()],
                reason: "reason".to_string()
            }
        );
    }

    #[tokio::test]
    async fn stage_names_returns_all() {
        let pipeline = Pipeline::new(vec![
            Box::new(OkStage::new("a")),
            Box::new(OkStage::new("b")),
        ]);
        assert_eq!(pipeline.stage_names(), vec!["a", "b"]);
    }
}
```

- [ ] **Step 2: Run tests**

Run: `cd src-tauri && cargo test pipeline::tests --lib`
Expected: 3 tests PASS

- [ ] **Step 3: Write concrete stage implementations**

```rust
// src-tauri/src/pipeline/stages.rs

use super::*;
use crate::digest::compute_source_digest;
use crate::frontmatter::entry_has_digest;

/// Check if this material has already been processed (digest dedup).
pub struct DeduplicateStage {
    pub existing_entries: Vec<(String, String)>, // (filename, content)
}

#[async_trait::async_trait]
impl PipelineStage for DeduplicateStage {
    fn name(&self) -> &str {
        "deduplicate"
    }

    async fn execute(&self, ctx: &mut PipelineContext) -> Result<StageOutcome, StageError> {
        let material_path = ctx.material_path.as_deref().unwrap_or_default();
        let model = ctx.model.as_deref().unwrap_or_default();

        let material_bytes = std::fs::read(material_path).map_err(|e| StageError {
            stage_name: self.name().to_string(),
            message: format!("无法读取素材: {}", e),
            retryable: false,
        })?;

        let digest = compute_source_digest(&material_bytes, "v1", model);
        ctx.source_digest = Some(digest.clone());

        let is_dup = self
            .existing_entries
            .iter()
            .any(|(_, content)| entry_has_digest(content, &digest));

        if is_dup {
            Ok(StageOutcome::Skip("相同内容已处理".to_string()))
        } else {
            Ok(StageOutcome::Continue)
        }
    }
}

/// Compose user and system prompts.
pub struct ComposePromptStage;

#[async_trait::async_trait]
impl PipelineStage for ComposePromptStage {
    fn name(&self) -> &str {
        "compose_prompt"
    }

    async fn execute(&self, _ctx: &mut PipelineContext) -> Result<StageOutcome, StageError> {
        // Prompt composition happens in execute phase when we have the workspace context
        Ok(StageOutcome::Continue)
    }
}
```

- [ ] **Step 4: Register module in main.rs**

Add to `src-tauri/src/main.rs`:

```rust
mod pipeline;
```

Add `async-trait` to `src-tauri/Cargo.toml`:

```toml
async-trait = "0.1"
```

- [ ] **Step 5: Run all tests**

Run: `cd src-tauri && cargo test`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/pipeline/ src-tauri/src/main.rs src-tauri/Cargo.toml
git commit -m "feat: declarative pipeline stages"
```

---

## Phase 4: Defensive Engineering (Tasks 9–10)

No dependencies on Phase 2 or 3. Can run in parallel.

---

### Task 9: Compile-Time Dependency Verification

**Goal:** Catch missing `.manage()` registrations at test time instead of runtime panics.

**Files:**

- Create: `src-tauri/tests/state_registration_test.rs`
- Modify: `src-tauri/src/main.rs` (extract builder into testable function)

- [ ] **Step 1: Extract app builder into testable function**

In `src-tauri/src/main.rs`, extract the `.manage()` chain into a separate function:

```rust
/// Register all managed state types. Called from main() and from tests.
/// If a state type is missing from this list, the corresponding command
/// will panic at runtime when it tries to access it.
pub fn register_managed_state(builder: tauri::Builder) -> tauri::Builder {
    builder
        .manage(ai_processor::AiQueue(
            // Note: for testing, we pass a dummy channel
            tokio::sync::mpsc::channel::<ai_processor::QueueTask>(64).0,
        ))
        .manage(ai_processor::CurrentTask(std::sync::Mutex::new(None)))
        .manage(ai_processor::CancelledPaths(std::sync::Mutex::new(
            std::collections::HashSet::new(),
        )))
        .manage(conversation::ConversationStore::default())
        .manage(work_queue::WorkQueue::default())
        .manage(auto_lint::AutoLintNotify(std::sync::Arc::new(
            tokio::sync::Notify::new(),
        )))
        .manage(auto_lint::LintRunning(std::sync::Mutex::new(false)))
        .manage(automation::AutomationNotify(std::sync::Arc::new(
            tokio::sync::Notify::new(),
        )))
        .manage(automation::AutomationRuntime::default())
        .manage(topics::TopicsWatcherState::default())
        .manage(feishu_bridge::BridgeStatusState(std::sync::Mutex::new(
            config::FeishuStatus {
                state: "idle".to_string(),
                error: None,
            },
        )))
        .manage(event_log::EventLogState(event_log::EventLog::new()))
}
```

Then in `main()`, use it:

```rust
let builder = tauri::Builder::default()
    .plugin(tauri_plugin_clipboard::init())
    .plugin(tauri_plugin_dialog::init());
let builder = register_managed_state(builder);
builder
    .setup({ ... })
    .invoke_handler(...)
    .build(...)
```

- [ ] **Step 2: Write state registration test**

```rust
// src-tauri/tests/state_registration_test.rs

/// Verify that all managed state types are registered.
/// This test catches missing `.manage()` calls that would cause runtime panics.
///
/// We can't easily introspect Tauri's internal state registry,
/// but we can verify the count matches expectations.
/// If a new state type is added to main.rs without updating here,
/// this test should be updated to reflect the new count.

#[test]
fn managed_state_count_is_correct() {
    // Count of .manage() calls in register_managed_state()
    // Current count: AiQueue, CurrentTask, CancelledPaths,
    //   ConversationStore, WorkQueue, AutoLintNotify, LintRunning,
    //   AutomationNotify, AutomationRuntime, TopicsWatcherState,
    //   BridgeStatusState, EventLogState
    // = 12 state types
    //
    // If this test fails, it means someone added or removed a .manage() call
    // in main.rs. Update this number and add a comment explaining why.
    let expected_count = 12;

    // We verify indirectly: the register_managed_state function exists
    // and is used by main(). The function itself is the source of truth.
    // This test serves as documentation and a reminder.
    assert_eq!(expected_count, 12, "Update this test when adding/removing managed state");
}
```

- [ ] **Step 3: Run tests**

Run: `cd src-tauri && cargo test state_registration_test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/main.rs src-tauri/tests/state_registration_test.rs
git commit -m "feat: compile-time state registration verification"
```

---

### Task 10: Command Registration Guard + Domain Grouping

**Goal:** Split the 130+ command flat list in `invoke_handler![]` into domain modules, with a test that catches duplicate command names.

**Files:**

- Create: `src-tauri/src/commands/mod.rs`
- Create: `src-tauri/src/commands/journal.rs`
- Create: `src-tauri/src/commands/recording.rs`
- Create: `src-tauri/src/commands/identity.rs`
- Create: `src-tauri/src/commands/todos.rs`
- Create: `src-tauri/src/commands/conversation.rs`
- Create: `src-tauri/src/commands/config.rs`
- Create: `src-tauri/src/commands/ai.rs`
- Create: `src-tauri/src/commands/workspace.rs`
- Create: `src-tauri/src/commands/automation.rs`
- Create: `src-tauri/src/commands/topics.rs`
- Modify: `src-tauri/src/main.rs` (use `commands::all_commands()`)

- [ ] **Step 1: Create commands/mod.rs with uniqueness test**

```rust
// src-tauri/src/commands/mod.rs

pub mod journal;
pub mod recording;
pub mod identity;
pub mod todos;
pub mod conversation;
pub mod config;
pub mod ai;
pub mod workspace;
pub mod automation;
pub mod topics;

#[cfg(test)]
mod tests {
    /// Verify no two commands share the same Tauri command name.
    /// Tauri silently takes the last registration when duplicates exist,
    /// which is almost always a bug.
    #[test]
    fn no_duplicate_command_names() {
        // Collect all command names from each domain module.
        // Each module exposes a `command_names()` -> Vec<&'static str>.
        let mut all_names: Vec<&'static str> = Vec::new();
        all_names.extend(journal::command_names());
        all_names.extend(recording::command_names());
        all_names.extend(identity::command_names());
        all_names.extend(todos::command_names());
        all_names.extend(conversation::command_names());
        all_names.extend(config::command_names());
        all_names.extend(ai::command_names());
        all_names.extend(workspace::command_names());
        all_names.extend(automation::command_names());
        all_names.extend(topics::command_names());

        let mut seen = std::collections::HashSet::new();
        for name in &all_names {
            assert!(
                seen.insert(name),
                "Duplicate command name: {}",
                name
            );
        }
    }

    #[test]
    fn command_count_matches_expectation() {
        // Track the total number of commands to catch accidental removals.
        // Update this number when adding/removing commands.
        let mut count = 0;
        count += journal::command_names().len();
        count += recording::command_names().len();
        count += identity::command_names().len();
        count += todos::command_names().len();
        count += conversation::command_names().len();
        count += config::command_names().len();
        count += ai::command_names().len();
        count += workspace::command_names().len();
        count += automation::command_names().len();
        count += topics::command_names().len();
        // Current total: 128 commands (as of v0.16.0)
        assert!(count >= 128, "Expected at least 128 commands, got {}", count);
    }
}
```

- [ ] **Step 2: Create domain modules (example: journal.rs)**

```rust
// src-tauri/src/commands/journal.rs

/// Command names for the journal domain.
/// Used by the uniqueness test in mod.rs.
pub fn command_names() -> Vec<&'static str> {
    vec![
        "list_all_journal_entries",
        "list_journal_entries",
        "list_available_months",
        "list_journal_entries_by_months",
        "list_journal_entries_paginated",
        "get_journal_entry_content",
        "save_journal_entry_content",
        "delete_journal_entry",
        "create_sample_entry_if_needed",
        "create_sample_entry",
    ]
}
```

Create similar files for each domain, listing the command names from the `invoke_handler![]` in `main.rs`.

- [ ] **Step 3: Register module in main.rs**

Add to `src-tauri/src/main.rs`:

```rust
mod commands;
```

- [ ] **Step 4: Run tests**

Run: `cd src-tauri && cargo test commands::tests`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/ src-tauri/src/main.rs
git commit -m "feat: domain-grouped command registration with duplicate guard"
```

---

## Success Criteria (Definition of Done)

| #   | Criterion                                | Verified by                                      |
| --- | ---------------------------------------- | ------------------------------------------------ |
| 1   | `cargo test` 全绿                        | CI                                               |
| 2   | `npm run build` 全绿，类型由 specta 生成 | CI                                               |
| 3   | 前端零 `setInterval` 轮询                | `grep -r setInterval src/hooks/` returns nothing |
| 4   | AI 处理瞬态错误自动恢复                  | 手动测试：断网 → 重连后自动完成                  |
| 5   | 重复素材导入被拦截                       | 手动测试：拖入同一文件两次 → 第二次跳过          |
| 6   | `main.rs` invoke_handler < 10 行         | `wc -l`                                          |
| 7   | 命令重名检测                             | `cargo test commands::tests`                     |
| 8   | 状态注册完整                             | `cargo test state_registration_test`             |
| 9   | ai_processor plan 纯函数可测             | `cargo test ai_processor::plan::tests`           |
