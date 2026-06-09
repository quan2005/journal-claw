//! Type contract verification between Rust structs and TypeScript type definitions.
//!
//! These tests ensure that field names used in Rust serialization match the
//! TypeScript interfaces in `src/types.ts`. Run `cargo test type_contract` to
//! catch drift before CI does.

/// Verifies that Rust ProcessingUpdate fields exist in TypeScript.
#[test]
fn verify_processing_update_matches_typescript() {
    let ts_source =
        std::fs::read_to_string("../src/types.ts").expect("Cannot read src/types.ts");

    let required_fields = ["material_path", "status", "error", "structured_error"];
    for field in &required_fields {
        assert!(
            ts_source.contains(field),
            "TypeScript types.ts missing field '{}' that exists in Rust ProcessingUpdate",
            field
        );
    }
}

/// Verifies that Rust AiProcessingError fields exist in TypeScript.
#[test]
fn verify_ai_processing_error_matches_typescript() {
    let ts_source =
        std::fs::read_to_string("../src/types.ts").expect("Cannot read src/types.ts");

    let required_fields = ["code", "message", "retryable", "user_action", "attempt"];
    for field in &required_fields {
        assert!(
            ts_source.contains(field),
            "TypeScript types.ts missing field '{}' that exists in Rust AiProcessingError",
            field
        );
    }
}

/// Verifies that Rust DomainEvent fields exist in TypeScript.
#[test]
fn verify_domain_event_matches_typescript() {
    let ts_source =
        std::fs::read_to_string("../src/types.ts").expect("Cannot read src/types.ts");

    let required_fields = ["seq", "timestamp_ms", "kind", "payload"];
    for field in &required_fields {
        assert!(
            ts_source.contains(field),
            "TypeScript types.ts missing field '{}' that exists in Rust DomainEvent",
            field
        );
    }
}

/// Verifies that Rust EventKind variants (serialized as kebab-case) exist in TypeScript.
#[test]
fn verify_event_kind_variants_in_typescript() {
    let ts_source =
        std::fs::read_to_string("../src/types.ts").expect("Cannot read src/types.ts");

    // EventKind uses #[serde(rename_all = "kebab-case")]
    let event_kinds = [
        "journal-updated",
        "todos-updated",
        "identity-updated",
        "speakers-updated",
        "ai-processing",
        "recording-processed",
    ];
    for kind in &event_kinds {
        assert!(
            ts_source.contains(kind),
            "TypeScript types.ts missing EventKind variant '{}' that exists in Rust",
            kind
        );
    }
}

/// Verifies that all Rust AiErrorCode variants (serialized as snake_case) exist in TypeScript.
#[test]
fn verify_error_codes_in_typescript() {
    let ts_source =
        std::fs::read_to_string("../src/types.ts").expect("Cannot read src/types.ts");

    // AiErrorCode uses #[serde(rename_all = "snake_case")]
    let error_codes = [
        "rate_limited",
        "auth_failed",
        "network_timeout",
        "model_unavailable",
        "quota_exhausted",
        "transcription_failed",
        "invalid_material",
        "llm_error",
        "internal_error",
    ];
    for code in &error_codes {
        assert!(
            ts_source.contains(code),
            "TypeScript types.ts missing error code '{}' that exists in Rust AiErrorCode",
            code
        );
    }
}

/// Verifies that Rust JournalEntry fields exist in TypeScript.
#[test]
fn verify_journal_entry_matches_typescript() {
    let ts_source =
        std::fs::read_to_string("../src/types.ts").expect("Cannot read src/types.ts");

    let required_fields = [
        "filename",
        "path",
        "title",
        "summary",
        "tags",
        "sources",
        "year_month",
        "day",
        "created_time",
        "created_at_secs",
        "mtime_secs",
        "materials",
    ];
    for field in &required_fields {
        assert!(
            ts_source.contains(field),
            "TypeScript types.ts missing field '{}' that exists in Rust JournalEntry",
            field
        );
    }
}

/// Verifies that Rust IdentityEntry fields exist in TypeScript.
#[test]
fn verify_identity_entry_matches_typescript() {
    let ts_source =
        std::fs::read_to_string("../src/types.ts").expect("Cannot read src/types.ts");

    let required_fields = [
        "filename",
        "path",
        "name",
        "region",
        "summary",
        "tags",
        "speaker_id",
        "mtime_secs",
    ];
    for field in &required_fields {
        assert!(
            ts_source.contains(field),
            "TypeScript types.ts missing field '{}' that exists in Rust IdentityEntry",
            field
        );
    }
}

/// Verifies that Rust TodoItem fields exist in TypeScript.
#[test]
fn verify_todo_item_matches_typescript() {
    let ts_source =
        std::fs::read_to_string("../src/types.ts").expect("Cannot read src/types.ts");

    let required_fields = [
        "text",
        "done",
        "due",
        "done_date",
        "source",
        "session_id",
        "line_index",
        "done_file",
    ];
    for field in &required_fields {
        assert!(
            ts_source.contains(field),
            "TypeScript types.ts missing field '{}' that exists in Rust TodoItem",
            field
        );
    }
}
